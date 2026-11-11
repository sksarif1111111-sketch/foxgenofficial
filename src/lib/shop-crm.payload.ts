type Row = Record<string, unknown>;
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
      order_number: order["order_number"], channel: order["channel"] === "telegram" || order["telegram_user_id"] != null ? "telegram" : "website",
      customer_name: order["customer_name"], delivery_emails: order["delivery_emails"], telegram_user_id: order["telegram_user_id"],
      payment_method_name: order["payment_method_name"], payment_reference: order["payment_reference"], confirmed_at: order["confirmed_at"], delivered_at: order["delivered_at"],
      shop_delivery_sla_minutes: sla, items: items.map(i => ({ product_name: i["product_name"], quantity: i["quantity"] })), has_fulfillment: hasFulfillment,
      original_currency: order["currency"], original_stars_amount: order["stars_total"],
    },
  };
}