export const STUDENT_VOUCHER_CODE = "FOXGENSTUDENT10";
type AccountOrder = { channel: string; customer_user_id: string | null; status: string; currency: string; total: number | null };
export function accountOrderSummary(orders: AccountOrder[], userId: string) {
  const own = orders.filter(o => o.channel === "website" && o.customer_user_id === userId);
  const paid = own.filter(o => ["payment_confirmed", "awaiting_fulfillment", "delivered"].includes(o.status));
  const totals: Record<string, number> = {};
  for (const order of paid) totals[order.currency] = (totals[order.currency] ?? 0) + Number(order.total);
  return { orderCount: own.length, paidCount: paid.length, deliveredCount: own.filter(o => o.status === "delivered").length,
    spending: Object.entries(totals).sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 })) };
}
export function studentVoucher(isStudent: boolean) { return isStudent ? STUDENT_VOUCHER_CODE : null; }