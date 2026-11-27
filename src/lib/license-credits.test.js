import { describe, expect, it } from "bun:test";
import { CREDIT_PLANS, creditLabel, creditPayload } from "./license-credits";

describe("licence credit plans", () => {
  it("offers 100 to 500 credits in steps of 100", () => {
    expect([...CREDIT_PLANS]).toEqual([100, 200, 300, 400, 500]);
  });
  it("sends the remaining balance and the plan size to the extension", () => {
    const p = creditPayload({ credit_total: 300, credit_balance: 120 });
    expect(p.credits).toBe(120);
    expect(p.max_credits).toBe(300);
    expect(p.total_credits).toBe(300);
  });
  it("shows 0 credits for a plain days licence", () => {
    const p = creditPayload({ credit_total: null, credit_balance: null });
    expect(p.credits).toBe(0);
    expect(p.max_credits).toBe(0);
    expect(creditLabel({ credit_total: null, credit_balance: null })).toBeNull();
  });
  it("labels a credit licence as balance / total", () => {
    expect(creditLabel({ credit_total: 500, credit_balance: 499 })).toBe("499 / 500");
  });
});
