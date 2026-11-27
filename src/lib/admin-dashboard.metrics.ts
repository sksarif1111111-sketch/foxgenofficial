export const PAID_SHOP_STATUSES = ["payment_confirmed", "awaiting_email", "awaiting_fulfillment", "completed", "delivered"];
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

type OperationalOrder = { status: string; currency: string; total: number | null; stars_total: number | null; created_at: string; confirmed_at: string | null; delivered_at: string | null };
export function operationalMetrics(orders: OperationalOrder[], wallet: Array<{amount_usd: number; created_at: string}>, now = new Date()) {
  const periods = kolkataPeriods(now);
  const local = new Date(now.getTime() + 330 * 60000);
  const monday = Date.parse(periods.todayStart) - ((local.getUTCDay() + 6) % 7) * 86400000;
  const window = (start: number, end: number) => {
    const inWindow = (value: string | null) => !!value && Date.parse(value) >= start && Date.parse(value) < end;
    const revenue = new Map<string, number>();
    for (const o of orders) if (inWindow(o.confirmed_at) && PAID_SHOP_STATUSES.includes(o.status)) {
      revenue.set(o.currency, (revenue.get(o.currency)??0) + Number(o.currency === 'XTR' ? o.stars_total??0 : o.total??0));
    }
    return { orders: orders.filter(o=>inWindow(o.created_at)).length, delivered: orders.filter(o=>inWindow(o.delivered_at)).length, revenue: [...revenue].map(([currency,total])=>({currency,total})) };
  };
  return {
    today: window(Date.parse(periods.todayStart), now.getTime()+1),
    thisWeek: window(monday, now.getTime()+1), lastWeek: window(monday-7*86400000,monday),
    overdue: orders.filter(o=>['payment_confirmed','awaiting_fulfillment'].includes(o.status) && o.confirmed_at && Date.parse(o.confirmed_at)+30*60000<=now.getTime()).length,
    walletChange: wallet.filter(t=>Date.parse(t.created_at)>=Date.parse(periods.todayStart)).reduce((n,t)=>n+Number(t.amount_usd),0),
  };
}
export function percentageChange(current: number, previous: number): number | null {
  return previous === 0 ? (current === 0 ? 0 : null) : Math.round((current-previous)/previous*100);
}