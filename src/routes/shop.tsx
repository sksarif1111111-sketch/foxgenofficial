import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy as CopyIcon,
  Mail,
  Minus,
  PackageOpen,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import {
  shopCancelOrder,
  shopCatalog,
  shopConfirmEmails,
  shopMyOrders,
  shopPlaceOrder,
  shopSubmitPayment,
  shopWallet,
  type MyOrder,
  type ShopCatalog,
} from "@/lib/shop.functions";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { ProductLogo } from "@/components/site/product-logo";
import { PriceTag, ProductCard, StockPill } from "@/components/site/product-card";
import { MORE_CATEGORY, STORE_CATEGORIES, categoryLabel, categoryOf } from "@/lib/store-categories";

type ShopSearch = { product?: string; category?: string; q?: string; buy?: boolean; view?: "orders" };

export const Route = createFileRoute("/shop")({
  validateSearch: (s: Record<string, unknown>): ShopSearch => ({
    product: typeof s.product === "string" ? s.product : undefined,
    category: typeof s.category === "string" ? s.category : undefined,
    q: typeof s.q === "string" && s.q.trim() ? s.q.trim().slice(0, 80) : undefined,
    buy: s.buy === true || s.buy === "1" || s.buy === 1 ? true : undefined,
    view: s.view === "orders" ? "orders" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Shop — Foxgen AI Store" },
      {
        name: "description",
        content:
          "Browse every Foxgen AI Store product: AI assistants, builder tools, Office and creator software. Pay with USDT, Binance or UPI; access arrives by email after review.",
      },
      { property: "og:title", content: "Shop — Foxgen AI Store" },
      { property: "og:description", content: "Premium software and AI tools with owner-reviewed payments and email delivery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShopPage,
});

type Product = ShopCatalog["products"][number];
type Method = ShopCatalog["methods"][number];
type Step = "list" | "detail" | "quantity" | "review" | "pay" | "email" | "done" | "orders";
type OrderDraft = {
  id: string;
  order_number: string;
  total: number | null;
  currency: string;
  payment_method_name: string | null;
  payment_network: string | null;
  payment_recipient: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  payment_submitted: "Payment submitted",
  awaiting_email: "Awaiting your email",
  under_review: "Under review",
  payment_confirmed: "Payment confirmed",
  awaiting_fulfillment: "Preparing your access",
  delivered: "Delivered",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
};

const CHECKOUT_STEPS: Array<{ id: Step; label: string }> = [
  { id: "quantity", label: "Quantity" },
  { id: "review", label: "Review" },
  { id: "pay", label: "Payment" },
  { id: "email", label: "Delivery" },
  { id: "done", label: "Done" },
];

const SORTS = { recommended: "Recommended", low: "Price: low to high", high: "Price: high to low" } as const;

const btnPrimary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-ember transition hover:brightness-105 disabled:pointer-events-none disabled:opacity-50";
const btnGhost =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-semibold transition hover:bg-muted disabled:opacity-50";
const field =
  "mt-1.5 h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20";

function Copy({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium transition hover:bg-muted"
    >
      {done ? <Check className="size-3.5 text-success" /> : <CopyIcon className="size-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "delivered" || status === "payment_confirmed"
      ? "bg-success/10 text-success"
      : status === "rejected" || status === "cancelled" || status === "expired"
        ? "bg-destructive/10 text-destructive"
        : "bg-warning/15 text-warning-foreground";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-7 ${className}`}>{children}</section>;
}

function Stepper({ step }: { step: Step }) {
  const index = CHECKOUT_STEPS.findIndex((s) => s.id === step);
  return (
    <ol className="no-scrollbar mb-6 flex items-center gap-2 overflow-x-auto">
      {CHECKOUT_STEPS.map((s, i) => (
        <li key={s.id} className="flex shrink-0 items-center gap-2">
          <span
            className={`flex size-6 items-center justify-center rounded-full text-[11px] font-semibold ${
              i < index ? "bg-success text-success-foreground" : i === index ? "bg-ink text-ink-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {i < index ? <Check className="size-3.5" /> : i + 1}
          </span>
          <span className={`text-xs font-medium ${i === index ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
          {i < CHECKOUT_STEPS.length - 1 && <ChevronRight className="size-3.5 text-muted-foreground/60" />}
        </li>
      ))}
    </ol>
  );
}

function ShopPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/shop" });
  const loadCatalog = useServerFn(shopCatalog);
  const place = useServerFn(shopPlaceOrder);
  const submit = useServerFn(shopSubmitPayment);
  const confirmEmails = useServerFn(shopConfirmEmails);
  const loadOrders = useServerFn(shopMyOrders);
  const cancel = useServerFn(shopCancelOrder);
  const loadWallet = useServerFn(shopWallet);

  const [token, setToken] = useState("");
  const [catalog, setCatalog] = useState<ShopCatalog | null>(null);
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [step, setStep] = useState<Step>("list");
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [method, setMethod] = useState<Method | null>(null);
  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [reference, setReference] = useState("");
  const [evidence, setEvidence] = useState("");
  const [emails, setEmails] = useState("");
  const [emailSummary, setEmailSummary] = useState("");
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(search.q ?? "");
  useEffect(() => {
    setQuery(search.q ?? "");
  }, [search.q]);
  const [sort, setSort] = useState<keyof typeof SORTS>("recommended");
  const category = search.category ?? "all";

  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("t");
    const stored = localStorage.getItem("foxgen_hub_token");
    const value = fromUrl ?? stored ?? "";
    if (fromUrl) localStorage.setItem("foxgen_hub_token", fromUrl);
    setToken(value);
  }, []);

  useEffect(() => {
    void loadCatalog({ data: undefined }).then(setCatalog).catch(() => setError("Could not load the store right now."));
  }, [loadCatalog]);

  // Deep link from Home: /shop?product=<id> opens that product.
  useEffect(() => {
    if (!catalog || !search.product) return;
    const match = catalog.products.find((p) => p.id === search.product);
    if (match) {
      setProduct(match);
      setQuantity(1);
      setStep(search.buy && match.purchasable ? "quantity" : "detail");
    }
  }, [catalog, search.product, search.buy]);

  useEffect(() => {
    if (search.view === "orders") setStep("orders");
  }, [search.view]);

  const refreshOrders = useCallback(async () => {
    if (!token) return;
    try {
      setOrders(await loadOrders({ data: { token } }));
    } catch {
      /* invalid token — orders stay hidden */
    }
  }, [loadOrders, token]);

  useEffect(() => {
    void refreshOrders();
  }, [refreshOrders]);

  const refreshWallet = useCallback(async () => {
    if (!token) return;
    try {
      setWallet(await loadWallet({ data: { token } }));
    } catch {
      /* invalid token — wallet stays hidden */
    }
  }, [loadWallet, token]);

  useEffect(() => {
    void refreshWallet();
  }, [refreshWallet]);

  const availableMethods = useMemo(() => {
    if (!catalog || !product) return [] as Method[];
    return catalog.methods.filter((m) => (m.currency === "INR" ? product.price_inr !== null : true));
  }, [catalog, product]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of catalog?.products ?? []) counts.set(categoryOf(p.name), (counts.get(categoryOf(p.name)) ?? 0) + 1);
    return [...STORE_CATEGORIES, MORE_CATEGORY].map((c) => ({ id: c.id as string, label: c.label, count: counts.get(c.id) ?? 0 })).filter((c) => c.count > 0);
  }, [catalog]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = (catalog?.products ?? []).filter(
      (p) =>
        (category === "all" || categoryOf(p.name) === category) &&
        (!q || p.name.toLowerCase().includes(q) || (p.short_description ?? "").toLowerCase().includes(q)),
    );
    if (sort !== "recommended") {
      list = [...list].sort((a, b) => {
        const av = a.price_usdt ?? Number.POSITIVE_INFINITY;
        const bv = b.price_usdt ?? Number.POSITIVE_INFINITY;
        return sort === "low" ? av - bv : (b.price_usdt ?? -1) - (a.price_usdt ?? -1);
      });
    } else {
      list = [...list].sort((a, b) => Number(b.purchasable) - Number(a.purchasable));
    }
    return list;
  }, [catalog, category, query, sort]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const goToList = () => {
    setStep("list");
    setProduct(null);
    setDraft(null);
    if (search.product) void navigate({ search: (prev) => ({ ...prev, product: undefined }) });
  };

  const unitPrice = method?.currency === "INR" ? (product?.price_inr ?? null) : (product?.price_usdt ?? null);
  const totalCurrency = method?.currency === "INR" ? "INR" : "USDT";
  const total = unitPrice === null ? null : unitPrice * quantity;
  const walletShort = method?.provider === "wallet" && total !== null && (wallet?.balance ?? 0) < total;
  const fmtMoney = (value: number) => (totalCurrency === "INR" ? `₹${value.toFixed(2)}` : `${value.toFixed(2)} USDT`);
  const inCheckout = ["quantity", "review", "pay", "email", "done"].includes(step);

  const summary = product && (
    <aside className="space-y-4 lg:sticky lg:top-24">
      <Panel className="!p-5">
        <p className="eyebrow text-muted-foreground">Order summary</p>
        <div className="mt-4 flex items-center gap-3">
          <ProductLogo name={product.name} logoUrl={product.logo_url} emoji={product.emoji} size="md" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{product.name}</p>
            <p className="text-xs text-muted-foreground">{product.duration_label ?? categoryLabel(categoryOf(product.name))}</p>
          </div>
        </div>
        <dl className="mt-5 space-y-2.5 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Quantity</dt>
            <dd className="font-medium tabular-nums">{quantity}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Unit price</dt>
            <dd className="font-medium tabular-nums">{unitPrice === null ? product.price_label : fmtMoney(unitPrice)}</dd>
          </div>
          {method && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Payment</dt>
              <dd className="truncate text-right font-medium">{method.name}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <dt className="font-medium">Total</dt>
            <dd className="font-display text-2xl font-bold tabular-nums">
              {draft?.total != null ? `${draft.total.toFixed(2)} ${draft.currency}` : total === null ? "—" : fmtMoney(total)}
            </dd>
          </div>
        </dl>
      </Panel>
      <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
        Your order is confirmed only after the owner checks the receiving account.
      </p>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav
        right={
          <button
            type="button"
            onClick={() => {
              setStep("orders");
              void refreshOrders();
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium shadow-soft transition hover:bg-muted"
          >
            <Receipt className="size-4" />
            <span className="hidden sm:inline">My orders</span>
          </button>
        }
      />

      {/* Page header */}
      <div className="border-b border-border bg-card">
        <div className="container-page flex flex-wrap items-end justify-between gap-4 py-8 sm:py-10">
          <div>
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <button type="button" onClick={goToList} className="hover:text-foreground">
                Shop
              </button>
              {step !== "list" && (
                <>
                  <ChevronRight className="size-3" />
                  <span className="truncate text-foreground">{step === "orders" ? "My orders" : product?.name}</span>
                </>
              )}
            </nav>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              {step === "orders" ? "My orders" : inCheckout ? "Checkout" : step === "detail" ? "Product details" : "All products"}
            </h1>
            {step === "list" && (
              <p className="mt-1 text-sm text-muted-foreground">
                {catalog ? `${catalog.products.length} products · ${catalog.products.filter((p) => p.purchasable).length} in stock` : "Loading catalogue…"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {wallet && (
              <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground">
                <Wallet className="size-4" /> ${wallet.balance.toFixed(2)}
              </span>
            )}
            {step !== "list" && (
              <button type="button" onClick={goToList} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted">
                <ArrowLeft className="size-4" /> All products
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="container-page py-8 sm:py-10">
        {error && (
          <p role="alert" className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {!token && step !== "list" && step !== "detail" && (
          <p className="mb-6 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
            Open “My account” in the Telegram bot and use its link to sign in before ordering.
          </p>
        )}

        {/* LIST */}
        {step === "list" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <label className="relative flex-1">
                <span className="sr-only">Search products</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Gemini, Lovable, Office…"
                  className="h-11 w-full rounded-xl border border-input bg-card pl-10 pr-4 text-sm shadow-soft outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
                />
              </label>
              <div className="flex gap-2">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as keyof typeof SORTS)}
                  aria-label="Sort products"
                  className="h-11 flex-1 rounded-xl border border-input bg-card px-3 text-sm shadow-soft md:flex-none"
                >
                  {Object.entries(SORTS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label="Refresh products"
                  onClick={() => void loadCatalog({ data: undefined }).then(setCatalog)}
                  className="inline-flex size-11 items-center justify-center rounded-xl border border-input bg-card shadow-soft hover:bg-muted"
                >
                  <RefreshCw className="size-4" />
                </button>
              </div>
            </div>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              {[{ id: "all", label: "All", count: catalog?.products.length ?? 0 }, ...categories].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void navigate({ search: (prev) => ({ ...prev, category: c.id === "all" ? undefined : c.id }) })}
                  className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition ${
                    category === c.id ? "border-ink bg-ink text-ink-foreground" : "border-border bg-card hover:border-foreground/20"
                  }`}
                >
                  {c.label}
                  <span className={`text-xs tabular-nums ${category === c.id ? "text-ink-foreground/70" : "text-muted-foreground"}`}>{c.count}</span>
                </button>
              ))}
            </div>
            {!catalog ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-80 animate-pulse rounded-2xl border border-border bg-card" />
                ))}
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
                <PackageOpen className="size-10 text-muted-foreground" />
                <p className="mt-4 font-semibold">No products match your search</p>
                <p className="mt-1 text-sm text-muted-foreground">Try another name or clear the category filter.</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    void navigate({ search: {} });
                  }}
                  className={`${btnGhost} mt-6`}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visible.map((item) => (
                  <ProductCard key={item.id} product={item} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* DETAIL */}
        {step === "detail" && product && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.25fr_1fr]">
            <div className="space-y-6">
              <div className="relative hidden aspect-[16/10] items-center justify-center overflow-hidden rounded-3xl border border-border bg-muted sm:flex">
                {product.image_url ? (
                  <img src={product.image_url} alt={`${product.name} product image`} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,var(--color-accent),transparent_65%)]" />
                    <ProductLogo name={product.name} logoUrl={product.logo_url} emoji={product.emoji} size="xl" />
                  </>
                )}
              </div>
              {(product.description || product.features.length > 0) && (
                <Panel>
                  <h2 className="text-lg font-semibold">About this product</h2>
                  {product.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{product.description}</p>}
                  {product.features.length > 0 && (
                    <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                      {product.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              )}
            </div>
            <aside className="order-first lg:order-none lg:sticky lg:top-24 lg:self-start">
              <Panel>
                <div className="flex items-center justify-between gap-3">
                  <span className="eyebrow text-muted-foreground">{categoryLabel(categoryOf(product.name))}</span>
                  <StockPill product={product} />
                </div>
                <h2 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">{product.name}</h2>
                {product.short_description && <p className="mt-2 text-sm text-muted-foreground">{product.short_description}</p>}
                <div className="mt-6 border-y border-border py-5">
                  <PriceTag product={product} size="lg" />
                  {product.duration_label && <p className="mt-1 text-sm text-muted-foreground">{product.duration_label}</p>}
                  {product.stock_label.includes("available") && <p className="mt-1 text-xs text-muted-foreground">{product.stock_label}</p>}
                </div>
                {product.credits_per_interval !== null && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Includes {product.credits_per_interval} credits every {product.renewal_interval ?? "month"}.
                  </p>
                )}
                <div className="mt-6 flex flex-col gap-2">
                  {product.purchasable ? (
                    <button type="button" onClick={() => setStep("quantity")} className={`${btnPrimary} h-12 w-full`}>
                      Buy now
                    </button>
                  ) : (
                    <span className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-muted text-sm font-medium text-muted-foreground">
                      Purchase unavailable
                    </span>
                  )}
                  <button type="button" onClick={goToList} className={`${btnGhost} w-full`}>
                    Continue shopping
                  </button>
                </div>
                <ul className="mt-6 space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">Access details are emailed after the owner confirms your payment.</span>
                  </li>
                  {catalog && catalog.methods.length > 0 && (
                    <li className="flex items-start gap-3">
                      <Wallet className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">Pay with {catalog.methods.map((m) => m.name).join(", ")}.</span>
                    </li>
                  )}
                </ul>
                {product.terms && <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">{product.terms}</p>}
              </Panel>
            </aside>
          </div>
        )}

        {/* CHECKOUT */}
        {inCheckout && product && (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <Stepper step={step} />

              {step === "quantity" && (
                <Panel>
                  <h2 className="text-xl font-semibold">How many units?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Maximum {product.max_units} per order.</p>
                  <div className="mt-6 flex items-center gap-3">
                    <button type="button" aria-label="Decrease" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="inline-flex size-12 items-center justify-center rounded-xl border border-border hover:bg-muted">
                      <Minus className="size-4" />
                    </button>
                    <input
                      type="number"
                      aria-label="Quantity"
                      min={1}
                      max={product.max_units}
                      value={quantity}
                      onChange={(event) => {
                        const next = Math.floor(Number(event.target.value));
                        setQuantity(Math.min(product.max_units, Math.max(1, Number.isFinite(next) ? next : 1)));
                      }}
                      className="h-12 w-24 rounded-xl border border-input bg-card text-center font-display text-xl font-bold tabular-nums"
                    />
                    <button type="button" aria-label="Increase" onClick={() => setQuantity((q) => Math.min(product.max_units, q + 1))} className="inline-flex size-12 items-center justify-center rounded-xl border border-border hover:bg-muted">
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[1, 2, 3, 4]
                      .filter((n) => n <= product.max_units)
                      .map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setQuantity(n)}
                          className={`h-9 rounded-lg border px-4 text-sm font-medium ${quantity === n ? "border-ink bg-ink text-ink-foreground" : "border-border hover:bg-muted"}`}
                        >
                          {n}×
                        </button>
                      ))}
                  </div>
                  <div className="mt-8 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setStep("review")} className={btnPrimary}>
                      Continue
                    </button>
                    <button type="button" onClick={() => setStep("detail")} className={btnGhost}>
                      Back
                    </button>
                  </div>
                </Panel>
              )}

              {step === "review" && (
                <Panel>
                  <h2 className="text-xl font-semibold">Choose a payment method</h2>
                  <div className="mt-5 grid gap-2.5">
                    {availableMethods.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition ${
                          method?.id === m.id ? "border-primary bg-accent ring-1 ring-primary" : "border-border hover:bg-muted"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className={`flex size-5 items-center justify-center rounded-full border ${method?.id === m.id ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>
                            {method?.id === m.id && <Check className="size-3" />}
                          </span>
                          <span className="font-medium">
                            {m.name}
                            {m.network ? <span className="text-muted-foreground"> · {m.network}</span> : null}
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {m.provider === "wallet" ? `Balance $${(wallet?.balance ?? 0).toFixed(2)}` : m.currency === "INR" ? "INR" : m.currency}
                        </span>
                      </button>
                    ))}
                  </div>
                  {walletShort && <p className="mt-3 text-xs text-destructive">Your wallet balance is not enough for this order. Ask support to add funds.</p>}
                  {catalog?.methods.some((m) => m.currency === "INR") && product.price_inr === null && (
                    <p className="mt-3 text-xs text-muted-foreground">UPI is unavailable for this product until an INR price is configured.</p>
                  )}
                  <div className="mt-8 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || !method || !token || walletShort}
                      onClick={() =>
                        void run(async () => {
                          const order = await place({
                            data: { token, productId: product.id, quantity, paymentMethodId: method!.id },
                          });
                          setDraft(order);
                          if (method?.provider === "wallet") {
                            await refreshWallet();
                            await refreshOrders();
                            setStep("email");
                          } else {
                            setStep("pay");
                          }
                        })
                      }
                      className={btnPrimary}
                    >
                      {busy ? "Creating order…" : "Continue to payment"}
                    </button>
                    <button type="button" onClick={() => setStep("quantity")} className={btnGhost}>
                      Back
                    </button>
                    <button type="button" onClick={goToList} className="inline-flex h-11 items-center px-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                      Cancel
                    </button>
                  </div>
                </Panel>
              )}

              {step === "pay" && draft && (
                <Panel>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-semibold">Send your payment</h2>
                    <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs">{draft.order_number}</span>
                  </div>
                  <dl className="mt-5 divide-y divide-border rounded-xl border border-border">
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <dt className="text-sm text-muted-foreground">Amount</dt>
                      <dd className="flex items-center gap-2 font-display text-lg font-bold tabular-nums">
                        {draft.total?.toFixed(2)} {draft.currency}
                        <Copy value={`${draft.total?.toFixed(2)}`} label="Copy" />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <dt className="text-sm text-muted-foreground">Method</dt>
                      <dd className="text-sm font-medium">
                        {draft.payment_method_name}
                        {draft.payment_network ? ` · ${draft.payment_network}` : ""}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <dt className="text-sm text-muted-foreground">{method?.recipient_label ?? "Recipient"}</dt>
                      <dd className="flex items-center gap-2">
                        <span className="break-all font-mono text-xs">{draft.payment_recipient}</span>
                        <Copy value={draft.payment_recipient ?? ""} label="Copy" />
                      </dd>
                    </div>
                  </dl>
                  {method?.instructions && <p className="mt-4 text-sm text-muted-foreground">{method.instructions}</p>}
                  <div className="mt-6 grid gap-4">
                    <label className="block text-sm font-medium">
                      {method?.reference_label ?? "Transaction reference"}
                      <input value={reference} onChange={(event) => setReference(event.target.value)} className={field} placeholder="Paste your transaction reference" />
                    </label>
                    <label className="block text-sm font-medium">
                      Screenshot link <span className="font-normal text-muted-foreground">(optional)</span>
                      <input value={evidence} onChange={(event) => setEvidence(event.target.value)} className={field} placeholder="https://…" />
                    </label>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    A reference or screenshot is supporting evidence only. Your order is confirmed after the owner checks the receiving account.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await submit({ data: { token, orderId: draft.id, reference, evidenceUrl: evidence || undefined } });
                          setStep("email");
                        })
                      }
                      className={btnPrimary}
                    >
                      I have paid
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await cancel({ data: { token, orderId: draft.id } });
                          setDraft(null);
                          setStep("list");
                        })
                      }
                      className={btnGhost}
                    >
                      Cancel order
                    </button>
                  </div>
                </Panel>
              )}

              {step === "email" && draft && (
                <Panel>
                  <h2 className="text-xl font-semibold">Where should we deliver?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Enter the email address for your activation link or product access.</p>
                  {quantity > 1 && (
                    <p className="mt-2 text-xs text-muted-foreground">For {quantity} units you can use one email, or {quantity} emails separated by commas.</p>
                  )}
                  <label className="mt-5 block text-sm font-medium">
                    Delivery email
                    <input value={emails} onChange={(event) => setEmails(event.target.value)} className={field} placeholder="you@example.com" />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const result = await confirmEmails({ data: { token, orderId: draft.id, emails } });
                        setEmailSummary(result.emails.join(", "));
                        setStep("done");
                        void refreshOrders();
                      })
                    }
                    className={`${btnPrimary} mt-6`}
                  >
                    Confirm email
                  </button>
                </Panel>
              )}

              {step === "done" && draft && (
                <Panel>
                  <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
                    <CheckCircle2 className="size-6" />
                  </span>
                  <h2 className="mt-5 text-2xl font-semibold">Thanks — your payment is being checked.</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Estimated review time: about {catalog?.reviewMinutes ?? 10} minutes. You will receive an update when your order is confirmed.
                  </p>
                  <dl className="mt-6 grid gap-3 rounded-xl bg-muted p-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">Order ID</dt>
                      <dd className="font-mono">{draft.order_number}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Delivery email</dt>
                      <dd className="break-all">{emailSummary}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("orders");
                      void refreshOrders();
                    }}
                    className={`${btnGhost} mt-6`}
                  >
                    <Receipt className="size-4" /> View my orders
                  </button>
                </Panel>
              )}
            </div>
            {summary}
          </div>
        )}

        {/* ORDERS */}
        {step === "orders" && (
          <div className="mx-auto max-w-3xl space-y-3">
            {!token && (
              <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                Open “My account” in the Telegram bot to see your orders here.
              </p>
            )}
            {token && orders.length === 0 && (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
                <Receipt className="size-10 text-muted-foreground" />
                <p className="mt-4 font-semibold">No orders yet</p>
                <button type="button" onClick={goToList} className={`${btnGhost} mt-6`}>
                  Start shopping
                </button>
              </div>
            )}
            {orders.map((order) => (
              <article key={order.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-medium">{order.order_number}</span>
                  <StatusPill status={order.status} />
                </div>
                <p className="mt-3 font-medium">{order.items.map((item) => `${item.product_name} ×${item.quantity}`).join(", ")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {order.currency === "XTR" ? `${order.stars_total ?? 0} Stars` : `${order.total?.toFixed(2) ?? "—"} ${order.currency}`} ·{" "}
                  {order.payment_method_name ?? "—"}
                </p>
                {order.delivery_emails && <p className="mt-1 text-xs text-muted-foreground">Email: {order.delivery_emails}</p>}
                {order.info_request && <p className="mt-2 text-xs text-warning-foreground">More info needed: {order.info_request}</p>}
                {order.reject_reason && <p className="mt-2 text-xs text-destructive">Reason: {order.reject_reason}</p>}
                {order.fulfillment.map((content) => (
                  <p key={content} className="mt-3 whitespace-pre-line rounded-xl border border-success/30 bg-success/5 p-3 text-sm">
                    {content}
                  </p>
                ))}
              </article>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
