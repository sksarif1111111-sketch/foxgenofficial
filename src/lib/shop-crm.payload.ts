type Row = Record<string, unknown>;
export type CrmSnapshot = { order: Row; items: Row[]; has_fulfillment: boolean };
export function crmCustomerRecord(order: Row, now: string) {
  const id = order["customer_external_id"];
  if (typeof id !== "string" || !id) return null;
  const emails = order["delivery_emails"];
  const email = typeof emails === "string" ? emails.split(",")[0]?.trim().toLowerCase() || null : null;
  return {
    entity: "customers", external_id: id, name: order["customer_name"] ?? "",
    status: "", amount: null, currency: null, updated_at: now,
    data: { email, telegram_user_id: order["telegram_user_id"] ?? null,
      telegram_username: order["telegram_username"] ?? null,
      first_seen_at: order["customer_first_seen_at"] ?? order["created_at"] ?? null },
  };
}
export function crmSyncRecords(snapshots: CrmSnapshot[], sla: number, now: string) {
  const customers = new Map<string, NonNullable<ReturnType<typeof crmCustomerRecord>>>();
  for (const snapshot of snapshots) {
    const customer = crmCustomerRecord(snapshot.order, now);
    if (customer) customers.set(customer.external_id, customer);
  }
  return [...customers.values(), ...snapshots.map(s => crmOrderRecord(s.order, s.items, s.has_fulfillment, sla))];
}
export function crmOrderRecord(order: Row, items: Row[], hasFulfillment: boolean, sla: number) {
  const stars = order["currency"] === "XTR";
  const equivalent = items.reduce((sum, i) => {
    const snapshot = i["snapshot"] as Row | null;
    return sum + Number(snapshot?.["price_usdt"] ?? 0) * Number(i["quantity"] ?? 1);
  }, 0);
  return {
    entity: "orders", external_id: String(order["id"]),
    name: `${items.map(i => `${i["product_name"]} x${i["quantity"]}`).join(", ")} — ${order["order_number"]}`,
    status: order["status"], amount: stars ? equivalent : Number(order["total"] ?? 0), currency: stars ? "USDT" : order["currency"], updated_at: order["updated_at"],
    data: {
      customer_external_id: order["customer_external_id"] ?? null,
      order_number: order["order_number"], channel: order["channel"] === "telegram" || order["telegram_user_id"] != null ? "telegram" : "website",
      customer_name: order["customer_name"], delivery_emails: order["delivery_emails"], telegram_user_id: order["telegram_user_id"],
      payment_method_name: order["payment_method_name"], payment_reference: order["payment_reference"], has_payment_proof: order["has_payment_proof"] === true, proof_submitted_at: order["has_payment_proof"] === true ? order["proof_submitted_at"] ?? null : null, confirmed_at: order["confirmed_at"], delivered_at: order["delivered_at"],
      shop_delivery_sla_minutes: sla, items: items.map(i => ({ product_name: i["product_name"], quantity: i["quantity"] })), has_fulfillment: hasFulfillment,
      original_currency: order["currency"], original_stars_amount: order["stars_total"],
    },
  };
}