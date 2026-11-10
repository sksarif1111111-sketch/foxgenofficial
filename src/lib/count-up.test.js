import { describe, expect, it } from "bun:test";
import { countUpValue } from "./count-up";

describe("member count up", () => {
  it("starts at 0", () => {
    expect(countUpValue(1234, 0)).toBe(0);
  });
  it("ends exactly on the real member count", () => {
    expect(countUpValue(1234, 1)).toBe(1234);
  });
  it("never passes the real count on the way up", () => {
    for (let p = 0; p <= 1; p += 0.05) expect(countUpValue(987, p)).toBeLessThanOrEqual(987);
  });
});
