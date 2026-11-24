/** Cloudflare Workers AI gives 10,000 free neurons per day, reset at 00:00 UTC. */
export const FREE_NEURONS_PER_DAY = 10_000;
/** flux-1-schnell at 1024x1024 with 4 steps: 4 tiles x 4.8 + 4 steps x 9.6 neurons. */
export const NEURONS_PER_PICTURE = 4 * 4.8 + 4 * 9.6;

export const utcDay = (d: Date) => d.toISOString().slice(0, 10);
export const estimateDailyPictures = () => Math.floor(FREE_NEURONS_PER_DAY / NEURONS_PER_PICTURE);

/** Milliseconds until the free limit resets (next 00:00 UTC). */
export function msUntilReset(now: Date) {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
}

export function formatReset(ms: number) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
