import { useEffect, useState } from "react";

export const REVIEW_WINDOW_MS = 30 * 60 * 1000;

export function reviewRemainingMs(submittedAt: string, now: number) {
  const start = Date.parse(submittedAt);
  if (Number.isNaN(start)) return 0;
  return Math.max(0, start + REVIEW_WINDOW_MS - now);
}

/** Live 30-minute review countdown from proof submission time. Renders after mount to avoid hydration mismatch. */
export function ReviewCountdown({ submittedAt, className = "" }: { submittedAt: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (now === null) return null;
  const left = reviewRemainingMs(submittedAt, now);
  const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
  return (
    <span role="timer" aria-live="off" className={`inline-flex items-center gap-1.5 font-mono tabular-nums ${className}`}>
      {left > 0 ? `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} left` : "Review is taking a little longer — we're on it"}
    </span>
  );
}
