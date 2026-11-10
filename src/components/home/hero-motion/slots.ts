import type { CSSProperties } from "react";

/** Where each floating element rests: centre in % of the stage, depth, size tier and motion. */
export type Slot = {
  x: number;
  y: number;
  z: number;
  ry: number;
  tier: "front" | "mid" | "back";
  /** Smallest screen that shows this slot. */
  from: "base" | "sm" | "lg";
  dur: number;
  delay: number;
  enter: number;
  approach?: number;
};

export const TILE_SLOTS: Slot[] = [
  { x: 14, y: 16, z: 110, ry: 10, tier: "front", from: "base", dur: 9.6, delay: -1.2, enter: 900, approach: -3 },
  { x: 88, y: 52, z: 120, ry: -12, tier: "front", from: "base", dur: 11.2, delay: -4.4, enter: 1050, approach: -11 },
  { x: 18, y: 82, z: 90, ry: 8, tier: "front", from: "base", dur: 10.4, delay: -6.1, enter: 1200 },
  { x: 88, y: 15, z: 40, ry: -8, tier: "mid", from: "base", dur: 12.6, delay: -2.7, enter: 1000 },
  { x: 40, y: 7, z: 30, ry: 4, tier: "mid", from: "base", dur: 13.4, delay: -8.3, enter: 1150, approach: -17 },
  { x: 6, y: 50, z: 20, ry: 14, tier: "mid", from: "sm", dur: 11.8, delay: -5.2, enter: 1300 },
  { x: 92, y: 81, z: 30, ry: -10, tier: "mid", from: "sm", dur: 9.2, delay: -0.6, enter: 1400 },
  { x: 30, y: 24, z: -90, ry: 6, tier: "back", from: "lg", dur: 14.2, delay: -7.4, enter: 1250 },
  { x: 96, y: 30, z: -110, ry: -6, tier: "back", from: "lg", dur: 15.6, delay: -3.3, enter: 1350 },
  { x: 66, y: 22, z: -120, ry: -4, tier: "back", from: "lg", dur: 13.8, delay: -9.8, enter: 1500 },
];

export const CATEGORY_SLOTS: Slot[] = [
  { x: 17, y: 35, z: 70, ry: 12, tier: "mid", from: "sm", dur: 12.2, delay: -2.1, enter: 2000 },
  { x: 80, y: 68, z: 80, ry: -12, tier: "mid", from: "base", dur: 13.6, delay: -6.5, enter: 2200 },
  { x: 42, y: 91, z: 60, ry: 6, tier: "mid", from: "sm", dur: 11.4, delay: -4.0, enter: 2400 },
  { x: 70, y: 89, z: 50, ry: -6, tier: "mid", from: "sm", dur: 14.8, delay: -8.8, enter: 2500 },
  { x: 66, y: 5, z: 10, ry: -4, tier: "mid", from: "lg", dur: 12.8, delay: -1.4, enter: 2600 },
];

export const visibility = { base: "", sm: "hidden sm:block", lg: "hidden lg:block" } as const;

export function slotStyle(slot: Slot, idle: string): CSSProperties {
  return {
    left: `${slot.x}%`,
    top: `${slot.y}%`,
    ["--z" as string]: `${slot.z}px`,
    ["--ry0" as string]: `${slot.ry}deg`,
    ["--dur" as string]: `${slot.dur}s`,
    ["--delay" as string]: `${slot.delay}s`,
    ["--idle" as string]: idle,
    ["--enter-delay" as string]: `${slot.enter}ms`,
    ["--from-z" as string]: `${slot.tier === "back" ? -320 : slot.tier === "mid" ? -200 : 160}px`,
    ["--approach-delay" as string]: `${slot.approach ?? 0}s`,
  };
}
