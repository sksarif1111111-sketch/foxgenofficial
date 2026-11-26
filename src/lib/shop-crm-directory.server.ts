import { db } from "./hub.server";
export async function flushCrmDirectory(key: string) {
  const token = crypto.randomUUID();
  const claimed = await db.rpc("shop_claim_crm_entities", { _token: token });
  if (claimed.error) throw new Error("Could not claim member feed");
  const rows = claimed.data ?? [];
  if (!rows.length) return { ok: true, sent: 0 };
  // Last version for each entity in this claim wins; all acknowledged versions are durable.
  const records = new Map<string, unknown>();
  for (const row of [...rows].sort((a,b) => a.created_at.localeCompare(b.created_at))) records.set(`${row.entity}:${row.external_id}`, row.payload);
  const body = JSON.stringify({ records: [...records.values()] });
  let error: string | null = null;
  try {
    if (new TextEncoder().encode(body).length > 256 * 1024) throw new Error("Payload too large");
    const { crmSyncUrl } = await import("./shop-crm.server");
    const response = await fetch(await crmSyncUrl(), { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(20000) });
    if (!response.ok || (await response.json() as { ok?: boolean }).ok !== true) error = `CRM did not acknowledge member feed (HTTP ${response.status}).`;
  } catch { error = "Member feed failed; queued for retry."; }
  const saved = await db.from("shop_crm_entity_outbox").update({ sent_at: error ? null : new Date().toISOString(), last_error: error, locked_until: null, claim_token: null }).in("id", rows.map(r => r.id)).eq("claim_token", token);
  if (saved.error) throw new Error("Could not save feed acknowledgement");
  return { ok: error === null, sent: error ? 0 : rows.length };
}