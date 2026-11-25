import { describe, expect, it } from "vitest";
import { shopActionSchema } from "./shop-actions.contract";

describe("CRM action contract", () => {
  it("rejects messages longer than 2000 characters", () => {
    expect(shopActionSchema.safeParse({ action: "message_customer", customer_id: crypto.randomUUID(), message: "x".repeat(2001), channels: ["telegram"] }).success).toBe(false);
  });
  it("accepts a 2000 character message", () => {
    expect(shopActionSchema.safeParse({ action: "message_customer", customer_id: crypto.randomUUID(), message: "x".repeat(2000), channels: ["account"] }).success).toBe(true);
  });
  it("rejects an unknown channel", () => {
    expect(shopActionSchema.safeParse({ action: "message_customer", customer_id: crypto.randomUUID(), message: "hi", channels: ["sms"] }).success).toBe(false);
  });
  it("rejects a zero wallet adjustment", () => {
    expect(shopActionSchema.safeParse({ action: "adjust_wallet", customer_id: crypto.randomUUID(), amount_usd: 0, reason: "test" }).success).toBe(false);
  });
  it("accepts a negative wallet adjustment", () => {
    expect(shopActionSchema.safeParse({ action: "adjust_wallet", customer_id: crypto.randomUUID(), amount_usd: -2.5, reason: "correction" }).success).toBe(true);
  });
});
