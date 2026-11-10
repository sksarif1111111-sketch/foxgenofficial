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

/** Category cards sit above the orbit band (top corners) so circling tiles never pass over them. */
export const CATEGORY_SLOTS: Slot[] = [
  { x: 20, y: 8, z: 40, ry: 10, from: "base", dur: 12.2, delay: -2.1, enter: 2000 },
  { x: 80, y: 9, z: 40, ry: -10, from: "base", dur: 13.6, delay: -6.5, enter: 2200 },
  { x: 12, y: 24, z: 70, ry: 8, from: "sm", dur: 11.4, delay: -4.0, enter: 2400 },
  { x: 88, y: 26, z: 70, ry: -8, from: "sm", dur: 14.8, delay: -8.8, enter: 2500 },
  { x: 50, y: 5, z: 10, ry: 0, from: "lg", dur: 12.8, delay: -1.4, enter: 2600 },
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
