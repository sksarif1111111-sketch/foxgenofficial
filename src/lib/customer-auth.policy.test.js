import { test, expect } from "bun:test";
import { ownsWebsiteOrder, safeCustomerRedirect } from "./customer-auth.policy";
test("website customer can read only own website order", () => {
 expect(ownsWebsiteOrder({ channel: "website", customer_user_id: "a" }, "a")).toBe(true);
 expect(ownsWebsiteOrder({ channel: "website", customer_user_id: "b" }, "a")).toBe(false);
});
test("Telegram and website identities never merge", () => { expect(ownsWebsiteOrder({ channel: "telegram", customer_user_id: "a" }, "a")).toBe(false); expect(ownsWebsiteOrder({ channel: "website" }, "a")).toBe(false); });
test("login returns to selected product, never external origins", () => { expect(safeCustomerRedirect("/shop?product=abc&buy=true")).toBe("/shop?product=abc&buy=true"); expect(safeCustomerRedirect("//evil.test")).toBe("/account"); expect(safeCustomerRedirect("/shop\\evil.test")).toBe("/account"); });