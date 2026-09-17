import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
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
  shopSetProductState,
  shopSummary,
  shopWalletAccounts,
  shopWalletTopUp,
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
  const fOrders = useServerFn(shopOrders);
  const fDetail = useServerFn(shopOrderDetail);
  const fApprove = useServerFn(shopApproveOrder);
  const fReject = useServerFn(shopRejectOrder);
  const fInfo = useServerFn(shopRequestInfo);
  const fFulfill = useServerFn(shopAddFulfillment);
  const fSend = useServerFn(shopSendDelivery);
  const fDraftEmail = useServerFn(shopDraftEmail);
  const fSaveEmail = useServerFn(shopSaveEmailDraft);

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
      <div className="grid gap-3 sm:grid-cols-5">
        {[
          ["Pending review", summary?.pendingReview],
          ["Awaiting email", summary?.awaitingEmail],
          ["Awaiting delivery", summary?.awaitingDelivery],
          ["Completed", summary?.completed],
          ["Rejected", summary?.rejected],
        ].map(([label, value]) => (
          <div key={String(label)} className={card}>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</p>
            <p className="text-2xl font-black">{value ?? 0}</p>
          </div>
        ))}
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
              <span className="rounded-full border border-border px-3 py-1 text-xs">{String(row["status"])}</span>
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
            <p>Status: {String(open.order["status"])}</p>
            <p>
              Amount:{" "}
              {open.order["currency"] === "XTR"
                ? `${open.order["stars_total"] ?? 0} ⭐`
                : `${Number(open.order["total"] ?? 0).toFixed(2)} ${String(open.order["currency"])}`}
            </p>
            <p>Method: {String(open.order["payment_method_name"] ?? "—")}</p>
            <p>Recipient used: {String(open.order["payment_recipient"] ?? "—")}</p>
            <p>Reference: {String(open.order["payment_reference"] ?? "—")}</p>
            <p>Evidence: {String(open.order["payment_evidence_url"] ?? "—")}</p>
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
              <button
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
                Send / Retry Delivery
              </button>
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
  duration_label: "",
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
  const fSave = useServerFn(shopSaveProduct);
  const fDuplicate = useServerFn(shopDuplicateProduct);
  const fState = useServerFn(shopSetProductState);
  const fMethods = useServerFn(shopPaymentMethods);
  const fSaveMethod = useServerFn(shopSavePaymentMethod);

  const [rows, setRows] = useState<Row[]>([]);
  const [methods, setMethods] = useState<Row[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    const [p, m] = await Promise.all([fProducts({ data: undefined }), fMethods({ data: undefined })]);
    setRows(p as Row[]);
    setMethods(m as Row[]);
  }, [fMethods, fProducts]);

  useEffect(() => {
    void load();
  }, [load]);

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
      duration_label: String(row["duration_label"] ?? ""),
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
          duration_label: draft.duration_label,
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
        <button type="button" className={primaryBtn} onClick={() => setDraft({ ...emptyProduct })}>
          + Add Product
        </button>
      </div>

      {rows.map((row) => (
        <article key={String(row["id"])} className={`${card} space-y-2`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold">
              {String(row["emoji"] ?? "")} {String(row["name"])}
            </span>
            <span className="text-xs text-muted-foreground">
              {row["price_usdt"] === null ? "Price not configured" : `${Number(row["price_usdt"]).toFixed(2)} USDT`} ·{" "}
              {row["price_stars"] === null ? "Stars not configured" : `${String(row["price_stars"])} ⭐`} ·{" "}
              {String(row["availability"])} · {row["shop_published"] ? "published" : "unpublished"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={ghostBtn} onClick={() => edit(row)}>
              Edit
            </button>
            <button
              type="button"
              className={ghostBtn}
              onClick={() =>
                void fDuplicate({ data: { id: String(row["id"]) } })
                  .then(load)
                  .then(() => notify("Product duplicated as a draft."))
              }
            >
              Duplicate
            </button>
            <button
              type="button"
              className={ghostBtn}
              onClick={() =>
                void fState({ data: { id: String(row["id"]), shop_published: !(row["shop_published"] === true) } })
                  .then(load)
              }
            >
              {row["shop_published"] ? "Unpublish" : "Publish"}
            </button>
            <button
              type="button"
              className={ghostBtn}
              onClick={() => void fState({ data: { id: String(row["id"]), status: "archived" } }).then(load)}
            >
              Archive
            </button>
          </div>
        </article>
      ))}

      {draft && (
        <div className={`${card} space-y-3 border-primary/40`}>
          <h3 className="text-lg font-black">{draft.id ? "Edit product" : "New product"}</h3>
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
            <Field label="Image URL">
              <input className={input} value={draft.image_url} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} />
            </Field>
            <Field label="Price USDT (blank = not configured)">
              <input className={input} value={draft.price_usdt} onChange={(e) => setDraft({ ...draft, price_usdt: e.target.value })} />
            </Field>
            <Field label="Price INR (blank = UPI unavailable)">
              <input className={input} value={draft.price_inr} onChange={(e) => setDraft({ ...draft, price_inr: e.target.value })} />
            </Field>
            <Field label="Price in Telegram Stars (whole number, blank = Telegram purchase off)">
              <input className={input} value={draft.price_stars} onChange={(e) => setDraft({ ...draft, price_stars: e.target.value })} />
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
          <span className="text-sm">
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
  name: string;
  username: string | null;
  telegram_user_id: number | null;
  balance: number;
};

export function WalletPanel({ notify }: { notify: Notify }) {
  const fAccounts = useServerFn(shopWalletAccounts);
  const fTopUp = useServerFn(shopWalletTopUp);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<WalletAccount[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await fAccounts({ data: { search: search.trim() || undefined } }));
    } catch {
      notify("Could not load wallets.");
    }
  }, [fAccounts, notify, search]);

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
                {row.username ? `@${row.username}` : row.telegram_user_id ?? "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
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
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No customers found.</p>}
      </div>
    </section>
  );
}
