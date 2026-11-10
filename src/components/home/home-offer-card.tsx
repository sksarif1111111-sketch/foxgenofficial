import { Link } from "@tanstack/react-router";
import { ShoppingBagOpen } from "@phosphor-icons/react/dist/ssr";
import type { CatalogProduct } from "@/components/site/product-card";
import { ProductLogo } from "@/components/site/product-logo";

const ease = "ease-[cubic-bezier(0.22,1,0.36,1)]";
const LIGHT_TILES = ["tile-lavender", "tile-sky", "tile-blush"] as const;
const tileFor = (name: string) => LIGHT_TILES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % LIGHT_TILES.length]!;

export function Availability({ p }: { p: CatalogProduct }) {
  const label = p.purchasable ? "In stock" : p.availability === "coming_soon" ? "Coming soon" : p.price_usdt === null ? "Price pending" : "Sold out";
  const tone = p.purchasable ? "bg-success/10 text-success" : "bg-muted text-muted-foreground";
  return (
    <span className={`caption-4 inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${tone}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

/** Homepage product card: verified data only, Buy now opens the existing checkout with this product selected. */
export function HomeOfferCard({ product: p, category }: { product: CatalogProduct; category: string }) {
  return (
    <article data-robot-point="" className={`group flex h-full flex-col rounded-2xl border border-border bg-card p-2 shadow-soft transition duration-500 ${ease} hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-lift`}>
      <Link
        to="/product/$productId"
        params={{ productId: p.id }}
        className={`card-sheen relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-xl ${p.image_url ? "bg-muted" : tileFor(p.name)} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
        aria-label={`${p.name} details`}
      >
        {p.image_url ? (
          <img src={p.image_url} alt={`${p.name} product image`} loading="lazy" className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 ${ease} group-hover:scale-[1.03]`} />
        ) : (
          <span className={`transition-transform duration-500 ${ease} group-hover:-translate-y-1 group-hover:scale-110`}>
            <ProductLogo name={p.name} logoUrl={p.logo_url} emoji={p.emoji} size="xl" />
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 px-2 pb-2 pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="caption-4 truncate text-muted-foreground">{category}</span>
          <Availability p={p} />
        </div>
        <h3 className="title-3 line-clamp-2">
          <Link to="/product/$productId" params={{ productId: p.id }} className="hover:text-primary focus-visible:outline-none focus-visible:underline">
            {p.name}
          </Link>
        </h3>
        {p.short_description && <p className="body-6 line-clamp-2 text-muted-foreground">{p.short_description}</p>}
        {p.duration_label && <p className="caption-4 text-muted-foreground">Plan: {p.duration_label}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          {p.price_usdt !== null ? (
            <p className="flex items-baseline gap-1">
              <span className="heading-6 tabular-nums">{p.price_usdt.toFixed(2)}</span>
              <span className="caption-4 text-muted-foreground">USDT</span>
              {p.price_inr !== null && <span className="caption-5 text-muted-foreground">· ₹{p.price_inr.toFixed(0)}</span>}
            </p>
          ) : (
            <p className="caption-2 text-muted-foreground">Price on request</p>
          )}
          {p.purchasable ? (
            <Link
              to="/shop"
              search={{ product: p.id, buy: true }}
              className={`button-sm inline-flex items-center gap-1 rounded-xl bg-navy px-3 py-2 text-navy-foreground transition duration-300 ${ease} hover:bg-primary hover:text-primary-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
              aria-label={`Buy ${p.name}`}
            >
              <ShoppingBagOpen size={14} weight="bold" /> Buy now
            </Link>
          ) : (
            <span className="button-sm rounded-full bg-muted px-3 py-2 text-muted-foreground" aria-disabled="true">
              Unavailable
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function OfferCardSkeleton() {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-2" aria-hidden="true">
      <div className="aspect-[16/10] animate-pulse rounded-lg bg-muted" />
      <div className="space-y-3 px-2 pb-2 pt-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="flex justify-between pt-3">
          <div className="h-6 w-16 animate-pulse rounded bg-muted" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}
