import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Headset, Package, ReceiptX, ShieldCheck, Timer, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { countUpValue } from "@/lib/count-up";

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * Counts from 0 to the real value once the number scrolls into view. Writes the text straight to the
 * element each frame (no React state per frame). Reduced motion shows the final value at once.
 */
function useCountUp(target: number | null, duration = 1800) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (target === null || !el) return;
    setDone(false);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || target === 0 || typeof IntersectionObserver === "undefined") {
      el.textContent = fmt(target);
      setDone(true);
      return;
    }
    el.textContent = "0";
    let raf = 0;
    const run = () => {
      let start = 0;
      const tick = (t: number) => {
        if (!start) start = t;
        const p = Math.min(1, (t - start) / duration);
        el.textContent = fmt(countUpValue(target, p));
        if (p < 1) raf = requestAnimationFrame(tick);
        else setDone(true);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          run();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target, duration]);
  return { ref, done };
}

function CountUp({ value, error, className, suffix }: { value: number | null; error?: boolean; className: string; suffix?: string }) {
  const { ref, done } = useCountUp(value);
  if (value === null) {
    if (error) return <span className={`${className} text-muted-foreground`}>—</span>;
    return <span className="inline-block h-[0.9em] w-[3ch] animate-pulse rounded-lg bg-primary/10 align-middle" aria-label="Loading" />;
  }
  return (
    <span className={`trust-count ${done ? "trust-count-done" : ""} ${className}`}>
      {/* Screen readers get the real number straight away; the animated digits are visual only. */}
      <span className="sr-only">{fmt(value)}{suffix ? ` ${suffix}` : ""}</span>
      <span aria-hidden="true">
        <span ref={ref}>0</span>
        {suffix && <span className="ml-1 text-[0.5em]">{suffix}</span>}
      </span>
    </span>
  );
}

/** Animated clock: the minute hand sweeps, the hour hand creeps, a soft glow breathes behind it. */
function DeliveryClock() {
  return (
    <span className="relative inline-flex size-12 shrink-0 items-center justify-center" aria-hidden="true">
      <span className="trust-clock-glow absolute inset-0 rounded-full" />
      <span className="relative flex size-full items-center justify-center rounded-full border border-primary/20 bg-card shadow-soft">
        <svg viewBox="0 0 64 64" className="size-9 text-primary">
          <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="3" />
          <circle className="trust-clock-arc" cx="32" cy="32" r="27" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" pathLength="100" strokeDasharray="50 100" transform="rotate(-90 32 32)" />
          {[0, 90, 180, 270].map((a) => (
            <line key={a} x1="32" y1="9" x2="32" y2="13" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${a} 32 32)`} />
          ))}
          <g className="trust-clock-hour">
            <line x1="32" y1="32" x2="32" y2="21" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          </g>
          <g className="trust-clock-minute">
            <line x1="32" y1="32" x2="32" y2="15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </g>
          <circle cx="32" cy="32" r="3" fill="currentColor" />
        </svg>
      </span>
    </span>
  );
}

/** One compact statistic: icon, uppercase label, value, one line of context. */
function StatTile({ Icon, label, note, children }: { Icon: typeof Package; label: string; note: string; children: ReactNode }) {
  return (
    <div className="trust-card flex min-w-0 flex-col gap-2 p-4 sm:p-5">
      <p className="caption-3 flex items-center gap-2 uppercase tracking-wider text-primary">
        <span className="inline-flex size-6 items-center justify-center rounded-md bg-accent"><Icon size={14} weight="bold" /></span>
        {label}
      </p>
      <p className="heading-4 tabular-nums leading-none">{children}</p>
      <p className="caption-5 text-muted-foreground">{note}</p>
    </div>
  );
}

const PROMISE = [
  { Icon: Timer, title: "Delivered within 30 minutes", body: "We guarantee delivery within 30 minutes after successful payment confirmation, subject to product availability and order verification." },
  { Icon: Headset, title: "Personal follow up if late", body: "If your order is not delivered within 30 minutes, our team will personally contact you and work to complete your delivery as soon as possible." },
  { Icon: ReceiptX, title: "Full refund if we cannot deliver", body: "If we are unable to provide the purchased product, you will receive a full refund. An order that arrives late but is delivered and accepted is not refunded." },
];

/**
 * Full width trust band under the hero, kept compact: real member count (count up from 0),
 * products in stock, typical review time, the 30 minute delivery guarantee and the refund promise.
 */
export function TrustStatsBand({
  members,
  membersError,
  inStock,
  reviewMinutes,
}: {
  members: number | null;
  membersError: boolean;
  inStock: number | null;
  reviewMinutes: number | null;
}) {
  return (
    <section aria-labelledby="delivery-title" className="trust-band relative w-full overflow-hidden border-y border-primary/15">
      <span className="trust-line top-0" aria-hidden="true"><span className="trust-line-glow" /></span>
      <span className="trust-line bottom-0" aria-hidden="true"><span className="trust-line-glow [animation-delay:-4s]" /></span>

      <div className="mx-auto w-full max-w-[96rem] px-4 py-8 sm:px-6 lg:px-12 lg:py-12">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile Icon={UsersThree} label="Total members" note={membersError ? "Could not load, refresh in a moment" : "Joined through our Telegram bot"}>
            <CountUp value={members} error={membersError} className="trust-number" />
          </StatTile>
          <StatTile Icon={Package} label="In stock" note="Genuine digital products">
            <CountUp value={inStock} className="" />
          </StatTile>
          {reviewMinutes ? (
            <StatTile Icon={ShieldCheck} label="Payment review" note="Every payment checked by a person">
              <CountUp value={reviewMinutes} suffix="min" className="" />
            </StatTile>
          ) : (
            <StatTile Icon={ShieldCheck} label="Payments" note="Every payment checked by a person">
              <span className="title-2">Owner checked</span>
            </StatTile>
          )}
          <div className="trust-card trust-card-accent flex min-w-0 items-center gap-3 p-4 sm:p-5">
            <DeliveryClock />
            <div className="min-w-0">
              <p className="caption-3 uppercase tracking-wider text-primary">30 minutes delivery</p>
              <p className="title-3 mt-1">Guaranteed delivery</p>
              <p className="caption-5 text-muted-foreground">After payment confirmation</p>
            </div>
          </div>
        </div>

        {/* Delivery promise and refund policy */}
        <div className="trust-card mt-3 p-4 sm:p-6">
          <div className="flex flex-col gap-1 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <p className="caption-3 uppercase tracking-wider text-primary">Our delivery promise</p>
              <h2 id="delivery-title" className="heading-6 mt-1">Guaranteed delivery within 30 minutes</h2>
              <p className="body-6 mt-1 max-w-[640px] text-muted-foreground">
                We aim to deliver your purchased digital products and software within 30 minutes of successful payment confirmation.
              </p>
            </div>
            <p className="caption-4 shrink-0 text-muted-foreground">
              <Link to="/terms" className="text-primary underline">Refund policy</Link>
              <span aria-hidden="true"> · </span>
              <Link to="/support" className="text-primary underline">Contact support</Link>
            </p>
          </div>
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {PROMISE.map(({ Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><Icon size={16} weight="bold" /></span>
                <span className="min-w-0">
                  <span className="title-4 block">{title}</span>
                  <span className="caption-2 mt-1 block text-muted-foreground">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
