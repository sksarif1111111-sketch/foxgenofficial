import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CalendarClock, RefreshCw, Tag } from "lucide-react";
import { publicOffers } from "@/lib/offers.functions";
import { shopCatalog } from "@/lib/shop.functions";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { ProductLogo } from "@/components/site/product-logo";
import { ProductCard } from "@/components/site/product-card";
import { supplierIsStale } from "@/lib/offers";
import { shortDate, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/offers")({
  head: () => ({
    meta: [
      { title: "Latest Offers — Foxgen AI Store" },
      { name: "description", content: "Current Foxgen promotions and live supplier deals on AI tools and premium software, with verified prices and stock." },
      { property: "og:title", content: "Latest Offers — Foxgen AI Store" },
      { property: "og:description", content: "Current promotions and live supplier deals with verified prices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OffersPage,
});

function OffersPage() {
  const loadOffers = useServerFn(publicOffers);
  const loadCatalog = useServerFn(shopCatalog);
  const offersQ = useQuery({ queryKey: ["public-offers"], queryFn: () => loadOffers() });
  const catalogQ = useQuery({ queryKey: ["home-catalog"], queryFn: () => loadCatalog() });
  const offers = offersQ.data?.offers ?? [];
  const supplierDeals = (catalogQ.data?.products ?? [])
    .filter((p) => p.source !== "manual" && p.purchasable)
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
    .slice(0, 12);
  const lastSync = catalogQ.data?.lastSupplierSync ?? null;
  const stale = supplierIsStale(lastSync);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <header className="border-b border-border bg-card">
        <div className="container-page py-10 sm:py-14">
          <p className="eyebrow text-primary">Latest offers</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-5xl">Promotions & live deals</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Foxgen promotions are set by the owner. Supplier deals come straight from our connected supplier APIs — prices and stock are never invented.
          </p>
        </div>
      </header>

      <main id="main" className="container-page space-y-16 py-10 sm:py-14">
        <section>
          <div className="mb-6 flex items-center gap-2">
            <Tag className="size-5 text-primary" />
            <h2 className="text-2xl font-bold">Foxgen promotions</h2>
          </div>
          {offersQ.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-72 animate-pulse rounded-2xl border border-border bg-card" />)}
            </div>
          ) : offersQ.isError ? (
            <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">Offers could not be loaded right now. Please refresh in a moment.</p>
          ) : offers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
              <p className="font-semibold">No promotions are running right now</p>
              <p className="mt-1 text-sm text-muted-foreground">Check the live supplier deals below or browse the full store.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => {
                const p = o.product;
                return (
                  <article key={o.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
                    <div className="relative flex aspect-[16/9] items-center justify-center bg-ink">
                      {o.image_url ? (
                        <img src={o.image_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                      ) : p ? (
                        <>
                          <div className="bg-brand-gradient absolute inset-0 opacity-40" />
                          <ProductLogo name={p.name} logoUrl={p.logo_url} emoji={p.emoji} size="lg" />
                        </>
                      ) : (
                        <div className="bg-brand-gradient absolute inset-0 opacity-50" />
                      )}
                      {o.badge && <span className="absolute left-3 top-3 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground">{o.badge}</span>}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-5">
                      {o.headline && <span className="eyebrow text-primary">{o.headline}</span>}
                      <h3 className="text-lg font-semibold leading-snug">{o.title}</h3>
                      {o.description && <p className="text-sm text-muted-foreground">{o.description}</p>}
                      <div className="mt-auto space-y-3 pt-4">
                        {p && (
                          <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                            <span className="truncate text-muted-foreground">{p.name}</span>
                            {p.price_usdt !== null && <span className="font-display font-bold tabular-nums">{p.price_usdt.toFixed(2)} USDT</span>}
                          </div>
                        )}
                        {o.ends_at && (
                          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarClock className="size-3.5" /> Valid until {shortDate(o.ends_at)}
                          </p>
                        )}
                        {p ? (
                          <Link to="/product/$productId" params={{ productId: p.id }} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                            {o.cta_text} <ArrowRight className="size-4" />
                          </Link>
                        ) : o.cta_url ? (
                          <a href={o.cta_url} target={o.cta_url.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                            {o.cta_text} <ArrowRight className="size-4" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <RefreshCw className="size-5 text-primary" />
                <h2 className="text-2xl font-bold">Live supplier deals</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {lastSync
                  ? stale
                    ? `Last verified ${timeAgo(lastSync)} — showing the last verified prices and stock.`
                    : `Prices and stock verified ${timeAgo(lastSync)}.`
                  : "Supplier information has not been verified yet."}
              </p>
            </div>
            <Link to="/shop" className="text-sm font-semibold hover:text-primary">Browse all products →</Link>
          </div>
          {catalogQ.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-80 animate-pulse rounded-2xl border border-border bg-card" />)}
            </div>
          ) : supplierDeals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">No supplier products are in stock right now.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
              {supplierDeals.map((p) => (
                <ProductCard key={p.id} product={p} footnote={`Updated ${timeAgo(p.updated_at)} · Supplier API`} />
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
