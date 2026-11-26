import { db, getSettings, logActivity, tg } from "@/lib/hub.server";
import { needsDeliveryEmail, telegramDeliveryText } from "@/lib/shop-fulfillment";

export type ShopChannel = "website" | "telegram";

export type ShopProduct = {
  id: string;
  slug: string | null;
  name: string;
  emoji: string | null;
  short_description: string | null;
  description: string | null;
  features: string[];
  terms: string | null;
  image_url: string | null;
  logo_url: string | null;
  duration_label: string | null;
  credits_per_interval: number | null;
  renewal_interval: string | null;
  price_usdt: number | null;
  price_inr: number | null;
  price_stars: number | null;
  stock_mode: string;
  stock_quantity: number | null;
  max_per_order: number;
  availability: string;
  delivery_method: string;
  requires_buyer_email: boolean;
  installation_instructions: string | null;
  warranty_label?: string | null;
  download_url: string | null;
  tutorial_url: string | null;
  shop_order: number;
  featured: boolean;
  created_at: string | null;
  updated_at: string | null;
  /** "manual" for owner-managed products, otherwise the supplier API that manages price and stock. */
  source: "manual" | "reseller" | "digihup";
  purchasable: boolean;
  stock_label: string;
  price_label: string;
};

const num = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const money = (value: number, currency: string) => `${value.toFixed(2)} ${currency}`;

export function featureList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((f) => String(f)).filter(Boolean);
  return [];
}

export function maxUnits(product: ShopProduct): number {
  const limit = Math.max(1, product.max_per_order || 1);
  if (product.stock_mode === "tracked") return Math.max(0, Math.min(limit, product.stock_quantity ?? 0));
  return limit;
}

export function shapeProduct(row: Record<string, unknown>, channel: ShopChannel): ShopProduct {
  const priceUsdt = num(row["price_usdt"]);
  const priceStars = num(row["price_stars"]);
  const stockMode = String(row["stock_mode"] ?? "manual");
  const stockQty = num(row["stock_quantity"]);
  const availability = String(row["availability"] ?? "in_stock");

  const inStock =
    availability === "in_stock" && (stockMode !== "tracked" || (stockQty ?? 0) > 0);
  const hasPrice = channel === "telegram" ? priceStars !== null && priceStars > 0 : priceUsdt !== null;

  const stockLabel =
    availability === "coming_soon"
      ? "Coming soon"
      : availability === "out_of_stock" || !inStock
        ? "Out of stock"
        : stockMode === "tracked"
          ? `In stock — ${stockQty ?? 0} available`
          : "In stock";

  const priceLabel =
    channel === "telegram"
      ? priceStars && priceStars > 0
        ? `${priceStars} ⭐`
        : "Price not configured"
      : priceUsdt !== null
        ? money(priceUsdt, "USDT")
        : "Price not configured";

  return {
    id: String(row["id"]),
    featured: row["featured"] === true,
    created_at: (row["created_at"] as string) ?? null,
    updated_at: (row["updated_at"] as string) ?? null,
    source: !row["reseller_product_id"]
      ? "manual"
      : String(row["reseller_product_id"]).startsWith("digihup:")
        ? "digihup"
        : "reseller",
    slug: (row["slug"] as string) ?? null,
    name: String(row["name"]),
    emoji: (row["emoji"] as string) ?? null,
    short_description: (row["short_description"] as string) ?? null,
    description: (row["description"] as string) ?? null,
    features: featureList(row["features"]),
    terms: (row["terms"] as string) ?? null,
    image_url: (row["image_url"] as string) ?? (row["banner_url"] as string) ?? null,
    logo_url: (row["logo_url"] as string) ?? null,
    duration_label: (row["duration_label"] as string) ?? null,
    credits_per_interval: num(row["credits_per_interval"]),
    renewal_interval: (row["renewal_interval"] as string) ?? null,
    price_usdt: priceUsdt,
    price_inr: num(row["price_inr"]) ?? (priceUsdt === null ? null : priceUsdt * 100),
    price_stars: priceStars,
    stock_mode: stockMode,
    stock_quantity: stockQty,
    max_per_order: Number(row["max_per_order"] ?? 1),
    availability,
    delivery_method: String(row["delivery_method"] ?? "email_manual"),
    requires_buyer_email: channel === "telegram" ? row["requires_buyer_email"] === true : row["requires_buyer_email"] !== false,
    installation_instructions: (row["installation_instructions"] as string) ?? null,
    warranty_label: (row["warranty_label"] as string) ?? null,
    download_url: (row["download_url"] as string) ?? null,
    tutorial_url: (row["tutorial_url"] as string) ?? null,
    shop_order: Number(row["shop_order"] ?? 0),
    purchasable: inStock && hasPrice,
    stock_label: stockLabel,
    price_label: priceLabel,
  };
}

export async function shopProductRows(channel: ShopChannel): Promise<ShopProduct[]> {
  const { data } = await db
    .from("products")
    .select("*")
    .eq("shop_published", true)
    .neq("status", "archived")
    .order("shop_order")
    .order("created_at");
  return (data ?? []).map((row) => shapeProduct(row as Record<string, unknown>, channel));
}

/** Public-safe product projection used by the storefront catalogue and product pages. */
export function toCatalogProduct(p: ShopProduct) {
  return {
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    short_description: p.short_description,
    description: p.description,
    features: p.features,
    terms: p.terms,
    image_url: p.image_url,
    logo_url: p.logo_url,
    duration_label: p.duration_label,
    credits_per_interval: p.credits_per_interval,
    renewal_interval: p.renewal_interval,
    price_usdt: p.price_usdt,
    price_inr: p.price_inr,
    price_label: p.price_label,
    stock_label: p.stock_label,
    availability: p.availability,
    purchasable: p.purchasable,
    max_units: maxUnits(p),
    delivery_method: p.delivery_method,
    featured: p.featured,
    created_at: p.created_at,
    updated_at: p.updated_at,
    source: p.source,
  };
}

/** Most recent successful supplier sync (null when suppliers have never synced). */
export async function lastSupplierSync(): Promise<string | null> {
  const [runs, crm] = await Promise.all([
    db.from("integration_sync_runs").select("finished_at").eq("status", "success").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("crm_products").select("last_synced_at").not("last_synced_at", "is", null).order("last_synced_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const a = runs.data?.finished_at ?? null;
  const b = crm.data?.last_synced_at ?? null;
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export async function shopProductById(id: string, channel: ShopChannel): Promise<ShopProduct | null> {
  const { data } = await db.from("products").select("*").eq("id", id).maybeSingle();
  if (!data || !data.shop_published || data.status === "archived" || data.supplier_removed) return null;
  return shapeProduct(data as Record<string, unknown>, channel);
}

/** Product ids ranked by paid units over the last 30 days (empty until real sales exist). */
export async function trendingProductIds(limit = 8): Promise<string[]> {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data } = await db
    .from("shop_order_items")
    .select("product_id, quantity, shop_orders!inner(status)")
    .gte("created_at", since)
    .in("shop_orders.status", ["payment_confirmed", "awaiting_fulfillment", "delivered"])
    .limit(1000);
  const units = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ product_id: string | null; quantity: number | null }>) {
    if (!row.product_id) continue;
    units.set(row.product_id, (units.get(row.product_id) ?? 0) + (row.quantity ?? 1));
  }
  return [...units.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
}

export async function websitePaymentMethods() {
  const { data } = await db
    .from("payment_methods")
    .select("*")
    .eq("enabled", true)
    .eq("channel", "website")
    .order("display_order");
  return data ?? [];
}

export async function orderEvent(orderId: string, event: string, actor: string, details?: string) {
  await db.from("shop_order_events").insert({ order_id: orderId, event, actor, details: details ?? null });
  void import("@/lib/shop-crm.server").then(m => m.kickCrmSync(), () => undefined);
}

export async function unpaidExpiryMinutes() {
  const settings = await getSettings();
  const parsed = Number(settings["shop_unpaid_expiry_minutes"] ?? 20);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}

export async function reviewMinutes() {
  const settings = await getSettings();
  const parsed = Number(settings["shop_review_minutes"] ?? 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

export function parseEmails(raw: string, units: number): string[] {
  const parts = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (parts.length === 0) throw new Error("Please enter an email address.");
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  for (const part of parts) {
    if (!pattern.test(part)) throw new Error(`“${part}” is not a valid email address.`);
  }
  if (parts.length !== 1 && parts.length !== units) {
    throw new Error(`Enter one email for the whole order, or ${units} emails separated by commas.`);
  }
  return parts;
}

/* --------------------------- order creation flow --------------------------- */

export async function createOrder(input: {
  channel: ShopChannel;
  profileId: string | null;
  telegramUserId: number | null;
  customerName: string | null;
  customerUserId?: string;
  productId: string;
  quantity: number;
  paymentMethodId?: string | null;
  checkoutKey?: string;
}) {
  const result = await db.rpc("shop_create_order_atomic", { _input: input });
  if (result.error || !result.data) throw new Error(result.error?.message ?? "Could not create order.");
  void import("@/lib/shop-crm.server").then(m => m.kickCrmSync(), () => undefined);
  return result.data as unknown as import("@/integrations/supabase/types").Database["public"]["Tables"]["shop_orders"]["Row"];
}

export async function refundWalletOrder(order: Record<string, unknown>, reason: string) {
  const result = await db.rpc("shop_refund_wallet_atomic", { _id: String(order["id"]), _reason: reason });
  if (result.error) throw new Error("Could not refund wallet.");
  return { refunded: result.data === true, amount: Number(order["total"] ?? 0) };
}

export async function submitPayment(orderId: string, reference: string, evidenceUrl: string | null) {
  const trimmed = reference.trim();
  if (trimmed.length < 6 || trimmed.length > 200) {
    throw new Error("Enter the transaction reference exactly as your payment app shows it.");
  }
  const { data: order } = await db.from("shop_orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) throw new Error("Order not found.");
  if (!["awaiting_payment", "payment_submitted"].includes(order.status)) {
    throw new Error("This order is no longer waiting for a payment reference.");
  }
  const submittedAt = new Date().toISOString();
  const { error } = await db
    .from("shop_orders")
    .update({
      payment_reference: trimmed,
      payment_evidence_url: evidenceUrl,
      status: order.delivery_emails || !await orderRequiresEmail(order) ? "under_review" : "awaiting_email",
      submitted_at: submittedAt,
      updated_at: submittedAt,
    })
    .eq("id", orderId)
    .in("status", ["awaiting_payment", "payment_submitted"]);
  if (!error) void import("@/lib/shop-crm.server").then(m => m.kickCrmSync(), () => undefined);
  if (error) {
    throw new Error("This transaction reference has already been submitted for another order.");
  }
  await orderEvent(orderId, "payment_submitted", "customer", trimmed);
  return { ok: true, submittedAt };
}

export async function setOrderEmails(orderId: string, rawEmails: string) {
  const { data: order } = await db.from("shop_orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) throw new Error("Order not found.");
  const { data: items } = await db.from("shop_order_items").select("*").eq("order_id", orderId);
  const units = (items ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 1), 0) || 1;
  const emails = parseEmails(rawEmails, units);

  for (const [index, item] of (items ?? []).entries()) {
    const email = emails.length === 1 ? emails[0] : emails[index] ?? emails[0];
    await db.from("shop_order_items").update({ delivery_email: email }).eq("id", item.id);
  }

  const nextStatus = order.confirmed_at ? "awaiting_fulfillment" : order.submitted_at ? "under_review" : order.status;
  await db
    .from("shop_orders")
    .update({
      delivery_emails: emails.join(", "),
      email_confirmed_at: new Date().toISOString(),
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  await orderEvent(orderId, "email_confirmed", "customer", emails.join(", "));
  return { emails, order_number: order.order_number as string };
}

export async function cancelOrder(orderId: string, actor: string, reason: string) {
  const r=await db.rpc("shop_cancel_atomic",{_id:orderId,_status:"cancelled",_reason:reason,_actor:actor});
  if(r.error)throw new Error(r.error.message);return {ok:true};
}

/* ------------------------------- notifications ------------------------------ */

export async function notifyBuyerTelegram(orderId: string, text: string) {
  const { data: order } = await db.from("shop_orders").select("telegram_user_id").eq("id", orderId).maybeSingle();
  const chatId = order?.telegram_user_id;
  if (!chatId) return { ok: false, reason: "no_telegram" };
  const { data: job } = await db
    .from("shop_delivery_jobs")
    .insert({ order_id: orderId, channel: "telegram", target: String(chatId), payload: { text } })
    .select("id")
    .single();
  try {
    const sent = await tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
    if (!sent.ok) throw new Error("Telegram notification failed");
    if (job) await db.from("shop_delivery_jobs").update({ status: "sent", attempts: 1, sent_at: new Date().toISOString() }).eq("id", job.id);
    return { ok: true };
  } catch (error) {
    if (job) {
      await db
        .from("shop_delivery_jobs")
        .update({ status: "failed", attempts: 1, last_error: String(error).slice(0, 400) })
        .eq("id", job.id);
    }
    return { ok: false, reason: "telegram_failed" };
  }
}

/* --------------------------------- email ---------------------------------- */

export type EmailResult = { ok: boolean; reason?: string };

export async function sendFulfillmentEmail(orderId: string, actor = "system"): Promise<EmailResult> {
  const settings = await getSettings();
  const { data: order } = await db.from("shop_orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return { ok: false, reason: "order_not_found" };
  const { data: items } = await db.from("shop_order_items").select("*").eq("order_id", orderId);
  const { data: fulfillments } = await db
    .from("shop_fulfillments")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at");
  if (!fulfillments || fulfillments.length === 0) return { ok: false, reason: "no_delivery_material" };
  if (order.status !== "payment_confirmed" && order.status !== "awaiting_fulfillment" && order.status !== "delivered") {
    return { ok: false, reason: "payment_not_confirmed" };
  }

  const apiKey = process.env["RESEND_API_KEY"];
  const from = (settings["shop_email_from"] ?? "").trim();
  const fromName = (settings["shop_email_from_name"] ?? "FOXGEN STORE").trim();
  const support = settings["support_url"] ?? settings["whatsapp_support_url"] ?? "our support channel";
  const productName = (items ?? []).map((i) => `${i.product_name} x${i.quantity}`).join(", ");
  const material = fulfillments.map((f) => f.content).join("\n\n");
  const recipients = [...new Set((items ?? []).map((i) => i.delivery_email).filter(Boolean))] as string[];
  const fallback = (order.delivery_emails ?? "").split(",").map((e: string) => e.trim()).filter(Boolean);
  const targets = recipients.length > 0 ? recipients : fallback;
  if (targets.length === 0) return { ok: false, reason: "no_email" };

  const subject =
    (order.email_subject ?? "").trim() || `Your FOXGEN STORE order ${order.order_number} — access details`;
  const body =
    (order.email_body ?? "").trim() ||
    `Hi ${order.customer_name ?? "there"},

Your payment for ${productName} has been confirmed.
Use the activation link or instructions below to access your purchase.

${material}

Order ID: ${order.order_number}
For help, contact ${support}.
Thank you for choosing FOXGEN STORE.`;

  for (const target of targets) {
    const { data: job } = await db
      .from("shop_delivery_jobs")
      .insert({ order_id: orderId, channel: "email", target, payload: { subject, body } })
      .select("id")
      .single();

    if (!apiKey || !from) {
      if (job) {
        await db
          .from("shop_delivery_jobs")
          .update({ status: "blocked", last_error: "Email provider is not configured (sender address / API key missing)." })
          .eq("id", job.id);
      }
      return { ok: false, reason: "email_provider_not_configured" };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${fromName} <${from}>`,
          to: [target],
          subject,
          text: body,
        }),
      });
      if (!response.ok) throw new Error(`${response.status} ${await response.text()}`.slice(0, 300));
      if (job)
        await db
          .from("shop_delivery_jobs")
          .update({ status: "sent", attempts: 1, sent_at: new Date().toISOString() })
          .eq("id", job.id);
    } catch (error) {
      if (job)
        await db
          .from("shop_delivery_jobs")
          .update({ status: "failed", attempts: 1, last_error: String(error).slice(0, 400) })
          .eq("id", job.id);
      return { ok: false, reason: "email_send_failed" };
    }
  }

  await db
    .from("shop_orders")
    .update({ status: "delivered", delivered_at: order.delivered_at ?? new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", orderId);
  await orderEvent(orderId, "delivered", actor, targets.join(", "));
  await notifyBuyerTelegram(
    orderId,
    `Your access email has been sent to ${targets.join(", ")}. Please check your inbox and spam folder.`,
  );
  return { ok: true };
}

export { db };

export async function orderRequiresEmail(order: { id: string; channel: string; telegram_user_id?: number | null }) {
  if (needsDeliveryEmail(order, false)) return true;
  const { data: items, error } = await db.from("shop_order_items").select("product_id,snapshot").eq("order_id", order.id);
  if (error) throw new Error("Could not check email requirements.");
  const ids = (items ?? []).map(i => i.product_id).filter((id): id is string => typeof id === "string");
  const products = ids.length ? await db.from("products").select("id,requires_buyer_email").in("id", ids) : { data: [], error: null };
  if (products.error) throw new Error("Could not check email requirements.");
  return (items ?? []).some(i => {
    const snapshot = i.snapshot as Record<string, unknown> | null;
    return snapshot?.["requires_buyer_email"] === true || (products.data ?? []).some(p => p.id === i.product_id && p.requires_buyer_email === true);
  });
}

export async function sendTelegramDelivery(orderId: string, actor = "admin", chatId?: number): Promise<EmailResult> {
  const { data: order } = await db.from("shop_orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return { ok: false, reason: "order_not_found" };
  const targetChat = chatId ?? order.telegram_user_id;
  if (!targetChat) return { ok: false, reason: "no_telegram" };
  // Email-first delivery may be followed by Telegram delivery, but not an unrelated delivered state.
  if (order.status === "delivered") {
    const email = await db.from("shop_delivery_jobs").select("id").eq("order_id", orderId).eq("channel", "email").eq("status", "sent").limit(1);
    if (!email.data?.length) return { ok: false, reason: "payment_not_confirmed" };
  } else if (!["payment_confirmed", "awaiting_fulfillment"].includes(order.status)) return { ok: false, reason: "payment_not_confirmed" };
  const [{ data: items, error: itemsError }, { data: materials, error: materialError }, settings] = await Promise.all([
    db.from("shop_order_items").select("product_name,quantity").eq("order_id", orderId),
    db.from("shop_fulfillments").select("content").eq("order_id", orderId).order("created_at"), getSettings(),
  ]);
  if (itemsError || materialError) return { ok: false, reason: "delivery_read_failed" };
  if (!materials?.length) return { ok: false, reason: "no_delivery_material" };
  const text = telegramDeliveryText((items ?? []).map(i => `${i.product_name} x${i.quantity}`).join(", "), materials.map(m => m.content), order.order_number, settings["support_url"] ?? settings["whatsapp_support_url"] ?? "our support channel");
  // Telegram allows 4096 characters; never truncate credentials or instructions.
  if (text.length > 4096) return { ok: false, reason: "telegram_material_too_long" };
  const lock = `delivery:${orderId}`;
  const { acquireLock, releaseLock } = await import("@/lib/hub.server");
  if (!await acquireLock(lock, 60000)) return { ok: false, reason: "delivery_in_progress" };
  try {
    const { data: previous } = await db.from("shop_delivery_jobs").select("id,payload").eq("order_id", orderId).eq("channel", "telegram").eq("status", "sent");
    if ((previous ?? []).some(j => (j.payload as Record<string, unknown>)?.["fulfillment"] === true)) return { ok: true, reason: "already_sent" };
    const { data: job, error } = await db.from("shop_delivery_jobs").insert({ order_id: orderId, channel: "telegram", target: String(targetChat), payload: { text, fulfillment: true }, attempts: 1 }).select("id").single();
    if (error || !job) return { ok: false, reason: "delivery_job_failed" };
    let sent = false;
    try { const result = await tg("sendMessage", { chat_id: targetChat, text, parse_mode: "HTML", disable_web_page_preview: true }); sent = result.ok; } catch { /* keep credential details out of errors */ }
    if (!sent) {
      await db.from("shop_delivery_jobs").update({ status: "failed", last_error: "Telegram could not deliver the message." }).eq("id", job.id);
      return { ok: false, reason: "telegram_send_failed" };
    }
    const now = new Date().toISOString();
    const result = await db.from("shop_delivery_jobs").update({ status: "sent", sent_at: now }).eq("id", job.id);
    if (result.error) return { ok: false, reason: "delivery_record_failed" };
    const updated = await db.from("shop_orders").update({ status: "delivered", delivered_at: order.delivered_at ?? now, updated_at: now }).eq("id", orderId);
    if (updated.error) return { ok: false, reason: "delivery_record_failed" };
    await orderEvent(orderId, "delivered", actor, "Telegram fulfillment");
    return { ok: true };
  } finally { await releaseLock(lock); }
}

/* ------------------------- AI fulfillment email draft ---------------------- */

export type EmailDraft = { subject: string; body: string };

export async function draftFulfillmentEmail(orderId: string): Promise<EmailDraft> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI drafting is not configured yet.");

  const settings = await getSettings();
  const { data: order } = await db.from("shop_orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) throw new Error("Order not found.");
  const { data: items } = await db.from("shop_order_items").select("*").eq("order_id", orderId);
  const { data: fulfillments } = await db
    .from("shop_fulfillments")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at");

  const storeName = (settings["shop_email_from_name"] ?? "FOXGEN STORE").trim() || "FOXGEN STORE";
  const support = settings["support_url"] ?? settings["whatsapp_support_url"] ?? "our support channel";
  const emails =
    [...new Set((items ?? []).map((i) => i.delivery_email).filter(Boolean))].join(", ") ||
    (order.delivery_emails ?? "");

  const lines = (items ?? []).map((item) => {
    const snapshot = (item.snapshot ?? {}) as Record<string, unknown>;
    return [
      `Product: ${item.product_name} x${item.quantity}`,
      snapshot["duration_label"] ? `Duration: ${String(snapshot["duration_label"])}` : "",
      snapshot["features"] && Array.isArray(snapshot["features"]) && snapshot["features"].length > 0
        ? `Features: ${(snapshot["features"] as string[]).join("; ")}`
        : "",
      snapshot["terms"] ? `Terms: ${String(snapshot["terms"])}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const context = [
    `Store name: ${storeName}`,
    `Order ID: ${order.order_number}`,
    `Customer name: ${order.customer_name ?? "Customer"}`,
    `Delivery email(s): ${emails || "not provided"}`,
    `Channel: ${order.channel}`,
    order.currency === "XTR"
      ? `Paid: ${order.stars_total ?? 0} Telegram Stars`
      : `Paid: ${order.total ?? 0} ${order.currency}`,
    order.payment_method_name ? `Payment method: ${order.payment_method_name}` : "",
    order.payment_reference ? `Transaction reference: ${order.payment_reference}` : "",
    "",
    lines.join("\n\n"),
    "",
    "Delivery material to include verbatim:",
    (fulfillments ?? []).map((f) => `[${f.kind}] ${f.content}`).join("\n") || "(none added yet)",
    "",
    `Support contact: ${support}`,
  ]
    .filter((part) => part !== undefined)
    .join("\n");

  const prompt = `You write fulfillment emails for a digital goods store.
Write ONE plain-text email confirming payment and delivering access for this order.
Rules:
- First line must be exactly: Subject: <subject line, max 80 characters, include the order ID>
- Then a blank line, then the email body only (plain text, no markdown, no placeholders like [name]).
- Use the real values given below; never invent prices, links, codes, durations or dates.
- Include the delivery material verbatim, the order ID, activation/usage steps, credits or duration if present, and the support contact.
- Warm, professional, concise (max 200 words).

ORDER DATA:
${context}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      input: prompt,
      stream: true,
      reasoning: { effort: "low", summary: "auto" },
    }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    if (response.status === 429) throw new Error("The AI service is busy right now. Try again in a moment.");
    if (response.status === 402) throw new Error("AI credits are exhausted. Add credits to keep drafting emails.");
    if (response.status === 403) throw new Error("AI drafting is blocked by the workspace AI settings.");
    throw new Error(`AI drafting failed (${response.status}). ${detail.slice(0, 200)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload) as { type?: string; delta?: string; response?: { output_text?: string } };
          if (event.type === "response.output_text.delta" && typeof event.delta === "string") text += event.delta;
          else if (event.type === "response.completed" && !text && event.response?.output_text)
            text = event.response.output_text;
        } catch {
          /* ignore keep-alive fragments */
        }
      }
    }
  }

  const clean = text.trim();
  if (!clean) throw new Error("The AI returned an empty draft. Try again.");
  const match = clean.match(/^subject:\s*(.+)$/im);
  const subject = (match?.[1] ?? `Your ${storeName} order ${order.order_number} — access details`).trim().slice(0, 200);
  const body = (match ? clean.slice(clean.indexOf(match[0]) + match[0].length) : clean).trim();

  await db
    .from("shop_orders")
    .update({
      email_subject: subject,
      email_body: body,
      email_draft_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  await orderEvent(orderId, "email_draft_generated", "ai", subject);
  return { subject, body };
}

export async function saveFulfillmentEmailDraft(orderId: string, subject: string, body: string) {
  await db
    .from("shop_orders")
    .update({ email_subject: subject, email_body: body, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  await orderEvent(orderId, "email_draft_saved", "admin", subject);
  return { ok: true };
}
