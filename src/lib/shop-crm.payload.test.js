import { test, expect } from "bun:test";
import { crmSyncRecords, crmOrderRecord } from "./shop-crm.payload";
const id = "b1111111-1111-4111-8111-111111111111";
const now = "2026-11-11T02:00:00Z";
const first = "2026-11-01T00:00:00Z";
const snapshot = (order) => ({ order, items: [{ product_name: "Tool", quantity: 2 }], has_fulfillment: false });
test("one customer per distinct buyer in a batch, each order links to that same UUID", () => {
  const records = crmSyncRecords([snapshot({ id: "order-1", customer_external_id: id }), snapshot({ id: "order-2", customer_external_id: id })], 30, now);
  expect(records.filter(r => r.entity === "customers")).toHaveLength(1);
  expect(records.filter(r => r.entity === "orders").map(r => r.data.customer_external_id)).toEqual([id, id]);
});
test("customer upsert carries normalized email, Telegram details and real first-seen time", () => {
  const [customer] = crmSyncRecords([snapshot({ customer_external_id: id, customer_name: "Buyer", delivery_emails: " Buyer@Example.com , second@example.com", telegram_user_id: 123, telegram_username: "buyer", customer_first_seen_at: first })], 30, now);
  expect(customer).toEqual({ entity: "customers", external_id: id, name: "Buyer", status: "", amount: null, currency: null, updated_at: now, data: { email: "buyer@example.com", telegram_user_id: 123, telegram_username: "buyer", first_seen_at: first } });
});
test("repeat sends keep identity while reflecting updated contact info and leaving FG order number untouched", () => {
  const records = crmSyncRecords([snapshot({ id: "order-1", order_number: "FG-123456", customer_external_id: id, delivery_emails: "new@example.com" })], 30, now);
  expect(records[0].external_id).toBe(id);
  expect(records[0].data.email).toBe("new@example.com");
  expect(records[1].external_id).toBe("order-1");
  expect(records[1].data.order_number).toBe("FG-123456");
});
test("unknown buyers stay unlinked without fake customer profiles", () => {
  const records = crmSyncRecords([snapshot({ id: "unknown" })], 30, now);
  expect(records).toHaveLength(1);
  expect(records[0].entity).toBe("orders");
  expect(records[0].data.customer_external_id).toBeNull();
});
test("order payload flags payment proof without leaking its location", () => {
  const order = { id: "o1", order_number: "N1", status: "under_review", currency: "INR", total: 10, payment_reference: "UTR123456", has_payment_proof: true, proof_submitted_at: "2026-11-25T01:00:00Z", payment_evidence_url: "storage:orders/x/y.jpg" };
  const rec = crmOrderRecord(order, [], false, 30);
  expect(rec.data.has_payment_proof).toBe(true);
  expect(rec.data.proof_submitted_at).toBe("2026-11-25T01:00:00Z");
  expect(rec.data.payment_reference).toBe("UTR123456");
  expect(rec.status).toBe("under_review");
  expect(JSON.stringify(rec)).not.toContain("storage:");
  expect(crmOrderRecord({ ...order, has_payment_proof: false }, [], false, 30).data.proof_submitted_at).toBe(null);
});
