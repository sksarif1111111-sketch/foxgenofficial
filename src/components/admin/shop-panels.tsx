import { InventoryManager } from "@/components/admin/inventory-manager";
import { marketplaceAssignInventory, marketplaceGenerateImage } from "@/lib/marketplace-admin.functions";
import { catalogCategories } from "@/lib/hubcatalog.functions";
import { Button } from "@/components/ui/button";
import { DeliveryCountdown } from "@/components/admin/delivery-countdown";
import { memberLabel } from "@/lib/member-number";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ImageUpload } from "@/components/admin/image-upload";
import { useServerFn } from "@tanstack/react-start";
import { adminSaveSettings } from "@/lib/hubadmin.functions";
import {
  shopAddFulfillment,
  shopAdminProducts,
  shopApproveOrder,
  shopDraftEmail,
  shopDuplicateProduct,
  shopOrderDetail,
  shopSaveEmailDraft,
  shopOrders,
  shopPaymentMethods,
  shopRejectOrder,
  shopRequestInfo,
  shopSavePaymentMethod,
  shopSaveProduct,
  shopSendDelivery,
  shopSendTelegramDelivery,
  shopSetProductState,
  shopDeleteProduct,
  shopSummary,
  shopWalletAccounts,
  shopWalletTopUp,
  shopWalletPendingTopUps,
  shopWalletReviewTopUp,
  shopWalletDeduct,
  type BuyingSummary,
} from "@/lib/shopadmin.functions";

type Notify = (message: string) => void;
type Row = Record<string, unknown>;

const card = "rounded-2xl border border-border bg-card/60 p-5 backdrop-blur";
const input = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";
const primaryBtn = "rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground";
const ghostBtn = "rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground";

const STATUSES = [
  "all",
  "awaiting_payment",
  "payment_submitted",
  "awaiting_email",
  "under_review",
  "payment_confirmed",
  "awaiting_fulfillment",
  "delivered",
  "rejected",
  "expired",
  "cancelled",
];

const DELIVERY_REASONS: Record<string, string> = {
  email_provider_not_configured:
    "Email provider is not configured. Add a verified sender address in Shop settings and the email API secret, then retry.",
  no_delivery_material: "Add a delivery link, activation code or workspace instructions first.",
  payment_not_confirmed: "Approve the payment before sending delivery.",
  no_email: "This order has no confirmed delivery email yet.",
  telegram_material_too_long: "Delivery material is too long for one Telegram message. Shorten it or use email.",
  telegram_send_failed: "Telegram could not deliver. Check the delivery job and retry.",
  delivery_in_progress: "Delivery is already in progress.",
  email_send_failed: "The email provider rejected the send. See the delivery jobs list for the error.",
  sent: "Delivery email sent.",
  pending: "Payment approved. Add delivery material, then send.",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/* --------------------------------- Buying --------------------------------- */

export function BuyingPanel({ notify }: { notify: Notify }) {
  const fSummary = useServerFn(shopSummary);
  const fAssignInventory = useServerFn(marketplaceAssignInventory);
  const fOrders = useServerFn(shopOrders);
  const fDetail = useServerFn(shopOrderDetail);
  const fApprove = useServerFn(shopApproveOrder);
  const fReject = useServerFn(shopRejectOrder);
  const fInfo = useServerFn(shopRequestInfo);
  const fFulfill = useServerFn(shopAddFulfillment);
  const fSend = useServerFn(shopSendDelivery);
  const fSendTelegram = useServerFn(shopSendTelegramDelivery);
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(timer); }, []);
  const fDraftEmail = useServerFn(shopDraftEmail);
  const fSaveEmail = useServerFn(shopSaveEmailDraft);
  const fSaveSettings = useServerFn(adminSaveSettings);
  const [slaDraft, setSlaDraft] = useState("30");

  const [summary, setSummary] = useState<BuyingSummary | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Awaited<ReturnType<typeof shopOrderDetail>> | null>(null);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [material, setMaterial] = useState("");
  const [kind, setKind] = useState<"link" | "code" | "instructions">("link");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [s, o] = await Promise.all([fSummary({ data: undefined }), fOrders({ data: { status, search } })]);
    setSummary(s);
    setSlaDraft(String(s.deliverySlaMinutes));
    setRows(o as Row[]);
  }, [fOrders, fSummary, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const openOrder = async (id: string) => {
    const detail = await fDetail({ data: { id } });
    setOpen(detail);
    setNotes("");
    setReason("");
    setMaterial("");
    setEmailSubject(String((detail.order as Row)["email_subject"] ?? ""));
    setEmailBody(String((detail.order as Row)["email_body"] ?? ""));
  };

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          ["Pending review", summary?.pendingReview],
          ["Awaiting email", summary?.awaitingEmail],
          ["Awaiting delivery", summary?.awaitingDelivery],
          ["Completed", summary?.completed],
          ["Rejected", summary?.rejected],
          ["Orders overdue", now ? (summary?.deliveryDeadlines ?? []).filter(t => Date.parse(t) + (summary?.deliverySlaMinutes ?? 30) * 60000 <= now).length : summary?.ordersOverdue],
        ].map(([label, value]) => (
          <div key={String(label)} className={card}>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className="text-2xl font-black">{value ?? 0}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">CRM sync · {summary?.crmSync.configured ? "Connected" : "Key missing"} · Last success: {summary?.crmSync.lastSuccess ? new Date(summary.crmSync.lastSuccess).toLocaleString() : "Not yet"} · {summary?.crmSync.pending ?? 0} queued · <span className={summary?.crmSync.stuck ? "text-destructive" : ""}>{summary?.crmSync.stuck ?? 0} stuck (5+ attempts)</span></p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Delivery SLA (minutes)"><input type="number" min="1" max="1440" value={slaDraft} onChange={e => setSlaDraft(e.target.value)} className={input} /></Field>
        <Button variant="outline" disabled={busy} onClick={() => void act(async () => {
          const minutes = Number(slaDraft);
          if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new Error("Enter 1–1440 minutes.");
          await fSaveSettings({ data: { values: { shop_delivery_sla_minutes: String(minutes) } } });
          notify("Delivery SLA saved.");
        })}>Save SLA</Button>
      </div>
      <div className={card}>
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Confirmed revenue by currency</p>
        <div className="mt-2 flex flex-wrap gap-4">
          {(summary?.revenue ?? []).length === 0 && <span className="text-sm text-muted-foreground">No confirmed orders yet.</span>}
          {(summary?.revenue ?? []).map((entry) => (
            <span key={entry.currency} className="text-lg font-black">
              {entry.currency === "XTR" ? `${entry.total} ⭐ XTR` : `${entry.total.toFixed(2)} ${entry.currency}`}
            </span>
          ))}
        </div>
      </div>

      <div className={`${card} flex flex-wrap items-end gap-3`}>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Search order / email / reference">
          <input value={search} onChange={(e) => setSearch(e.target.value)} className={input} />
        </Field>
        <button type="button" className={ghostBtn} onClick={() => void load()}>
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No orders match these filters.</p>}
        {rows.map((row) => (
          <article key={String(row["id"])} className={`${card} space-y-2`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold">{String(row["order_number"])}</span>
              <div className="flex flex-wrap items-center gap-2"><DeliveryCountdown order={row as { status: string; confirmed_at: string | null; delivered_at: string | null }} minutes={summary?.deliverySlaMinutes ?? 30} now={now} /><span className="rounded-full border border-border px-3 py-1 text-xs">{String(row["status"])}</span></div>
            </div>
            <p className="text-sm text-muted-foreground">
              {(row["items"] as Array<{ product_name: string; quantity: number }>)
                .map((i) => `${i.product_name} x${i.quantity}`)
                .join(", ")}
            </p>
            <p className="text-sm">
              {row["currency"] === "XTR"
                ? `${row["stars_total"] ?? 0} ⭐`
                : `${Number(row["total"] ?? 0).toFixed(2)} ${String(row["currency"])}`}{" "}
              · {String(row["payment_method_name"] ?? "—")} · {String(row["customer_name"] ?? "—")}
            </p>
            {row["delivery_emails"] ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                {String(row["delivery_emails"])}
                <button
                  type="button"
                  className={ghostBtn}
                  onClick={() => void navigator.clipboard.writeText(String(row["delivery_emails"]))}
                >
                  Copy Email
                </button>
              </p>
            ) : null}
            {row["payment_reference"] ? (
              <p className="text-xs text-muted-foreground">Reference: {String(row["payment_reference"])}</p>
            ) : null}
            <button type="button" className={primaryBtn} onClick={() => void openOrder(String(row["id"]))}>
              View Order
            </button>
          </article>
        ))}
      </div>

      {open && (
        <div className={`${card} space-y-4 border-primary/40`}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black">Order {String(open.order["order_number"])}</h3>
            <button type="button" className={ghostBtn} onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p className="flex flex-wrap items-center gap-2">Status: {String(open.order["status"])} <DeliveryCountdown order={open.order} minutes={summary?.deliverySlaMinutes ?? 30} now={now} /></p>
            <p>
              Amount:{" "}
              {open.order["currency"] === "XTR"
                ? `${open.order["stars_total"] ?? 0} ⭐`
                : `${Number(open.order["total"] ?? 0).toFixed(2)} ${String(open.order["currency"])}`}
            </p>
            <p>Method: {String(open.order["payment_method_name"] ?? "—")}</p>
            <p>Recipient used: {String(open.order["payment_recipient"] ?? "—")}</p>
            <p>Reference: {String(open.order["payment_reference"] ?? "—")}</p>
            <p>Evidence: {open.order.payment_evidence_url ? <a href={open.order.payment_evidence_url} target="_blank" rel="noreferrer" className="text-primary">View private screenshot</a> : "—"}</p>
            <p>Emails: {String(open.order["delivery_emails"] ?? "—")}</p>
            <p>
              Telegram: {open.telegram?.username ? `@${open.telegram.username}` : "—"}{" "}
              {open.telegram?.telegram_user_id ?? ""}
            </p>
            <p>Stock reserved: {open.order["stock_reserved"] ? "yes" : "no"}</p>
            <p>Stock consumed: {open.order["stock_consumed"] ? "yes" : "no"}</p>
          </div>

          <div className="space-y-2">
            <Field label="Review notes (optional)">
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className={primaryBtn}
                onClick={() =>
                  void act(async () => {
                    const result = await fApprove({ data: { id: String(open.order["id"]), notes } });
                    notify(DELIVERY_REASONS[result.delivery ?? "pending"] ?? "Payment approved.");
                    await openOrder(String(open.order["id"]));
                  })
                }
              >
                Approve Payment
              </button>
              <button
                type="button"
                disabled={busy}
                className={primaryBtn}
                onClick={() =>
                  void act(async () => {
                    const result = await fApprove({ data: { id: String(open.order["id"]), notes, send: true } });
                    notify(DELIVERY_REASONS[result.delivery ?? "pending"] ?? "Done.");
                    await openOrder(String(open.order["id"]));
                  })
                }
              >
                Approve and Send
              </button>
              {open.order.delivery_emails && (              <Button
                type="button"
                disabled={busy}
                className={ghostBtn}
                onClick={() =>
                  void act(async () => {
                    const result = await fSend({ data: { id: String(open.order["id"]) } });
                    notify(result.ok ? "Delivery email sent." : (DELIVERY_REASONS[result.reason ?? ""] ?? "Delivery failed."));
                    await openOrder(String(open.order["id"]));
                  })
                }
              >
                Send Delivery
              </Button>)}
              {open.order.telegram_user_id != null && <Button type="button" variant="outline" disabled={busy} className={ghostBtn} onClick={() => void act(async () => {
                const result = await fSendTelegram({ data: { id: open.order.id } });
                notify(result.ok ? "Telegram delivery sent." : (DELIVERY_REASONS[result.reason ?? ""] ?? "Telegram delivery failed. Check delivery jobs."));
                await openOrder(open.order.id);
              })}>Send via Telegram</Button>}
            </div>
            <Field label="Rejection reason or information request">
              <input value={reason} onChange={(e) => setReason(e.target.value)} className={input} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || reason.trim().length < 3}
                className={ghostBtn}
                onClick={() =>
                  void act(async () => {
                    await fReject({ data: { id: String(open.order["id"]), reason } });
                    notify("Order rejected and the customer was notified.");
                    setOpen(null);
                  })
                }
              >
                Reject Payment
              </button>
              <button
                type="button"
                disabled={busy || reason.trim().length < 3}
                className={ghostBtn}
                onClick={() =>
                  void act(async () => {
                    await fInfo({ data: { id: String(open.order["id"]), message: reason } });
                    notify("Information request sent.");
                  })
                }
              >
                Request More Information
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold">Delivery material</p>
            <Button variant="outline" disabled={busy} onClick={()=>void act(async()=>{const r=await fAssignInventory({data:{id:open.order.id}});notify(`${r.assigned} private items assigned.`);await openOrder(open.order.id);})}>Assign private inventory</Button>
            {open.fulfillments.map((f: Row) => (
              <p key={String(f["id"])} className="whitespace-pre-line rounded-xl border border-border p-3 text-xs">
                [{String(f["kind"])}] {String(f["content"])}
              </p>
            ))}
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Type">
                <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={input}>
                  <option value="link">Delivery link</option>
                  <option value="code">Activation code</option>
                  <option value="instructions">Workspace invitation instructions</option>
                </select>
              </Field>
              <Field label="Content">
                <input value={material} onChange={(e) => setMaterial(e.target.value)} className={input} />
              </Field>
              <button
                type="button"
                disabled={busy || material.trim().length < 3}
                className={primaryBtn}
                onClick={() =>
                  void act(async () => {
                    await fFulfill({ data: { id: String(open.order["id"]), kind, content: material } });
                    setMaterial("");
                    notify("Delivery material saved.");
                    await openOrder(String(open.order["id"]));
                  })
                }
              >
                Add
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold">Fulfillment email</p>
            <p className="text-xs text-muted-foreground">
              Draft the email automatically from this order (order ID, email, duration, credits, delivery material and
              payment details), review it, then save. A saved draft is what gets sent.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || drafting}
                className={primaryBtn}
                onClick={() => {
                  setDrafting(true);
                  void (async () => {
                    try {
                      const draftEmail = await fDraftEmail({ data: { id: String(open.order["id"]) } });
                      setEmailSubject(draftEmail.subject);
                      setEmailBody(draftEmail.body);
                      notify("Draft ready. Review it and save before sending.");
                    } catch (error) {
                      notify(error instanceof Error ? error.message : "Could not write the draft.");
                    } finally {
                      setDrafting(false);
                    }
                  })();
                }}
              >
                {drafting ? "Writing draft…" : "Draft with AI"}
              </button>
              <button
                type="button"
                disabled={busy || emailSubject.trim().length < 3 || emailBody.trim().length < 10}
                className={ghostBtn}
                onClick={() =>
                  void act(async () => {
                    await fSaveEmail({
                      data: { id: String(open.order["id"]), subject: emailSubject, body: emailBody },
                    });
                    notify("Email draft saved.");
                    await openOrder(String(open.order["id"]));
                  })
                }
              >
                Save draft
              </button>
            </div>
            <Field label="Subject">
              <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className={input} />
            </Field>
            <Field label="Body">
              <textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={12}
                className={`${input} font-mono text-xs`}
              />
            </Field>
          </div>


          <div className="space-y-1">
            <p className="text-sm font-bold">Audit timeline</p>
            {open.events.map((e: Row) => (
              <p key={String(e["id"])} className="text-xs text-muted-foreground">
                {new Date(String(e["created_at"])).toLocaleString()} · {String(e["event"])} · {String(e["actor"] ?? "")}{" "}
                {String(e["details"] ?? "")}
              </p>
            ))}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-bold">Delivery jobs</p>
            {open.jobs.length === 0 && <p className="text-xs text-muted-foreground">No delivery attempts yet.</p>}
            {open.jobs.map((j: Row) => (
              <p key={String(j["id"])} className="text-xs text-muted-foreground">
                {String(j["channel"])} → {String(j["target"] ?? "")} · {String(j["status"])}{" "}
                {j["last_error"] ? `· ${String(j["last_error"])}` : ""}
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------- Shop products ----------------------------- */

const emptyProduct = {
  name: "",
  slug: "",
  emoji: "",
  short_description: "",
  description: "",
  features: "",
  terms: "",
  image_url: "",
  logo_url: "",
  featured: false,
  reseller_product_id: "",
  duration_label: "",
  warranty_label: "",
  category_id: "",
  min_per_order: "1",
  credits_per_interval: "",
  renewal_interval: "",
  price_usdt: "",
  price_inr: "",
  price_stars: "",
  stock_mode: "manual",
  stock_quantity: "",
  max_per_order: "1",
  availability: "in_stock",
  shop_published: false,
  shop_order: "0",
  delivery_method: "email_manual",
  requires_buyer_email: true,
  installation_instructions: "",
  private_delivery_notes: "",
  download_url: "",
  status: "active",
};

type Draft = typeof emptyProduct & { id?: string };

const numOrNull = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

export function ShopProductsPanel({ notify }: { notify: Notify }) {
  const fProducts = useServerFn(shopAdminProducts);
  const fCategories = useServerFn(catalogCategories);
  const fGenerateImage = useServerFn(marketplaceGenerateImage);
  const [generating,setGenerating] = useState(false);
  const [categories,setCategories] = useState<Array<{id:string;name:string}>>([]);
  const fSave = useServerFn(shopSaveProduct);
  const fDuplicate = useServerFn(shopDuplicateProduct);
  const fState = useServerFn(shopSetProductState);
  const fDeleteProduct = useServerFn(shopDeleteProduct);
  const fMethods = useServerFn(shopPaymentMethods);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "manual" | "api" | "unpublished" | "featured">("all");
  const fSaveMethod = useServerFn(shopSavePaymentMethod);

  const [rows, setRows] = useState<Row[]>([]);
  const [methods, setMethods] = useState<Row[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    const [p, m, c] = await Promise.all([fProducts({ data: undefined }), fMethods({ data: undefined }), fCategories()]);
    setCategories(c);
    setRows(p as Row[]);
    setMethods(m as Row[]);
  }, [fMethods, fProducts, fCategories]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (q && !String(row["name"] ?? "").toLowerCase().includes(q)) return false;
      if (sourceFilter === "manual") return !row["reseller_product_id"];
      if (sourceFilter === "api") return Boolean(row["reseller_product_id"]);
      if (sourceFilter === "featured") return row["featured"] === true;
      if (sourceFilter === "unpublished") return row["shop_published"] !== true;
      return true;
    });
  }, [rows, query, sourceFilter]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      notify(ok);
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Action failed.");
    }
  };

  const edit = (row: Row) =>
    setDraft({
      id: String(row["id"]),
      name: String(row["name"] ?? ""),
      slug: String(row["slug"] ?? ""),
      emoji: String(row["emoji"] ?? ""),
      short_description: String(row["short_description"] ?? ""),
      description: String(row["description"] ?? ""),
      features: Array.isArray(row["features"]) ? (row["features"] as string[]).join("\n") : "",
      terms: String(row["terms"] ?? ""),
      image_url: String(row["image_url"] ?? ""),
      logo_url: String(row["logo_url"] ?? ""),
      featured: row["featured"] === true,
      reseller_product_id: row["reseller_product_id"] ? String(row["reseller_product_id"]) : "",
      duration_label: String(row["duration_label"] ?? ""),
      warranty_label: String(row["warranty_label"] ?? ""),
      category_id: String(row["category_id"] ?? ""),
      min_per_order: String(row["min_per_order"] ?? 1),
      credits_per_interval: row["credits_per_interval"] === null ? "" : String(row["credits_per_interval"]),
      renewal_interval: String(row["renewal_interval"] ?? ""),
      price_usdt: row["price_usdt"] === null ? "" : String(row["price_usdt"]),
      price_inr: row["price_inr"] === null ? "" : String(row["price_inr"]),
      price_stars: row["price_stars"] === null ? "" : String(row["price_stars"]),
      stock_mode: String(row["stock_mode"] ?? "manual"),
      stock_quantity: row["stock_quantity"] === null ? "" : String(row["stock_quantity"]),
      max_per_order: String(row["max_per_order"] ?? 1),
      availability: String(row["availability"] ?? "in_stock"),
      shop_published: row["shop_published"] === true,
      shop_order: String(row["shop_order"] ?? 0),
      delivery_method: String(row["delivery_method"] ?? "email_manual"),
      requires_buyer_email: row["requires_buyer_email"] !== false,
      installation_instructions: String(row["installation_instructions"] ?? ""),
      private_delivery_notes: String(row["private_delivery_notes"] ?? ""),
      download_url: String(row["download_url"] ?? ""),
      status: String(row["status"] ?? "active"),
    });

  const save = async () => {
    if (!draft) return;
    try {
      await fSave({
        data: {
          ...(draft.id ? { id: draft.id } : {}),
          name: draft.name,
          slug: draft.slug,
          emoji: draft.emoji,
          short_description: draft.short_description,
          description: draft.description,
          features: draft.features.split("\n").map((f) => f.trim()).filter(Boolean),
          terms: draft.terms,
          image_url: draft.image_url,
          logo_url: draft.logo_url,
          featured: draft.featured,
          duration_label: draft.duration_label,
          warranty_label: draft.warranty_label,
          category_id: draft.category_id || null,
          min_per_order: Number(draft.min_per_order || 1),
          credits_per_interval: numOrNull(draft.credits_per_interval),
          renewal_interval: draft.renewal_interval,
          price_usdt: numOrNull(draft.price_usdt),
          price_inr: numOrNull(draft.price_inr),
          price_stars: numOrNull(draft.price_stars),
          stock_mode: draft.stock_mode as "manual" | "tracked",
          stock_quantity: numOrNull(draft.stock_quantity),
          max_per_order: Number(draft.max_per_order || 1),
          availability: draft.availability as "in_stock" | "out_of_stock" | "coming_soon",
          shop_published: draft.shop_published,
          shop_order: Number(draft.shop_order || 0),
          delivery_method: draft.delivery_method,
          requires_buyer_email: draft.requires_buyer_email,
          installation_instructions: draft.installation_instructions,
          private_delivery_notes: draft.private_delivery_notes,
          download_url: draft.download_url,
          status: draft.status as "active" | "draft" | "archived",
        },
      });
      notify("Product saved.");
      setDraft(null);
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save this product.");
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex justify-end">
        <button type="button" className={primaryBtn} onClick={() => { setDraft({ ...emptyProduct }); window.setTimeout(() => document.getElementById("product-editor")?.scrollIntoView({ behavior: "smooth" }), 60); }}>
          + Add Product
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" aria-label="Search products" className="h-10 min-w-56 flex-1 rounded-lg border border-input bg-background px-3 text-sm" />
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {([["all", "All"], ["manual", "Store managed"], ["api", "Supplier API"], ["featured", "Featured"], ["unpublished", "Hidden"]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setSourceFilter(id)} className={`h-8 rounded-md px-3 text-xs font-medium ${sourceFilter === id ? "bg-card shadow-soft" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{visibleRows.length} of {rows.length} products. Supplier API products refresh price and stock on sync; store-only edits (images, Stars price, descriptions) are kept.</p>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>{["Product", "Source", "Price", "Stock", "Visibility", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleRows.map((row) => {
                const id = String(row["id"]);
                const api = Boolean(row["reseller_product_id"]);
                const archived = row["status"] === "archived";
                return (
                  <tr key={id} className={`hover:bg-muted/30 ${archived ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-base">
                          {row["logo_url"] ? <img src={String(row["logo_url"])} alt="" className="size-6 object-contain" /> : String(row["emoji"] ?? "") || String(row["name"]).charAt(0)}
                        </span>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 truncate font-medium">{row["featured"] === true && <span className="text-warning" aria-label="Featured">★</span>}{String(row["name"])}</p>
                          <p className="text-xs text-muted-foreground">{String(row["status"])}{row["duration_label"] ? ` · ${String(row["duration_label"])}` : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${api ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                        {api ? (String(row["reseller_product_id"]).startsWith("digihup:") ? "DIGIHUP API" : "Reseller API") : "Store managed"}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {row["price_usdt"] === null ? <span className="text-muted-foreground">Not set</span> : `${Number(row["price_usdt"]).toFixed(2)} USDT`}
                      <p className="text-xs text-muted-foreground">{row["price_stars"] === null ? "No Stars price" : `${String(row["price_stars"])} Stars`}</p>
                    </td>
                    <td className="px-4 py-3 text-xs">{String(row["availability"]).replaceAll("_", " ")}{row["stock_mode"] === "tracked" ? ` · ${String(row["stock_quantity"] ?? 0)} left` : ""}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${row["shop_published"] ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
                        onClick={() => void act(() => fState({ data: { id, shop_published: !(row["shop_published"] === true) } }), row["shop_published"] ? "Product hidden from the store and bot." : "Product published to the store and bot.")}
                      >
                        {row["shop_published"] ? "Published" : "Hidden"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button type="button" className={ghostBtn} onClick={() => { edit(row); window.setTimeout(() => document.getElementById("product-editor")?.scrollIntoView({ behavior: "smooth" }), 60); }}>Edit</button>
                        <button type="button" className={ghostBtn} onClick={() => void act(() => fState({ data: { id, featured: !(row["featured"] === true) } }), row["featured"] ? "Removed from featured." : "Marked as featured on the Home page.")}>
                          {row["featured"] ? "Unfeature" : "Feature"}
                        </button>
                        <button type="button" className={ghostBtn} onClick={() => void act(() => fDuplicate({ data: { id } }), "Product duplicated as a hidden draft.")}>Duplicate</button>
                        {archived ? (
                          <button type="button" className={ghostBtn} onClick={() => void act(() => fState({ data: { id, status: "active" } }), "Product restored.")}>Restore</button>
                        ) : (
                          <button type="button" className={ghostBtn} onClick={() => void act(() => fState({ data: { id, status: "archived" } }), "Product archived.")}>Archive</button>
                        )}
                        <button
                          type="button"
                          className="rounded-xl border border-destructive/40 px-3 py-2 text-xs font-bold text-destructive"
                          onClick={() => {
                            if (!window.confirm(`Delete “${String(row["name"])}” permanently? Products with orders can only be archived.`)) return;
                            void act(() => fDeleteProduct({ data: { id } }), "Product deleted.");
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!visibleRows.length && <p className="px-4 py-10 text-center text-sm text-muted-foreground">No products match.</p>}
        </div>
      </div>

      {draft && (
        <div id="product-editor" className={`${card} scroll-mt-24 space-y-3 border-primary/40`}>
          <h3 className="text-lg font-bold">{draft.id ? "Edit product" : "New product"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input className={input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Short name (slug)">
              <input className={input} value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
            </Field>
            <Field label="Emoji">
              <input className={input} value={draft.emoji} onChange={(e) => setDraft({ ...draft, emoji: e.target.value })} />
            </Field>
            <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
              <ImageUpload folder="products" label="Product image (cards & product page)" value={draft.image_url} onChange={(url) => setDraft({ ...draft, image_url: url })} />
              <ImageUpload folder="products" label="Brand logo (square)" value={draft.logo_url} onChange={(url) => setDraft({ ...draft, logo_url: url })} />
            </div>
            <Button variant="outline" disabled={generating||!draft.name.trim()} onClick={async()=>{if(!window.confirm("Generate a product thumbnail using paid AI credits?"))return;setGenerating(true);try{const r=await fGenerateImage({data:{name:draft.name,description:draft.description}});setDraft({...draft,image_url:r.url});notify("Image saved. Save the product to use it.");}catch(e){notify(e instanceof Error?e.message:"Image generation unavailable. Upload an image instead.");}finally{setGenerating(false);}}}>{generating?"Generating…":"Generate image · AI credits"}</Button>
            {draft.reseller_product_id && (
              <p className="sm:col-span-2 rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
                Connected to supplier product <span className="font-mono">{draft.reseller_product_id}</span>. Name, USDT price and stock are refreshed on each sync; everything else you edit here is kept.
              </p>
            )}
            <Field label="Price USDT (blank = not configured)">
              <input className={input} value={draft.price_usdt} onChange={(e) => setDraft({ ...draft, price_usdt: e.target.value })} />
            </Field>
            <Field label="Price INR (blank = UPI unavailable)">
              <input className={input} value={draft.price_inr} onChange={(e) => setDraft({ ...draft, price_inr: e.target.value })} />
            </Field>
            <Field label="Price in Telegram Stars (whole number, blank = Telegram purchase off)">
              <input className={input} value={draft.price_stars} onChange={(e) => setDraft({ ...draft, price_stars: e.target.value })} />
            </Field>
            <Field label="Bot category"><select className={input} value={draft.category_id} onChange={e=>setDraft({...draft,category_id:e.target.value})}><option value="">Uncategorised</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Warranty">
              <input className={input} value={draft.warranty_label} onChange={e => setDraft({...draft,warranty_label:e.target.value})} />
            </Field>
            <Field label="Minimum quantity">
              <input type="number" min="1" max="100" className={input} value={draft.min_per_order} onChange={e=>setDraft({...draft,min_per_order:e.target.value})} />
            </Field>
            <Field label="Duration label">
              <input className={input} value={draft.duration_label} onChange={(e) => setDraft({ ...draft, duration_label: e.target.value })} />
            </Field>
            <Field label="Credits per interval">
              <input className={input} value={draft.credits_per_interval} onChange={(e) => setDraft({ ...draft, credits_per_interval: e.target.value })} />
            </Field>
            <Field label="Renewal interval">
              <input className={input} value={draft.renewal_interval} onChange={(e) => setDraft({ ...draft, renewal_interval: e.target.value })} />
            </Field>
            <Field label="Stock mode">
              <select className={input} value={draft.stock_mode} onChange={(e) => setDraft({ ...draft, stock_mode: e.target.value })}>
                <option value="manual">Manual availability</option>
                <option value="tracked">Tracked quantity</option>
              </select>
            </Field>
            <Field label="Stock quantity (tracked only)">
              <input className={input} value={draft.stock_quantity} onChange={(e) => setDraft({ ...draft, stock_quantity: e.target.value })} />
            </Field>
            <Field label="Max units per order">
              <input className={input} value={draft.max_per_order} onChange={(e) => setDraft({ ...draft, max_per_order: e.target.value })} />
            </Field>
            <Field label="Availability">
              <select className={input} value={draft.availability} onChange={(e) => setDraft({ ...draft, availability: e.target.value })}>
                <option value="in_stock">In stock</option>
                <option value="out_of_stock">Out of stock</option>
                <option value="coming_soon">Coming soon</option>
              </select>
            </Field>
            <Field label="Display order">
              <input className={input} value={draft.shop_order} onChange={(e) => setDraft({ ...draft, shop_order: e.target.value })} />
            </Field>
            <Field label="State">
              <select className={input} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Delivery method">
              <input className={input} value={draft.delivery_method} onChange={(e) => setDraft({ ...draft, delivery_method: e.target.value })} />
            </Field>
            <Field label="Public download / documentation URL">
              <input className={input} value={draft.download_url} onChange={(e) => setDraft({ ...draft, download_url: e.target.value })} />
            </Field>
          </div>
          {draft.id && <InventoryManager productId={draft.id} />}
          <Field label="Short description">
            <input className={input} value={draft.short_description} onChange={(e) => setDraft({ ...draft, short_description: e.target.value })} />
          </Field>
          <Field label="Full description">
            <textarea rows={4} className={input} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </Field>
          <Field label="Features (one per line)">
            <textarea rows={4} className={input} value={draft.features} onChange={(e) => setDraft({ ...draft, features: e.target.value })} />
          </Field>
          <Field label="Product terms">
            <textarea rows={2} className={input} value={draft.terms} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} />
          </Field>
          <Field label="Installation instructions">
            <textarea rows={3} className={input} value={draft.installation_instructions} onChange={(e) => setDraft({ ...draft, installation_instructions: e.target.value })} />
          </Field>
          <Field label="Private delivery notes (admin only, never shown to customers)">
            <textarea rows={2} className={input} value={draft.private_delivery_notes} onChange={(e) => setDraft({ ...draft, private_delivery_notes: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.shop_published} onChange={(e) => setDraft({ ...draft, shop_published: e.target.checked })} />
            Published in the store
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.featured} onChange={(e) => setDraft({ ...draft, featured: e.target.checked })} />
            Featured on the Home page
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.requires_buyer_email} onChange={(e) => setDraft({ ...draft, requires_buyer_email: e.target.checked })} />
            Requires a buyer email
          </label>
          <div className="flex gap-2">
            <button type="button" className={primaryBtn} onClick={() => void save()}>
              Save product
            </button>
            <button type="button" className={ghostBtn} onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <PaymentMethodsEditor rows={methods} notify={notify} reload={load} save={fSaveMethod} />
    </section>
  );
}

function PaymentMethodsEditor({
  rows,
  notify,
  reload,
  save,
}: {
  rows: Row[];
  notify: Notify;
  reload: () => Promise<void>;
  save: ReturnType<typeof useServerFn<typeof shopSavePaymentMethod>>;
}) {
  const [draft, setDraft] = useState<Row | null>(null);

  const field = (key: string) => String(draft?.[key] ?? "");

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black">Payment methods</h3>
        <button
          type="button"
          className={primaryBtn}
          onClick={() =>
            setDraft({
              name: "",
              provider: "",
              currency: "USDT",
              channel: "website",
              network: "",
              recipient: "",
              recipient_label: "Recipient",
              settlement_asset: "",
              reference_label: "Transaction reference",
              instructions: "",
              enabled: true,
              display_order: 0,
            })
          }
        >
          + Add Payment Method
        </button>
      </div>
      {rows.map((row) => (
        <article key={String(row["id"])} className={`${card} flex flex-wrap items-center justify-between gap-2`}>
          <span className="min-w-0 max-w-full break-all text-sm">
            <strong>{String(row["name"])}</strong> · {String(row["currency"])} ·{" "}
            {String(row["network"] ?? "no network")} · {String(row["recipient"] ?? "—")} ·{" "}
            {row["enabled"] ? "enabled" : "disabled"}
          </span>
          <button type="button" className={ghostBtn} onClick={() => setDraft(row)}>
            Edit
          </button>
        </article>
      ))}
      {draft && (
        <div className={`${card} space-y-3 border-primary/40`}>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["name", "Name"],
              ["provider", "Provider key"],
              ["currency", "Currency"],
              ["network", "Network"],
              ["recipient", "Recipient address / ID"],
              ["recipient_label", "Recipient label"],
              ["settlement_asset", "Settlement asset"],
              ["reference_label", "Reference label"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <input className={input} value={field(key)} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
              </Field>
            ))}
            <Field label="Channel">
              <select className={input} value={String(draft["channel"] ?? "website")} onChange={(e) => setDraft({ ...draft, channel: e.target.value })}>
                <option value="website">Website</option>
                <option value="telegram">Telegram</option>
              </select>
            </Field>
            <Field label="Display order">
              <input className={input} value={String(draft["display_order"] ?? 0)} onChange={(e) => setDraft({ ...draft, display_order: e.target.value })} />
            </Field>
          </div>
          <Field label="Account / recipient name"><input className={input} value={String((draft["config"] as Row | undefined)?.["account_name"] ?? (draft["config"] as Row | undefined)?.["recipient_name"] ?? "")} onChange={e=>setDraft({...draft,config:{...((draft["config"] as Row)||{}),account_name:e.target.value,recipient_name:e.target.value}})} /></Field>
          <Field label="Payment QR"><ImageUpload folder="products" label="QR image" value={String((draft["config"] as Row | undefined)?.["qr_url"]??"")} onChange={url=>setDraft({...draft,config:{...((draft["config"] as Row)||{}),qr_url:url}})} /></Field>
          <Field label="Instructions">
            <textarea rows={3} className={input} value={field("instructions")} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft["enabled"] === true} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
            Enabled
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className={primaryBtn}
              onClick={() =>
                void (async () => {
                  try {
                    await save({
                      data: {
                        ...(draft["id"] ? { id: String(draft["id"]) } : {}),
                        name: String(draft["name"] ?? ""),
                        provider: String(draft["provider"] ?? ""),
                        currency: String(draft["currency"] ?? ""),
                        channel: (String(draft["channel"] ?? "website") as "website" | "telegram"),
                        network: String(draft["network"] ?? ""),
                        recipient: String(draft["recipient"] ?? ""),
                        recipient_label: String(draft["recipient_label"] ?? ""),
                        settlement_asset: String(draft["settlement_asset"] ?? ""),
                        reference_label: String(draft["reference_label"] ?? ""),
                        instructions: String(draft["instructions"] ?? ""),
                        config: {account_name:String((draft["config"] as Row|undefined)?.["account_name"]??""),recipient_name:String((draft["config"] as Row|undefined)?.["recipient_name"]??""),qr_url:String((draft["config"] as Row|undefined)?.["qr_url"]??"")},
                        enabled: draft["enabled"] === true,
                        display_order: Number(draft["display_order"] ?? 0),
                      },
                    });
                    notify("Payment method saved.");
                    setDraft(null);
                    await reload();
                  } catch (error) {
                    notify(error instanceof Error ? error.message : "Could not save this payment method.");
                  }
                })()
              }
            >
              Save
            </button>
            <button type="button" className={ghostBtn} onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* --------------------------------- Wallets -------------------------------- */

type WalletAccount = {
  id: string;
  member_number?: number | null;
  name: string;
  username: string | null;
  telegram_user_id: number | null;
  balance: number;
};

export function WalletPanel({ notify }: { notify: Notify }) {
  const fAccounts = useServerFn(shopWalletAccounts);
  const fTopUp = useServerFn(shopWalletTopUp);
  const fPending = useServerFn(shopWalletPendingTopUps);
  const fReview = useServerFn(shopWalletReviewTopUp);
  const fDeduct = useServerFn(shopWalletDeduct);
  const [pending, setPending] = useState<Awaited<ReturnType<typeof shopWalletPendingTopUps>>>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [credits, setCredits] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<WalletAccount[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await fAccounts({ data: { search: search.trim() || undefined } }));
      setPending(await fPending());
    } catch {
      notify("Could not load wallets.");
    }
  }, [fAccounts, fPending, notify, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const topUp = async (row: WalletAccount) => {
    const amount = Number(amounts[row.id] ?? "");
    if (!Number.isFinite(amount) || amount <= 0) {
      notify("Enter a dollar amount greater than zero.");
      return;
    }
    setBusy(true);
    try {
      await fTopUp({ data: { profileId: row.id, amount, note: "Added by admin" } });
      setAmounts((prev) => ({ ...prev, [row.id]: "" }));
      notify(`Added $${amount.toFixed(2)} to ${row.name}.`);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not add funds.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card/60 p-5">
      <h3 className="text-lg font-bold">Pending top ups</h3>
      <div className="space-y-3">
        {pending.map(r => <div key={r.id} className="border-b border-border pb-4 space-y-2">
          <p className="font-semibold">{r.amount} {r.currency} · {r.reference}</p>
          <p className="text-xs text-muted-foreground break-all">{r.profile_id} · {r.network} · {r.recipient_used}</p>
          {r.evidence_url && <a href={r.evidence_url} target="_blank" rel="noreferrer" className="text-primary text-sm">Payment evidence</a>}
          <input aria-label={`Review note ${r.id}`} placeholder="Review note or rejection reason" className={input} value={notes[r.id] ?? ""} onChange={e => setNotes(p => ({ ...p, [r.id]: e.target.value }))} />
          {r.currency === "INR" && <input aria-label={`USD credit ${r.id}`} placeholder="Verified USD wallet credit" inputMode="decimal" className={input} value={credits[r.id] ?? ""} onChange={e => setCredits(p => ({ ...p, [r.id]: e.target.value }))} />}
          <div className="flex gap-2">{[true,false].map(approve => <Button key={String(approve)} variant={approve ? "default" : "outline"} disabled={busy} onClick={async () => {
            if ((notes[r.id] ?? "").trim().length < 3 || (approve && r.currency === "INR" && !(Number(credits[r.id]) > 0))) { notify("Enter a review note and verified USD credit for INR."); return; }
            setBusy(true); try { const result = await fReview({ data: { id: r.id, approve, note: notes[r.id], creditUsd: r.currency === "INR" && approve ? Number(credits[r.id]) : undefined } }); notify(result.notified ? "Top up reviewed." : "Reviewed; Telegram notification failed."); await load(); } catch(e) { notify(e instanceof Error ? e.message : "Review failed."); } finally { setBusy(false); }
          }}>{approve ? "Approve" : "Reject"}</Button>)}</div>
        </div>)}
        {!pending.length && <p className="text-sm text-muted-foreground">No pending top ups.</p>}
      </div>
      <div>
        <h3 className="text-lg font-black">Customer wallets</h3>
        <p className="text-sm text-muted-foreground">
          Add dollars to a customer&apos;s wallet. They can then pay for products instantly from that balance.
        </p>
      </div>
      <div className="flex gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or username"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted/40"
        >
          Search
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">{row.name}</p>
              <p className="text-xs text-muted-foreground">
                {memberLabel(row.member_number)} · {row.username ? `@${row.username}` : row.telegram_user_id ?? "—"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 max-w-full">
              <span className="text-sm font-black text-primary">${row.balance.toFixed(2)}</span>
              <input
                value={amounts[row.id] ?? ""}
                onChange={(event) => setAmounts((prev) => ({ ...prev, [row.id]: event.target.value }))}
                placeholder="0.00"
                inputMode="decimal"
                className="w-24 rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void topUp(row)}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                Add funds
              </button>
              <input aria-label={`Deduction note ${row.id}`} placeholder="Deduction note" className="min-w-0 w-32 border border-border rounded-md p-2 text-sm" value={notes[row.id] ?? ""} onChange={e => setNotes(p => ({ ...p, [row.id]: e.target.value }))} />
              <Button variant="outline" disabled={busy} onClick={async () => {
                if (!(Number(amounts[row.id]) > 0) || (notes[row.id] ?? "").trim().length < 3) { notify("Enter an amount and short deduction note."); return; }
                setBusy(true); try { await fDeduct({ data: { profileId: row.id, amount: Number(amounts[row.id]), note: notes[row.id] } }); await load(); notify("Wallet corrected."); } catch(e) { notify(e instanceof Error ? e.message : "Deduction failed."); } finally { setBusy(false); }
              }}>Deduct</Button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No customers found.</p>}
      </div>
    </section>
  );
}
