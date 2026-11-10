import { useEffect, useState, type ReactNode } from "react";
import { useHydrated } from "@tanstack/react-router";
import { Confetti, ShoppingBagOpen, Tag, Timer } from "@phosphor-icons/react/dist/ssr";
import { ACTIVE_OFFER } from "@/config/offers";
import { countdownParts, festiveOfferStatus, msUntilNextChange } from "@/lib/festive-offer";
import type { CatalogProduct } from "@/components/site/product-card";
import { ProductLogo } from "@/components/site/product-logo";
import { BuyNowLink } from "@/components/site/site-nav";
import { Reveal } from "@/components/home/reveal";

const ease = "ease-[cubic-bezier(0.22,1,0.36,1)]";
const MAX_TIMEOUT = 2_147_483_647;

/**
 * Whether the configured festive offer is live right now. Rechecks exactly when the offer
 * starts or ends, so every offer element appears and disappears on time without a reload.
 */
export function useFestiveOffer() {
  const [now, setNow] = useState(() => Date.now());
  const status = festiveOfferStatus(ACTIVE_OFFER, now);
  useEffect(() => {
    const current = Date.now();
    if (current !== now && festiveOfferStatus(ACTIVE_OFFER, current) !== status) return setNow(current);
    const wait = msUntilNextChange(ACTIVE_OFFER, current);
    if (wait === null) return;
    const id = window.setTimeout(() => setNow(Date.now()), Math.min(wait + 50, MAX_TIMEOUT));
    return () => window.clearTimeout(id);
  }, [now, status]);
  return { offer: ACTIVE_OFFER, live: status === "live" };
}

/** Finds the catalogue product named in the offer so the real product visual can be shown. */
export function findOfferProduct(products: CatalogProduct[], name: string) {
  const n = name.trim().toLowerCase();
  return products.find((p) => p.name.trim().toLowerCase() === n) ?? products.find((p) => p.name.toLowerCase().includes(n)) ?? null;
}

const pad = (v: number) => String(v).padStart(2, "0");

/** Live countdown to endsAt. Rendered only after mount so server and browser HTML always match. */
export function OfferCountdown({ className = "" }: { className?: string }) {
  const hydrated = useHydrated();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!hydrated || now === null) {
    return <span aria-hidden="true" className={`inline-block h-4 w-24 animate-pulse rounded bg-current opacity-20 ${className}`} />;
  }
  const { days, hours, minutes, seconds } = countdownParts(Date.parse(ACTIVE_OFFER.endsAt) - now);
  return (
    <time dateTime={ACTIVE_OFFER.endsAt} className={`font-mono tabular-nums ${className}`}>
      {days > 0 && `${days}d `}
      {pad(hours)}h {pad(minutes)}m {pad(seconds)}s
    </time>
  );
}

/** Slim bar at the very top of the page: offer name plus the live countdown. */
export function OfferAnnouncementBar() {
  return (
    <div role="region" aria-label="Current offer" className="surface-ink flex h-9 items-center justify-center gap-2 px-4">
      <Confetti size={16} weight="fill" className="shrink-0 text-primary" aria-hidden="true" />
      <p className="caption-1 min-w-0 truncate">{ACTIVE_OFFER.name}</p>
      <span aria-hidden="true" className="caption-5 shrink-0 text-muted-foreground">·</span>
      <p className="caption-2 flex shrink-0 items-center gap-1 text-muted-foreground">
        <span className="hidden min-[400px]:inline">Ends in</span>
        <OfferCountdown className="caption-4 text-foreground" />
      </p>
    </div>
  );
}

const ctaClass = `inline-flex items-center justify-center gap-2 rounded-full bg-primary px-3 py-2 text-primary-foreground transition duration-300 ${ease} hover:bg-primary/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`;

/** The single primary action: the offer CTA while the offer is live, otherwise the store's Buy now. */
export function PrimaryCta({ live, className = "" }: { live: boolean; className?: string }) {
  if (!live) {
    return (
      <BuyNowLink className={className}>
        <ShoppingBagOpen size={18} weight="bold" /> Buy now
      </BuyNowLink>
    );
  }
  const external = /^https?:\/\//i.test(ACTIVE_OFFER.ctaHref);
  return (
    <a href={ACTIVE_OFFER.ctaHref} {...(external ? { target: "_blank", rel: "noreferrer" } : {})} className={`${ctaClass} ${className}`}>
      <ShoppingBagOpen size={18} weight="bold" /> {ACTIVE_OFFER.ctaLabel}
    </a>
  );
}

function ProductVisual({ product, loading, size }: { product: CatalogProduct | null; loading: boolean; size: "lg" | "xl" }) {
  if (loading) return <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden="true" />;
  if (product?.image_url) {
    return <img src={product.image_url} alt={`${ACTIVE_OFFER.productName} product image`} className="absolute inset-0 h-full w-full object-cover" />;
  }
  return (
    <>
      <ProductLogo name={ACTIVE_OFFER.productName} logoUrl={product?.logo_url ?? null} emoji={product?.emoji ?? null} size={size} />
      <span className="sr-only">{ACTIVE_OFFER.productName} logo</span>
    </>
  );
}

function DiscountBadge({ animated }: { animated: boolean }) {
  return (
    <span className={`caption-3 absolute right-4 top-4 z-10 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-primary-foreground shadow-ember ${animated ? "animate-offer-pop" : ""}`}>
      <Tag size={14} weight="fill" aria-hidden="true" /> {ACTIVE_OFFER.discountLabel}
    </span>
  );
}

function Prices({ animated, size }: { animated: boolean; size: "hero" | "card" }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <p className={`overflow-hidden ${size === "hero" ? "heading-4" : "heading-5"}`}>
        <span className="sr-only">Offer price </span>
        <span className={`inline-block tabular-nums ${animated ? "animate-offer-rise" : ""}`}>{ACTIVE_OFFER.offerPrice}</span>
      </p>
      <p className="body-3 text-muted-foreground">
        <span className="sr-only">Original price </span>
        <del className="relative inline-block tabular-nums no-underline">
          {ACTIVE_OFFER.originalPrice}
          <span aria-hidden="true" className={`absolute inset-x-0 top-1/2 h-0.5 origin-left rounded-full bg-current ${animated ? "animate-offer-strike" : ""}`} />
        </del>
      </p>
    </div>
  );
}

/** Hero visual while an offer is live: product visual, discount badge, struck original price and offer price. */
export function HeroOfferVisual({ product, loading }: { product: CatalogProduct | null; loading: boolean }) {
  return (
    <div className="min-w-0 rounded-3xl border border-border bg-card p-2 shadow-lift">
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-muted">
        <DiscountBadge animated />
        <ProductVisual product={product} loading={loading} size="xl" />
      </div>
      <div className="flex flex-col gap-3 p-4 sm:p-6">
        <p className="caption-3 uppercase tracking-wider text-primary">{ACTIVE_OFFER.name}</p>
        <p className="title-1">{ACTIVE_OFFER.productName}</p>
        <Prices animated size="hero" />
        <p className="caption-2 flex items-center gap-2 text-muted-foreground">
          <Timer size={16} aria-hidden="true" /> Ends in <OfferCountdown className="caption-4 text-foreground" />
        </p>
      </div>
    </div>
  );
}

/** Offer section below the benefits: one product card that rises and fades in once on scroll. */
export function FestiveOfferSection({ product, loading }: { product: CatalogProduct | null; loading: boolean }): ReactNode {
  return (
    <section aria-labelledby="festive-title" className="container-page pb-16 lg:pb-24">
      <Reveal as="article" className="grid gap-2 rounded-3xl border border-border bg-card p-2 md:grid-cols-2">
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-muted md:aspect-auto md:min-h-80">
          <DiscountBadge animated={false} />
          <ProductVisual product={product} loading={loading} size="xl" />
        </div>
        <div className="flex flex-col justify-center gap-4 p-4 sm:p-8">
          <p className="caption-3 inline-flex items-center gap-2 uppercase tracking-wider text-primary">
            <Confetti size={16} weight="fill" aria-hidden="true" /> {ACTIVE_OFFER.name}
          </p>
          <h2 id="festive-title" className="heading-4 sm:heading-3">{ACTIVE_OFFER.productName}</h2>
          <Prices animated={false} size="card" />
          <p className="caption-2 flex items-center gap-2 text-muted-foreground">
            <Timer size={16} aria-hidden="true" /> Offer ends in <OfferCountdown className="caption-4 text-foreground" />
          </p>
          <div className="pt-2">
            <PrimaryCta live className="button-md" />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
