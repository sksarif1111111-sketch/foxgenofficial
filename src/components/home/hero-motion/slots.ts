import type { CSSProperties } from "react";

/** Where a category card rests: centre in % of the stage, depth, smallest screen and motion. */
export type Slot = {
  x: number;
  y: number;
  z: number;
  ry: number;
  from: "base" | "sm" | "lg";
  dur: number;
  delay: number;
  enter: number;
};

/** Category cards sit outside the orbit band (top and bottom corners) so circling tiles stay clear. */
export const CATEGORY_SLOTS: Slot[] = [
  { x: 18, y: 7, z: 40, ry: 10, from: "sm", dur: 12.2, delay: -2.1, enter: 2000 },
  { x: 82, y: 90, z: 80, ry: -10, from: "base", dur: 13.6, delay: -6.5, enter: 2200 },
  { x: 82, y: 9, z: 30, ry: -8, from: "sm", dur: 11.4, delay: -4.0, enter: 2400 },
  { x: 18, y: 92, z: 70, ry: 8, from: "sm", dur: 14.8, delay: -8.8, enter: 2500 },
  { x: 50, y: 99, z: 90, ry: 0, from: "lg", dur: 12.8, delay: -1.4, enter: 2600 },
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
  };
}
