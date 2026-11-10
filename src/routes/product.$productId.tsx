import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, ChevronRight, Clock3, Mail, PackageX, ShieldCheck, Wallet } from "lucide-react";
import { shopProductDetail } from "@/lib/shop.functions";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { ProductLogo } from "@/components/site/product-logo";
import { PriceTag, ProductCard, StockPill } from "@/components/site/product-card";
import { categoryLabel, categoryOf } from "@/lib/store-categories";
import { timeAgo } from "@/lib/format";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/product/$productId")({
  loader: async ({ params }) => {
    if (!UUID.test(params.productId)) throw notFound();
    const detail = await shopProductDetail({ data: { id: params.productId } });
    if (!detail) throw notFound();
    return detail;
  },
  head: ({ loaderData }) => {
    const p = loaderData?.product;
    const title = p ? `${p.name} — Foxgen AI Store` : "Product unavailable — Foxgen AI Store";
    const description = p?.short_description ?? (p ? `Buy ${p.name} at Foxgen AI Store with owner-verified delivery.` : "This product is not available.");
    const meta = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (!p) meta.push({ name: "robots", content: "noindex" });
    if (p?.image_url && /^https:\/\//.test(p.image_url)) {
      meta.push({ property: "og:image", content: p.image_url }, { name: "twitter:image", content: p.image_url });
    }
    return { meta };
  },
  notFoundComponent: ProductMissing,
  component: ProductPage,
});

function ProductMissing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main id="main" className="container-page flex flex-col items-center py-24 text-center">
        <PackageX className="size-12 text-muted-foreground" />
        <h1 className="mt-5 text-3xl font-bold">This product isn't available</h1>
        <p className="mt-2 max-w-md text-muted-foreground">It may have been removed or is no longer listed. Browse the store for current offers.</p>
        <Link to="/shop" className="mt-8 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
          <ArrowLeft className="size-4" /> Back to the shop
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}

function ProductPage() {
  const { product: p, related, methods, reviewMinutes, lastSupplierSync } = Route.useLoaderData();
  const category = categoryOf(p.name);
  const isSupplier = p.source !== "manual";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <div className="border-b border-border bg-card">
        <nav aria-label="Breadcrumb" className="container-page flex items-center gap-1.5 py-4 text-xs text-muted-foreground">
          <Link to="/shop" className="hover:text-foreground">Shop</Link>
          <ChevronRight className="size-3" />
          <Link to="/shop" search={{ category }} className="hover:text-foreground">{categoryLabel(category)}</Link>
          <ChevronRight className="size-3" />
          <span className="truncate text-foreground">{p.name}</span>
        </nav>
      </div>

      <main id="main" className="container-page py-8 sm:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.3fr_1fr] lg:gap-12">
          <div className="space-y-6">
            <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-3xl border border-border bg-ink">
              {p.image_url ? (
                <img src={p.image_url} alt={`${p.name} product image`} className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <>
                  <div className="bg-brand-gradient absolute inset-0 opacity-30" />
                  <div className="bg-grid-ink absolute inset-0 opacity-60" />
                  <span className="relative scale-125">
                    <ProductLogo name={p.name} logoUrl={p.logo_url} emoji={p.emoji} size="xl" />
                  </span>
                </>
              )}
            </div>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <h2 className="text-lg font-semibold">About this product</h2>
              {p.description ? (
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{p.description}</p>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">{p.short_description ?? "Details are shared with your delivery."}</p>
              )}
              {p.features.length > 0 && (
                <>
                  <h3 className="mt-6 text-sm font-semibold">Features</h3>
                  <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {(p.duration_label || p.credits_per_interval !== null) && (
              <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <h2 className="text-lg font-semibold">Available plan</h2>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/30 bg-accent/50 p-4">
                  <div>
                    <p className="font-semibold">{p.duration_label ?? "Standard plan"}</p>
                    {p.credits_per_interval !== null && (
                      <p className="text-sm text-muted-foreground">Includes {p.credits_per_interval} credits every {p.renewal_interval ?? "month"}</p>
                    )}
                  </div>
                  <PriceTag product={p} />
                </div>
              </section>
            )}

            {p.installation_instructions && (
              <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <h2 className="text-lg font-semibold">How delivery works</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{p.installation_instructions}</p>
              </section>
            )}

            {p.terms && (
              <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
                <h2 className="text-lg font-semibold">Important terms</h2>
                <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{p.terms}</p>
              </section>
            )}
          </div>

          <aside className="order-first lg:order-none lg:sticky lg:top-24 lg:self-start">
            <div data-robot-point="" className="rounded-2xl border border-border bg-card p-6 shadow-lift">
              <div className="flex items-center justify-between gap-3">
                <span className="eyebrow text-muted-foreground">{categoryLabel(category)}</span>
                <StockPill product={p} />
              </div>
              <div className="mt-4 flex items-center gap-4">
                <ProductLogo name={p.name} logoUrl={p.logo_url} emoji={p.emoji} size="md" />
                <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{p.name}</h1>
              </div>
              {p.short_description && <p className="mt-3 text-sm text-muted-foreground">{p.short_description}</p>}
              <div className="mt-6 border-y border-border py-5">
                <PriceTag product={p} size="lg" />
                {p.duration_label && <p className="mt-1 text-sm text-muted-foreground">{p.duration_label}</p>}
                {p.stock_label.includes("available") && <p className="mt-1 text-xs text-muted-foreground">{p.stock_label}</p>}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {isSupplier ? `Price & stock from supplier API · verified ${timeAgo(lastSupplierSync)}` : `Store price · updated ${timeAgo(p.updated_at)}`}
                </p>
              </div>
              <div className="mt-6 flex flex-col gap-2">
                {p.purchasable ? (
                  <Link
                    to="/shop"
                    search={{ product: p.id, buy: true }}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-ember transition hover:brightness-110"
                  >
                    Buy now
                  </Link>
                ) : (
                  <span className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-muted text-sm font-medium text-muted-foreground">
                    {p.availability === "coming_soon" ? "Coming soon" : p.price_usdt === null ? "Price not available yet" : "Currently sold out"}
                  </span>
                )}
                <Link to="/support" className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-border text-sm font-semibold hover:bg-muted">
                  Ask a question
                </Link>
              </div>
              <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0" />Your order is confirmed only after the owner checks the payment.</li>
                <li className="flex items-start gap-3"><Clock3 className="mt-0.5 size-4 shrink-0" />Typical review time is about {reviewMinutes} minutes.</li>
                <li className="flex items-start gap-3"><Mail className="mt-0.5 size-4 shrink-0" />Access details are delivered by email.</li>
                {methods.length > 0 && <li className="flex items-start gap-3"><Wallet className="mt-0.5 size-4 shrink-0" />Pay with {methods.join(", ")}.</li>}
              </ul>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-6 text-2xl font-bold">More in {categoryLabel(category)}</h2>
            <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
              {related.map((r) => (
                <ProductCard key={r.id} product={r} />
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
