import { describe, expect, it } from "bun:test";
import { avoidSpans, canChat, canFall, canPoint, clampX, gaitPose, pawPose, pickTarget, pointDirection, reachableTarget, wanderTarget, walkRange } from "./robot-motion";

describe("Foxy mascot", () => {
  it("uses short walking bouts rather than crossing the entire screen", () => {
    expect(wanderTarget(600, 1280, () => 0.8)).toBeCloseTo(734.64);
    expect(wanderTarget(600, 1280, () => 0.2)).toBeCloseTo(523.44);
  });

  it("plants each paw before lifting it into its next step", () => {
    expect(pawPose(0)).toEqual({ x: 5, y: 0, angle: 6 });
    expect(pawPose(0.3).x).toBeCloseTo(0);
    expect(pawPose(0.3).angle).toBeCloseTo(0);
    expect(pawPose(0.3).y).toBe(0);
    expect(pawPose(0.8).y).toBeCloseTo(-6);
    expect(gaitPose(0, 20).left).toEqual(gaitPose(20, 20).left);
    expect(gaitPose(10, 20).left.x).not.toBe(gaitPose(0, 20).left.x);
  });

  it("never walks through a payment button between two free endpoints", () => {
    expect(reachableTarget(200, 900, 1280, [[500, 700]])).toBe(404);
    expect(reachableTarget(900, 200, 1280, [[500, 700]])).toBe(708);
  });
  it("never walks off a desktop screen (88px wide)", () => {
    expect(walkRange(1280)).toEqual({ min: 12, max: 1280 - 88 - 12 });
    expect(clampX(-50, 1280)).toBe(12);
    expect(clampX(5000, 1280)).toBe(1180);
  });

  it("is 68px on phones and walks in the right part only", () => {
    expect(walkRange(390)).toEqual({ min: 156, max: 390 - 68 - 12 });
  });

  it("always picks a target inside the screen", () => {
    for (let i = 0; i < 50; i++) {
      const t = pickTarget(600, 1280);
      expect(t).toBeGreaterThanOrEqual(12);
      expect(t).toBeLessThanOrEqual(1180);
    }
  });

  it("drops in first after 8 seconds, then at most once every 2.5 minutes", () => {
    expect(canFall(7999, 0, null)).toBe(false);
    expect(canFall(8000, 0, null)).toBe(true);
    expect(canFall(149999, 0, 0)).toBe(false);
    expect(canFall(150000, 0, 0)).toBe(true);
  });

  it("shows at most one chatter bubble every 20 seconds", () => {
    expect(canChat(0, null)).toBe(true);
    expect(canChat(19999, 0)).toBe(false);
    expect(canChat(20000, 0)).toBe(true);
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

  it("never stands over a Place order / Pay button", () => {
    const x = avoidSpans(600, 1280, [[560, 760]]);
    expect(x + 88 <= 552 || x >= 768).toBe(true);
    expect(avoidSpans(100, 1280, [[560, 760]])).toBe(100);
  });
});
