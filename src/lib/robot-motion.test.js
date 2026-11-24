import { describe, expect, it } from "bun:test";
import { canFall, canPoint, clampX, hasRoomToFall, pickTarget, pointDirection, walkRange } from "./robot-motion";

describe("walking robot", () => {
  it("never walks off a desktop screen", () => {
    expect(walkRange(1280)).toEqual({ min: 12, max: 1280 - 76 - 12 });
    expect(clampX(-50, 1280)).toBe(12);
    expect(clampX(5000, 1280)).toBe(1192);
  });

  it("walks a shorter distance on phones (right part only)", () => {
    expect(walkRange(390)).toEqual({ min: 156, max: 390 - 54 - 12 });
  });

  it("always picks a target inside the screen", () => {
    for (let i = 0; i < 50; i++) {
      const t = pickTarget(600, 1280);
      expect(t).toBeGreaterThanOrEqual(12);
      expect(t).toBeLessThanOrEqual(1192);
    }
  });

  it("falls first after 9 seconds, then at most once every 50 seconds", () => {
    expect(canFall(8000, 0, null)).toBe(false);
    expect(canFall(9000, 0, null)).toBe(true);
    expect(canFall(40000, 0, 0)).toBe(false);
    expect(canFall(50000, 0, 0)).toBe(true);
  });

  it("does not fall where it would lie off the screen", () => {
    expect(hasRoomToFall(1192, 1, 1280)).toBe(false);
    expect(hasRoomToFall(600, 1, 1280)).toBe(true);
    expect(hasRoomToFall(12, -1, 1280)).toBe(false);
  });

  it("points at a new product at most once every 9 seconds", () => {
    expect(canPoint(1000, null)).toBe(true);
    expect(canPoint(8000, 0)).toBe(false);
    expect(canPoint(9000, 0)).toBe(true);
  });

  it("points towards the side the product is on", () => {
    expect(pointDirection(1000, 300)).toBe(-1);
    expect(pointDirection(300, 1000)).toBe(1);
  });
});
