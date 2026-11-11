export const runningDeliveryStatuses = ["payment_confirmed", "awaiting_fulfillment"];

export function deliverySlaMinutes(raw?: string | number) {
  const n = Number(raw ?? 30);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export function needsDeliveryEmail(order: { channel: string; telegram_user_id?: number | null }, required: boolean) {
  return order.channel === "telegram" || order.telegram_user_id != null ? required : true;
}

export function deliveryClock(order: { status: string; confirmed_at?: string | null; delivered_at?: string | null }, minutes = 30, now = Date.now()) {
  const start = Date.parse(order.confirmed_at ?? "");
  if (!Number.isFinite(start)) return null;
  const window = minutes * 60000;
  if (order.status === "delivered") {
    const end = Date.parse(order.delivered_at ?? "");
    if (!Number.isFinite(end)) return null;
    const elapsed = Math.max(0, end - start);
    return { label: `Delivered in ${Math.ceil(elapsed / 60000)} min`, tone: elapsed <= window ? "success" : "warning", overdue: false };
  }
  if (!runningDeliveryStatuses.includes(order.status)) return null;
  const left = start + window - now;
  return { label: left > 0 ? `${Math.ceil(left / 60000)} min left` : `${Math.floor(-left / 60000)} min overdue`, tone: left <= 0 ? "destructive" : left > window / 2 ? "success" : "warning", overdue: left <= 0 };
}

export function telegramDeliveryText(product: string, material: string[], number: string, support: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<b>Your order is ready</b>\n${esc(product)}\n\n${material.map(esc).join("\n\n")}\n\nOrder: ${esc(number)}\nSupport: ${esc(support)}`;
}