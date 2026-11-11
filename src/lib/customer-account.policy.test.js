import { expect, test } from "bun:test";
import { accountOrderSummary, studentVoucher } from "./customer-account.policy";
const order = (status, total, currency = "USDT", extra = {}) => ({ channel: "website", customer_user_id: "buyer", status, total, currency, ...extra });
test("spending counts only confirmed purchases, separated by currency", () => {
  expect(accountOrderSummary([order("delivered", 12), order("awaiting_fulfillment", 8), order("payment_confirmed", 300, "INR"), order("awaiting_payment", 99), order("cancelled", 55), order("refunded", 10)], "buyer")).toEqual({ orderCount: 6, paidCount: 3, deliveredCount: 1, spending: [{currency: "INR", amount: 300}, {currency: "USDT", amount: 20}] });
});
test("account totals never include Telegram orders or another buyer", () => {
  expect(accountOrderSummary([order("delivered", 12, "USDT", { channel: "telegram" }), order("delivered", 9, "USDT", { customer_user_id: "other" })], "buyer").orderCount).toBe(0);
});
test("students see the owner's exact voucher code without inferred discount", () => { expect(studentVoucher(true)).toBe("FOXGENSTUDENT10"); expect(studentVoucher(false)).toBe(null); });