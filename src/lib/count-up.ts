/** Ease out cubic: fast start, gentle landing on the real number. */
export function easeOutCubic(p: number): number {
  const t = Math.min(1, Math.max(0, p));
  return 1 - (1 - t) ** 3;
}

/** Value shown at progress p (0 to 1) of a count up from 0 to target; always lands exactly on target. */
export function countUpValue(target: number, p: number): number {
  if (p >= 1) return target;
  return Math.round(target * easeOutCubic(p));
}
