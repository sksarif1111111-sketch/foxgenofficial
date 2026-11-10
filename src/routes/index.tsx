import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  ChatCircleDots,
  CheckCircle,
  Gift,
  Lifebuoy,
  MagnifyingGlass,
  PlayCircle,
  SealCheck,
  Package,
  ShieldCheck,
  Sparkle,
  SquaresFour,
  TelegramLogo,
  Timer,
  UsersThree,
  WhatsappLogo,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { shopCatalog } from "@/lib/shop.functions";
import { publicOffers } from "@/lib/offers.functions";
import { publicSiteInfo } from "@/lib/site.functions";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { ProductLogo } from "@/components/site/product-logo";
import type { CatalogProduct } from "@/components/site/product-card";
import { HomeOfferCard, OfferCardSkeleton } from "@/components/home/home-offer-card";
import { Reveal } from "@/components/home/reveal";
import { TaglineReveal } from "@/components/home/tagline-reveal";
import { ShowcaseMarquee } from "@/components/home/showcase-marquee";
import { Faq, type FaqItem } from "@/components/home/faq";
import { FestiveOfferSection, HeroOfferVisual, OfferAnnouncementBar, PrimaryCta, findOfferProduct, useFestiveOffer } from "@/components/home/festive-offer";
import { categoryOf, type StoreCategoryId } from "@/lib/store-categories";
import { timeAgo } from "@/lib/format";
import { BRAND } from "@/lib/brand";

const ease = "ease-[cubic-bezier(0.22,1,0.36,1)]";

/** Static FAQ text used for structured data (dynamic details are added in the visible answers). */
const FAQ_SCHEMA: Array<{ q: string; a: string }> = [
  { q: "What products can I buy at Foxgen AI Store?", a: "AI assistants such as Gemini and ChatGPT plans, builder tools such as Lovable, productivity software, design tools and more. The store shows every product that is currently listed with its price and availability." },
  { q: "How do I buy a product?", a: "Press Buy now on a product, choose the quantity and a payment method, pay the exact amount and submit your payment reference. The owner checks the payment and then sends your access details." },
  { q: "Is a typed payment reference enough to confirm my order?", a: "No. An order is confirmed only after the owner sees the payment arrive in the receiving account." },
  { q: "How do I check current prices and stock?", a: "Every product card and product page shows the current store price and availability. Supplier products also show when their stock was last checked." },
  { q: "How do free rewards work?", a: "Start the Foxgen Telegram bot, complete the required community tasks, then share your invite link. Each verified friend earns 1 credit, and credits can be redeemed for FoxGEN Pro licences." },
  { q: "How do I contact support?", a: "Use the WhatsApp or Telegram support links on the support page, or ask the Foxgen AI assistant on the website." },
  { q: "Where can I find tutorials?", a: "The Tutorials page has step by step guides for installing and using the FoxGEN Pro extension." },
  { q: "Can I order inside Telegram?", a: "Yes. The Telegram bot has the same catalogue and supports payment with Telegram Stars." },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Foxgen AI Store — Lovable, ChatGPT and Gemini offers in one place" },
      {
        name: "description",
        content: "Browse current offers for Lovable, ChatGPT, Gemini, AI and developer tools. See real prices and stock, press Buy now, and get access after a person checks your payment.",
      },
      { property: "og:title", content: "Foxgen AI Store — Premium software access, better value, one place" },
      { property: "og:description", content: "Current offers for Lovable, ChatGPT, Gemini and developer tools with real prices and owner checked payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Foxgen AI Store — Premium software access" },
      { name: "twitter:description", content: "Current offers for Lovable, ChatGPT, Gemini and developer tools." },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ_SCHEMA.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }),
      },
    ],
  }),
  component: Home,
});

const GROUPS: Array<{ id: string; label: string; cats: StoreCategoryId[] }> = [
  { id: "ai", label: "AI software", cats: ["ai"] },
  { id: "dev", label: "Website and development tools", cats: ["build"] },
  { id: "productivity", label: "Productivity tools", cats: ["office"] },
  { id: "other", label: "Other software", cats: ["creative", "learning", "entertainment", "security", "more"] },
];
const groupOf = (p: CatalogProduct) => GROUPS.find((g) => g.cats.includes(categoryOf(p.name))) ?? GROUPS[3]!;

function SectionHead({ eyebrow, title, body, center = false, action }: { eyebrow: string; title: string; body?: string; center?: boolean; action?: React.ReactNode }) {
  return (
    <div className={`mb-10 flex flex-wrap items-end gap-6 ${center ? "flex-col items-center text-center" : "justify-between"}`}>
      <div className={`max-w-[680px] ${center ? "mx-auto" : ""}`}>
        <p className="caption-3 uppercase tracking-wider text-primary">{eyebrow}</p>
        <h2 className="heading-4 mt-3 sm:heading-3">{title}</h2>
        {body && <p className="body-3 mt-3 text-muted-foreground">{body}</p>}
      </div>
      {action}
    </div>
  );
}

function Home() {
  const loadCatalog = useServerFn(shopCatalog);
  const loadOffers = useServerFn(publicOffers);
  const loadSite = useServerFn(publicSiteInfo);
  const catalog = useQuery({ queryKey: ["home-catalog"], queryFn: () => loadCatalog() });
  const offers = useQuery({ queryKey: ["public-offers"], queryFn: () => loadOffers() });
  const site = useQuery({ queryKey: ["site-info"], queryFn: () => loadSite() });
  const [group, setGroup] = useState("all");

  const products = catalog.data?.products ?? [];
  const live = useMemo(() => products.filter((p) => p.purchasable), [products]);
  const groups = useMemo(() => GROUPS.map((g) => ({ ...g, count: live.filter((p) => groupOf(p).id === g.id).length })).filter((g) => g.count > 0), [live]);
  const featuredFirst = useMemo(() => [...live].sort((a, b) => Number(b.featured) - Number(a.featured)), [live]);
  const shown = (group === "all" ? featuredFirst : featuredFirst.filter((p) => groupOf(p).id === group)).slice(0, 8);
  const showcase = useMemo(() => {
    const withLogo = featuredFirst.filter((p) => p.logo_url || p.image_url);
    return (withLogo.length >= 6 ? withLogo : featuredFirst).slice(0, 16);
  }, [featuredFirst]);
  const promos = offers.data?.offers ?? [];
  const festive = useFestiveOffer();
  const festiveProduct = useMemo(() => (festive.live ? findOfferProduct(products, festive.offer.productName) : null), [festive.live, festive.offer.productName, products]);

  const links = site.data?.links ?? {};
  const botUser = links.bot_username?.replace(/^@/, "");
  const botUrl = botUser ? `https://t.me/${botUser}` : null;
  const methods = (catalog.data?.methods ?? []).filter((m) => m.provider !== "wallet").map((m) => m.name);
  const reviewMinutes = catalog.data?.reviewMinutes ?? null;
  const members = site.data?.stats.members ?? null;
  const requiredTasks = site.data?.stats.requiredTasks ?? null;
  const rewards = site.data?.rewards ?? [];
  const guide = site.data?.guide ?? [];

  const faqs: FaqItem[] = [
    { q: FAQ_SCHEMA[0]!.q, a: <>{FAQ_SCHEMA[0]!.a} Right now {catalog.data ? `${live.length} products are in stock` : "the catalogue is loading"}. <Link to="/shop" className="text-primary underline">Explore all offers</Link>.</> },
    { q: FAQ_SCHEMA[1]!.q, a: <>{FAQ_SCHEMA[1]!.a}{methods.length > 0 && <> Current payment methods: {methods.join(", ")}.</>}</> },
    { q: FAQ_SCHEMA[2]!.q, a: FAQ_SCHEMA[2]!.a },
    { q: "How long does delivery take?", a: reviewMinutes ? `The typical payment review time is about ${reviewMinutes} minutes. Access details are then sent to your delivery email, or in Telegram for bot orders.` : "Access details are sent after the owner confirms your payment." },
    { q: FAQ_SCHEMA[3]!.q, a: FAQ_SCHEMA[3]!.a },
    { q: FAQ_SCHEMA[4]!.q, a: FAQ_SCHEMA[4]!.a },
    { q: FAQ_SCHEMA[7]!.q, a: FAQ_SCHEMA[7]!.a },
    { q: FAQ_SCHEMA[5]!.q, a: <>{FAQ_SCHEMA[5]!.a} <Link to="/support" className="text-primary underline">Open support</Link>.</> },
    { q: FAQ_SCHEMA[6]!.q, a: <>{FAQ_SCHEMA[6]!.a} <Link to="/tutorials" className="text-primary underline">Open tutorials</Link>.</> },
    { q: "What are your refund terms?", a: <>Refund and cancellation terms have not been published yet. Please <Link to="/support" className="text-primary underline">ask support</Link> before you buy.</> },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav announcement={festive.live ? <OfferAnnouncementBar /> : undefined} />

      <main id="main">
        {/* HERO */}
        <section aria-labelledby="hero-title" className="hero-aura relative -mt-20 overflow-hidden pb-16 pt-28 sm:pt-36 lg:pb-24">
          <div className="container-page">
            <div className="grid items-end gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-12">
              <div className="min-w-0 animate-fade-up">
                <p className="caption-1 inline-flex items-center gap-2 rounded-lg border border-border bg-card/90 px-3 py-1.5 text-primary shadow-soft">
                  <SealCheck size={16} weight="fill" /> Every payment checked by a person
                </p>
                <h1 id="hero-title" className="heading-3 text-hero-gradient mt-6 max-w-[760px] pb-1 [text-wrap:wrap] sm:heading-2 sm:leading-[1.1] xl:text-[3.5rem]">
                  <span className="sm:hidden">
                    Premium software.
                    <br />
                    Better value.
                    <br />
                    One place.
                  </span>
                  <span className="hidden sm:inline">
                    Premium software access,
                    <br />
                    better value in one place
                  </span>
                </h1>
                {festive.live && (
                  <p className="title-2 mt-6 max-w-[620px] font-normal text-muted-foreground">
                    Discover current offers for Lovable, ChatGPT, Gemini, AI tools and developer software, then press Buy now to start your order.
                  </p>
                )}
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <PrimaryCta live={festive.live} className="button-md" />
                  <Link to="/shop" className="button-md inline-flex items-center gap-2 rounded-xl border border-border bg-card/80 px-5 py-3 text-foreground shadow-soft transition duration-300 ease-weighted hover:-translate-y-0.5 hover:bg-card">
                    Explore all offers <ArrowRight size={16} />
                  </Link>
                </div>
              </div>

              {festive.live ? (
                <HeroOfferVisual product={festiveProduct} loading={catalog.isLoading} />
              ) : (
                <div className="min-w-0 animate-fade-up [animation-delay:150ms]">
                  <p className="body-3 max-w-[420px] text-muted-foreground lg:title-2 lg:font-normal">
                    Discover current offers for Lovable, ChatGPT, Gemini, AI tools and developer software. Check the real price, then start your order with our team.
                  </p>
                  <dl className="mt-6 grid max-w-[420px] grid-cols-3 gap-4">
                    {[
                      { Icon: Package, label: "Products in stock", value: catalog.data ? live.length.toLocaleString("en-US") : null },
                      { Icon: UsersThree, label: "Bot members", value: members !== null ? members.toLocaleString("en-US") : null },
                      { Icon: Timer, label: "Typical review", value: reviewMinutes ? `${reviewMinutes} min` : null },
                    ].map((s) => (
                      <div key={s.label} className="min-w-0">
                        <span className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-soft">
                          <s.Icon size={16} weight="bold" />
                        </span>
                        <dd className="heading-5 mt-3 tabular-nums sm:heading-4">{s.value ?? <span className="inline-block h-7 w-12 animate-pulse rounded bg-muted" />}</dd>
                        <dt className="caption-5 mt-1 text-muted-foreground">{s.label}</dt>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          </div>

          {/* Moving showcase of real products */}
          <div className="mt-14 animate-fade-up [animation-delay:300ms] lg:mt-20">
            <ShowcaseMarquee products={showcase} loading={catalog.isLoading} />
            {catalog.data?.lastSupplierSync && (
              <p className="caption-5 container-page mt-4 flex items-center gap-2 text-muted-foreground">
                <span className="relative inline-flex size-2">
                  <span className="absolute inset-0 rounded-full bg-success animate-glow-ping" />
                  <span className="relative size-2 rounded-full bg-success" />
                </span>
                Stock checked {timeAgo(catalog.data.lastSupplierSync)}
              </p>
            )}
          </div>
        </section>

        {/* AVAILABLE OFFERS */}
        <section id="offers" aria-labelledby="offers-title" className="scroll-mt-24 border-y border-border bg-card py-16 lg:py-24">
          <div className="container-page">
            <Reveal>
              <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
                <div className="max-w-[680px]">
                  <p className="caption-3 uppercase tracking-wider text-primary">Available offers</p>
                  <h2 id="offers-title" className="heading-4 mt-3 sm:heading-3">Pick a product and press Buy now</h2>
                  <p className="body-3 mt-3 text-muted-foreground">Prices and stock come straight from the store. Only products you can order right now are shown here.</p>
                </div>
                <Link to="/shop" className="body-5 inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 transition duration-300 hover:bg-muted">
                  <MagnifyingGlass size={16} /> Search all products
                </Link>
              </div>
            </Reveal>

            {promos.length > 0 && (
              <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {promos.slice(0, 3).map((o) =>
                  o.product ? (
                    <Link
                      key={o.id}
                      to="/product/$productId"
                      params={{ productId: o.product.id }}
                      className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-accent px-4 py-3 transition duration-300 hover:border-primary"
                    >
                      <ProductLogo name={o.product.name} logoUrl={o.product.logo_url} emoji={o.product.emoji} size="sm" />
                      <span className="min-w-0">
                        <span className="title-4 block truncate">{o.title}</span>
                        <span className="caption-5 block text-accent-foreground">{o.badge ?? "Current promotion"}</span>
                      </span>
                    </Link>
                  ) : null,
                )}
              </div>
            )}

            {groups.length > 0 && (
              <div role="tablist" aria-label="Filter offers by category" className="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
                {[{ id: "all", label: "All offers", count: live.length }, ...groups].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    role="tab"
                    aria-selected={group === g.id}
                    onClick={() => setGroup(g.id)}
                    className={`button-sm inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 transition duration-300 ${ease} active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      group === g.id ? "border-ink bg-ink text-ink-foreground" : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {g.label}
                    <span className={`caption-4 tabular-nums ${group === g.id ? "text-ink-foreground/70" : "text-muted-foreground"}`}>{g.count}</span>
                  </button>
                ))}
              </div>
            )}

            {catalog.isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <OfferCardSkeleton key={i} />)}</div>
            ) : catalog.isError ? (
              <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="body-5 flex items-center gap-2 text-destructive"><Warning size={18} /> Offers could not be loaded. Check your connection and try again.</p>
                <button type="button" onClick={() => void catalog.refetch()} className="button-sm rounded-full border border-border bg-background px-3 py-2 hover:bg-muted">Try again</button>
              </div>
            ) : shown.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
                <SquaresFour size={32} className="text-muted-foreground" />
                <p className="title-3 mt-4">No products are in stock right now</p>
                <p className="body-6 mt-1 text-muted-foreground">New stock is added often. Ask support about a product or join the Telegram channel for updates.</p>
                <Link to="/support" className="button-sm mt-6 rounded-full bg-ink px-3 py-2 text-ink-foreground">Contact support</Link>
              </div>
            ) : (
              <div className="grid gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
                {shown.map((p) => (
                  <HomeOfferCard key={p.id} product={p} category={groupOf(p).label} />
                ))}
              </div>
            )}
            {!catalog.isLoading && live.length > shown.length && (
              <div className="mt-10 flex justify-center">
                <Link to="/shop" className="button-sm inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 transition duration-300 hover:bg-muted">
                  View all {live.length} products <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* WHY */}
        <section aria-labelledby="why-title" className="container-page py-16 lg:py-24">
          <Reveal>
            <SectionHead eyebrow="Why Foxgen" title="Know the price before you pay" body="A simple store for people who use AI and developer tools every day: freelancers, creators and builders." />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { Icon: SquaresFour, title: "Many tools in one place", body: `${groups.length || "Several"} categories, from AI assistants and builder tools to productivity and design software.` },
              { Icon: MagnifyingGlass, title: "Prices you can check first", body: "Every product shows its current price, plan and stock before you start an order." },
              { Icon: ShieldCheck, title: "A person checks every payment", body: "Orders are confirmed only after the owner sees your payment arrive. Typed references are never enough." },
              { Icon: Lifebuoy, title: "Help when you need it", body: "Support on WhatsApp and Telegram, plus written setup guides on the Tutorials page." },
            ].map((b, i) => (
              <Reveal key={b.title} delay={i * 60} className={`card-sheen rounded-2xl border border-border bg-card p-6 shadow-soft transition duration-500 ${ease} hover:-translate-y-1 hover:shadow-lift`}>
                <span className={`inline-flex size-11 items-center justify-center rounded-xl text-foreground ${["bg-accent", "bg-tint-violet", "bg-tint-green", "bg-tint-amber"][i]}`}>
                  <b.Icon size={20} weight="duotone" />
                </span>
                <h3 className="title-2 mt-4">{b.title}</h3>
                <p className="body-6 mt-2 text-muted-foreground">{b.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* FESTIVE OFFER (config driven, hidden outside its dates) */}
        {festive.live && <FestiveOfferSection product={festiveProduct} loading={catalog.isLoading} />}

        {/* HOW IT WORKS */}
        <section aria-labelledby="how-title" className="container-page pb-16 lg:pb-24">
          <Reveal>
            <SectionHead eyebrow="How it works" title="Three steps to your software" />
          </Reveal>
          <ol className="grid gap-4 md:grid-cols-3">
            {[
              { title: "Explore offers", body: "Browse the available software and plans, or filter by category." },
              { title: "Choose your product", body: "Open a product to review its plan, delivery steps and terms." },
              { title: "Press Buy now", body: "Pick a payment method and submit your reference. Our team checks it and sends your access." },
            ].map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 60} className="relative rounded-2xl border border-border bg-card p-6">
                <span className="caption-3 inline-flex size-8 items-center justify-center rounded-full bg-ink text-ink-foreground tabular-nums">{i + 1}</span>
                <h3 className="title-2 mt-4">{s.title}</h3>
                <p className="body-6 mt-2 text-muted-foreground">{s.body}</p>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* TAGLINE REVEAL */}
        <section aria-label="Our promise" className="container-page py-16 lg:py-24">
          <TaglineReveal lines={["The software you need,", "at a price you can check,", "delivered after a real person", "confirms your payment."]} />
        </section>

        {/* REWARDS */}
        <section aria-labelledby="rewards-title" className="container-page py-16 lg:py-24">
          <Reveal className="grid gap-8 rounded-3xl border border-border bg-card p-6 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:p-12">
            <div>
              <p className="caption-3 inline-flex items-center gap-2 uppercase tracking-wider text-primary"><Gift size={16} weight="fill" /> Free rewards</p>
              <h2 id="rewards-title" className="heading-4 mt-3 sm:heading-3">Earn FoxGEN Pro licences by inviting friends</h2>
              <p className="body-3 mt-3 text-muted-foreground">Our Telegram rewards bot gives you credits for verified invites. Spend them on FoxGEN Pro extension licences.</p>
              <ol className="mt-8 space-y-4">
                {[
                  `Start ${botUser ? `@${botUser}` : "the Foxgen bot"} in Telegram.`,
                  requiredTasks ? `Complete the ${requiredTasks} required community tasks. The bot verifies them.` : "Complete the required community tasks. The bot verifies them.",
                  "Share your invite link. Each verified friend earns you 1 credit.",
                  "Redeem your credits for a FoxGEN Pro licence.",
                ].map((t, i) => (
                  <li key={t} className="flex items-start gap-3">
                    <span className="caption-3 mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">{i + 1}</span>
                    <span className="body-5">{t}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-8 flex flex-wrap gap-3">
                {botUrl && (
                  <a href={botUrl} target="_blank" rel="noreferrer" className="button-sm inline-flex items-center gap-2 rounded-full bg-ink px-3 py-2 text-ink-foreground transition duration-300 hover:bg-ink/90 active:scale-[0.98]">
                    <TelegramLogo size={16} weight="fill" /> Open the Telegram bot
                  </a>
                )}
                <Link to="/hub" className="button-sm inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 transition duration-300 hover:bg-muted">
                  Rewards hub <ArrowRight size={14} />
                </Link>
              </div>
            </div>
            <div className="rounded-2xl bg-muted/60 p-4 sm:p-6">
              <p className="title-4">Rewards you can redeem</p>
              {site.isLoading ? (
                <div className="mt-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-card" />)}</div>
              ) : rewards.length === 0 ? (
                <p className="body-6 mt-4 text-muted-foreground">Rewards are being updated. Check the bot for the current list.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {rewards.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3">
                      <span className="body-5">{r.duration_days} day licence</span>
                      <span className="caption-1 tabular-nums text-muted-foreground">{r.credit_cost} credits</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-6 flex flex-wrap gap-2">
                {links.telegram_channel_1 && (
                  <a href={links.telegram_channel_1} target="_blank" rel="noreferrer" className="caption-1 inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 hover:border-primary/40">
                    <TelegramLogo size={14} /> {links.telegram_channel_1_name ?? "Telegram channel"}
                  </a>
                )}
                {links.telegram_channel_2 && (
                  <a href={links.telegram_channel_2} target="_blank" rel="noreferrer" className="caption-1 inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 hover:border-primary/40">
                    <TelegramLogo size={14} /> {links.telegram_channel_2_name ?? "Telegram channel"}
                  </a>
                )}
              </div>
            </div>
          </Reveal>
        </section>

        {/* TUTORIALS */}
        <section aria-labelledby="tutorials-title" className="container-page py-16 lg:py-24">
          <Reveal>
            <SectionHead
              eyebrow="Tutorials and updates"
              title={links.guide_title ?? "Setup guides"}
              body="Short written guides for installing and using the FoxGEN Pro extension."
              action={
                <Link to="/tutorials" className="body-5 inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 transition duration-300 hover:bg-muted">
                  All tutorials <ArrowRight size={14} />
                </Link>
              }
            />
          </Reveal>
          {site.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />)}</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {guide.slice(0, 5).map((g, i) => (
                <Reveal key={g.id} delay={i * 60}>
                  <Link to="/tutorials" className={`group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition duration-500 ${ease} hover:-translate-y-1 hover:shadow-soft`}>
                    <span className="inline-flex size-10 items-center justify-center rounded-xl bg-muted"><BookOpenText size={20} /></span>
                    <h3 className="title-3 mt-4">{g.heading.replace(/^\d+\.\s*/, "")}</h3>
                    <p className="body-6 mt-2 line-clamp-3 text-muted-foreground">{g.body}</p>
                    <span className="caption-1 mt-auto inline-flex items-center gap-1 pt-4 text-primary">Read guide <ArrowRight size={14} /></span>
                  </Link>
                </Reveal>
              ))}
              {links.youtube_url && (
                <Reveal delay={300}>
                  <a href={links.youtube_url} target="_blank" rel="noreferrer" className={`flex h-full flex-col rounded-2xl bg-ink p-6 text-ink-foreground transition duration-500 ${ease} hover:-translate-y-1`}>
                    <PlayCircle size={32} weight="fill" />
                    <h3 className="title-3 mt-4">Video walkthroughs</h3>
                    <p className="body-6 mt-2 opacity-80">Watch setup videos and updates on the Foxgen YouTube channel.</p>
                    <span className="caption-1 mt-auto inline-flex items-center gap-1 pt-4">Watch on YouTube <ArrowRight size={14} /></span>
                  </a>
                </Reveal>
              )}
              {guide.length === 0 && !links.youtube_url && (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center sm:col-span-2 lg:col-span-3">
                  <p className="title-3">Guides are on the way</p>
                  <p className="body-6 mt-1 text-muted-foreground">Ask support if you need help setting up a product.</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* SUPPORT */}
        <section aria-labelledby="support-title" className="container-page py-16 lg:py-24">
          <Reveal>
            <SectionHead eyebrow="Customer support" title="Questions before or after you buy" body="Ask about a product, get help with a purchase, or sort out a setup problem." />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              links.whatsapp_support_url && { href: links.whatsapp_support_url, Icon: WhatsappLogo, title: "WhatsApp support", body: "Message the Foxgen team directly." },
              links.support_url && { href: links.support_url, Icon: TelegramLogo, title: "Telegram support", body: "Chat with support on Telegram." },
            ]
              .filter(Boolean)
              .map((c, i) => {
                const item = c as { href: string; Icon: typeof WhatsappLogo; title: string; body: string };
                return (
                  <Reveal key={item.href} delay={i * 60}>
                    <a href={item.href} target="_blank" rel="noreferrer" className={`flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition duration-500 ${ease} hover:-translate-y-1 hover:shadow-soft`}>
                      <item.Icon size={28} weight="fill" className="text-primary" />
                      <h3 className="title-3 mt-4">{item.title}</h3>
                      <p className="body-6 mt-1 text-muted-foreground">{item.body}</p>
                    </a>
                  </Reveal>
                );
              })}
            <Reveal delay={120}>
              <Link to="/chat" className={`flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition duration-500 ${ease} hover:-translate-y-1 hover:shadow-soft`}>
                <Sparkle size={28} weight="fill" className="text-primary" />
                <h3 className="title-3 mt-4">Ask Foxgen AI</h3>
                <p className="body-6 mt-1 text-muted-foreground">Quick answers about products and prices.</p>
              </Link>
            </Reveal>
            <Reveal delay={180}>
              <Link to="/support" className={`flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition duration-500 ${ease} hover:-translate-y-1 hover:shadow-soft`}>
                <ChatCircleDots size={28} weight="fill" className="text-primary" />
                <h3 className="title-3 mt-4">Support centre</h3>
                <p className="body-6 mt-1 text-muted-foreground">Ordering steps and every community link.</p>
              </Link>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-title" className="container-page py-16 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption-3 uppercase tracking-wider text-primary">FAQ</p>
              <h2 id="faq-title" className="heading-4 mt-3 sm:heading-3">Answers before you buy</h2>
              <p className="body-3 mt-3 text-muted-foreground">Still unsure? Talk to support first. There is no account needed to browse.</p>
              <Link to="/support" className="button-sm mt-6 inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 transition duration-300 hover:bg-muted">
                <Lifebuoy size={16} /> Contact support
              </Link>
            </Reveal>
            <Reveal delay={60}>
              <Faq items={faqs} />
            </Reveal>
          </div>
        </section>

        {/* FINAL CTA */}
        <section aria-labelledby="final-title" className="container-page pb-8 pt-16 lg:pt-24">
          <Reveal className="surface-ink tile-night relative overflow-hidden rounded-3xl px-6 py-16 text-center shadow-lift sm:px-12 lg:py-24">
            <h2 id="final-title" className="heading-4 mx-auto max-w-[680px] sm:heading-3 lg:heading-2">Find the software you need.</h2>
            <p className="body-3 mx-auto mt-4 max-w-[680px] text-muted-foreground">Explore the available {BRAND.name} offers and start your order when you are ready.</p>
            <div className="mt-8 flex flex-col items-center gap-4">
              <PrimaryCta live={festive.live} className="button-md" />
              <p className="caption-2 inline-flex items-center gap-2 text-muted-foreground">
                <CheckCircle size={16} /> You pay only the amount shown on your order, checked by a person.
              </p>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
