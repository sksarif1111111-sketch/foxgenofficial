/**
 * Supplier (reseller API) adapters and the shared catalogue sync.
 * Each provider has its own adapter because their response shapes differ.
 * Credentials are read from server secrets only and never returned to the browser.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { supplierOf, supplierEnabled } from "./supplier-policy";
import { supplierFailure } from "./supplier-errors";
export { supplierOf } from "./supplier-policy";

export type SupplierId = "reseller" | "digihup";

export const SUPPLIERS: Array<{ id: SupplierId; name: string; secret: string; capabilities: string[] }> = [
  { id: "reseller", name: "Reseller API (original supplier)", secret: "RESELLER_API_KEY", capabilities: ["Products", "Wholesale price", "Stock", "Balance"] },
  { id: "digihup", name: "DIGIHUP", secret: "DIGIHUP_API_KEY", capabilities: ["Products", "Wholesale price", "Stock", "Instructions"] },
];

type SupplierProduct = {
  id: string;
  name: string;
  wholesale_price: number;
  currency?: string;
  stock?: number;
  description?: string;
  delivery_instruction?: string;
  emoji?: string;
};

const RESELLER_URL = "https://eygkdpfjrjwwbiackfpr.supabase.co/functions/v1/reseller-api";
const DIGIHUP_URL = "https://shorky-new-production.up.railway.app/api/reseller/v1";
/** DIGIHUP ids are namespaced so they never collide with the first supplier's ids. */
export const DIGIHUP_PREFIX = "digihup:";

/** Supplier descriptions use Telegram HTML; the store shows plain text. */
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

async function getJson(url: string, key: string, provider: string) {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20000) });
  } catch (err) {
    const timeout = err instanceof Error && err.name === "TimeoutError";
    throw new Error(timeout ? `${provider} did not respond within 20 seconds.` : `Could not reach ${provider}.`);
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !json || json["ok"] === false) {
    console.error("supplier api error", provider, res.status);
    throw new Error(supplierFailure(res.status, provider, json));
  }
  return json;
}

async function callReseller(action: string) {
  const key = process.env["RESELLER_API_KEY"];
  if (!key) throw new Error("Reseller API key is not configured.");
  return getJson(`${RESELLER_URL}?action=${encodeURIComponent(action)}`, key, "Reseller API");
}

export async function resellerBalance() {
  const json = await callReseller("balance");
  const r = (json["reseller"] ?? {}) as { name?: string; balance?: number };
  return { name: String(r.name ?? ""), balance: Number(r.balance ?? 0) };
}

async function fetchResellerProducts(): Promise<SupplierProduct[]> {
  const json = await callReseller("products");
  const list = Array.isArray(json["products"]) ? (json["products"] as SupplierProduct[]) : [];
  return list.filter((p) => p && typeof p.id === "string" && typeof p.name === "string");
}

type DigihupProduct = {
  id: string;
  name: string;
  description?: string;
  short_description?: string;
  emoji?: string | null;
  price: string;
  currency?: string;
  stock: number | null;
  unlimited_stock?: boolean;
  public_instructions?: string;
};

async function fetchDigihupProducts(maxPages = 20): Promise<SupplierProduct[]> {
  const key = process.env["DIGIHUP_API_KEY"];
  if (!key) throw new Error("DIGIHUP API key is not configured.");
  const out: SupplierProduct[] = [];
  for (let page = 0; page < maxPages; page++) {
    const json = (await getJson(`${DIGIHUP_URL}/products?page=${page}`, key, "DIGIHUP")) as {
      data?: { items?: DigihupProduct[]; has_next?: boolean };
    };
    for (const p of json.data?.items ?? []) {
      if (!p?.id || !p.name) continue;
      out.push({
        id: DIGIHUP_PREFIX + p.id,
        name: p.name,
        wholesale_price: Number(p.price) || 0,
        currency: p.currency ?? "USD",
        stock: p.unlimited_stock ? undefined : (p.stock ?? 0),
        description: p.description || p.short_description,
        delivery_instruction: p.public_instructions,
        emoji: p.emoji ?? undefined,
      });
    }
    if (!json.data?.has_next) break;
  }
  return out;
}

/** Lightweight health check: verifies the key works without changing any data. */
export async function checkSupplier(id: SupplierId): Promise<{ ok: boolean; detail: string }> {
  try {
    if (id === "reseller") {
      const b = await resellerBalance();
      return { ok: true, detail: `Balance ${b.balance.toFixed(2)}${b.name ? ` · ${b.name}` : ""}` };
    }
    const items = await fetchDigihupProducts(1);
    return { ok: true, detail: `${items.length} products on the first page` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "Check failed" };
  }
}

async function recordRun(provider: string, trigger: "manual" | "auto", status: "success" | "partial" | "failed", counts: { total: number; added: number; updated: number }, message: string | null, started: string) {
  await supabaseAdmin.from("integration_sync_runs").insert({
    provider,
    trigger,
    status,
    total: counts.total,
    added: counts.added,
    updated: counts.updated,
    message,
    started_at: started,
    finished_at: new Date().toISOString(),
  });
}

/**
 * Pulls every supplier, refreshes wholesale data on CRM products and publishes/updates
 * live store products by `reseller_product_id`. New products start at the CRM selling price;
 * existing store prices, Stars prices, emoji, images and other store edits are never overwritten.
 * A failing supplier is skipped and its products are left untouched.
 */
export async function syncSuppliers(trigger: "manual" | "auto") {
  const started = new Date().toISOString();
  const { data: settingsRows, error: settingsError } = await supabaseAdmin.from("app_settings").select("key,value").like("key", "supplier_disabled_%");
  if (settingsError) throw new Error("Could not check supplier controls; sync stopped.");
  const settings = Object.fromEntries((settingsRows ?? []).map(r => [r.key, r.value ?? ""]));
  const enabled = SUPPLIERS.filter(s => supplierEnabled(s.id, settings) && Boolean(process.env[s.secret]));
  if (!enabled.length) return { suppliers: [] };
  const results = await Promise.allSettled(enabled.map(s => s.id === "reseller" ? fetchResellerProducts() : fetchDigihupProducts()));
  const bySupplier: Record<SupplierId, { list: SupplierProduct[]; error: string | null }> = {
    reseller: { list: [], error: null },
    digihup: { list: [], error: null },
  };
  enabled.forEach(({ id }, i) => {
    const r = results[i];
    if (!r) return;
    if (r.status === "fulfilled") bySupplier[id].list = r.value;
    else bySupplier[id].error = r.reason instanceof Error ? r.reason.message : "Sync failed";
  });
  const okSuppliers = enabled.map(s => s.id).filter((id) => !bySupplier[id].error);
  if (!okSuppliers.length) {
    for (const { id } of enabled) {
      await recordRun(id, trigger, "failed", { total: 0, added: 0, updated: 0 }, bySupplier[id].error, started);
    }
    throw new Error(enabled.map(s => bySupplier[s.id].error).filter(Boolean).join(" ") + " Previous products and prices were kept; bot menus remain available.");
  }
  const list = okSuppliers.flatMap((id) => bySupplier[id].list);
  const db = supabaseAdmin;
  const now = new Date().toISOString();
  const counts: Record<SupplierId, { total: number; added: number; updated: number }> = {
    reseller: { total: bySupplier.reseller.list.length, added: 0, updated: 0 },
    digihup: { total: bySupplier.digihup.list.length, added: 0, updated: 0 },
  };

  const { data: existing, error } = await db.from("crm_products").select("id, reseller_product_id").not("reseller_product_id", "is", null);
  if (error) throw new Error(error.message);
  const known = new Map((existing ?? []).map((r) => [r.reseller_product_id as string, r.id]));
  const seenIds = new Set<string>();
  for (const p of list) {
    if (seenIds.has(p.id)) continue; // never create duplicates from a repeated API row
    seenIds.add(p.id);
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
      const { error: e } = await db.from("crm_products").update(common).eq("id", id);
      if (e) throw new Error(e.message);
    } else {
      const { error: e } = await db.from("crm_products").insert({ ...common, reseller_product_id: p.id, default_sale_price: wholesale, currency: "USD", active: true });
      if (e) throw new Error(e.message);
    }
  }

  const { data: crmRows, error: crmErr } = await db.from("crm_products").select("reseller_product_id, default_sale_price").not("reseller_product_id", "is", null);
  if (crmErr) throw new Error(crmErr.message);
  const sellPrice = new Map((crmRows ?? []).map((r) => [r.reseller_product_id as string, Number(r.default_sale_price)]));
  const { data: storeRows, error: storeErr } = await db.from("products").select("id, reseller_product_id, supplier_removed").not("reseller_product_id", "is", null);
  if (storeErr) throw new Error(storeErr.message);
  const inStore = new Map((storeRows ?? []).map((r) => [r.reseller_product_id as string, r.id]));
  const removed = new Set((storeRows ?? []).filter(r => r.supplier_removed).map(r => r.reseller_product_id));
  const seen = new Set<string>();
  let order = 0;
  for (const p of list) {
    if (seen.has(p.id) || removed.has(p.id)) continue;
    seen.add(p.id);
    const supplier = supplierOf(p.id);
    if (!supplier) continue;
    const stock = Number.isFinite(Number(p.stock)) ? Math.max(0, Math.floor(Number(p.stock))) : null;
    const price = sellPrice.get(p.id) ?? Math.max(0, Number(p.wholesale_price) || 0);
    // Existing store products keep their selling price (edited in Products); only stock and name refresh.
    const refresh = {
      name: String(p.name).slice(0, 200),
      stock_mode: stock === null ? "manual" : "tracked",
      stock_quantity: stock,
      availability: stock === 0 ? "out_of_stock" : "in_stock",
      updated_at: now,
    };
    const storeId = inStore.get(p.id);
    if (storeId) {
      const { error: e } = await db.from("products").update(refresh).eq("id", storeId);
      if (e) throw new Error(e.message);
      counts[supplier].updated++;
    } else {
      const { error: e } = await db.from("products").insert({
        ...refresh,
        price_usdt: price,
        price_inr: Math.round(price * 10000) / 100,
        price,
        currency: "USD",
        is_free: false,
        reseller_product_id: p.id,
        description: plainText(p.description),
        short_description: plainText(p.description, 160),
        installation_instructions: plainText(p.delivery_instruction),
        emoji: p.emoji ?? null,
        product_type: "digital_product",
        delivery_method: "email_manual",
        max_per_order: 5,
        status: "active",
        shop_published: true,
        shop_order: 100 + order++,
      });
      if (e) throw new Error(e.message);
      counts[supplier].added++;
    }
  }
  // Products a working supplier no longer lists go out of stock (kept for order history).
  for (const [rid, storeId] of inStore) {
    const supplier = supplierOf(rid);
    if (!supplier) continue;
    if (seen.has(rid) || !okSuppliers.includes(supplier)) continue;
    await db.from("products").update({ availability: "out_of_stock", updated_at: now }).eq("id", storeId);
  }

  try { const { autoFillProductImages } = await import("./product-image.server"); await autoFillProductImages(4); } catch { /* pictures are best effort */ }
  for (const { id } of enabled) {
    const err = bySupplier[id].error;
    await recordRun(id, trigger, err ? "failed" : "success", counts[id], err, started);
  }
  return {
    suppliers: enabled.map(s => s.id).map((id) => ({ id, ok: !bySupplier[id].error, error: bySupplier[id].error, ...counts[id] })),
  };
}
