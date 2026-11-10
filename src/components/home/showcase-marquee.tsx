import { Link } from "@tanstack/react-router";
import type { CatalogProduct } from "@/components/site/product-card";
import { ProductLogo } from "@/components/site/product-logo";
import { shortProductName } from "@/lib/hero-scene";

const TILES = ["tile-night", "tile-lavender", "tile-sky", "tile-ember", "tile-blush"] as const;

/** Logo (or emoji) and the clean product name only: no price, plan length or badges. */
function ShowcaseTile({ product: p, index }: { product: CatalogProduct; index: number }) {
  const tile = TILES[index % TILES.length]!;
  const name = shortProductName(p.name);
  return (
    <Link
      to="/product/$productId"
      params={{ productId: p.id }}
      aria-label={`${name} details`}
      className="group block shrink-0 rounded-2xl border border-border/70 bg-card p-1.5 shadow-soft transition duration-500 ease-weighted hover:-translate-y-1 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className={`${tile} card-sheen relative flex h-44 w-[272px] flex-col justify-between overflow-hidden rounded-xl p-5 sm:h-52 sm:w-[340px]`}>
        <span className="w-fit transition-transform duration-500 ease-weighted group-hover:scale-110">
          <ProductLogo name={p.name} logoUrl={p.logo_url} emoji={p.emoji} size="lg" />
        </span>
        <p className="heading-6 line-clamp-2 sm:text-2xl sm:leading-8">{name}</p>
      </div>
    </Link>
  );
}

function Row({ items, reverse, offset }: { items: CatalogProduct[]; reverse?: boolean; offset: number }) {
  // Items are rendered twice so the -50% loop is seamless; the copy is hidden from assistive tech.
  return (
    <div className="mask-fade-x overflow-hidden motion-reduce:overflow-x-auto">
      <div className={`flex w-max gap-4 pause-on-hover ${reverse ? "animate-marquee-reverse" : "animate-marquee"}`}>
        {items.map((p, i) => <ShowcaseTile key={p.id} product={p} index={i + offset} />)}
        <div aria-hidden="true" className="flex gap-4 motion-reduce:hidden" inert>
          {items.map((p, i) => <ShowcaseTile key={`${p.id}-copy`} product={p} index={i + offset} />)}
        </div>
      </div>
    </div>
  );
}

/** Two moving rows of real store products, like a showcase wall. Pauses on hover; static under reduced motion. */
export function ShowcaseMarquee({ products, loading }: { products: CatalogProduct[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex gap-4 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[188px] w-[284px] shrink-0 animate-pulse rounded-2xl bg-muted sm:h-[220px] sm:w-[352px]" />)}
      </div>
    );
  }
  if (products.length === 0) return null;
  const half = Math.ceil(products.length / 2);
  const top = products.slice(0, Math.max(half, 3));
  const bottom = products.length >= 6 ? products.slice(half) : [];
  return (
    <div className="space-y-4" aria-label="Products in the store">
      <Row items={top} offset={0} />
      {bottom.length > 0 && <Row items={bottom} reverse offset={2} />}
    </div>
  );
}
