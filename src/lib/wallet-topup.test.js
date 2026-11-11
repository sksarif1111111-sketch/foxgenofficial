import { test, expect } from "bun:test";
import { topupAmount, walletDeductSchema, walletReviewSchema } from "./wallet-topup.contract";
import { memberLabel } from "./member-number";
import { shopActionSchema } from "./shop-actions.contract";
test("member labels retain UUID-independent six-digit friendly numbers", () => { expect(memberLabel(123)).toBe("M-000123"); expect(memberLabel(1234567)).toBe("M-1234567"); });
test("funds require positive cent precision", () => { expect(topupAmount.safeParse("12.50").success).toBe(true); expect(topupAmount.safeParse(0).success).toBe(false); expect(topupAmount.safeParse(0.001).success).toBe(false); });
test("deductions always require a short note", () => { expect(walletDeductSchema.safeParse({ profileId: "11111111-1111-4111-8111-111111111111", amount: 5, note: "" }).success).toBe(false); });
test("review rejects missing admin reason", () => { expect(walletReviewSchema.safeParse({ id: "11111111-1111-4111-8111-111111111111", approve: false, note: "" }).success).toBe(false); });
test("product bridge validates stock and prices without needing an order ID", () => {
 const p = { action: "upsert_product", reseller_product_id: "qa", name: "Tool", price_usdt: 5, price_inr: 500, price_stars: 250, stock_quantity: 1 };
 expect(shopActionSchema.safeParse(p).success).toBe(true);
 expect(shopActionSchema.safeParse({ ...p, stock_quantity: -1 }).success).toBe(false);
 expect(shopActionSchema.safeParse({ ...p, price_usdt: -1 }).success).toBe(false);
});