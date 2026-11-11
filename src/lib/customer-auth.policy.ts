export function safeCustomerRedirect(value: unknown) {
  if (typeof value !== "string" || !/^\/(shop|account)([/?#]|$)/.test(value) || /[\\\r\n]/.test(value)) return "/account";
  return value;
}
export function ownsWebsiteOrder(order: { customer_user_id?: string | null; channel: string }, userId: string) {
  return order.channel === "website" && order.customer_user_id === userId;
}