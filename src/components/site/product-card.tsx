import { Link } from "@tanstack/react-router";
import type { ShopCatalog } from "@/lib/shop.functions";
import { ProductLogo } from "@/components/site/product-logo";
import { Button } from "@/components/ui/button";
import { cleanProductText } from "@/lib/product-content";

export type CatalogProduct = ShopCatalog["products"][number];

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

/** Minimal catalogue card; details and purchase actions remain on the individual product page. */
export function ProductCard({ product, onOpen }: { product: CatalogProduct; onOpen?: () => void; footnote?: string; ribbon?: string }) {
  const body = (
    <>
      <div className="catalog-card-image">
        {product.image_url ? (
          <img src={product.image_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-contain" />
        ) : (
          <ProductLogo name={cleanProductText(product.name)} logoUrl={product.logo_url} emoji={null} size="lg" />
        )}
      </div>
      <div className="catalog-card-content">
        <h3 className="catalog-card-name">{cleanProductText(product.name)}</h3>
        <div className="catalog-card-price">
          {product.price_usdt === null ? (
            <span className="caption-3 text-muted-foreground">Price on request</span>
          ) : (
            <>
              <span className="catalog-card-amount">{product.price_usdt.toFixed(2)} <span className="caption-4 font-normal text-muted-foreground">USDT</span></span>
              {product.price_inr !== null && <span className="caption-4 text-muted-foreground">₹{product.price_inr.toFixed(0)}</span>}
            </>
          )}
        </div>
      </div>
    </>
  );
  if (onOpen) return <Button variant="ghost" onClick={onOpen} className="catalog-card" data-robot-point="">{body}</Button>;
  return <Link to="/product/$productId" params={{ productId: product.id }} className="catalog-card" data-robot-point="">{body}</Link>;
}
