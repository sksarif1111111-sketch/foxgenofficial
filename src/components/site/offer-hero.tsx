import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { ProductLogo } from "@/components/site/product-logo";
import { shortDate } from "@/lib/format";

export type HeroSlide = {
  key: string;
  eyebrow: string;
  title: string;
  description: string | null;
  badge: string | null;
  image: string | null;
  endsAt: string | null;
  sourceLabel: string;
  cta: { label: string; href: string | null; productId: string | null };
  product: {
    id: string;
    name: string;
    logo_url: string | null;
    emoji: string | null;
    price_usdt: number | null;
    price_inr: number | null;
    purchasable: boolean;
    availability: string;
    duration_label: string | null;
  } | null;
};

function CtaLink({ slide, className, children }: { slide: HeroSlide; className: string; children: React.ReactNode }) {
  const { href, productId } = slide.cta;
  if (href && /^https:\/\//.test(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  if (href && href.startsWith("/")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  if (productId) {
    return (
      <Link to="/product/$productId" params={{ productId }} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <Link to="/offers" className={className}>
      {children}
    </Link>
  );
}

/** Large promotional banner: admin-managed offers first, real catalogue products as fallback. */
export function OfferHero({ slides, loading }: { slides: HeroSlide[]; loading: boolean }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), 7000);
    return () => window.clearInterval(t);
  }, [count, paused]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  if (loading || !count) {
    return (
      <div className="surface-ink relative h-[420px] overflow-hidden rounded-3xl sm:h-[460px]">
        <div className="bg-grid-ink absolute inset-0 opacity-60" />
        {!loading && (
          <div className="relative flex h-full flex-col items-start justify-center gap-4 px-8 sm:px-14">
            <p className="eyebrow text-primary">Foxgen AI Store</p>
            <h1 className="max-w-xl text-4xl font-bold sm:text-5xl">Premium software. Better prices. Exclusive access.</h1>
            <Link to="/shop" className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground">
              Browse the store <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured offers"
      className="surface-ink relative overflow-hidden rounded-3xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="bg-grid-ink pointer-events-none absolute inset-0 opacity-60" />
      <div className="bg-brand-gradient pointer-events-none absolute -right-32 -top-40 size-[34rem] rounded-full opacity-30 blur-[120px]" />
      <div className="flex transition-transform duration-700 ease-out" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((slide, i) => (
          <div
            key={slide.key}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== index}
            className="relative grid w-full shrink-0 gap-8 px-6 pb-16 pt-10 sm:px-10 sm:pt-14 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:px-14 lg:pb-20 lg:pt-16"
          >
            <div className="max-w-xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="eyebrow text-primary">{slide.eyebrow}</span>
                {slide.badge && (
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">{slide.badge}</span>
                )}
              </div>
              <h1 className="mt-4 text-[34px] font-bold leading-[1.06] sm:text-5xl lg:text-[56px]">{slide.title}</h1>
              {slide.description && <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">{slide.description}</p>}
              {slide.product && (
                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span className="text-sm text-muted-foreground">{slide.product.name}</span>
                  {slide.product.price_usdt !== null && (
                    <span className="flex items-baseline gap-1.5">
                      <span className="font-display text-3xl font-bold tabular-nums">{slide.product.price_usdt.toFixed(2)}</span>
                      <span className="eyebrow text-muted-foreground">USDT</span>
                      {slide.product.price_inr !== null && <span className="text-sm text-muted-foreground">· ₹{slide.product.price_inr.toFixed(0)}</span>}
                    </span>
                  )}
                  {!slide.product.purchasable && (
                    <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                      {slide.product.availability === "coming_soon" ? "Coming soon" : "Currently sold out"}
                    </span>
                  )}
                </div>
              )}
              {slide.endsAt && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="size-3.5" /> Offer valid until {shortDate(slide.endsAt)}
                </p>
              )}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <CtaLink
                  slide={slide}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-ember transition hover:brightness-110"
                >
                  {slide.cta.label} <ArrowRight className="size-4" />
                </CtaLink>
                {slide.product && (
                  <Link
                    to="/product/$productId"
                    params={{ productId: slide.product.id }}
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-card/40 px-6 text-sm font-semibold transition hover:bg-card"
                  >
                    Product details
                  </Link>
                )}
              </div>
              <p className="mt-6 text-[11px] text-muted-foreground/80">{slide.sourceLabel}</p>
            </div>
            <div className="relative mx-auto hidden w-full max-w-md sm:block lg:max-w-none">
              {slide.image ? (
                <img
                  src={slide.image}
                  alt={slide.product ? `${slide.product.name} promotion` : slide.title}
                  loading={i === 0 ? "eager" : "lazy"}
                  className="aspect-[4/3] w-full rounded-2xl border border-border object-cover shadow-lift"
                />
              ) : slide.product ? (
                <div className="relative flex aspect-[4/3] items-center justify-center rounded-2xl border border-border bg-card/60 shadow-lift">
                  <div className="bg-brand-gradient absolute inset-10 rounded-full opacity-25 blur-3xl" />
                  <div className="relative flex flex-col items-center gap-5 text-center">
                    <span className="scale-125">
                      <ProductLogo name={slide.product.name} logoUrl={slide.product.logo_url} emoji={slide.product.emoji} size="xl" />
                    </span>
                    <span className="max-w-xs px-6 font-display text-lg font-semibold">{slide.product.name}</span>
                    {slide.product.duration_label && <span className="text-sm text-muted-foreground">{slide.product.duration_label}</span>}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-5 flex items-center justify-between px-6 sm:px-10 lg:px-14">
          <div className="flex gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                aria-label={`Show slide ${i + 1}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-8 bg-primary" : "w-3 bg-foreground/25 hover:bg-foreground/40"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" aria-label="Previous slide" onClick={() => setIndex((i) => (i - 1 + count) % count)} className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card/50 hover:bg-card">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" aria-label="Next slide" onClick={() => setIndex((i) => (i + 1) % count)} className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card/50 hover:bg-card">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
