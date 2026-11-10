import { describe, expect, it } from "vitest";
import { canFall, clampX, hasRoomToFall, pickTarget, walkRange } from "./robot-motion";

describe("walking robot", () => {
  it("never walks off a desktop screen", () => {
    expect(walkRange(1280)).toEqual({ min: 12, max: 1280 - 84 - 12 });
    expect(clampX(-50, 1280)).toBe(12);
    expect(clampX(5000, 1280)).toBe(1184);
  });

  it("walks a shorter distance on phones (right part only)", () => {
    expect(walkRange(390)).toEqual({ min: 156, max: 390 - 58 - 12 });
  });

  it("always picks a target inside the screen", () => {
    for (let i = 0; i < 50; i++) {
      const t = pickTarget(600, 1280);
      expect(t).toBeGreaterThanOrEqual(12);
      expect(t).toBeLessThanOrEqual(1184);
    }
  });

  it("falls first after 9 seconds, then at most once every 50 seconds", () => {
    expect(canFall(8000, 0, null)).toBe(false);
    expect(canFall(9000, 0, null)).toBe(true);
    expect(canFall(40000, 0, 0)).toBe(false);
    expect(canFall(50000, 0, 0)).toBe(true);
  });

  it("does not fall where it would lie off the screen", () => {
    expect(hasRoomToFall(1184, 1, 1280)).toBe(false);
    expect(hasRoomToFall(600, 1, 1280)).toBe(true);
    expect(hasRoomToFall(12, -1, 1280)).toBe(false);
  });
});
