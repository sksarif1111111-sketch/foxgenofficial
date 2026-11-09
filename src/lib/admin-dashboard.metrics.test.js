import { expect, test } from "bun:test";
import { financialTotals, kolkataPeriods, PAID_SHOP_STATUSES } from "./admin-dashboard.metrics";
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