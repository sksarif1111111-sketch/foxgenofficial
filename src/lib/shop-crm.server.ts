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
  const settings = await getSettings();
  const fail = async (message: string, rowIds: string[]) => {
    const result = await db.from("shop_crm_outbox").update({ last_error: message, locked_until: null, claim_token: null }).in("id", rowIds).eq("claim_token", token);
    if (result.error) throw new Error("Could not record CRM retry.");
  };
  const sla = deliverySlaMinutes(settings["shop_delivery_sla_minutes"]);
  let sent = 0;
  // One version per request preserves every transition and bounds large batches.
  for (const row of rows) {
  const snapshot = row.payload as { order: Record<string, unknown>; items: Record<string, unknown>[]; has_fulfillment: boolean };
  const body = JSON.stringify({ records: [crmOrderRecord(snapshot.order, snapshot.items, snapshot.has_fulfillment, sla)] });
  if (new TextEncoder().encode(body).length > 256 * 1024) { await fail("Order exceeds CRM's 256 KB limit.", [row.id]); continue; }
  try {
    const response = await fetch("https://foxgencrm.lovable.app/api/public/store/sync", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(20000) });
    if (!response.ok) {
      // Do not persist provider bodies: these may contain customer data or credentials.
      await fail(`CRM returned HTTP ${response.status}.`, [row.id]); continue;
    }
    const result = await response.json() as { ok?: boolean };
    if (result.ok !== true) { await fail("CRM did not acknowledge the batch.", [row.id]); continue; }
    const saved = await db.from("shop_crm_outbox").update({ sent_at: new Date().toISOString(), last_error: null, locked_until: null, claim_token: null }).eq("id", row.id).eq("claim_token", token);
    if (saved.error) throw new Error("Could not record CRM acknowledgement.");
    sent++;
  } catch { await fail("CRM connection failed; queued for retry.", [row.id]); }
  }
  await db.rpc("shop_pause_crm_when_drained");
  return { ok: sent === rows.length, sent };
}