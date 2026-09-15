import { db, getSettings, logActivity, tg } from "@/lib/hub.server";

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
  download_url: string | null;
  tutorial_url: string | null;
  shop_order: number;
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
    slug: (row["slug"] as string) ?? null,
    name: String(row["name"]),
    emoji: (row["emoji"] as string) ?? null,
    short_description: (row["short_description"] as string) ?? null,
    description: (row["description"] as string) ?? null,
    features: featureList(row["features"]),
    terms: (row["terms"] as string) ?? null,
    image_url: (row["image_url"] as string) ?? (row["banner_url"] as string) ?? null,
    duration_label: (row["duration_label"] as string) ?? null,
    credits_per_interval: num(row["credits_per_interval"]),
    renewal_interval: (row["renewal_interval"] as string) ?? null,
    price_usdt: priceUsdt,
    price_inr: num(row["price_inr"]),
    price_stars: priceStars,
    stock_mode: stockMode,
    stock_quantity: stockQty,
    max_per_order: Number(row["max_per_order"] ?? 1),
    availability,
    delivery_method: String(row["delivery_method"] ?? "email_manual"),
    requires_buyer_email: row["requires_buyer_email"] !== false,
    installation_instructions: (row["installation_instructions"] as string) ?? null,
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

export async function shopProductById(id: string, channel: ShopChannel): Promise<ShopProduct | null> {
  const { data } = await db.from("products").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return shapeProduct(data as Record<string, unknown>, channel);
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
  productId: string;
  quantity: number;
  paymentMethodId?: string | null;
}) {
  const product = await shopProductById(input.productId, input.channel);
  if (!product) throw new Error("This product is no longer available.");
  if (!product.purchasable) throw new Error("This product cannot be purchased yet.");

  const limit = maxUnits(product);
  if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new Error("Choose a whole number of units.");
  if (input.quantity > limit) throw new Error(`You can order at most ${limit} unit(s) of this product.`);

  let method: Record<string, unknown> | null = null;
  if (input.channel === "website") {
    if (!input.paymentMethodId) throw new Error("Choose a payment method.");
    const { data } = await db.from("payment_methods").select("*").eq("id", input.paymentMethodId).maybeSingle();
    if (!data || data.enabled !== true || data.channel !== "website") throw new Error("That payment method is unavailable.");
    method = data as Record<string, unknown>;
    if (String(method["currency"]) === "INR" && product.price_inr === null) {
      throw new Error("UPI is unavailable for this product until an INR price is configured.");
    }
  }

  const currency = input.channel === "telegram" ? "XTR" : String(method?.["currency"] ?? "USDT");
  const unitPrice =
    input.channel === "telegram" ? null : currency === "INR" ? product.price_inr : product.price_usdt;
  if (input.channel === "website" && unitPrice === null) throw new Error("This product has no configured price.");
  const unitStars = input.channel === "telegram" ? product.price_stars : null;

  const reserved = await db.rpc("shop_reserve_stock", { _product_id: product.id, _qty: input.quantity });
  if (reserved.error || reserved.data !== true) throw new Error("Not enough stock left for this product.");

  const expiry = await unpaidExpiryMinutes();
  const { data: order, error } = await db
    .from("shop_orders")
    .insert({
      profile_id: input.profileId,
      telegram_user_id: input.telegramUserId,
      customer_name: input.customerName,
      channel: input.channel,
      status: "awaiting_payment",
      currency,
      total: unitPrice === null ? null : Number((unitPrice * input.quantity).toFixed(2)),
      stars_total: unitStars === null ? null : unitStars * input.quantity,
      payment_method_id: method ? String(method["id"]) : null,
      payment_method_name: method ? String(method["name"]) : input.channel === "telegram" ? "Telegram Stars" : null,
      payment_network: method ? ((method["network"] as string) ?? null) : null,
      payment_recipient: method ? ((method["recipient"] as string) ?? null) : null,
      stock_reserved: true,
      expires_at: new Date(Date.now() + expiry * 60_000).toISOString(),
    })
    .select("*")
    .single();

  if (error || !order) {
    if (product.stock_mode === "tracked") {
      await db
        .from("products")
        .update({ stock_quantity: (product.stock_quantity ?? 0) })
        .eq("id", product.id);
    }
    throw new Error("Could not create this order. Please try again.");
  }

  await db.from("shop_order_items").insert({
    order_id: order.id,
    product_id: product.id,
    product_name: product.name,
    quantity: input.quantity,
    unit_price: unitPrice,
    line_total: unitPrice === null ? null : Number((unitPrice * input.quantity).toFixed(2)),
    unit_stars: unitStars,
    currency,
    snapshot: {
      name: product.name,
      duration_label: product.duration_label,
      features: product.features,
      terms: product.terms,
      delivery_method: product.delivery_method,
      price_usdt: product.price_usdt,
      price_inr: product.price_inr,
      price_stars: product.price_stars,
      recipient: method ? String(method["recipient"] ?? "") : null,
      network: method ? String(method["network"] ?? "") : null,
      method_name: method ? String(method["name"] ?? "") : "Telegram Stars",
    },
  });

  await orderEvent(order.id, "order_created", "customer", `${product.name} x${input.quantity}`);
  await logActivity("shop", "Order created", "info", `${order.order_number} — ${product.name} x${input.quantity}`);
  return order;
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
  const { error } = await db
    .from("shop_orders")
    .update({
      payment_reference: trimmed,
      payment_evidence_url: evidenceUrl,
      status: order.delivery_emails ? "under_review" : "awaiting_email",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .in("status", ["awaiting_payment", "payment_submitted"]);
  if (error) {
    throw new Error("This transaction reference has already been submitted for another order.");
  }
  await orderEvent(orderId, "payment_submitted", "customer", trimmed);
  return { ok: true };
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

  const nextStatus = order.submitted_at ? "under_review" : order.status;
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
  const { data: order } = await db.from("shop_orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) throw new Error("Order not found.");
  if (["payment_confirmed", "awaiting_fulfillment", "delivered"].includes(order.status)) {
    throw new Error("A confirmed order cannot be cancelled here.");
  }
  await db.rpc("shop_release_stock", { _order_id: orderId });
  await db
    .from("shop_orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", orderId);
  await orderEvent(orderId, "cancelled", actor, reason);
  return { ok: true };
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
    await tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
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

export async function sendFulfillmentEmail(orderId: string): Promise<EmailResult> {
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

  const subject = `Your FOXGEN STORE order ${order.order_number} — access details`;
  const body = `Hi ${order.customer_name ?? "there"},

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
    .update({ status: "delivered", delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", orderId);
  await orderEvent(orderId, "delivered", "system", targets.join(", "));
  await notifyBuyerTelegram(
    orderId,
    `Your access email has been sent to ${targets.join(", ")}. Please check your inbox and spam folder.`,
  );
  return { ok: true };
}

export { db };
