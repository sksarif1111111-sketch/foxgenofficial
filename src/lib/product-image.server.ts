import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MODEL = "@cf/black-forest-labs/flux-1-schnell";

/** Generates a product picture with Cloudflare Workers AI and stores it in the private media bucket. */
export async function generateProductImage(name: string, description?: string | null): Promise<string> {
  const token = process.env["CL_CLOUDFLARE_API_TOKEN"];
  const account = process.env["CLOUDFLARE_ACCOUNT_ID"];
  if (!token || !account) throw new Error("Cloudflare picture service is not set up yet.");
  const prompt = `Premium e-commerce product thumbnail for a digital subscription called "${name}". ${(description ?? "").slice(0, 300)} Clean blue and white studio lighting, abstract glossy technology objects, modern minimal composition. No text, no brand logos, no trademarks, no prices.`;
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${MODEL}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, steps: 4 }),
  });
  if (res.status === 429) throw new Error("Today's free Cloudflare picture limit is used up. Try again tomorrow.");
  const json = (await res.json().catch(() => null)) as { success?: boolean; result?: { image?: string }; errors?: Array<{ message?: string }> } | null;
  const encoded = json?.result?.image;
  if (!res.ok || !encoded) {
    const msg = json?.errors?.[0]?.message ?? `status ${res.status}`;
    console.error("Cloudflare image failed:", msg);
    if (/limit|quota|neuron/i.test(msg)) throw new Error("Today's free Cloudflare picture limit is used up. Try again tomorrow.");
    throw new Error("Picture service is unavailable right now. Upload an image instead.");
  }
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const key = `products/${crypto.randomUUID()}.jpg`;
  const up = await supabaseAdmin.storage.from("store-media").upload(key, bytes, { contentType: "image/jpeg" });
  if (up.error) throw new Error("Could not save the generated picture.");
  return `/api/public/media/${key}`;
}

/** Fills pictures for products that have none and were never tried. Never throws. */
export async function autoFillProductImages(limit = 4, onlyId?: string) {
  let q = supabaseAdmin.from("products").select("id,name,short_description").is("image_url", null).is("image_auto_attempted_at", null).neq("status", "archived").eq("supplier_removed", false).limit(limit);
  if (onlyId) q = q.eq("id", onlyId);
  const { data } = await q;
  let made = 0;
  for (const p of data ?? []) {
    await supabaseAdmin.from("products").update({ image_auto_attempted_at: new Date().toISOString() }).eq("id", p.id);
    try {
      const url = await generateProductImage(p.name, p.short_description);
      await supabaseAdmin.from("products").update({ image_url: url }).eq("id", p.id).is("image_url", null);
      made++;
    } catch (e) {
      console.error("Auto picture failed", p.id, e instanceof Error ? e.message : e);
      if (e instanceof Error && /not set up|limit/.test(e.message)) {
        await supabaseAdmin.from("products").update({ image_auto_attempted_at: null }).eq("id", p.id);
        break;
      }
    }
  }
  return { made };
}
