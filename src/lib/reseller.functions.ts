import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RESELLER_URL = "https://eygkdpfjrjwwbiackfpr.supabase.co/functions/v1/reseller-api";

type ResellerProduct = {
  id: string;
  name: string;
  wholesale_price: number;
  currency?: string;
  stock?: number;
  description?: string;
  delivery_instruction?: string;
};

/** Reseller descriptions use Telegram HTML; the store shows plain text. */
export function plainText(html: unknown, max = 2000): string | null {
  if (typeof html !== "string") return null;
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text ? text.slice(0, max) : null;
}

async function callReseller(action: string) {
  const key = process.env["RESELLER_API_KEY"];
  if (!key) throw new Error("Reseller API key is not configured.");
  const res = await fetch(`${RESELLER_URL}?action=${encodeURIComponent(action)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !json || json.ok === false) {
    console.error("reseller api error", action, res.status, json);
    throw new Error("Could not reach the reseller service. Try again.");
  }
  return json;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_admin", { _user_id: userId });
  if (error || !data) throw new Error("Admins only.");
}

export const resellerBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const json = await callReseller("balance");
    const r = (json.reseller ?? {}) as { name?: string; balance?: number };
    return { name: String(r.name ?? ""), balance: Number(r.balance ?? 0) };
  });

export const resellerSyncProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const json = await callReseller("products");
    const list = (Array.isArray(json.products) ? json.products : []) as ResellerProduct[];
    const sb = context.supabase;
    const { data: existing, error } = await sb
      .from("crm_products")
      .select("id, reseller_product_id")
      .not("reseller_product_id", "is", null);
    if (error) throw new Error(error.message);
    const known = new Map((existing ?? []).map((r) => [r.reseller_product_id as string, r.id]));
    const now = new Date().toISOString();
    let added = 0;
    let updated = 0;
    for (const p of list) {
      if (!p?.id || !p.name) continue;
      const wholesale = Math.max(0, Number(p.wholesale_price) || 0);
      const common = {
        name: String(p.name).slice(0, 200),
        wholesale_price: wholesale,
        default_cost_price: wholesale,
        reseller_currency: String(p.currency ?? "USDT").slice(0, 10),
        reseller_stock: Number.isFinite(Number(p.stock)) ? Number(p.stock) : null,
        last_synced_at: now,
      };
      const id = known.get(p.id);
      if (id) {
        // Keep the admin's own selling price; only refresh wholesale data.
        const { error: e } = await sb.from("crm_products").update(common).eq("id", id);
        if (e) throw new Error(e.message);
        updated++;
      } else {
        const { error: e } = await sb.from("crm_products").insert({
          ...common,
          reseller_product_id: p.id,
          default_sale_price: wholesale,
          currency: "USD",
          active: true,
        });
        if (e) throw new Error(e.message);
        added++;
      }
    }
    return { added, updated, total: list.length };
  });
