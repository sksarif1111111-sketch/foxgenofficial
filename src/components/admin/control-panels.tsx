import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Bot,
  CheckCircle2,
  Coins,
  KeyRound,
  ListChecks,
  Loader2,
  Lock,
  Package,
  Tag,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MetricCard, Panel, StatusDot, type AdminNavId } from "@/components/admin/admin-shell";
import { ImageUpload } from "@/components/admin/image-upload";
import { botDashboard, integrationsHistory, integrationsStatus, integrationsSync, integrationsRemoveSupplier, memberCreditHistory, referralLeaderboard, type LeaderRow } from "@/lib/control.functions";
import { adminDeleteOffer, adminOffers, adminSaveOffer, type OfferInput } from "@/lib/offers.functions";
import { shopAdminProducts } from "@/lib/shopadmin.functions";
import { lockExtension } from "@/lib/admin-access.functions";
import { offerState, type OfferState } from "@/lib/offers";
import { dateTime, shortDate, timeAgo } from "@/lib/format";

type Notify = (message: string) => void;
const field = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/15";
const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function Loading() {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Loading…
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
      <span className="text-destructive">{message}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
    </div>
  );
}

/* -------------------------------- Dashboard ------------------------------- */

const QUICK: Array<{ title: string; body: string; cta: string; icon: typeof Users; go: AdminNavId; tint: string; text: string }> = [
  { title: "Store products", body: "Add, edit, feature or publish products for the store and the bot.", cta: "Manage products", icon: Package, go: "Shop", tint: "bg-tint-violet", text: "text-violet" },
  { title: "Promotional offers", body: "Banner and offer cards with dates, priority and images.", cta: "Create offer", icon: Tag, go: "Offers", tint: "bg-accent", text: "text-primary" },
  { title: "Bot tasks", body: "Community tasks members complete before Invite and Earn unlocks.", cta: "Manage tasks", icon: ListChecks, go: "Tasks", tint: "bg-tint-rose", text: "text-destructive" },
];

function SectionTitle({ icon: Icon, title, action }: { icon: typeof Users; title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2.5 text-lg font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Icon className="size-4" /></span>
        {title}
      </h2>
      {action && (
        <button type="button" onClick={action.onClick} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          {action.label} <ArrowUpRight className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function BotDashboardPanel({ onOpen }: { onOpen: (id: AdminNavId) => void }) {
  const load = useServerFn(botDashboard);
  const q = useQuery({ queryKey: ["bot-dashboard"], queryFn: () => load() });
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorBox message="Could not load the dashboard." onRetry={() => void q.refetch()} />;
  const d = q.data;
  const tiles: Array<{ label: string; value: number; icon: typeof Users; tone?: "success" | "primary" | "warning" | "danger"; hint?: string; go: AdminNavId }> = [
    { label: "Registered users", value: d.users.total, icon: Users, hint: `${d.users.newToday} joined today`, go: "Users" },
    { label: "Active users", value: d.users.active, icon: UserCheck, tone: "success", hint: `${d.users.pending} pending verification`, go: "Users" },
    { label: "Total referrals", value: d.referrals.total, icon: Users, go: "Referrals" },
    { label: "Verified referrals", value: d.referrals.verified, icon: BadgeCheck, tone: "success", go: "Leaderboard" },
    { label: "Pending approvals", value: d.referrals.pending, icon: AlertTriangle, tone: d.referrals.pending ? "warning" : undefined, go: "Referrals" },
    { label: "Enabled tasks", value: d.tasks.enabled, icon: ListChecks, hint: `${d.tasks.total} configured`, go: "Tasks" },
  ];
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-8">
        <section>
          <SectionTitle icon={Plus} title="Quick actions" />
          <div className="grid gap-4 md:grid-cols-3">
            {QUICK.map((c, i) => (
              <button
                key={c.title}
                type="button"
                onClick={() => onOpen(c.go)}
                style={{ animationDelay: `${i * 80}ms` }}
                className="group card-sheen relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition duration-500 ease-weighted animate-fade-up hover:-translate-y-1 hover:shadow-lift"
              >
                <c.icon aria-hidden="true" className="absolute -right-3 -top-3 size-24 text-foreground/[0.04] transition-transform duration-700 ease-weighted group-hover:rotate-6 group-hover:scale-110" />
                <span className={`flex size-11 items-center justify-center rounded-xl border border-border ${c.tint} ${c.text}`}><c.icon className="size-5" /></span>
                <p className="mt-4 text-lg font-semibold">{c.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
                <span className={`mt-4 inline-flex items-center gap-1 text-sm font-medium ${c.text}`}>
                  {c.cta} <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle icon={Users} title="Members and referrals" action={{ label: "Leaderboard", onClick: () => onOpen("Leaderboard") }} />
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
            {tiles.map((t) => (
              <button key={t.label} type="button" onClick={() => onOpen(t.go)} className="text-left transition duration-300 ease-weighted hover:-translate-y-0.5">
                <MetricCard label={t.label} value={t.value.toLocaleString()} icon={t.icon} tone={t.tone} hint={t.hint} />
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle icon={Activity} title="Recent activity" action={{ label: "View all", onClick: () => onOpen("Activity") }} />
          <div className="rounded-2xl border border-border bg-card shadow-soft">
            {d.recent.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.recent.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-muted/40">
                    <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${a.status === "error" ? "bg-destructive/10 text-destructive" : a.status === "warning" ? "bg-warning/15 text-warning-foreground" : "bg-muted text-muted-foreground"}`}>
                      <Activity className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate"><span className="font-medium">{a.action}</span> <span className="text-muted-foreground">· {a.module}</span></p>
                      {a.details && <p className="truncate text-xs text-muted-foreground">{a.details}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <aside className="min-w-0 space-y-8">
        <section>
          <SectionTitle icon={Coins} title="Rewards performance" />
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Credits issued</p>
            <p className="mt-1 flex items-baseline gap-2 font-display text-4xl font-bold tabular-nums tracking-tight">
              {d.credits.issued.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">credits</span>
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Spent</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{d.credits.spent.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Available</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-success">{d.credits.available.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <SectionTitle icon={KeyRound} title="Licences" action={{ label: "History", onClick: () => onOpen("Licenses") }} />
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-baseline gap-2">
              <p className="font-display text-4xl font-bold tabular-nums">{d.licenses.active.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">active</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{d.licenses.total.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Redeemed</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-primary">{d.licenses.redeemedByMembers.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <SectionTitle icon={Bot} title="Bot connection" action={{ label: "Settings", onClick: () => onOpen("Bot") }} />
          <div className={`rounded-2xl border border-border bg-card p-5 shadow-soft border-l-4 ${d.bot.connected ? "border-l-success" : "border-l-destructive"}`}>
            <div className="flex items-center gap-3">
              <span className={`flex size-11 items-center justify-center rounded-full ${d.bot.connected ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                <Bot className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{d.bot.connected ? `@${d.bot.username}` : "Not connected"}</p>
                <p className="text-sm text-muted-foreground">Webhook {d.bot.webhookSet ? "connected" : "not set"} · {d.bot.pending} pending</p>
              </div>
            </div>
            {d.bot.lastError && <p className="mt-4 rounded-lg bg-destructive/5 px-3 py-2 text-xs text-destructive">Last Telegram error: {d.bot.lastError}</p>}
            <p className="mt-4 text-xs text-muted-foreground">Checked {dateTime(d.checkedAt)}</p>
          </div>
        </section>
      </aside>
    </div>
  );
}

/* --------------------------------- Offers --------------------------------- */

type OfferRow = Awaited<ReturnType<typeof adminOffers>>[number];
type ProductRow = { id: string; name: string; price_usdt: number | null; reseller_product_id: string | null; shop_published: boolean; status: string };

const STATE_TONE: Record<OfferState, "success" | "primary" | "muted" | "danger" | "warning"> = {
  live: "success",
  scheduled: "primary",
  expired: "warning",
  draft: "muted",
  archived: "muted",
};

const emptyOffer: OfferInput = {
  title: "",
  headline: "",
  description: "",
  product_id: null,
  image_url: "",
  badge: "",
  cta_text: "View offer",
  cta_url: "",
  status: "draft",
  starts_at: null,
  ends_at: null,
  featured: false,
  priority: 0,
  source: "manual",
};

const toLocal = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

export function OffersPanel({ notify }: { notify: Notify }) {
  const fList = useServerFn(adminOffers);
  const fSave = useServerFn(adminSaveOffer);
  const fDelete = useServerFn(adminDeleteOffer);
  const fProducts = useServerFn(shopAdminProducts);
  const cache = useQueryClient();
  const offers = useQuery({ queryKey: ["admin-offers"], queryFn: () => fList() });
  const products = useQuery({ queryKey: ["admin-products-lite"], queryFn: async () => (await fProducts()) as unknown as ProductRow[] });
  const [draft, setDraft] = useState<OfferInput | null>(null);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<OfferRow | null>(null);
  const [filter, setFilter] = useState<"all" | OfferState>("all");

  const save = useMutation({
    mutationFn: (input: OfferInput) => fSave({ data: input }),
    onSuccess: async () => {
      notify("Offer saved. It appears on the store when it is active and inside its dates.");
      setDraft(null);
      await cache.invalidateQueries({ queryKey: ["admin-offers"] });
      await cache.invalidateQueries({ queryKey: ["public-offers"] });
    },
    onError: (e) => setError(errMsg(e, "Could not save this offer.")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => fDelete({ data: { id } }),
    onSuccess: async () => {
      notify("Offer deleted.");
      await cache.invalidateQueries({ queryKey: ["admin-offers"] });
    },
    onError: (e) => notify(errMsg(e, "Could not delete this offer.")),
  });

  const rows = offers.data ?? [];
  const visible = rows.filter((o) => filter === "all" || offerState(o) === filter);
  const selectedProduct = (products.data ?? []).find((p) => p.id === draft?.product_id);

  const edit = (o: OfferRow) => {
    setError("");
    setDraft({
      id: o.id,
      title: o.title,
      headline: o.headline ?? "",
      description: o.description ?? "",
      product_id: o.product_id,
      image_url: o.image_url ?? "",
      badge: o.badge ?? "",
      cta_text: o.cta_text,
      cta_url: o.cta_url ?? "",
      status: o.status as OfferInput["status"],
      starts_at: o.starts_at,
      ends_at: o.ends_at,
      featured: o.featured,
      priority: o.priority,
      source: o.source as OfferInput["source"],
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {(["all", "live", "scheduled", "draft", "expired", "archived"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={`h-8 rounded-md px-3 text-xs font-medium capitalize ${filter === f ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground"}`}>
              {f} {f !== "all" && <span className="tabular-nums text-muted-foreground">{rows.filter((o) => offerState(o) === f).length}</span>}
            </button>
          ))}
        </div>
        <Button onClick={() => { setError(""); setDraft({ ...emptyOffer }); }} className="gap-1.5"><Plus className="size-4" /> New offer</Button>
      </div>

      {offers.isLoading ? (
        <Loading />
      ) : offers.isError ? (
        <ErrorBox message="Could not load offers." onRetry={() => void offers.refetch()} />
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="font-semibold">{rows.length ? "No offers match this filter" : "No promotional offers yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Until you add one, the Home banner features real in-stock products from the catalogue.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Offer</th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((o) => {
                  const state = offerState(o);
                  const product = Array.isArray(o.product) ? o.product[0] : o.product;
                  return (
                    <tr key={o.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                            {o.image_url ? <img src={o.image_url} alt="" className="h-full w-full object-cover" /> : <Star className="size-4 text-muted-foreground" />}
                          </span>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate font-medium">{o.featured && <Star className="size-3.5 fill-current text-warning" />}{o.title}</p>
                            {o.badge && <p className="text-xs text-muted-foreground">{o.badge}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {product ? (
                          <>
                            <p className="truncate text-foreground">{product.name}</p>
                            <p className="text-xs">{product.price_usdt != null ? `${Number(product.price_usdt).toFixed(2)} USDT` : "No price"}{!product.shop_published && " · unpublished"}</p>
                          </>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3"><StatusDot tone={STATE_TONE[state]}>{state}</StatusDot></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{o.starts_at ? shortDate(o.starts_at) : "Now"} → {o.ends_at ? shortDate(o.ends_at) : "No expiry"}</td>
                      <td className="px-4 py-3 tabular-nums">{o.priority}</td>
                      <td className="px-4 py-3"><StatusDot tone={o.source === "manual" ? "muted" : "primary"}>{o.source === "manual" ? "Manual" : o.source === "digihup" ? "DIGIHUP API" : "Reseller API"}</StatusDot></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => edit(o)} aria-label={`Edit ${o.title}`}><Pencil className="size-3.5" /></Button>
                          <Button variant="outline" size="sm" onClick={() => setToDelete(o)} aria-label={`Delete ${o.title}`} className="text-destructive hover:bg-destructive/10"><Trash2 className="size-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Sheet open={draft !== null} onOpenChange={(v) => !v && setDraft(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetTitle>{draft?.id ? "Edit offer" : "New offer"}</SheetTitle>
          <SheetDescription>Prices always come from the linked product — offers never change prices or margins.</SheetDescription>
          {draft && (
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setError("");
                save.mutate(draft);
              }}
            >
              <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Offer title *</span>
                <input className={field} value={draft.title} maxLength={120} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Premium Software. Better Prices." required />
              </label>
              <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Small headline</span>
                <input className={field} value={draft.headline} maxLength={80} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} placeholder="EXCLUSIVE SOFTWARE OFFERS" />
              </label>
              <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Description</span>
                <textarea className={`${field} h-24 py-2`} value={draft.description} maxLength={600} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
              </label>
              <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Product</span>
                <select className={field} value={draft.product_id ?? ""} onChange={(e) => setDraft({ ...draft, product_id: e.target.value || null })}>
                  <option value="">No product (link only)</option>
                  {(products.data ?? []).filter((p) => p.status !== "archived").map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.shop_published ? "" : " (unpublished)"}</option>
                  ))}
                </select>
              </label>
              {selectedProduct && (
                <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Current price: <b className="text-foreground">{selectedProduct.price_usdt != null ? `${Number(selectedProduct.price_usdt).toFixed(2)} USDT` : "not set"}</b> ·{" "}
                  {selectedProduct.reseller_product_id ? "price & stock managed by supplier sync" : "price managed manually in Products"}. Margin rules are unchanged.
                </p>
              )}
              <ImageUpload folder="offers" label="Promotional image (16:9 works best)" value={draft.image_url ?? ""} onChange={(url) => setDraft({ ...draft, image_url: url })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Offer label</span>
                  <input className={field} value={draft.badge} maxLength={40} onChange={(e) => setDraft({ ...draft, badge: e.target.value })} placeholder="Limited time" />
                </label>
                <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Button text *</span>
                  <input className={field} value={draft.cta_text} maxLength={40} onChange={(e) => setDraft({ ...draft, cta_text: e.target.value })} required />
                </label>
              </div>
              <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Button link (optional — defaults to the product page)</span>
                <input className={field} value={draft.cta_url} maxLength={500} onChange={(e) => setDraft({ ...draft, cta_url: e.target.value })} placeholder="/shop or https://…" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Starts</span>
                  <input type="datetime-local" className={field} value={toLocal(draft.starts_at)} onChange={(e) => setDraft({ ...draft, starts_at: fromLocal(e.target.value) })} />
                </label>
                <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Expires</span>
                  <input type="datetime-local" className={field} value={toLocal(draft.ends_at)} onChange={(e) => setDraft({ ...draft, ends_at: fromLocal(e.target.value) })} />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Display status</span>
                  <select className={field} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as OfferInput["status"] })}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Priority</span>
                  <input type="number" min={0} max={1000} className={field} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Math.max(0, Math.min(1000, Math.floor(Number(e.target.value) || 0))) })} />
                </label>
                <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Source</span>
                  <select className={field} value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value as OfferInput["source"] })}>
                    <option value="manual">Manual</option>
                    <option value="reseller">Reseller API</option>
                    <option value="digihup">DIGIHUP API</option>
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.featured} onChange={(e) => setDraft({ ...draft, featured: e.target.checked })} className="size-4 accent-[var(--color-primary)]" />
                Featured (shown first in the Home banner)
              </label>
              {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={save.isPending} className="flex-1 gap-2">{save.isPending && <Loader2 className="size-4 animate-spin" />}Save offer</Button>
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={toDelete !== null} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete this offer?</AlertDialogTitle>
          <AlertDialogDescription>“{toDelete?.title}” will be removed from the store immediately. The linked product is not affected.</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => toDelete && remove.mutate(toDelete.id)}>Delete offer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------ Integrations ------------------------------ */

export function IntegrationsPanel({ notify, onOpen }: { notify: Notify; onOpen: (id: AdminNavId) => void }) {
  const fStatus = useServerFn(integrationsStatus);
  const fSync = useServerFn(integrationsSync);
  const fRemove = useServerFn(integrationsRemoveSupplier);
  const [removing, setRemoving] = useState(false);
  const cache = useQueryClient();
  const q = useQuery({ queryKey: ["integrations"], queryFn: () => fStatus() });
  const sync = useMutation({
    mutationFn: () => fSync(),
    onSuccess: async (res) => {
      const parts = res.suppliers.map((s) => (s.ok ? `${s.id === "digihup" ? "DIGIHUP" : "Reseller API"}: ${s.total} products, ${s.added} new` : `${s.id === "digihup" ? "DIGIHUP" : "Reseller API"} failed — ${s.error}`));
      notify(`Sync finished. ${parts.join(" · ")}`);
      await cache.invalidateQueries({ queryKey: ["integrations"] });
      await cache.invalidateQueries({ queryKey: ["sync-history"] });
      await cache.invalidateQueries({ queryKey: ["home-catalog"] });
    },
    onError: (e) => notify(errMsg(e, "Sync failed. Previous products and prices were kept.")),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-soft">
        <div>
          <p className="font-semibold">Supplier catalogue sync</p>
          <p className="text-sm text-muted-foreground">Refreshes wholesale cost, stock and new products. Your selling prices, Stars prices and store edits are never overwritten.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpen("SyncHistory")}>View history</Button>
          <Button onClick={() => sync.mutate()} disabled={sync.isPending} className="gap-2">
            {sync.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {sync.isPending ? "Syncing…" : "Sync suppliers now"}
          </Button>
        </div>
      </div>
      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <ErrorBox message="Could not check integrations." onRetry={() => void q.refetch()} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(q.data ?? []).map((c) => (
            <article key={c.id} className="rounded-xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{c.detail}</p>
                  {c.endpoint && <p className="mt-1 break-all text-xs text-muted-foreground">{c.endpoint}</p>}
                </div>
                <StatusDot tone={c.status === "connected" ? "success" : c.status === "error" ? "danger" : "muted"}>
                  {c.removed ? "Removed" : c.status === "connected" ? "In use" : c.status === "error" ? "Error" : "Not in use"}
                </StatusDot>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {c.capabilities.map((cap) => <span key={cap} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{cap}</span>)}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs">
                <div><dt className="text-muted-foreground">Credentials</dt><dd className="mt-0.5 font-medium">{c.configured ? "Stored securely" : "Missing"}</dd></div>
                {c.products !== null && <div><dt className="text-muted-foreground">Store products</dt><dd className="mt-0.5 font-medium tabular-nums">{c.products}</dd></div>}
                {c.kind === "supplier" && <div><dt className="text-muted-foreground">Last successful sync</dt><dd className="mt-0.5 font-medium">{c.lastSuccess ? timeAgo(c.lastSuccess) : "No sync recorded"}</dd></div>}
                {c.lastError && <div className="col-span-2"><dt className="text-muted-foreground">Last error {c.lastErrorAt ? `· ${timeAgo(c.lastErrorAt)}` : ""}</dt><dd className="mt-0.5 break-words text-destructive">{c.lastError}</dd></div>}
              </dl>
              {c.kind === "supplier" && (
                <div className="mt-4 flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => onOpen("SyncHistory")}>View logs</Button>
                  {!c.removed && <Button variant="destructive" size="sm" disabled={removing || sync.isPending} onClick={async () => {
                    if (c.id !== "reseller" && c.id !== "digihup") return;
                    if (!window.confirm(`Remove ${c.name} from this store? All its products disappear from the website and Telegram. Imports stop; previous orders and accounts stay intact. Stored credentials are retained but no longer used.`)) return;
                    setRemoving(true);
                    try { const result = await fRemove({data:{id:c.id}}); notify(`${result.removed} products removed from website and Telegram. Order history retained.`); await cache.invalidateQueries(); }
                    catch (e) { notify(errMsg(e, "Removal failed.")); } finally { setRemoving(false); }
                  }}><Trash2 className="mr-1 size-3.5" />Remove API & products</Button>}
                </div>
              )}
              {c.id === "telegram" && (
                <div className="mt-4 flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => onOpen("Bot")}>Bot settings</Button>
                  <Button variant="ghost" size="sm" onClick={() => onOpen("Logs")}>Error reports</Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function SyncHistoryPanel() {
  const f = useServerFn(integrationsHistory);
  const q = useQuery({ queryKey: ["sync-history"], queryFn: () => f() });
  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorBox message="Could not load sync history." onRetry={() => void q.refetch()} />;
  const rows = q.data ?? [];
  if (!rows.length) return <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">No synchronisations recorded yet. Run “Sync suppliers now” from Connection health.</div>;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>{["When", "Provider", "Trigger", "Result", "Products", "New", "Updated", "Message"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{dateTime(r.started_at)}</td>
                <td className="px-4 py-3 font-medium">{r.provider === "digihup" ? "DIGIHUP" : r.provider === "reseller" ? "Reseller API" : r.provider}</td>
                <td className="px-4 py-3 capitalize text-muted-foreground">{r.trigger}</td>
                <td className="px-4 py-3">
                  {r.status === "success" ? <StatusDot tone="success">Success</StatusDot> : r.status === "partial" ? <StatusDot tone="warning">Partial</StatusDot> : <StatusDot tone="danger">Failed</StatusDot>}
                </td>
                <td className="px-4 py-3 tabular-nums">{r.total}</td>
                <td className="px-4 py-3 tabular-nums">{r.added}</td>
                <td className="px-4 py-3 tabular-nums">{r.updated}</td>
                <td className="max-w-xs truncate px-4 py-3 text-xs text-muted-foreground" title={r.message ?? ""}>{r.message ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------- Leaderboard ------------------------------ */

export function LeaderboardPanel() {
  const f = useServerFn(referralLeaderboard);
  const fHistory = useServerFn(memberCreditHistory);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [member, setMember] = useState<LeaderRow | null>(null);
  const q = useQuery({ queryKey: ["leaderboard", term], queryFn: () => f({ data: { search: term } }) });
  const history = useQuery({ queryKey: ["credit-history", member?.id], queryFn: () => fHistory({ data: { userId: member!.id } }), enabled: !!member });
  const totals = useMemo(() => {
    const rows = q.data ?? [];
    return { referrers: rows.length, verified: rows.reduce((s, r) => s + r.verified, 0) };
  }, [q.data]);

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(search.trim()); }}>
        <label className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search member name or username" className={`${field} pl-9`} />
        </label>
        <Button type="submit" variant="outline">Search</Button>
        {!q.isLoading && <span className="text-sm text-muted-foreground">{totals.referrers} referrers · {totals.verified} verified referrals</span>}
      </form>
      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <ErrorBox message="Could not load the leaderboard." onRetry={() => void q.refetch()} />
      ) : !(q.data ?? []).length ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">No referrals recorded{term ? " for this search" : " yet"}.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>{["#", "Member", "Account", "Referrals", "Verified", "Pending", "Credits (avail. / earned / spent)", "Last referral", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(q.data ?? []).map((r, i) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3"><p className="font-medium">{r.name}</p>{r.username && <p className="text-xs text-muted-foreground">@{r.username}</p>}</td>
                    <td className="px-4 py-3"><StatusDot tone={r.status === "active" ? "success" : r.status === "banned" || r.status === "suspicious" ? "danger" : "muted"}>{r.status}</StatusDot></td>
                    <td className="px-4 py-3 tabular-nums">{r.referrals}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-success">{r.verified}</td>
                    <td className="px-4 py-3 tabular-nums">{r.pending}</td>
                    <td className="px-4 py-3 tabular-nums"><b>{r.credits_available}</b> <span className="text-muted-foreground">/ {r.credits_earned} / {r.credits_spent}</span></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(r.last_activity)}</td>
                    <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => setMember(r)}>Credit activity</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Dialog open={!!member} onOpenChange={(v) => !v && setMember(null)}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Credit activity — {member?.name}</DialogTitle>
          {history.isLoading ? <Loading /> : history.isError ? <p className="text-sm text-destructive">Could not load credit activity.</p> : !(history.data ?? []).length ? (
            <p className="text-sm text-muted-foreground">No credit transactions.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {(history.data ?? []).map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0"><p className="truncate">{t.description ?? t.transaction_type.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{dateTime(t.created_at)}</p></div>
                  <span className={`font-semibold tabular-nums ${t.amount > 0 ? "text-success" : "text-destructive"}`}>{t.amount > 0 ? "+" : ""}{t.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------- Security -------------------------------- */

export function SecurityPanel({ notify }: { notify: Notify }) {
  const fLock = useServerFn(lockExtension);
  const cache = useQueryClient();
  const lock = useMutation({
    mutationFn: () => fLock(),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["admin-access"] });
      notify("Extension admin locked. Licence controls need the extension password again.");
    },
  });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Access levels">
        <ul className="space-y-3 text-sm">
          <li className="flex gap-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /><span><b>Visitors</b> browse the store — no sign-in.</span></li>
          <li className="flex gap-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /><span><b>Members</b> sign in through the Telegram bot's secure link to see orders, wallet and rewards.</span></li>
          <li className="flex gap-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /><span><b>Control Center</b> needs the admin password. Every admin action is checked on the server.</span></li>
          <li className="flex gap-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /><span><b>Extension Admin</b> needs a second unlock before licences can be generated, blocked or deleted.</span></li>
        </ul>
      </Panel>
      <Panel title="This session">
        <p className="text-sm text-muted-foreground">Encrypted, HTTP-only session cookie. It signs out automatically after 8 hours. Changing the admin password signs out every device.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => lock.mutate()} disabled={lock.isPending} className="gap-2"><Lock className="size-4" /> Lock Extension Admin</Button>
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground"><XCircle className="mt-0.5 size-3.5 shrink-0" />Passwords are stored as server secrets and are never shown in the browser.</p>
      </Panel>
    </div>
  );
}
