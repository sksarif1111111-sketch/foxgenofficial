import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import type { ShopCatalog } from "@/lib/shop.functions";
import { ProductLogo } from "@/components/site/product-logo";
import { categoryLabel, categoryOf } from "@/lib/store-categories";

export type CatalogProduct = ShopCatalog["products"][number];

/** Consistent decorative badge requested for every storefront product card. */
export function HotBadge() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-primary/40 bg-navy px-1.5 py-1 text-[9px] font-bold leading-none tracking-[0.14em] text-navy-foreground shadow-soft sm:left-3 sm:top-3 sm:px-2 sm:text-[10px]">
      <Sparkle weight="fill" className="size-2.5 sm:size-3" /> HOT
    </span>
  );
}

export function StockPill({ product }: { product: CatalogProduct }) {
  const tone = product.purchasable
    ? "bg-success/10 text-success"
    : product.availability === "coming_soon"
      ? "bg-warning/15 text-warning-foreground"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium sm:gap-1.5 sm:px-2 sm:text-[11px] ${tone}`}>
      <span className="size-1 rounded-full bg-current sm:size-1.5" />
      {product.purchasable ? "In stock" : product.availability === "coming_soon" ? "Coming soon" : "Sold out"}
    </span>
  );
}

/** Splits "25.00 USDT" style labels so the number can carry the visual weight. */
export function PriceTag({ product, size = "md" }: { product: CatalogProduct; size?: "md" | "lg" }) {
  if (product.price_usdt === null) {
    return <span className="text-sm font-medium text-muted-foreground">Price on request</span>;
  }
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-1">
      <span className={`font-display font-bold tabular-nums ${size === "lg" ? "heading-5 sm:heading-3" : "title-4 sm:title-1"}`}>
        {product.price_usdt.toFixed(2)}
      </span>
      <span className="eyebrow text-muted-foreground">USDT</span>
      {product.price_inr !== null && (
        <span className="text-[10px] text-muted-foreground sm:ml-1 sm:text-xs">· ₹{product.price_inr.toFixed(0)}</span>
      )}
    </span>
  );
}

/** Marketplace product card used on Home and in the Store grid. */
export function ProductCard({
  product,
  onOpen,
  ribbon,
  footnote,
}: {
  product: CatalogProduct;
  onOpen?: () => void;
  ribbon?: string;
  /** Small line under the price, e.g. "Updated 2h ago · Supplier API". */
  footnote?: string;
}) {
  const body = (
    <>
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-border bg-muted sm:aspect-[16/10] sm:rounded-xl">
        <HotBadge />
        {product.image_url ? (
          <img src={product.image_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--color-accent),transparent_60%)]" />
            <div className="relative transition duration-500 group-hover:scale-105">
              <ProductLogo name={product.name} logoUrl={product.logo_url} emoji={product.emoji} size="lg" />
            </div>
          </>
        )}
        {ribbon && (
          <span className="eyebrow absolute bottom-2 left-2 rounded-md bg-primary px-2 py-1 text-[10px] text-primary-foreground sm:bottom-auto sm:left-3 sm:top-12">{ribbon}</span>
        )}
        <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-card/90 text-foreground opacity-0 shadow-soft transition group-hover:opacity-100 sm:right-3 sm:top-3 sm:size-8">
          <ArrowUpRight className="size-3 sm:size-4" />
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-0.5 pt-2 sm:gap-2 sm:px-1 sm:pt-4">
        <div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <span className="caption-5 truncate text-muted-foreground sm:eyebrow">{categoryLabel(categoryOf(product.name))}</span>
          <StockPill product={product} />
        </div>
        <h3 className="body-4 line-clamp-2 min-h-10 break-words sm:min-h-0">{product.name}</h3>
        {product.short_description && (
          <p className="caption-4 line-clamp-1 text-muted-foreground sm:body-6 sm:line-clamp-2">{product.short_description}</p>
        )}
        <div className="mt-auto flex min-w-0 flex-wrap items-end justify-between gap-1 pt-2 sm:pt-3">
          <PriceTag product={product} />
          {product.duration_label && <span className="text-[10px] text-muted-foreground sm:text-xs">{product.duration_label}</span>}
        </div>
        {footnote && <p className="border-t border-border pt-2 text-[9px] text-muted-foreground sm:text-[11px]">{footnote}</p>}
      </div>
    </>
  );
  const cls =
    "group flex h-full min-w-0 flex-col rounded-lg border border-border bg-card p-1.5 text-left shadow-soft transition duration-300 hover:-translate-y-1 hover:border-foreground/15 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-3";
  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className={cls} data-robot-point="">
        {body}
      </button>
    );
  }
  return (
    <Link to="/product/$productId" params={{ productId: product.id }} className={cls} data-robot-point="">
      {body}
    </Link>
  );
}
