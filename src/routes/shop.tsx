import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  shopCancelOrder,
  shopCatalog,
  shopConfirmEmails,
  shopMyOrders,
  shopPlaceOrder,
  shopSubmitPayment,
  type MyOrder,
  type ShopCatalog,
} from "@/lib/shop.functions";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "FOXGEN STORE — Buy Gemini AI Pro & Lovable Pro Access" },
      {
        name: "description",
        content:
          "Browse FOXGEN STORE digital products, review your purchase and pay with USDT on Solana, Binance or UPI. Access details arrive by email after review.",
      },
      { property: "og:title", content: "FOXGEN STORE" },
      { property: "og:description", content: "Premium digital products with owner-reviewed payments and email delivery." },
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
      className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
    >
      {done ? "Copied" : label}
    </button>
  );
}

function Badge({ tone, children }: { tone: "ok" | "warn" | "off"; children: React.ReactNode }) {
  const styles =
    tone === "ok"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
      : tone === "warn"
        ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
        : "border-border bg-muted/40 text-muted-foreground";
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles}`}>{children}</span>;
}

function ShopPage() {
  const loadCatalog = useServerFn(shopCatalog);
  const place = useServerFn(shopPlaceOrder);
  const submit = useServerFn(shopSubmitPayment);
  const confirmEmails = useServerFn(shopConfirmEmails);
  const loadOrders = useServerFn(shopMyOrders);
  const cancel = useServerFn(shopCancelOrder);

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const availableMethods = useMemo(() => {
    if (!catalog || !product) return [] as Method[];
    return catalog.methods.filter((m) => (m.currency === "INR" ? product.price_inr !== null : true));
  }, [catalog, product]);

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

  const total = product?.price_usdt !== null && product?.price_usdt !== undefined ? product.price_usdt * quantity : null;

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">🦊 FOXGEN STORE</h1>
            <p className="text-sm text-muted-foreground">Choose a product to view its details.</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setStep("orders");
                void refreshOrders();
              }}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted/40"
            >
              My Orders
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("list");
                setProduct(null);
                setDraft(null);
              }}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted/40"
            >
              Home
            </button>
          </div>
        </header>

        {error && (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {!token && step !== "list" && step !== "detail" && (
          <p className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-300">
            Open “My account” in the Telegram bot and use its link to sign in before ordering.
          </p>
        )}

        {step === "list" && (
          <section className="space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              📄 Page 1 of 1 · {catalog?.products.length ?? 0} products
            </p>
            {(catalog?.products ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setProduct(item);
                  setQuantity(1);
                  setStep("detail");
                }}
                className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-card/60 p-5 text-left transition hover:border-primary/60"
              >
                <span className="space-y-1">
                  <span className="block text-lg font-bold">
                    {item.emoji ? `${item.emoji} ` : ""}
                    {item.name}
                  </span>
                  <span className="block text-sm text-muted-foreground">{item.short_description}</span>
                </span>
                <span className="shrink-0 space-y-2 text-right">
                  <span className="block text-base font-black text-primary">{item.price_label}</span>
                  <Badge tone={item.purchasable ? "ok" : item.availability === "coming_soon" ? "warn" : "off"}>
                    {item.stock_label}
                  </Badge>
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => void loadCatalog({ data: undefined }).then(setCatalog)}
              className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted/40"
            >
              Refresh
            </button>
          </section>
        )}

        {step === "detail" && product && (
          <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-6">
            {product.image_url && (
              <img
                src={product.image_url}
                alt={`${product.name} product image`}
                loading="lazy"
                className="h-48 w-full rounded-xl object-cover"
              />
            )}
            <h2 className="text-2xl font-black">
              {product.emoji ? `${product.emoji} ` : ""}
              {product.name}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xl font-black text-primary">{product.price_label}</span>
              <Badge tone={product.purchasable ? "ok" : product.availability === "coming_soon" ? "warn" : "off"}>
                {product.stock_label}
              </Badge>
              {product.duration_label && <Badge tone="off">{product.duration_label}</Badge>}
            </div>
            {product.description && <p className="whitespace-pre-line text-sm text-muted-foreground">{product.description}</p>}
            {product.features.length > 0 && (
              <ul className="space-y-1 text-sm">
                {product.features.map((feature) => (
                  <li key={feature}>✅ {feature}</li>
                ))}
              </ul>
            )}
            {product.credits_per_interval !== null && (
              <p className="text-sm text-muted-foreground">
                Includes {product.credits_per_interval} credits every {product.renewal_interval ?? "month"}.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Delivery: access details are sent to your email address after the owner confirms your payment.
            </p>
            {product.terms && <p className="text-xs text-muted-foreground">{product.terms}</p>}
            <div className="flex flex-wrap gap-2">
              {product.purchasable ? (
                <button
                  type="button"
                  onClick={() => setStep("quantity")}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
                >
                  Buy Now
                </button>
              ) : (
                <span className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-muted-foreground">
                  Purchase unavailable
                </span>
              )}
              <button
                type="button"
                onClick={() => setStep("list")}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted/40"
              >
                Back to Shop
              </button>
            </div>
          </section>
        )}

        {step === "quantity" && product && (
          <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-6">
            <h2 className="text-xl font-black">How many units?</h2>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4]
                .filter((n) => n <= product.max_units)
                .map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQuantity(n)}
                    className={`rounded-xl border px-5 py-2.5 text-sm font-bold ${
                      quantity === n ? "border-primary bg-primary/15 text-primary" : "border-border hover:bg-muted/40"
                    }`}
                  >
                    {n}x
                  </button>
                ))}
            </div>
            <label className="block text-sm">
              Custom quantity (max {product.max_units})
              <input
                type="number"
                min={1}
                max={product.max_units}
                value={quantity}
                onChange={(event) => {
                  const next = Math.floor(Number(event.target.value));
                  setQuantity(Math.min(product.max_units, Math.max(1, Number.isFinite(next) ? next : 1)));
                }}
                className="mt-1 w-32 rounded-xl border border-border bg-background px-3 py-2"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep("review")}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => setStep("detail")}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted/40"
              >
                Back
              </button>
            </div>
          </section>
        )}

        {step === "review" && product && (
          <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-6">
            <h2 className="text-xl font-black">Review Your Purchase</h2>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Product</dt>
                <dd className="font-semibold">{product.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Quantity</dt>
                <dd className="font-semibold">{quantity}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Unit price</dt>
                <dd className="font-semibold">{product.price_label}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="text-lg font-black text-primary">
                  {total === null ? "Price not configured" : `${total.toFixed(2)} USDT`}
                </dd>
              </div>
            </dl>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Choose a payment method</p>
              {availableMethods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm ${
                    method?.id === m.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <span className="font-semibold">
                    {m.name}
                    {m.network ? ` · ${m.network}` : ""}
                  </span>
                  <span className="text-muted-foreground">{m.currency}</span>
                </button>
              ))}
              {catalog?.methods.some((m) => m.currency === "INR") && product.price_inr === null && (
                <p className="text-xs text-muted-foreground">
                  UPI is unavailable for this product until an INR price is configured.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !method || !token}
                onClick={() =>
                  void run(async () => {
                    const order = await place({
                      data: { token, productId: product.id, quantity, paymentMethodId: method!.id },
                    });
                    setDraft(order);
                    setStep("pay");
                  })
                }
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                Continue to payment
              </button>
              <button
                type="button"
                onClick={() => setStep("quantity")}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted/40"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep("list")}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted/40"
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        {step === "pay" && draft && (
          <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-6">
            <h2 className="text-xl font-black">Payment details</h2>
            <p className="text-sm text-muted-foreground">Order {draft.order_number}</p>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="flex items-center gap-2 font-black">
                  {draft.total?.toFixed(2)} {draft.currency}
                  <Copy value={`${draft.total?.toFixed(2)}`} label="Copy Amount" />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Method</dt>
                <dd className="font-semibold">
                  {draft.payment_method_name}
                  {draft.payment_network ? ` · ${draft.payment_network}` : ""}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{method?.recipient_label ?? "Recipient"}</dt>
                <dd className="flex items-center gap-2">
                  <span className="break-all text-right font-mono text-xs">{draft.payment_recipient}</span>
                  <Copy value={draft.payment_recipient ?? ""} label="Copy" />
                </dd>
              </div>
            </dl>
            {method?.instructions && <p className="text-sm text-muted-foreground">{method.instructions}</p>}
            <label className="block text-sm">
              {method?.reference_label ?? "Transaction reference"}
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                placeholder="Paste your transaction reference"
              />
            </label>
            <label className="block text-sm">
              Screenshot link (optional)
              <input
                value={evidence}
                onChange={(event) => setEvidence(event.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                placeholder="https://…"
              />
            </label>
            <p className="text-xs text-muted-foreground">
              A reference or screenshot is supporting evidence only. Your order is confirmed after the owner checks the
              receiving account.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await submit({ data: { token, orderId: draft.id, reference, evidenceUrl: evidence || undefined } });
                    setStep("email");
                  })
                }
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                I Have Paid
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
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted/40"
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        {step === "email" && draft && (
          <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-6">
            <h2 className="text-xl font-black">Delivery email</h2>
            <p className="text-sm text-muted-foreground">
              Please enter the email address where you want to receive your activation link or product access.
            </p>
            {quantity > 1 && (
              <p className="text-xs text-muted-foreground">
                For {quantity} units you can use one email, or {quantity} emails separated by commas.
              </p>
            )}
            <input
              value={emails}
              onChange={(event) => setEmails(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
              placeholder="you@example.com"
            />
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
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              Confirm email
            </button>
          </section>
        )}

        {step === "done" && draft && (
          <section className="space-y-3 rounded-2xl border border-border bg-card/60 p-6">
            <h2 className="text-xl font-black">Please wait. My owner is checking your payment.</h2>
            <p className="text-sm">Your delivery email: {emailSummary}</p>
            <p className="text-sm text-muted-foreground">
              Estimated review time: about {catalog?.reviewMinutes ?? 10} minutes.
            </p>
            <p className="text-sm">Order ID: {draft.order_number}</p>
            <p className="text-sm text-muted-foreground">You will receive an update when your order is confirmed.</p>
            <button
              type="button"
              onClick={() => {
                setStep("orders");
                void refreshOrders();
              }}
              className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted/40"
            >
              My Orders
            </button>
          </section>
        )}

        {step === "orders" && (
          <section className="space-y-3">
            <h2 className="text-xl font-black">My Orders</h2>
            {orders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
            {orders.map((order) => (
              <article key={order.id} className="space-y-2 rounded-2xl border border-border bg-card/60 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">{order.order_number}</span>
                  <Badge tone={order.status === "delivered" ? "ok" : order.status === "rejected" ? "off" : "warn"}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {order.items.map((item) => `${item.product_name} x${item.quantity}`).join(", ")}
                </p>
                <p className="text-sm">
                  {order.currency === "XTR"
                    ? `${order.stars_total ?? 0} ⭐`
                    : `${order.total?.toFixed(2) ?? "—"} ${order.currency}`}{" "}
                  · {order.payment_method_name ?? "—"}
                </p>
                {order.delivery_emails && <p className="text-xs text-muted-foreground">Email: {order.delivery_emails}</p>}
                {order.info_request && <p className="text-xs text-amber-300">More info needed: {order.info_request}</p>}
                {order.reject_reason && <p className="text-xs text-destructive">Reason: {order.reject_reason}</p>}
                {order.fulfillment.map((content) => (
                  <p key={content} className="whitespace-pre-line rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
                    {content}
                  </p>
                ))}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
