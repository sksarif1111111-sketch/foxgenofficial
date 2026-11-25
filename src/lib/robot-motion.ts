/**
 * Where Foxy (the walking mascot) may go and when it may do its tricks.
 * Pure helpers so the rules (stay on screen, avoid checkout buttons, rare drop-ins, quiet bubbles) are testable.
 */
export const ROBOT_MOTION = {
  desktopWidth: 88,
  mobileWidth: 68,
  edge: 12,
  mobileBreakpoint: 640,
  /** Phones only walk in the right part of the screen. */
  mobileStartRatio: 0.4,
  /** First drop from the top about 8 s after the first visit, then at most once every 2.5 minutes. */
  firstFallAfterMs: 8000,
  fallGapMs: 150000,
  desktopSpeed: 70,
  mobileSpeed: 42,
  /** Pointing at a product that just came into view: at most once per gap. */
  pointGapMs: 9000,
  /** Idle chatter bubbles: at most one per gap. */
  bubbleGapMs: 20000,
  /** No interaction for this long and Foxy dozes off. */
  sleepAfterMs: 60000,
  /** Buttons whose bottom edge is within this many px of the screen bottom are kept clear. */
  avoidBand: 150,
} as const;

export function robotWidth(vw: number) {
  return vw < ROBOT_MOTION.mobileBreakpoint ? ROBOT_MOTION.mobileWidth : ROBOT_MOTION.desktopWidth;
}

export function walkRange(vw: number) {
  const w = robotWidth(vw);
  const max = Math.max(ROBOT_MOTION.edge, vw - w - ROBOT_MOTION.edge);
  const min = vw < ROBOT_MOTION.mobileBreakpoint ? Math.min(max, Math.round(vw * ROBOT_MOTION.mobileStartRatio)) : ROBOT_MOTION.edge;
  return { min, max };
}

export function clampX(x: number, vw: number) {
  const { min, max } = walkRange(vw);
  return Math.min(max, Math.max(min, x));
}

/** Next spot to walk to: somewhere clearly away from where it stands, always on screen. */
export function pickTarget(current: number, vw: number, rand: () => number = Math.random) {
  const { min, max } = walkRange(vw);
  const span = max - min;
  if (span <= 0) return min;
  const minStep = span * 0.3;
  for (let i = 0; i < 6; i++) {
    const t = Math.round(min + rand() * span);
    if (Math.abs(t - current) >= minStep) return t;
  }
  return current - min > max - current ? min : max;
}

export function walkDuration(from: number, to: number, vw: number) {
  const speed = vw < ROBOT_MOTION.mobileBreakpoint ? ROBOT_MOTION.mobileSpeed : ROBOT_MOTION.desktopSpeed;
  return Math.max(600, Math.round((Math.abs(to - from) / speed) * 1000));
}

/** Small curious walks rather than repeated full-screen sweeps. */
export function wanderTarget(current: number, vw: number, rand: () => number = Math.random) {
  const step = robotWidth(vw) * (0.65 + rand() * 1.1);
  const direction = rand() < 0.5 ? -1 : 1;
  const target = clampX(current + step * direction, vw);
  return Math.abs(target - current) > 8 ? target : clampX(current - step * direction, vw);
}

/** Keep the whole walking path clear, not just the landing point. */
export function reachableTarget(from: number, to: number, vw: number, blocked: Array<[number, number]>) {
  const w = robotWidth(vw);
  let target = clampX(to, vw);
  for (const [left, right] of blocked) {
    if (to > from && from + w <= left - 8) target = Math.min(target, left - w - 8);
    if (to < from && from >= right + 8) target = Math.max(target, right + 8);
  }
  return clampX(target, vw);
}

/** One planted stance followed by a lifted recovery; opposite paws are half a cycle apart. */
export function pawPose(phase: number) {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.6) return { x: 5 - (p / 0.6) * 10, y: 0, angle: 6 - (p / 0.6) * 12 };
  const swing = (p - 0.6) / 0.4;
  return { x: -5 + swing * 10, y: -Math.sin(swing * Math.PI) * 6, angle: -6 + swing * 12 };
}

/** Phase is derived from travelled distance, so a paused walk also freezes the feet. */
export function gaitPose(distance: number, stride: number) {
  const phase = distance / Math.max(1, stride);
  return {
    left: pawPose(phase), right: pawPose(phase + 0.5),
    bob: -Math.abs(Math.sin(phase * Math.PI * 2)) * 2.5,
    lean: Math.cos(phase * Math.PI * 2) * 3,
  };
}

/** Drop in from the top only after the first delay, then at most once per gap. */
export function canFall(now: number, startedAt: number, lastFallAt: number | null) {
  if (lastFallAt === null) return now - startedAt >= ROBOT_MOTION.firstFallAfterMs;
  return now - lastFallAt >= ROBOT_MOTION.fallGapMs;
}

/** Point at a newly visible product only now and then, so it never feels pushy. */
export function canPoint(now: number, lastPointAt: number | null) {
  return lastPointAt === null || now - lastPointAt >= ROBOT_MOTION.pointGapMs;
}

/** Idle chatter: never more than one bubble per gap. */
export function canChat(now: number, lastBubbleAt: number | null) {
  return lastBubbleAt === null || now - lastBubbleAt >= ROBOT_MOTION.bubbleGapMs;
}

/** Which way to point: towards the product's horizontal centre. */
export function pointDirection(robotCentre: number, targetCentre: number): 1 | -1 {
  return targetCentre >= robotCentre ? 1 : -1;
}

/**
 * Move a wanted x so Foxy never stands over a blocked span (e.g. "Place order" / "Pay" buttons).
 * Blocked spans are [left, right] in px. Returns the nearest free x on screen.
 */
export function avoidSpans(x: number, vw: number, blocked: Array<[number, number]>) {
  const w = robotWidth(vw);
  const { min, max } = walkRange(vw);
  const pad = 8;
  const hits = (p: number) => blocked.some(([l, r]) => p < r + pad && p + w > l - pad);
  const start = clampX(x, vw);
  if (!hits(start)) return start;
  for (let d = 4; d <= vw; d += 4) {
    if (start - d >= min && !hits(start - d)) return start - d;
    if (start + d <= max && !hits(start + d)) return start + d;
  }
  // Nothing free in the walking range: tuck into the far corner.
  return max;
}
