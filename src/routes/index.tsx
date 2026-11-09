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
  MonitorSmartphone,
  Palette,
  Puzzle,
  ShieldCheck,
  Sparkles,
  Lock,
  Wallet,
} from "lucide-react";
import { shopCatalog } from "@/lib/shop.functions";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { ProductLogo } from "@/components/site/product-logo";
import { PriceTag, ProductCard, type CatalogProduct } from "@/components/site/product-card";
import { MORE_CATEGORY, STORE_CATEGORIES, categoryOf, type StoreCategoryId } from "@/lib/store-categories";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FOXGEN OFFICIAL — Premium Software & AI Tools Marketplace" },
      {
        name: "description",
        content:
          "Shop premium AI assistants, builder tools, Office and creator software at FOXGEN OFFICIAL. Pay with USDT, Binance or UPI and get delivery by email.",
      },
      { property: "og:title", content: "FOXGEN OFFICIAL — Premium Software & AI Tools Marketplace" },
      { property: "og:description", content: "AI assistants, builder tools and software licences — on the web and in Telegram." },
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

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: { label: string; search?: { category?: string } };
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="eyebrow text-primary">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-bold sm:text-[32px] sm:leading-tight">{title}</h2>
        {description && <p className="mt-2 text-sm text-muted-foreground sm:text-base">{description}</p>}
      </div>
      {action && (
        <Link
          to="/shop"
          search={action.search ?? {}}
          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary"
        >
          {action.label}
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

function ProductRow({ products, ribbon }: { products: CatalogProduct[]; ribbon?: (p: CatalogProduct, i: number) => string | undefined }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
      {products.map((p, i) => (
        <div key={p.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
          <ProductCard product={p} ribbon={ribbon?.(p, i)} />
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

function StoreHome() {
  const load = useServerFn(shopCatalog);
  const { data, isLoading } = useQuery({ queryKey: ["home-catalog"], queryFn: () => load() });
  const products = data?.products ?? [];

  const view = useMemo(() => {
    const live = products.filter((p) => p.purchasable);
    const flagged = live.filter((p) => p.featured);
    const featured = (flagged.length ? flagged : live).slice(0, 4);
    const byId = new Map(products.map((p) => [p.id, p]));
    const trending = (data?.trending ?? []).map((id) => byId.get(id)).filter((p): p is CatalogProduct => !!p?.purchasable).slice(0, 4);
    const latest = [...live]
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
      .slice(0, 8);
    const premium = [...live].filter((p) => p.price_usdt !== null).sort((a, b) => (b.price_usdt ?? 0) - (a.price_usdt ?? 0)).slice(0, 4);
    const counts = new Map<StoreCategoryId, number>();
    for (const p of products) counts.set(categoryOf(p.name), (counts.get(categoryOf(p.name)) ?? 0) + 1);
    const categories = [...STORE_CATEGORIES, MORE_CATEGORY]
      .map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }))
      .filter((c) => c.count > 0);
    const hero = premium[0] ?? live[0];
    const heroSide = live.filter((p) => p.id !== hero?.id && p.logo_url).slice(0, 3);
    const extensionProduct = products.find((p) => /foxgen pro/i.test(p.name));
    return { live, featured, trending, latest, premium, categories, hero, heroSide, extensionProduct };
  }, [products, data?.trending]);

  const methods = data?.methods ?? [];
  const payNames = methods.filter((m) => m.provider !== "wallet").map((m) => m.name.replace(/\s*\(.*?\)\s*/g, " ").trim());

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav
        right={
          <Link
            to="/shop"
            className="hidden h-9 items-center rounded-lg bg-ink px-4 text-sm font-semibold text-ink-foreground transition hover:opacity-90 md:inline-flex"
          >
            Shop now
          </Link>
        }
      />

      {/* HERO */}
      <section className="container-page pt-4 sm:pt-6">
        <div className="surface-ink relative overflow-hidden rounded-3xl">
          <div className="bg-grid-ink pointer-events-none absolute inset-0 opacity-70" />
          <div className="pointer-events-none absolute -right-24 -top-32 size-[28rem] rounded-full bg-primary/25 blur-[120px]" />
          <div className="relative grid gap-10 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:px-14 lg:py-20">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-primary" />
                Software marketplace · Website & Telegram
              </span>
              <h1 className="mt-6 text-[40px] font-bold leading-[1.02] sm:text-6xl lg:text-[68px]">
                Premium software,
                <br />
                <span className="text-primary">without the premium.</span>
              </h1>
              <p className="mt-5 max-w-md text-base text-muted-foreground sm:text-lg">
                AI assistants, builder tools, Office and creator suites — checked by a real owner and delivered to your
                inbox.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/shop"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-ember transition hover:brightness-105"
                >
                  Browse {view.live.length ? `${view.live.length} products` : "the store"}
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  to="/extension"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card/40 px-6 text-sm font-semibold transition hover:bg-card"
                >
                  <Puzzle className="size-4" /> FoxGEN Pro extension
                </Link>
              </div>
              <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-border pt-6">
                <div>
                  <dt className="eyebrow text-muted-foreground">In stock</dt>
                  <dd className="mt-1 font-display text-2xl font-bold tabular-nums">{isLoading ? "—" : view.live.length}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-muted-foreground">Pay with</dt>
                  <dd className="mt-1 font-display text-2xl font-bold tabular-nums">{isLoading ? "—" : methods.length}</dd>
                </div>
                <div>
                  <dt className="eyebrow text-muted-foreground">Review</dt>
                  <dd className="mt-1 font-display text-2xl font-bold tabular-nums">~{data?.reviewMinutes ?? 10}m</dd>
                </div>
              </dl>
            </div>

            {/* Offer composition */}
            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              {view.hero ? (
                <Link
                  to="/shop"
                  search={{ product: view.hero.id }}
                  className="group relative block rounded-3xl border border-border bg-card p-6 shadow-lift transition hover:-translate-y-1 sm:p-8"
                >
                  <div className="flex items-start justify-between gap-4">
                    <ProductLogo name={view.hero.name} logoUrl={view.hero.logo_url} emoji={view.hero.emoji} size="lg" />
                    <span className="eyebrow rounded-md bg-primary px-2 py-1 text-[10px] text-primary-foreground">Top offer</span>
                  </div>
                  <h3 className="mt-6 text-2xl font-bold leading-tight sm:text-3xl">{view.hero.name}</h3>
                  {view.hero.short_description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{view.hero.short_description}</p>
                  )}
                  <div className="mt-8 flex items-end justify-between gap-4">
                    <PriceTag product={view.hero} size="lg" />
                    <span className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-semibold text-background transition group-hover:bg-primary group-hover:text-primary-foreground">
                      View <ArrowRight className="size-4" />
                    </span>
                  </div>
                </Link>
              ) : (
                <div className="h-72 animate-pulse rounded-3xl border border-border bg-card" />
              )}
              {view.heroSide.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {view.heroSide.map((p) => (
                    <Link
                      key={p.id}
                      to="/shop"
                      search={{ product: p.id }}
                      className="flex flex-col gap-3 rounded-2xl border border-border bg-card/70 p-3 transition hover:bg-card sm:p-4"
                    >
                      <ProductLogo name={p.name} logoUrl={p.logo_url} emoji={p.emoji} size="sm" />
                      <span className="line-clamp-1 text-xs font-medium">{p.name}</span>
                      <span className="font-display text-sm font-bold tabular-nums">
                        {p.price_usdt !== null ? `${p.price_usdt.toFixed(2)}` : "—"}
                        <span className="ml-1 text-[10px] font-medium text-muted-foreground">USDT</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="container-page mt-6">
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

      <main className="container-page mt-20 space-y-24">
        {/* CATEGORIES */}
        {view.categories.length > 0 && (
          <section>
            <SectionHeader eyebrow="Popular categories" title="Find the right tool, fast." />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {view.categories.map((c) => {
                const Icon = CATEGORY_ICONS[c.id];
                return (
                  <Link
                    key={c.id}
                    to="/shop"
                    search={{ category: c.id }}
                    className="group flex flex-col justify-between gap-6 rounded-2xl border border-border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40"
                  >
                    <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="size-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{c.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{c.count} products</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* FEATURED */}
        <section>
          <SectionHeader
            eyebrow="Featured offers"
            title="Hand-picked for this week"
            description="Available right now and ready to order."
            action={{ label: "See all products" }}
          />
          {isLoading ? <SkeletonRow /> : <ProductRow products={view.featured} ribbon={(_, i) => (i === 0 ? "Featured" : undefined)} />}
        </section>

        {/* TRENDING — only when real paid orders exist */}
        {view.trending.length > 0 && (
          <section>
            <SectionHeader eyebrow="Trending" title="Best sellers in the last 30 days" action={{ label: "Shop trending" }} />
            <ProductRow products={view.trending} ribbon={(_, i) => `#${i + 1}`} />
          </section>
        )}

        {/* EXCLUSIVE */}
        <section className="surface-ink relative overflow-hidden rounded-3xl">
          <div className="bg-grid-ink pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative grid gap-10 p-8 sm:p-12 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-xl">
              <p className="eyebrow text-primary">Exclusive to FOXGEN</p>
              <h2 className="mt-3 text-3xl font-bold sm:text-4xl">FoxGEN Pro browser extension</h2>
              <p className="mt-3 text-muted-foreground">
                Our own extension for lovable.dev. Download it free and activate with a FoxGEN licence key — works on
                multiple devices.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/extension"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
                >
                  Download FoxGEN Pro <ArrowRight className="size-4" />
                </Link>
                {view.extensionProduct && (
                  <Link
                    to="/shop"
                    search={{ product: view.extensionProduct.id }}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold hover:bg-card"
                  >
                    Get a licence
                  </Link>
                )}
              </div>
            </div>
            <div className="relative mx-auto">
              <div className="absolute inset-0 rounded-full bg-primary/30 blur-3xl" />
              <img src="/foxgen-logo.png" alt="FoxGEN Pro" width={176} height={176} className="relative size-36 rounded-[2rem] ring-1 ring-border sm:size-44" />
            </div>
          </div>
        </section>

        {/* LATEST */}
        {view.latest.length > 0 && (
          <section>
            <SectionHeader eyebrow="Latest software deals" title="Newly added to the store" action={{ label: "Browse everything" }} />
            <ProductRow products={view.latest} ribbon={(_, i) => (i < 2 ? "New" : undefined)} />
          </section>
        )}

        {/* PREMIUM */}
        {view.premium.length > 0 && (
          <section>
            <SectionHeader
              eyebrow="Premium products"
              title="Professional plans & yearly workspaces"
              description="Our highest-tier tools for builders and teams."
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {view.premium.map((p) => (
                <Link
                  key={p.id}
                  to="/shop"
                  search={{ product: p.id }}
                  className="group flex min-w-0 items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft sm:gap-5 sm:p-5 transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <ProductLogo name={p.name} logoUrl={p.logo_url} emoji={p.emoji} size="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="mt-1 line-clamp-1 block text-sm text-muted-foreground">
                      {p.short_description ?? p.duration_label ?? "Premium plan"}
                    </span>
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

        {/* FREE REWARDS */}
        <section className="grid gap-6 rounded-3xl border border-border bg-accent/60 p-8 sm:p-12 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-ember">
            <Gift className="size-7" />
          </span>
          <div>
            <p className="eyebrow text-accent-foreground">Free rewards</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Invite friends, earn credits, unlock licences.</h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Join our Telegram bot, complete the community tasks and share your invite link. Credits can be redeemed
              for FoxGEN Pro licences in your Rewards hub.
            </p>
          </div>
          <Link
            to="/hub"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-ink-foreground"
          >
            <BadgeCheck className="size-4" /> Open Rewards hub
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
