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

    // Publish every reseller product to the live store (website + Telegram bot).
    // Store USDT price follows the admin's CRM selling price; Stars price, emoji,
    // images and other store edits are never overwritten.
    const { data: crmRows, error: crmErr } = await sb
      .from("crm_products")
      .select("reseller_product_id, default_sale_price")
      .not("reseller_product_id", "is", null);
    if (crmErr) throw new Error(crmErr.message);
    const sellPrice = new Map(
      (crmRows ?? []).map((r) => [r.reseller_product_id as string, Number(r.default_sale_price)]),
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: storeRows, error: storeErr } = await supabaseAdmin
      .from("products")
      .select("id, reseller_product_id")
      .not("reseller_product_id", "is", null);
    if (storeErr) throw new Error(storeErr.message);
    const inStore = new Map((storeRows ?? []).map((r) => [r.reseller_product_id as string, r.id]));
    const seen = new Set<string>();
    let storeAdded = 0;
    let storeUpdated = 0;
    for (const p of list) {
      if (!p?.id || !p.name) continue;
      seen.add(p.id);
      const stock = Number.isFinite(Number(p.stock)) ? Math.max(0, Math.floor(Number(p.stock))) : null;
      const price = sellPrice.get(p.id) ?? Math.max(0, Number(p.wholesale_price) || 0);
      const refresh = {
        name: String(p.name).slice(0, 200),
        price_usdt: price,
        price: price,
        currency: "USD",
        is_free: false,
        stock_mode: stock === null ? "manual" : "tracked",
        stock_quantity: stock,
        availability: stock === 0 ? "out_of_stock" : "in_stock",
        updated_at: now,
      };
      const storeId = inStore.get(p.id);
      if (storeId) {
        const { error: e } = await supabaseAdmin.from("products").update(refresh).eq("id", storeId);
        if (e) throw new Error(e.message);
        storeUpdated++;
      } else {
        const { error: e } = await supabaseAdmin.from("products").insert({
          ...refresh,
          reseller_product_id: p.id,
          description: plainText(p.description),
          short_description: plainText(p.description, 160),
          installation_instructions: plainText(p.delivery_instruction),
          product_type: "digital_product",
          delivery_method: "email_manual",
          max_per_order: 5,
          status: "active",
          shop_published: true,
          shop_order: 100 + storeAdded,
        });
        if (e) throw new Error(e.message);
        storeAdded++;
      }
    }
    // Products the reseller no longer lists go out of stock (kept for order history).
    for (const [rid, storeId] of inStore) {
      if (seen.has(rid)) continue;
      await supabaseAdmin.from("products").update({ availability: "out_of_stock", updated_at: now }).eq("id", storeId);
    }

    return { added, updated, total: list.length, storeAdded, storeUpdated };
  });
