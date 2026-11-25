import { gaitPose } from "./robot-motion";

export type FoxyAct = "idle" | "walk" | "sniff" | "turn" | "wave" | "point" | "sit" | "held" | "land" | "drop" | "splash" | "puddle" | "reform" | "dizzy" | "tail" | "juggle" | "peek";
export type FoxyFace = "normal" | "happy" | "curious" | "surprised" | "dizzy" | "sleepy";
export type FoxyRenderState = {
  act: FoxyAct; face: FoxyFace; dir: 1 | -1; blink: boolean; nod: boolean;
  hover: boolean; reduced: boolean; hidden: boolean; press: boolean;
  gaze: { x: number; y: number }; gait: ReturnType<typeof gaitPose>;
};

export const FOXY_3D = { yaw: 0.32, damping: 12, maxDelta: 0.05, walkCycleMs: 680, strideRatio: 0.28 } as const;

/** Only the expression compresses the eye. The iris never disappears into a blank white socket. */
export function eyeOpenness(face: FoxyFace, blink: boolean, reduced: boolean) {
  if (blink && !reduced) return 0.12;
  if (face === "sleepy") return 0.48;
  if (face === "happy") return 0.88;
  if (face === "surprised") return 1.08;
  return 1;
}

/** Landing/drop/reform use a whole volume, not a rotated image plane. */
export function volumePose(act: FoxyAct, elapsed: number, reduced: boolean) {
  if (reduced) return { visible: true, x: 1, y: 1, lift: 0 };
  if (act === "puddle") return { visible: false, x: 1, y: 1, lift: 0 };
  if (act === "splash") {
    const p = Math.min(1, elapsed / 0.18);
    return { visible: p < 1, x: 1 + p * 0.5, y: Math.max(0.06, 1 - p), lift: 0 };
  }
  if (act === "drop") return { visible: true, x: 0.91, y: 1.12, lift: 0 };
  if (act === "reform") {
    const p = Math.min(1, elapsed / 0.64);
    const spring = Math.sin(p * Math.PI * 3) * (1 - p) * 0.28;
    return { visible: true, x: 1 - spring, y: Math.max(0.1, Math.min(1, p * 3) + spring), lift: 0 };
  }
  if (act === "turn") {
    const p = Math.min(1, elapsed / 0.31);
    return { visible: true, x: 1 + Math.sin(p * Math.PI * 2) * 0.09, y: 1 - Math.sin(p * Math.PI * 2) * 0.12, lift: Math.sin(p * Math.PI) * 0.14 };
  }
  if (act === "land") {
    const p = Math.min(1, elapsed / 0.34);
    const squash = Math.sin(p * Math.PI * 2) * (1 - p) * 0.15;
    return { visible: true, x: 1 + squash, y: 1 - squash, lift: 0 };
  }
  return { visible: true, x: 1, y: 1, lift: 0 };
}