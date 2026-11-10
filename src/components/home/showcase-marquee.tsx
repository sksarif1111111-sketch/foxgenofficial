import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import type { CatalogProduct } from "@/components/site/product-card";
import { ProductLogo } from "@/components/site/product-logo";

const TILES = ["tile-night", "tile-lavender", "tile-sky", "tile-ember", "tile-blush"] as const;

function ShowcaseTile({ product: p, index }: { product: CatalogProduct; index: number }) {
  const tile = TILES[index % TILES.length]!;
  return (
    <Link
      to="/product/$productId"
      params={{ productId: p.id }}
      aria-label={`${p.name} details`}
      className="group block shrink-0 rounded-2xl border border-border/70 bg-card p-1.5 shadow-soft transition duration-500 ease-weighted hover:-translate-y-1 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className={`${tile} card-sheen relative flex h-44 w-[272px] flex-col justify-between overflow-hidden rounded-xl p-5 sm:h-52 sm:w-[340px]`}>
        <div className="flex items-start justify-between gap-3">
          <span className="transition-transform duration-500 ease-weighted group-hover:scale-110">
            <ProductLogo name={p.name} logoUrl={p.logo_url} emoji={p.emoji} size="lg" />
          </span>
          {p.featured && <span className="caption-4 rounded-full bg-card/90 px-2 py-0.5 text-foreground shadow-soft">Featured</span>}
        </div>
        <div className="min-w-0">
          <p className="heading-6 line-clamp-2 sm:text-2xl sm:leading-8">{p.name}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="caption-1 rounded-full bg-card/90 px-3 py-1 tabular-nums text-foreground shadow-soft">
              {p.price_usdt !== null ? `${p.price_usdt.toFixed(2)} USDT` : "Price on request"}
            </span>
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-card/90 text-foreground opacity-0 shadow-soft transition duration-500 ease-weighted group-hover:opacity-100">
              <ArrowUpRight size={16} weight="bold" />
            </span>
          </div>
        </div>
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
