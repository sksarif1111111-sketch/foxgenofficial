import { test, expect } from "bun:test";
import { deliveryClock, deliverySlaMinutes, needsDeliveryEmail, telegramDeliveryText } from "./shop-fulfillment";
import { shopActionSchema } from "./shop-actions.contract";
import { crmOrderRecord } from "./shop-crm.payload";

test("SLA defaults to exactly 30 minutes", () => { expect(deliverySlaMinutes()).toBe(30); expect(deliverySlaMinutes("45")).toBe(45); });
test("Telegram skips email except explicit product requirement", () => { expect(needsDeliveryEmail({ channel: "telegram" }, false)).toBe(false); expect(needsDeliveryEmail({ channel: "telegram" }, true)).toBe(true); });
test("Telegram ID also skips the optional email step", () => { expect(needsDeliveryEmail({ channel: "website", telegram_user_id: 1 }, false)).toBe(false); });
test("Website email path stays required", () => { expect(needsDeliveryEmail({ channel: "website" }, false)).toBe(true); });
const start = "2026-11-11T00:00:00Z";
test("SLA greens first half, ambers second half, overdue at deadline", () => {
  const order = { status: "awaiting_fulfillment", confirmed_at: start };
  expect(deliveryClock(order, 30, Date.parse(start) + 12 * 60000)).toEqual({ label: "18 min left", tone: "success", overdue: false });
  expect(deliveryClock(order, 30, Date.parse(start) + 16 * 60000)?.tone).toBe("warning");
  expect(deliveryClock(order, 30, Date.parse(start) + 30 * 60000)?.overdue).toBe(true);
});
test("Delivered SLA uses final timestamps and unpaid orders have no running clock", () => {
  expect(deliveryClock({ status: "delivered", confirmed_at: start, delivered_at: "2026-11-11T00:24:00Z" }, 30)?.tone).toBe("success");
  expect(deliveryClock({ status: "delivered", confirmed_at: start, delivered_at: "2026-11-11T00:31:00Z" }, 30)?.tone).toBe("warning");
  expect(deliveryClock({ status: "under_review", confirmed_at: start })).toBeNull();
});
test("Telegram HTML preserves delivery characters through escaping", () => {
  expect(telegramDeliveryText("A", ["code <abc>&123"], "FG-1", "help")).toContain("code &lt;abc&gt;&amp;123");
});
test("CRM actions require UUIDs and restrict operations", () => {
  expect(shopActionSchema.safeParse({ action: "approve", order_id: "bad" }).success).toBe(false);
  expect(shopActionSchema.safeParse({ action: "delete", order_id: "f39a4c60-1ca2-4a82-8a27-f84e2b4f71a4" }).success).toBe(false);
});
test("Stars CRM export uses stored USDT snapshot and plain UUID", () => {
  const r = crmOrderRecord({ id: "f39a4c60-1ca2-4a82-8a27-f84e2b4f71a4", currency: "XTR", stars_total: 200, status: "delivered" }, [{ quantity: 2, snapshot: { price_usdt: 5 }, product_name: "Tool" }], true, 30);
  expect(r.external_id).toBe("f39a4c60-1ca2-4a82-8a27-f84e2b4f71a4"); expect(r.amount).toBe(10); expect(r.currency).toBe("USDT"); expect(r.data.original_stars_amount).toBe(200); expect(r.data.has_fulfillment).toBe(true);
});