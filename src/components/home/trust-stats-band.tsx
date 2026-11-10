import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle, Headset, Package, ReceiptX, ShieldCheck, Timer, UsersThree } from "@phosphor-icons/react/dist/ssr";
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
    <span className="relative inline-flex size-20 shrink-0 items-center justify-center sm:size-24" aria-hidden="true">
      <span className="trust-clock-glow absolute inset-0 rounded-full" />
      <span className="relative flex size-full items-center justify-center rounded-full border border-primary/20 bg-card shadow-lift">
        <svg viewBox="0 0 64 64" className="size-14 text-primary sm:size-16">
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

/**
 * Full width trust band under the hero: real member count (count up from 0), products in stock,
 * typical review time, the 30 minute delivery guarantee and the delivery and refund promise.
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

      <div className="mx-auto w-full max-w-[96rem] px-4 py-16 sm:px-6 lg:px-12 lg:py-20">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-8">
          {/* Member statistics */}
          <div className="trust-card flex flex-col justify-between gap-10 p-6 sm:p-10">
            <div>
              <p className="caption-3 inline-flex items-center gap-2 uppercase tracking-widest text-primary">
                <UsersThree size={16} weight="bold" /> Total members
              </p>
              <p className="mt-4 font-display text-6xl font-bold leading-none tracking-tight tabular-nums sm:text-7xl lg:text-8xl">
                <CountUp value={members} error={membersError} className="trust-number" />
              </p>
              <p className="body-3 mt-4 max-w-[520px] text-muted-foreground">
                {membersError
                  ? "The member count could not load right now. Please refresh the page in a moment."
                  : "People who have joined Foxgen through our Telegram bot to shop genuine digital products and premium software."}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-4 border-t border-border pt-6">
              <div className="min-w-0">
                <dt className="caption-4 flex items-center gap-2 text-muted-foreground"><Package size={16} weight="bold" className="text-primary" /> Products in stock</dt>
                <dd className="heading-4 mt-2 tabular-nums sm:heading-3"><CountUp value={inStock} className="" /></dd>
              </div>
              {reviewMinutes ? (
                <div className="min-w-0">
                  <dt className="caption-4 flex items-center gap-2 text-muted-foreground"><Timer size={16} weight="bold" className="text-primary" /> Typical payment review</dt>
                  <dd className="heading-4 mt-2 tabular-nums sm:heading-3"><CountUp value={reviewMinutes} suffix="min" className="" /></dd>
                </div>
              ) : (
                <div className="min-w-0">
                  <dt className="caption-4 flex items-center gap-2 text-muted-foreground"><ShieldCheck size={16} weight="bold" className="text-primary" /> Payments</dt>
                  <dd className="title-2 mt-2">Checked by a person</dd>
                </div>
              )}
            </dl>
          </div>

          {/* 30 minute delivery guarantee */}
          <div className="trust-card trust-card-accent flex flex-col gap-6 p-6 sm:p-10">
            <div className="flex items-center gap-5">
              <DeliveryClock />
              <div className="min-w-0">
                <p className="caption-3 uppercase tracking-widest text-primary">30 minutes delivery</p>
                <h2 id="delivery-title" className="heading-5 mt-2 sm:heading-4">Guaranteed delivery within 30 minutes</h2>
              </div>
            </div>
            <p className="body-3 text-muted-foreground">
              We aim to deliver your purchased digital products and software within 30 minutes of successful payment confirmation.
            </p>
            <ul className="mt-auto grid gap-3 sm:grid-cols-2">
              {["Fast order processing after payment", "Genuine digital products only"].map((t) => (
                <li key={t} className="body-5 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                  <CheckCircle size={18} weight="fill" className="shrink-0 text-success" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Delivery promise and refund policy */}
        <div className="trust-card mt-6 p-6 sm:p-10 lg:mt-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)] lg:gap-12">
            <div>
              <p className="caption-3 uppercase tracking-widest text-primary">Our delivery promise</p>
              <h3 className="heading-5 mt-2">Customer support and refund policy</h3>
              <p className="body-6 mt-3 text-muted-foreground">
                Full details are in our <Link to="/terms" className="text-primary underline">terms</Link>. Questions about an order? <Link to="/support" className="text-primary underline">Contact support</Link>.
              </p>
            </div>
            <ul className="grid gap-4 md:grid-cols-3">
              {[
                { Icon: Timer, title: "Delivered within 30 minutes", body: "We guarantee delivery within 30 minutes after successful payment confirmation, subject to product availability and order verification." },
                { Icon: Headset, title: "Personal follow up if late", body: "If your order is not delivered within 30 minutes, our team will personally contact you and work to complete your delivery as soon as possible." },
                { Icon: ReceiptX, title: "Full refund if we cannot deliver", body: "If we are unable to provide the purchased product, you will receive a full refund. An order that arrives late but is delivered and accepted is not refunded." },
              ].map(({ Icon, title, body }) => (
                <li key={title} className="rounded-2xl border border-border bg-background/60 p-5">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent text-primary"><Icon size={20} weight="bold" /></span>
                  <p className="title-3 mt-4">{title}</p>
                  <p className="body-6 mt-2 text-muted-foreground">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
