import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { ShopCatalog } from "@/lib/shop.functions";
import { ProductLogo } from "@/components/site/product-logo";
import { categoryLabel, categoryOf } from "@/lib/store-categories";

export type CatalogProduct = ShopCatalog["products"][number];

export function StockPill({ product }: { product: CatalogProduct }) {
  const tone = product.purchasable
    ? "bg-success/10 text-success"
    : product.availability === "coming_soon"
      ? "bg-warning/15 text-warning-foreground"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      <span className="size-1.5 rounded-full bg-current" />
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
    <span className="flex items-baseline gap-1.5">
      <span className={`font-display font-bold tabular-nums tracking-tight ${size === "lg" ? "text-4xl" : "text-xl"}`}>
        {product.price_usdt.toFixed(2)}
      </span>
      <span className="eyebrow text-muted-foreground">USDT</span>
      {product.price_inr !== null && (
        <span className="ml-1 text-xs text-muted-foreground">· ₹{product.price_inr.toFixed(0)}</span>
      )}
    </span>
  );
}

/** Marketplace product card used on Home and in the Store grid. */
export function ProductCard({
  product,
  onOpen,
  ribbon,
}: {
  product: CatalogProduct;
  onOpen?: () => void;
  ribbon?: string;
}) {
  const body = (
    <>
      <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
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
          <span className="eyebrow absolute left-3 top-3 rounded-md bg-ink px-2 py-1 text-[10px] text-ink-foreground">{ribbon}</span>
        )}
        <span className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-card/90 text-foreground opacity-0 shadow-soft transition group-hover:opacity-100">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-1 pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow truncate text-muted-foreground">{categoryLabel(categoryOf(product.name))}</span>
          <StockPill product={product} />
        </div>
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight">{product.name}</h3>
        {product.short_description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{product.short_description}</p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <PriceTag product={product} />
          {product.duration_label && <span className="text-xs text-muted-foreground">{product.duration_label}</span>}
        </div>
      </div>
    </>
  );
  const cls =
    "group flex h-full flex-col rounded-2xl border border-border bg-card p-3 text-left shadow-soft transition duration-300 hover:-translate-y-1 hover:border-foreground/15 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className={cls}>
        {body}
      </button>
    );
  }
  return (
    <Link to="/shop" search={{ product: product.id }} className={cls}>
      {body}
    </Link>
  );
}
