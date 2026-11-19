import { ProductCard, type CatalogProduct } from "@/components/site/product-card";

/** Home and Shop share the same compact image, name and price presentation. */
export function HomeOfferCard({ product }: { product: CatalogProduct; category?: string }) {
  return <ProductCard product={product} />;
}

export function OfferCardSkeleton() {
  return (
    <div className="catalog-card" aria-hidden="true">
      <div className="catalog-card-image animate-pulse" />
      <div className="catalog-card-content space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
