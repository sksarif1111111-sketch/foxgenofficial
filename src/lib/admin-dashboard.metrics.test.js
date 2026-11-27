import { expect, test } from "bun:test";
import { financialTotals, kolkataPeriods, PAID_SHOP_STATUSES, operationalMetrics, percentageChange } from "./admin-dashboard.metrics";
test("Net profit deducts snapshot wholesale costs, expenses, fees and refunds", () => {
  expect(financialTotals([{currency:"USD",total:100,cost:40}], [{currency:"USD",amount:10}], [{currency:"USD",fee:3}], [{currency:"USD",amount:5}])[0].net).toBe(42);
});
test("Different currencies are never added together", () => {
  const totals = financialTotals([{currency:"USD",total:30},{currency:"INR",total:150}],[],[],[]);
  expect(totals.find(r => r.currency === "USD").sales).toBe(30);
  expect(totals.find(r => r.currency === "INR").sales).toBe(150);
});
test("Today and month boundaries use Kolkata time", () => {
  const period = kolkataPeriods(new Date("2026-11-09T22:18:00Z"));
  expect(period.day).toBe("2026-11-10");
  expect(period.todayStart).toBe("2026-11-09T18:30:00.000Z");
  expect(period.monthStart).toBe("2026-10-31T18:30:00.000Z");
});
test("Unconfirmed orders are excluded from paid CRM reconciliation", () => {
  expect(PAID_SHOP_STATUSES.includes("awaiting_payment")).toBe(false);
  expect(PAID_SHOP_STATUSES.includes("delivered")).toBe(true);
  expect(PAID_SHOP_STATUSES.includes("awaiting_fulfillment")).toBe(true);
});
test('daily revenue uses payment confirmation and keeps USD INR XTR separate', () => {
  const rows = ['USD','INR','XTR'].map(currency=>({status:'delivered',currency,total:100,stars_total:25,created_at:'2026-11-27T20:00:00Z',confirmed_at:'2026-11-28T01:00:00Z',delivered_at:'2026-11-28T01:05:00Z'}));
  const result=operationalMetrics(rows,[],new Date('2026-11-28T02:00:00Z'));
  expect(result.today.revenue).toEqual([{currency:'USD',total:100},{currency:'INR',total:100},{currency:'XTR',total:25}]);
  expect(result.today.delivered).toBe(3);
});
test('overdue means confirmed plus thirty minutes, not order creation',()=>{
  const order={status:'awaiting_fulfillment',currency:'USD',total:1,stars_total:null,created_at:'2026-11-27T00:00:00Z',confirmed_at:'2026-11-28T01:30:00Z',delivered_at:null};
  expect(operationalMetrics([order],[],new Date('2026-11-28T01:59:59Z')).overdue).toBe(0);
  expect(operationalMetrics([order],[],new Date('2026-11-28T02:00:00Z')).overdue).toBe(1);
});
test('week comparison does not invent a percentage from no previous sales',()=>{
  expect(percentageChange(20,10)).toBe(100); expect(percentageChange(10,20)).toBe(-50); expect(percentageChange(10,0)).toBeNull();
});