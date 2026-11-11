import { db, getSettings } from "@/lib/hub.server";
import { deliverySlaMinutes } from "@/lib/shop-fulfillment";
import { crmSyncRecords, type CrmSnapshot } from "@/lib/shop-crm.payload";

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
  const { flushCrmDirectory } = await import("./shop-crm-directory.server");
  const directory = await flushCrmDirectory(key);
  const { data: rows, error } = await db.rpc("shop_claim_crm_outbox", { _token: token });
  if (error) throw new Error("Could not claim CRM queue.");
  if (!rows?.length) { await db.rpc("shop_pause_crm_when_drained"); return directory; }
  const settings = await getSettings();
  const fail = async (message: string, rowIds: string[]) => {
    const result = await db.from("shop_crm_outbox").update({ last_error: message, locked_until: null, claim_token: null }).in("id", rowIds).eq("claim_token", token);
    if (result.error) throw new Error("Could not record CRM retry.");
  };
  const sla = deliverySlaMinutes(settings["shop_delivery_sla_minutes"]);
  // Older snapshots intentionally preserve historic status/material; only enrich the stable buyer link.
  const identities = await db.from("shop_orders").select("id,customer_external_id,customer_first_seen_at,created_at").in("id", rows.map(r => r.order_id));
  if (identities.error) {
    await fail("Could not read CRM customer identities.", rows.map(r => r.id));
    return { ok: false, sent: 0 };
  }
  const identityByOrder = new Map(identities.data.map(o => [o.id, o]));
  const { data: directoryRecords } = await db.from("shop_crm_entity_outbox").select("external_id,payload").eq("entity","customers").in("external_id", identities.data.map(o => o.customer_external_id).filter((id): id is string => id !== null)).order("created_at", { ascending: false }).limit(1000);
  const directoryById = new Map<string, Record<string, unknown>>();
  for (const r of directoryRecords ?? []) if (!directoryById.has(r.external_id)) directoryById.set(r.external_id, r.payload as Record<string, unknown>);
  let sent = 0;
  // One version per request preserves every transition and bounds large batches.
  for (const row of [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))) {
  const snapshot = row.payload as CrmSnapshot;
  const identity = identityByOrder.get(row.order_id);
  const enriched = { ...snapshot, order: { ...snapshot.order,
    customer_external_id: identity?.customer_external_id ?? snapshot.order["customer_external_id"],
    customer_first_seen_at: identity?.customer_first_seen_at ?? snapshot.order["customer_first_seen_at"],
    created_at: identity?.created_at ?? snapshot.order["created_at"],
  } };
  const records = crmSyncRecords([enriched], sla, new Date().toISOString()).map(r => {
    if (r.entity !== "customers") return r;
    const member = directoryById.get(r.external_id);
    return member ? { ...member, updated_at: r.updated_at } : r;
  });
  const body = JSON.stringify({ records });
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
  return { ok: sent === rows.length && directory.ok, sent: sent + directory.sent };
}