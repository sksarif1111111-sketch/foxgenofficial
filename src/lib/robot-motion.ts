/**
 * Where the walking Foxgen robot may go and when it may do its funny fall.
 * Pure helpers so the rules (stay on screen, shorter walks on phones, fall only now and then) are testable.
 */
export const ROBOT_MOTION = {
  desktopWidth: 84,
  mobileWidth: 58,
  edge: 12,
  mobileBreakpoint: 640,
  /** Phones only walk in the right part of the screen. */
  mobileStartRatio: 0.4,
  /** First fall happens soon so visitors see it, then rarely. */
  firstFallAfterMs: 9000,
  fallGapMs: 50000,
  desktopSpeed: 70,
  mobileSpeed: 42,
  /** Lying down, the robot reaches this many robot-widths past its centre. */
  lyingReach: 1.2,
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

/** Fall only after the first delay, then at most once per gap. */
export function canFall(now: number, startedAt: number, lastFallAt: number | null) {
  if (lastFallAt === null) return now - startedAt >= ROBOT_MOTION.firstFallAfterMs;
  return now - lastFallAt >= ROBOT_MOTION.fallGapMs;
}

/** True when the robot can lie down in the walking direction without leaving the screen. */
export function hasRoomToFall(x: number, dir: 1 | -1, vw: number) {
  const w = robotWidth(vw);
  const centre = x + w / 2;
  const reach = w * ROBOT_MOTION.lyingReach;
  return dir === 1 ? centre + reach <= vw - 4 : centre - reach >= 4;
}
