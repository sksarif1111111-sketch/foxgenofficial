import { db, getSettings } from "@/lib/hub.server";
import { deliverySlaMinutes } from "@/lib/shop-fulfillment";
import { crmOrderRecord } from "@/lib/shop-crm.payload";

export async function crmSyncStatus() {
  const [last, pending, stuck] = await Promise.all([
    db.from("shop_crm_outbox").select("sent_at").not("sent_at", "is", null).order("sent_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("shop_crm_outbox").select("id", { head: true, count: "exact" }).is("sent_at", null),
    db.from("shop_crm_outbox").select("id", { head: true, count: "exact" }).is("sent_at", null).gte("attempts", 5),
  ]);
  if (last.error || pending.error || stuck.error) throw new Error("Could not read CRM sync status.");
  return { configured: Boolean(process.env["FOXGEN_CRM_API_KEY"]), lastSuccess: last.data?.sent_at ?? null, pending: pending.count ?? 0, stuck: stuck.count ?? 0 };
}

export async function flushCrmOutbox() {
  const key = process.env["FOXGEN_CRM_API_KEY"];
  if (!key) return { ok: false, error: "CRM_NOT_CONFIGURED" };
  const token = crypto.randomUUID();
  const { data: rows, error } = await db.rpc("shop_claim_crm_outbox", { _token: token });
  if (error) throw new Error("Could not claim CRM queue.");
  if (!rows?.length) return { ok: true, sent: 0 };
  const ids = [...new Set(rows.map(r => r.order_id))];
  const results = await Promise.all([
    db.from("shop_orders").select("*").in("id", ids),
    db.from("shop_order_items").select("*").in("order_id", ids),
    db.from("shop_fulfillments").select("order_id").in("order_id", ids), getSettings(),
  ]);
  const [orders, items, materials, settings] = results;
  const fail = async (message: string, rowIds: string[]) => {
    const result = await db.from("shop_crm_outbox").update({ last_error: message, locked_until: null, claim_token: null }).in("id", rowIds).eq("claim_token", token);
    if (result.error) throw new Error("Could not record CRM retry.");
  };
  if (orders.error || items.error || materials.error) { await fail("Could not read order data.", rows.map(r => r.id)); return { ok: false }; }
  const sla = deliverySlaMinutes(settings["shop_delivery_sla_minutes"]);
  const records = (orders.data ?? []).map(o => crmOrderRecord(o, (items.data ?? []).filter(i => i.order_id === o.id), (materials.data ?? []).some(m => m.order_id === o.id), sla));
  const body = JSON.stringify({ records });
  if (new TextEncoder().encode(body).length > 256 * 1024) {
    await fail("CRM batch exceeds 256 KB. Reduce oversized order data.", rows.map(r => r.id)); return { ok: false, error: "BATCH_TOO_LARGE" };
  }
  try {
    const response = await fetch("https://foxgencrm.lovable.app/api/public/store/sync", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(20000) });
    if (!response.ok) {
      // Do not persist provider bodies: these may contain customer data or credentials.
      await fail(`CRM returned HTTP ${response.status}.`, rows.map(r => r.id)); return { ok: false };
    }
    const result = await response.json() as { ok?: boolean };
    if (result.ok !== true) { await fail("CRM did not acknowledge the batch.", rows.map(r => r.id)); return { ok: false }; }
    const saved = await db.from("shop_crm_outbox").update({ sent_at: new Date().toISOString(), last_error: null, locked_until: null, claim_token: null }).in("id", rows.map(r => r.id)).eq("claim_token", token);
    if (saved.error) throw new Error("Could not record CRM acknowledgement.");
    return { ok: true, sent: rows.length };
  } catch { await fail("CRM connection failed; queued for retry.", rows.map(r => r.id)); return { ok: false }; }
}