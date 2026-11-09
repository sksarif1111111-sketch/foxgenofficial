import { describe, expect, test } from "bun:test";
import { externalOrderId, isPaid, normalizeChannel, querySchema, validKeyHeader } from "./shop-api.contract";

describe("External CRM rules", () => {
  test("website and bot sales have a stable shared import identity", () => {
    expect(externalOrderId("abc")).toBe("shop:abc");
    expect(normalizeChannel("telegram")).toBe("Bot");
    expect(normalizeChannel("bot")).toBe("Bot");
    expect(normalizeChannel("website")).toBe("Website");
  });
  test("unconfirmed orders cannot be exported as paid sales", () => {
    expect(isPaid("confirmed")).toBe(true);
    expect(isPaid("delivered")).toBe(true);
    for (const status of ["awaiting_payment", "pending", "submitted", "rejected", "expired"]) {
      expect(isPaid(status)).toBe(false);
    }
  });
  test("requires a secret bearer credential", () => {
    expect(validKeyHeader(null)).toBeNull();
    expect(validKeyHeader("Bearer short")).toBeNull();
    expect(validKeyHeader(`Bearer ${"a".repeat(32)}`)).toBe("a".repeat(32));
  });
  test("bounded incremental pages require a complete cursor", () => {
    expect(querySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(querySchema.safeParse({ cursor_time: "2026-11-09T00:00:00Z" }).success).toBe(false);
    expect(querySchema.safeParse({ limit: 100, since: "2026-11-09T00:00:00Z" }).success).toBe(true);
  });
});