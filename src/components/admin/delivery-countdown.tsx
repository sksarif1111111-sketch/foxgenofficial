import { deliveryClock } from "@/lib/shop-fulfillment";

export function DeliveryCountdown({ order, minutes, now }: { order: { status: string; confirmed_at?: string | null; delivered_at?: string | null }; minutes: number; now: number }) {
  const clock = deliveryClock(order, minutes, now);
  if (!clock) return null;
  const tone = clock.tone === "success" ? "text-success border-success/25 bg-success/10" : clock.tone === "warning" ? "text-warning border-warning/25 bg-warning/10" : "text-destructive border-destructive/25 bg-destructive/10";
  return <span className={`inline-flex rounded-xl border px-3 py-1 text-xs font-medium tabular-nums ${tone} ${clock.overdue ? "delivery-overdue" : ""}`}>{clock.label}</span>;
}