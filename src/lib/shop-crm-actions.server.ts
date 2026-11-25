import { db, getSettings, tg } from "@/lib/hub.server";
import { orderEvent } from "@/lib/shop.server";

export type ActionResult = { status: number; body: Record<string, unknown> };
const ok = (extra: Record<string, unknown> = {}): ActionResult => ({ status: 200, body: { ok: true, ...extra } });
const fail = (status: number, error: string, message?: string): ActionResult => ({ status, body: { ok: false, error, ...(message ? { message } : {}) } });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Run an action once per request key; retries replay the stored response and never repeat side effects. */
export async function onceForRequest(key: string, action: string, run: () => Promise<ActionResult>): Promise<ActionResult> {
  const claim = await db.from("shop_crm_action_requests").insert({ request_key: key, action }).select("request_key");
  if (claim.error) {
    const prior = await db.from("shop_crm_action_requests").select("status,http_status,response").eq("request_key", key).maybeSingle();
    if (prior.data?.status === "done" && prior.data.response) return { status: prior.data.http_status ?? 200, body: { ...(prior.data.response as Record<string, unknown>), replayed: true } };
    if (prior.data?.status === "processing") return fail(409, "REQUEST_IN_PROGRESS", "The same request is still running.");
    // A previous attempt failed before doing anything durable; allow a retry.
    await db.from("shop_crm_action_requests").update({ status: "processing", updated_at: new Date().toISOString() }).eq("request_key", key).eq("status", "failed");
  }
  let result: ActionResult;
  try { result = await run(); } catch (e) {
    console.error("crm action failed", action, e instanceof Error ? e.message : e);
    result = fail(500, "ACTION_FAILED", "The action could not be completed. Retry with the same request.");
  }
  // Server errors may be retried; definitive answers (success, 4xx) are replayed.
  await db.from("shop_crm_action_requests").update({ status: result.status >= 500 ? "failed" : "done", http_status: result.status, response: result.body as import("@/integrations/supabase/types").Json, updated_at: new Date().toISOString() }).eq("request_key", key);
  return result;
}

type Customer = { id: string; kind: "member" | "website"; telegramId: number | null; email: string | null; name: string };

async function resolveCustomer(id: string): Promise<Customer | null> {
  const profile = await db.from("profiles").select("id,telegram_user_id,first_name").eq("id", id).maybeSingle();
  if (profile.data) {
    const last = await db.from("shop_orders").select("delivery_emails").eq("customer_external_id", id).not("delivery_emails", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return { id, kind: "member", telegramId: profile.data.telegram_user_id, email: last.data?.delivery_emails?.split(",")[0]?.trim() || null, name: profile.data.first_name ?? "there" };
  }
  const account = await db.from("shop_customer_accounts").select("user_id,email").eq("user_id", id).maybeSingle();
  if (account.data) return { id, kind: "website", telegramId: null, email: account.data.email, name: "there" };
  return null;
}

async function sendEmail(to: string, subject: string, text: string): Promise<string> {
  const settings = await getSettings();
  const apiKey = process.env["RESEND_API_KEY"];
  const from = (settings["shop_email_from"] ?? "").trim();
  const fromName = (settings["shop_email_from_name"] ?? "FOXGEN STORE").trim();
  if (!apiKey || !from) return "email_not_configured";
  try {
    const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: `${fromName} <${from}>`, to: [to], subject, text }) });
    return res.ok ? "sent" : "email_failed";
  } catch { return "email_failed"; }
}

async function sendTelegram(chatId: number, html: string): Promise<string> {
  try { const r = await tg("sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true }); return r.ok ? "sent" : "telegram_failed"; }
  catch { return "telegram_failed"; }
}

async function resync(orderId: string | null, customerId: string | null) {
  if (orderId) await db.from("shop_orders").update({ updated_at: new Date().toISOString() }).eq("id", orderId);
  if (customerId) await db.rpc("shop_enqueue_customer", { _id: customerId });
}

export async function messageCustomer(input: { order_id?: string; customer_id?: string; message: string; channels: Array<"telegram" | "email" | "account"> }): Promise<ActionResult> {
  let orderId: string | null = null, customerId = input.customer_id ?? null, orderTelegram: number | null = null, orderEmail: string | null = null, orderNumber: string | null = null, websiteUser: string | null = null;
  if (input.order_id) {
    const o = await db.from("shop_orders").select("id,order_number,customer_external_id,customer_user_id,telegram_user_id,delivery_emails").eq("id", input.order_id).maybeSingle();
    if (!o.data) return fail(404, "ORDER_NOT_FOUND");
    orderId = o.data.id; orderNumber = o.data.order_number; customerId = customerId ?? o.data.customer_external_id;
    orderTelegram = o.data.telegram_user_id; orderEmail = o.data.delivery_emails?.split(",")[0]?.trim() || null; websiteUser = o.data.customer_user_id;
  }
  const customer = customerId ? await resolveCustomer(customerId) : null;
  if (!customer && !orderId) return fail(404, "CUSTOMER_NOT_FOUND");
  const telegramId = orderTelegram ?? customer?.telegramId ?? null;
  const email = orderEmail ?? customer?.email ?? null;
  const accountUser = websiteUser ?? (customer?.kind === "website" ? customer.id : null);
  const subject = orderNumber ? `Update on your FOXGEN order ${orderNumber}` : "Message from FOXGEN STORE";
  const results: Record<string, string> = {};
  for (const channel of new Set(input.channels)) {
    if (channel === "telegram") results["telegram"] = telegramId ? await sendTelegram(telegramId, `<b>${esc(subject)}</b>\n\n${esc(input.message)}`) : "no_telegram";
    if (channel === "email") results["email"] = email ? await sendEmail(email, subject, `${input.message}\n\n— FOXGEN STORE`) : "no_email";
    if (channel === "account") {
      if (accountUser) {
        const r = await db.from("customer_notices").insert({ user_id: accountUser, title: subject, body: input.message, order_id: orderId });
        results["account"] = r.error ? "account_failed" : "sent";
      } else if (customer?.kind === "member") {
        const r = await db.from("notifications").insert({ user_id: customer.id, title: subject, body: input.message, kind: "crm" });
        results["account"] = r.error ? "account_failed" : "sent";
      } else results["account"] = "no_account";
    }
  }
  if (orderId) await orderEvent(orderId, "customer_messaged", "crm", `Channels: ${Object.entries(results).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  await resync(orderId, customerId);
  if (!Object.values(results).includes("sent")) return fail(409, "NOT_DELIVERED", "No selected channel could reach this customer.");
  return ok({ channels: results });
}

export type DeliveryFields = { account_email?: string; account_username?: string; account_number?: string; password?: string; link?: string; notes?: string };
export function deliveryContent(f: DeliveryFields) {
  const rows: Array<[string, string | undefined]> = [["Account email", f.account_email], ["Username", f.account_username], ["Account number", f.account_number], ["Password", f.password], ["Link", f.link], ["Notes", f.notes]];
  return rows.filter(([, v]) => v && v.trim()).map(([k, v]) => `${k}: ${v!.trim()}`).join("\n");
}

const APPROVABLE = ["payment_submitted", "under_review", "awaiting_email", "payment_confirmed", "awaiting_fulfillment"];

export async function approveAndDeliver(input: { order_id: string; fields: DeliveryFields }): Promise<ActionResult> {
  const content = deliveryContent(input.fields);
  if (!content) return fail(400, "NO_DELIVERY_FIELDS");
  const read = await db.from("shop_orders").select("*").eq("id", input.order_id).maybeSingle();
  const order = read.data;
  if (!order) return fail(404, "ORDER_NOT_FOUND");
  if (!APPROVABLE.includes(order.status)) return fail(409, "ORDER_STATE_CONFLICT", `Order is ${order.status}.`);
  const { shopApproveOrder } = await import("@/lib/shop-actions.server");
  const { sendTelegramDelivery, sendFulfillmentEmail } = await import("@/lib/shop.server");
  if (!order.stock_consumed) {
    try { await shopApproveOrder({ id: order.id, notes: "Approved from CRM" }, "crm"); }
    catch { return fail(409, "ORDER_STATE_CONFLICT", "Order is not waiting for payment approval."); }
  }
  // Credentials arrive with this action, so a pending email request no longer blocks delivery.
  await db.from("shop_orders").update({ status: "awaiting_fulfillment", updated_at: new Date().toISOString() }).eq("id", order.id).in("status", ["awaiting_email", "payment_confirmed"]);
  const saved = await db.from("shop_fulfillments").insert({ order_id: order.id, kind: "instructions", content });
  if (saved.error) return fail(500, "FULFILLMENT_SAVE_FAILED");
  await orderEvent(order.id, "fulfillment_added", "crm", "instructions");
  const delivery: Record<string, string> = {};
  const isTelegram = order.channel === "telegram";
  if (order.telegram_user_id) { const r = await sendTelegramDelivery(order.id, "crm"); delivery["telegram"] = r.ok ? "sent" : r.reason ?? "failed"; }
  if (!isTelegram) {
    const r = await sendFulfillmentEmail(order.id, "crm"); delivery["email"] = r.ok ? "sent" : r.reason ?? "failed";
    delivery["account"] = "visible_in_my_orders";
  }
  const now = new Date().toISOString();
  await db.from("shop_orders").update({ status: "delivered", delivered_at: order.delivered_at ?? now, updated_at: now }).eq("id", order.id).neq("status", "delivered");
  await orderEvent(order.id, "approved_and_delivered", "crm", Object.entries(delivery).map(([k, v]) => `${k}=${v}`).join(", "));
  await resync(order.id, order.customer_external_id);
  return ok({ status: "delivered", delivery });
}

export async function adjustWallet(input: { customer_id: string; amount_usd: number; reason: string }): Promise<ActionResult> {
  const profile = await db.from("profiles").select("id,telegram_user_id").eq("id", input.customer_id).maybeSingle();
  if (!profile.data) return fail(404, "CUSTOMER_NOT_FOUND", "Wallets belong to bot members.");
  const amount = Math.round(Math.abs(input.amount_usd) * 100) / 100;
  if (amount <= 0) return fail(400, "INVALID_AMOUNT");
  if (input.amount_usd > 0) {
    const r = await db.rpc("wallet_credit", { _profile_id: profile.data.id, _amount: amount, _kind: "adjustment", _note: `CRM: ${input.reason}`, _actor: "crm" });
    if (r.error) return fail(500, "WALLET_UPDATE_FAILED");
  } else {
    const r = await db.rpc("shop_admin_wallet_deduct", { _profile: profile.data.id, _amount: amount, _note: `CRM: ${input.reason}` });
    if (r.error) return fail(500, "WALLET_UPDATE_FAILED");
    if (r.data !== true) return fail(409, "INSUFFICIENT_BALANCE", "The wallet balance cannot go below 0.");
  }
  const w = await db.from("wallets").select("balance_usd").eq("profile_id", profile.data.id).maybeSingle();
  const balance = Number(w.data?.balance_usd ?? 0);
  let telegram = "no_telegram";
  if (profile.data.telegram_user_id) telegram = await sendTelegram(profile.data.telegram_user_id, `<b>Wallet ${input.amount_usd > 0 ? "credited" : "debited"}</b>\n${input.amount_usd > 0 ? "+" : "−"}$${amount.toFixed(2)}\nReason: ${esc(input.reason)}\nNew balance: $${balance.toFixed(2)}`);
  await db.from("activity_logs").insert({ module: "wallet", action: "CRM wallet adjustment", status: "success", user_id: profile.data.id, actor: "crm", details: `${input.amount_usd > 0 ? "+" : "-"}${amount.toFixed(2)} USD — ${input.reason}` });
  await resync(null, profile.data.id);
  return ok({ balance_usd: balance, telegram });
}
