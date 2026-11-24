import { describe, expect, it } from "vitest";
import { estimateDailyPictures, formatReset, msUntilReset } from "./image-quota";

describe("Cloudflare picture quota", () => {
  it("estimates 173 free pictures a day", () => expect(estimateDailyPictures()).toBe(173));
  it("resets at midnight UTC", () => {
    expect(formatReset(msUntilReset(new Date("2026-11-24T23:14:00Z")))).toBe("0h 46m");
  });
});
