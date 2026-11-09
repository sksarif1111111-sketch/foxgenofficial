import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Clock3,
  Code2,
  Film,
  Gift,
  GraduationCap,
  Layers,
  Lock,
  MonitorSmartphone,
  Palette,
  Puzzle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { shopCatalog } from "@/lib/shop.functions";
import { publicOffers, type PublicOffer } from "@/lib/offers.functions";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { ProductLogo } from "@/components/site/product-logo";
import { PriceTag, ProductCard, type CatalogProduct } from "@/components/site/product-card";
import { OfferHero, type HeroSlide } from "@/components/site/offer-hero";
import { MORE_CATEGORY, STORE_CATEGORIES, categoryOf, type StoreCategoryId } from "@/lib/store-categories";
import { supplierIsStale } from "@/lib/offers";
import { timeAgo } from "@/lib/format";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Foxgen AI Store — Premium AI Tools & Software Offers" },
      {
        name: "description",
        content:
          "Exclusive offers on Lovable, ChatGPT, Gemini and premium software. Verified prices, owner-checked payments and delivery by email or Telegram.",
      },
      { property: "og:title", content: "Foxgen AI Store — Premium AI Tools & Software Offers" },
      { property: "og:description", content: "Premium software. Better prices. Exclusive access — on the web and in Telegram." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoreHome,
});

const CATEGORY_ICONS: Record<StoreCategoryId, typeof Sparkles> = {
  ai: Sparkles,
  build: Code2,
  office: MonitorSmartphone,
  creative: Palette,
  learning: GraduationCap,
  entertainment: Film,
  security: Lock,
  more: Layers,
};

const SOURCE_LABEL: Record<CatalogProduct["source"], string> = {
  manual: "Store managed",
  reseller: "Supplier API",
  digihup: "Supplier API",
};

function SectionHeader({ eyebrow, title, description, to = "/shop", action }: { eyebrow: string; title: string; description?: string; to?: "/shop" | "/offers"; action?: string }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="eyebrow text-primary">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-bold sm:text-[30px] sm:leading-tight">{title}</h2>
        {description && <p className="mt-2 text-sm text-muted-foreground sm:text-base">{description}</p>}
      </div>
      {action && (
        <Link to={to} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary">
          {action}
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

function ProductRow({ products, ribbon, footnote }: { products: CatalogProduct[]; ribbon?: (p: CatalogProduct, i: number) => string | undefined; footnote?: (p: CatalogProduct) => string | undefined }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
      {products.map((p, i) => (
        <div key={p.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
          <ProductCard product={p} ribbon={ribbon?.(p, i)} footnote={footnote?.(p)} />
        </div>
      ))}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-80 animate-pulse rounded-2xl border border-border bg-card p-3">
          <div className="aspect-[16/10] rounded-xl bg-muted" />
          <div className="mt-4 h-3 w-1/3 rounded bg-muted" />
          <div className="mt-3 h-4 w-3/4 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function OfferCard({ offer }: { offer: PublicOffer }) {
  const p = offer.product;
  const inner = (
    <>
      <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-xl bg-ink">
        {offer.image_url ? (
          <img src={offer.image_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        ) : p ? (
          <>
            <div className="bg-brand-gradient absolute inset-0 opacity-40" />
            <ProductLogo name={p.name} logoUrl={p.logo_url} emoji={p.emoji} size="lg" />
          </>
        ) : (
          <div className="bg-brand-gradient absolute inset-0 opacity-50" />
        )}
        {offer.badge && <span className="absolute left-3 top-3 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground">{offer.badge}</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-1 pt-4">
        {offer.headline && <span className="eyebrow text-primary">{offer.headline}</span>}
        <h3 className="line-clamp-2 font-semibold leading-snug">{offer.title}</h3>
        {offer.description && <p className="line-clamp-2 text-sm text-muted-foreground">{offer.description}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          {p?.price_usdt != null ? (
            <span className="flex items-baseline gap-1.5">
              <span className="font-display text-xl font-bold tabular-nums">{p.price_usdt.toFixed(2)}</span>
              <span className="eyebrow text-muted-foreground">USDT</span>
            </span>
          ) : (
            <span />
          )}
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
            {offer.cta_text} <ArrowRight className="size-3.5" />
          </span>
        </div>
      </div>
    </>
  );
  const cls = "group flex h-full flex-col rounded-2xl border border-border bg-card p-3 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift";
  if (p) {
    return (
      <Link to="/product/$productId" params={{ productId: p.id }} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <Link to="/offers" className={cls}>
      {inner}
    </Link>
  );
}

function StoreHome() {
  const loadCatalog = useServerFn(shopCatalog);
  const loadOffers = useServerFn(publicOffers);
  const { data, isLoading } = useQuery({ queryKey: ["home-catalog"], queryFn: () => loadCatalog() });
  const offersQuery = useQuery({ queryKey: ["public-offers"], queryFn: () => loadOffers() });
  const products = data?.products ?? [];
  const offers = offersQuery.data?.offers ?? [];

  const view = useMemo(() => {
    const live = products.filter((p) => p.purchasable);
    const flagged = live.filter((p) => p.featured);
    const featured = (flagged.length ? flagged : live).slice(0, 4);
    const byId = new Map(products.map((p) => [p.id, p]));
    const trending = (data?.trending ?? []).map((id) => byId.get(id)).filter((p): p is CatalogProduct => !!p?.purchasable).slice(0, 4);
    const latest = [...live].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")).slice(0, 4);
    const premium = [...live].filter((p) => p.price_usdt !== null).sort((a, b) => (b.price_usdt ?? 0) - (a.price_usdt ?? 0)).slice(0, 4);
    const updated = [...live].filter((p) => p.updated_at).sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? "")).slice(0, 8);
    const counts = new Map<StoreCategoryId, number>();
    for (const p of products) counts.set(categoryOf(p.name), (counts.get(categoryOf(p.name)) ?? 0) + 1);
    const categories = [...STORE_CATEGORIES, MORE_CATEGORY].map((c) => ({ ...c, count: counts.get(c.id) ?? 0 })).filter((c) => c.count > 0);
    const extensionProduct = products.find((p) => /foxgen pro/i.test(p.name));
    const brands = live.filter((p) => p.logo_url).filter((p, i, arr) => arr.findIndex((x) => x.logo_url === p.logo_url) === i).slice(0, 10);
    return { live, featured, trending, latest, premium, updated, categories, extensionProduct, brands };
  }, [products, data?.trending]);

  const slides: HeroSlide[] = useMemo(() => {
    if (offers.length) {
      return offers.slice(0, 5).map((o) => ({
        key: o.id,
        eyebrow: o.headline ?? "Exclusive software offer",
        title: o.title,
        description: o.description,
        badge: o.badge,
        image: o.image_url ?? o.product?.image_url ?? null,
        endsAt: o.ends_at,
        sourceLabel: o.source === "manual" ? "Foxgen offer · price shown is the current store price" : "Supplier offer · price and stock verified from the supplier API",
        cta: { label: o.cta_text, href: o.cta_url, productId: o.product?.id ?? null },
        product: o.product,
      }));
    }
    // No admin offers yet: feature real in-stock products from the catalogue (never invented content).
    return view.premium.slice(0, 3).map((p) => ({
      key: p.id,
      eyebrow: "Featured from the store",
      title: p.name,
      description: p.short_description ?? "Premium plan available now with owner-verified delivery.",
      badge: null,
      image: p.image_url,
      endsAt: null,
      sourceLabel: "Current store price · updated " + timeAgo(p.updated_at),
      cta: { label: "View offer", href: null, productId: p.id },
      product: p,
    }));
  }, [offers, view.premium]);

  const methods = data?.methods ?? [];
  const payNames = methods.filter((m) => m.provider !== "wallet").map((m) => m.name.replace(/\s*\(.*?\)\s*/g, " ").trim());
  const stale = supplierIsStale(data?.lastSupplierSync ?? null);
  const gridOffers = offers.slice(0, 4);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <section className="container-page pt-4 sm:pt-6">
        <OfferHero slides={slides} loading={isLoading || offersQuery.isLoading} />
      </section>

      {/* TRUST STRIP */}
      <section className="container-page mt-5">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Wallet, title: payNames.length ? payNames.slice(0, 3).join(" · ") : "Crypto & UPI", text: "Website payment options" },
            { icon: Bot, title: "Telegram bot checkout", text: "Same catalogue, pay with Stars" },
            { icon: ShieldCheck, title: "Owner-verified payments", text: "Every order is checked by hand" },
            { icon: Clock3, title: `About ${data?.reviewMinutes ?? 10} minute review`, text: "Access details arrive by email" },
          ].map((item) => (
            <div key={item.text} className="flex min-w-0 items-center gap-3 bg-card px-5 py-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <item.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{item.title}</span>
                <span className="block text-xs text-muted-foreground">{item.text}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <main className="container-page mt-16 space-y-20">
        {/* BRANDS + CATEGORIES */}
        {(view.brands.length > 0 || view.categories.length > 0) && (
          <section>
            <SectionHeader eyebrow="Shop by brand" title="Lovable, ChatGPT, Gemini and more" action="Browse all" />
            {view.brands.length > 0 && (
              <div className="no-scrollbar -mx-4 mb-6 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0 lg:grid-cols-10">
                {view.brands.map((p) => (
                  <Link
                    key={p.id}
                    to="/product/$productId"
                    params={{ productId: p.id }}
                    className="flex w-28 shrink-0 flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 sm:w-auto"
                  >
                    <ProductLogo name={p.name} logoUrl={p.logo_url} emoji={p.emoji} size="lg" />
                    <span className="line-clamp-1 text-xs font-medium">{p.name.split(/[\s—–-]+/).slice(0, 2).join(" ")}</span>
                  </Link>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {view.categories.map((c) => {
                const Icon = CATEGORY_ICONS[c.id];
                return (
                  <Link
                    key={c.id}
                    to="/shop"
                    search={{ category: c.id }}
                    className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 transition hover:border-primary/40"
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{c.label}</span>
                      <span className="block text-xs text-muted-foreground">{c.count} products</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* FEATURED OFFERS */}
        <section>
          <SectionHeader
            eyebrow="Featured offers"
            title={gridOffers.length ? "This week's promotions" : "Hand-picked for this week"}
            description="Available right now and ready to order."
            to={gridOffers.length ? "/offers" : "/shop"}
            action={gridOffers.length ? "All offers" : "See all products"}
          />
          {isLoading || offersQuery.isLoading ? (
            <SkeletonRow />
          ) : gridOffers.length ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {gridOffers.map((o) => (
                <OfferCard key={o.id} offer={o} />
              ))}
            </div>
          ) : (
            <ProductRow products={view.featured} ribbon={(_, i) => (i === 0 ? "Featured" : undefined)} />
          )}
        </section>

        {view.trending.length > 0 && (
          <section>
            <SectionHeader eyebrow="Trending software" title="Best sellers in the last 30 days" action="Shop trending" />
            <ProductRow products={view.trending} ribbon={(_, i) => `#${i + 1}`} />
          </section>
        )}

        {view.latest.length > 0 && (
          <section>
            <SectionHeader eyebrow="Latest products" title="Newly added to the store" action="Browse everything" />
            <ProductRow products={view.latest} ribbon={(_, i) => (i < 2 ? "New" : undefined)} />
          </section>
        )}

        {view.premium.length > 0 && (
          <section>
            <SectionHeader eyebrow="Premium software" title="Professional plans & yearly workspaces" description="Our highest-tier tools for builders and teams." />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {view.premium.map((p) => (
                <Link
                  key={p.id}
                  to="/product/$productId"
                  params={{ productId: p.id }}
                  className="group flex min-w-0 items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift sm:gap-5 sm:p-5"
                >
                  <ProductLogo name={p.name} logoUrl={p.logo_url} emoji={p.emoji} size="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="mt-1 line-clamp-1 block text-sm text-muted-foreground">{p.short_description ?? p.duration_label ?? "Premium plan"}</span>
                  </span>
                  <span className="hidden sm:block">
                    <PriceTag product={p} />
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* EXCLUSIVE */}
        <section className="surface-ink relative overflow-hidden rounded-3xl">
          <div className="bg-grid-ink pointer-events-none absolute inset-0 opacity-60" />
          <div className="bg-brand-gradient pointer-events-none absolute -left-24 bottom-0 size-80 rounded-full opacity-25 blur-[100px]" />
          <div className="relative grid gap-10 p-8 sm:p-12 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-xl">
              <p className="eyebrow text-primary">Exclusive Foxgen offers</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">FoxGEN Pro browser extension</h2>
              <p className="mt-3 text-muted-foreground">
                Our own extension for lovable.dev. Download it free and activate with a FoxGEN licence key — works on multiple devices.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link to="/extension" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
                  <Puzzle className="size-4" /> Download FoxGEN Pro
                </Link>
                {view.extensionProduct && (
                  <Link
                    to="/product/$productId"
                    params={{ productId: view.extensionProduct.id }}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold hover:bg-card"
                  >
                    Get a licence
                  </Link>
                )}
              </div>
            </div>
            <img src={BRAND.logo} alt={BRAND.name} width={208} height={208} className="relative mx-auto size-44 rounded-[2rem] ring-1 ring-border sm:size-52" />
          </div>
        </section>

        {/* FREE REWARDS */}
        <section className="grid grid-cols-1 gap-6 rounded-3xl border border-border bg-accent/60 p-8 sm:p-12 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-ember">
            <Gift className="size-7" />
          </span>
          <div>
            <p className="eyebrow text-accent-foreground">Free rewards</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Invite friends, earn credits, unlock licences.</h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Join our Telegram bot, complete the community tasks and share your invite link. Every verified friend earns 1 credit — redeem credits for FoxGEN Pro licences.
            </p>
          </div>
          <Link to="/hub" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-ink-foreground">
            <BadgeCheck className="size-4" /> Open Free Rewards
          </Link>
        </section>

        {/* RECENTLY UPDATED */}
        {view.updated.length > 0 && (
          <section>
            <SectionHeader
              eyebrow="Recently updated offers"
              title="Fresh prices and stock"
              description={
                stale
                  ? `Supplier prices were last verified ${timeAgo(data?.lastSupplierSync ?? null)}. Final price is confirmed at checkout.`
                  : `Supplier prices verified ${timeAgo(data?.lastSupplierSync ?? null)}.`
              }
              to="/offers"
              action="Latest offers"
            />
            <ProductRow products={view.updated.slice(0, 4)} footnote={(p) => `Updated ${timeAgo(p.updated_at)} · ${SOURCE_LABEL[p.source]}`} />
            {stale && (
              <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="size-3.5" /> Showing the last verified supplier information.
              </p>
            )}
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
