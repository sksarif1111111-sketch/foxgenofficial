import { describe, expect, it } from "bun:test";
import { eyeOpenness, FOXY_3D, volumePose } from "./foxy-pose";

describe("volumetric Foxy", () => {
  it("keeps visible dark eyes on click, surprise and sleep", () => {
    expect(eyeOpenness("happy", false, false)).toBe(0.88);
    expect(eyeOpenness("surprised", false, false)).toBe(1.08);
    expect(eyeOpenness("sleepy", false, false)).toBe(0.48);
  });
  it("keeps its face towards the viewer without a 360 degree turn", () => {
    expect(FOXY_3D.yaw).toBe(0.32);
    expect(FOXY_3D.yaw).toBeLessThan(Math.PI / 2);
  });
  it("reforms a complete volume after melting", () => {
    expect(volumePose("puddle", 0.4, false).visible).toBe(false);
    expect(volumePose("reform", 0.64, false)).toEqual({ visible: true, x: 1, y: 1, lift: 0 });
  });
  it("never falls, squashes or hops in reduced motion", () => {
    for (const act of ["drop", "turn", "splash", "reform"]) {
      expect(volumePose(act, 0.12, true)).toEqual({ visible: true, x: 1, y: 1, lift: 0 });
    }
    expect(eyeOpenness("normal", true, true)).toBe(1);
  });
});