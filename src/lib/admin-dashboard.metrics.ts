export const PAID_SHOP_STATUSES = ["awaiting_email", "awaiting_fulfillment", "completed", "delivered"];
export type MoneyRow = { currency: string; total?: number; cost?: number; amount?: number; fee?: number };
export function financialTotals(orders: MoneyRow[], expenses: MoneyRow[], payments: MoneyRow[], refunds: MoneyRow[]) {
  const currencies = [...new Set([...orders, ...expenses, ...payments, ...refunds].map(r => r.currency.trim().toUpperCase()))].sort();
  return currencies.map(currency => {
    const sum = (rows: MoneyRow[], key: keyof MoneyRow) => rows.filter(r => r.currency.trim().toUpperCase() === currency).reduce((n, r) => n + Number(r[key] ?? 0), 0);
    const sales = sum(orders, "total"), cost = sum(orders, "cost"), spending = sum(expenses, "amount"), fees = sum(payments, "fee"), refunded = sum(refunds, "amount");
    return { currency, sales, cost, expenses: spending, fees, refunds: refunded, net: sales - cost - spending - fees - refunded };
  });
}
export function kolkataPeriods(now = new Date()) {
  const offset = 330 * 60_000;
  const local = new Date(now.getTime() + offset);
  const day = local.toISOString().slice(0, 10);
  const month = `${day.slice(0, 7)}-01`;
  return { day, month, todayStart: new Date(Date.parse(`${day}T00:00:00Z`) - offset).toISOString(), monthStart: new Date(Date.parse(`${month}T00:00:00Z`) - offset).toISOString(), end: now.toISOString() };
}