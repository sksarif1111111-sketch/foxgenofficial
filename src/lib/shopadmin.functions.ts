import { requireAdminPassword } from "@/lib/admin-access.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { walletReviewSchema, walletDeductSchema } from "./wallet-topup.contract";

const idInput = z.object({ id: z.string().uuid() });

/* --------------------------------- Buying --------------------------------- */

export type BuyingSummary = {
  deliverySlaMinutes: number;
  crmSync: { configured: boolean; lastSuccess: string | null; pending: number; stuck: number };
  ordersOverdue: number;
  deliveryDeadlines: string[];
  pendingReview: number;
  awaitingEmail: number;
  awaitingDelivery: number;
  completed: number;
  rejected: number;
  revenue: Array<{ currency: string; total: number }>;
};

export const shopSummary = createServerFn({ method: "POST" }).middleware([requireAdminPassword]).handler(async (): Promise<BuyingSummary> => {
  const { db, getSettings } = await import("@/lib/hub.server");
  const { deliverySlaMinutes: parseSla, deliveryClock } = await import("@/lib/shop-fulfillment");
  const { crmSyncStatus } = await import("@/lib/shop-crm.server");
  const [settings, crmSync] = await Promise.all([getSettings(), crmSyncStatus()]);
  const deliverySlaMinutes = parseSla(settings["shop_delivery_sla_minutes"]);
  const rows: Array<{ status: string; currency: string; total: number | null; stars_total: number | null; confirmed_at: string | null; delivered_at: string | null }> = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await db.from("shop_orders").select("status,currency,total,stars_total,confirmed_at,delivered_at").order("id").range(offset, offset + 999);
    if (result.error) throw new Error("Could not load order summary.");
    rows.push(...(result.data ?? []));
    if ((result.data ?? []).length < 1000) break;
  }
  const revenueMap = new Map<string, number>();
  for (const row of rows) {
    if (!["payment_confirmed", "awaiting_fulfillment", "delivered"].includes(row.status)) continue;
    if (row.currency === "XTR") {
      revenueMap.set("XTR", (revenueMap.get("XTR") ?? 0) + Number(row.stars_total ?? 0));
    } else {
      revenueMap.set(row.currency, (revenueMap.get(row.currency) ?? 0) + Number(row.total ?? 0));
    }
  }
  return {
    deliverySlaMinutes, crmSync,
    deliveryDeadlines: rows.filter(r => ["payment_confirmed", "awaiting_fulfillment"].includes(r.status) && r.confirmed_at).map(r => String(r.confirmed_at)),
    ordersOverdue: rows.filter(r => deliveryClock(r, deliverySlaMinutes)?.overdue).length,
    pendingReview: rows.filter((r) => r.status === "under_review" || r.status === "payment_submitted").length,
    awaitingEmail: rows.filter((r) => r.status === "awaiting_email").length,
    awaitingDelivery: rows.filter((r) => r.status === "awaiting_fulfillment" || r.status === "payment_confirmed").length,
    completed: rows.filter((r) => r.status === "delivered").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
    revenue: [...revenueMap.entries()].map(([currency, total]) => ({ currency, total })),
  };
});

export const shopOrders = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.string().max(40).optional(),
        method: z.string().max(80).optional(),
        search: z.string().max(120).optional(),
        from: z.string().max(30).optional(),
        to: z.string().max(30).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    let query = db.from("shop_orders").select("*").order("created_at", { ascending: false }).limit(300);
    if (data.status && data.status !== "all") query = query.eq("status", data.status);
    if (data.method && data.method !== "all") query = query.eq("payment_method_name", data.method);
    if (data.from) query = query.gte("created_at", data.from);
    if (data.to) query = query.lte("created_at", `${data.to}T23:59:59Z`);
    const { data: orders } = await query;
    let rows = orders ?? [];
    const search = (data.search ?? "").trim().toLowerCase();
    if (search) {
      rows = rows.filter((row) =>
        [row.order_number, row.delivery_emails, row.payment_reference, row.customer_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search)),
      );
    }
    const ids = rows.map((r) => r.id);
    const { data: items } = ids.length
      ? await db.from("shop_order_items").select("*").in("order_id", ids)
      : { data: [] as Array<Record<string, unknown>> };
    return rows.map((row) => ({
      ...row,
      total: row.total === null ? null : Number(row.total),
      items: (items ?? [])
        .filter((item) => item["order_id"] === row.id)
        .map((item) => ({
          product_name: String(item["product_name"]),
          quantity: Number(item["quantity"]),
          delivery_email: (item["delivery_email"] as string) ?? null,
        })),
    }));
  });

export const shopOrderDetail = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    const [{ data: order }, { data: items }, { data: events }, { data: fulfillments }, { data: jobs }] =
      await Promise.all([
        db.from("shop_orders").select("*").eq("id", data.id).maybeSingle(),
        db.from("shop_order_items").select("*").eq("order_id", data.id),
        db.from("shop_order_events").select("*").eq("order_id", data.id).order("created_at"),
        db.from("shop_fulfillments").select("*").eq("order_id", data.id).order("created_at"),
        db.from("shop_delivery_jobs").select("*").eq("order_id", data.id).order("created_at"),
      ]);
    if (!order) throw new Error("Order not found.");
    let telegram: { username: string | null; telegram_user_id: number | null } | null = null;
    if (order.profile_id) {
      const { data: profile } = await db
        .from("profiles")
        .select("telegram_username, telegram_user_id")
        .eq("id", order.profile_id)
        .maybeSingle();
      if (profile)
        telegram = { username: profile.telegram_username, telegram_user_id: profile.telegram_user_id };
    }
    return {
      order: { ...order, payment_evidence_url: /^(telegram-file|storage):/.test(order.payment_evidence_url ?? "") ? `/api/admin/payment-proof/${order.id}` : order.payment_evidence_url, total: order.total === null ? null : Number(order.total) },
      items: items ?? [],
      events: events ?? [],
      fulfillments: fulfillments ?? [],
      jobs: jobs ?? [],
      telegram,
    };
  });

export const shopApproveOrder = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), notes: z.string().max(600).optional(), send: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const actions = await import("@/lib/shop-actions.server");
    return actions.shopApproveOrder(data);
  });

export const shopRejectOrder = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), reason: z.string().trim().min(3).max(600) }).parse(input))
  .handler(async ({ data }) => {
    const actions = await import("@/lib/shop-actions.server");
    return actions.shopRejectOrder(data);
  });

export const shopRequestInfo = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), message: z.string().trim().min(3).max(600) }).parse(input))
  .handler(async ({ data }) => {
    const actions = await import("@/lib/shop-actions.server");
    return actions.shopRequestInfo(data);
  });

export const shopAddFulfillment = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        kind: z.enum(["link", "code", "instructions"]),
        content: z.string().trim().min(3).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const actions = await import("@/lib/shop-actions.server");
    return actions.shopAddFulfillment(data);
  });

export const shopSendTelegramDelivery = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data }) => {
    const { sendTelegramDelivery } = await import("@/lib/shop.server");
    return sendTelegramDelivery(data.id);
  });

export const shopSendDelivery = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data }) => {
    const { sendFulfillmentEmail } = await import("@/lib/shop.server");
    const result = await sendFulfillmentEmail(data.id);
    return result;
  });

/* ----------------------------- Shop products ------------------------------ */

const productShopSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes."),
  emoji: z.string().trim().max(8).optional(),
  short_description: z.string().trim().max(300).optional(),
  description: z.string().trim().max(4000).optional(),
  features: z.array(z.string().trim().max(200)).max(20),
  terms: z.string().trim().max(2000).optional(),
  image_url: z.string().trim().max(700).optional(),
  logo_url: z.string().trim().max(700).optional(),
  featured: z.boolean().optional(),
  duration_label: z.string().trim().max(60).optional(),
  warranty_label: z.string().trim().max(120).optional(),
  category_id: z.string().uuid().nullable().optional(),
  min_per_order: z.number().int().min(1).max(100).optional(),
  credits_per_interval: z.number().int().min(0).max(1000000).nullable().optional(),
  renewal_interval: z.string().trim().max(30).optional(),
  price_usdt: z.number().min(0).max(1000000).nullable().optional(),
  price_inr: z.number().min(0).max(100000000).nullable().optional(),
  price_stars: z.number().int().min(1).max(1000000).nullable().optional(),
  stock_mode: z.enum(["manual", "tracked"]),
  stock_quantity: z.number().int().min(0).max(1000000).nullable().optional(),
  max_per_order: z.number().int().min(1).max(100),
  availability: z.enum(["in_stock", "out_of_stock", "coming_soon"]),
  shop_published: z.boolean(),
  shop_order: z.number().int().min(0).max(999),
  delivery_method: z.string().trim().min(1).max(60),
  requires_buyer_email: z.boolean(),
  installation_instructions: z.string().trim().max(4000).optional(),
  private_delivery_notes: z.string().trim().max(4000).optional(),
  download_url: z.string().trim().max(700).optional(),
  status: z.enum(["active", "draft", "archived"]),
});

const blank = (value: string | undefined | null) => {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
};

export const shopAdminProducts = createServerFn({ method: "POST" }).middleware([requireAdminPassword]).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  const { data } = await db.from("products").select("*").order("shop_order").order("created_at");
  return data ?? [];
});

export const shopSaveProduct = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => productShopSchema.parse(input))
  .handler(async ({ data }) => {
    const { db, logActivity } = await import("@/lib/hub.server");
    const { id, ...rest } = data;
    const row = {
      ...rest,
      emoji: blank(rest.emoji),
      short_description: blank(rest.short_description),
      description: blank(rest.description),
      terms: blank(rest.terms),
      image_url: blank(rest.image_url),
      logo_url: blank(rest.logo_url),
      featured: rest.featured ?? false,
      duration_label: blank(rest.duration_label),
      renewal_interval: blank(rest.renewal_interval),
      installation_instructions: blank(rest.installation_instructions),
      private_delivery_notes: blank(rest.private_delivery_notes),
      download_url: blank(rest.download_url),
      credits_per_interval: rest.credits_per_interval ?? null,
      price_usdt: rest.price_usdt ?? null,
      price_inr: rest.price_inr ?? null,
      price_stars: rest.price_stars ?? null,
      stock_quantity: rest.stock_mode === "tracked" ? (rest.stock_quantity ?? 0) : null,
      updated_at: new Date().toISOString(),
    };
    if (id) {
      const { error } = await db.from("products").update(row).eq("id", id);
      if (error) throw new Error("Could not save this product. The short name must be unique.");
    } else {
      const { error } = await db
        .from("products")
        .insert({ ...row, product_type: "digital", price: rest.price_usdt ?? 0, currency: "USDT", is_free: false });
      if (error) throw new Error("Could not create this product. The short name must be unique.");
      if (!row.image_url) { const { autoFillProductImages } = await import("@/lib/product-image.server"); await autoFillProductImages(1); }
    }
    await logActivity("shop", id ? "Shop product updated" : "Shop product added", "success", row.name);
    return { ok: true };
  });

export const shopDuplicateProduct = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    const { data: source } = await db.from("products").select("*").eq("id", data.id).maybeSingle();
    if (!source) throw new Error("Product not found.");
    const copy: Record<string, unknown> = { ...source };
    delete copy["id"];
    delete copy["created_at"];
    copy["name"] = `${source.name} (copy)`;
    copy["slug"] = `${source.slug ?? "product"}-copy-${Date.now().toString(36)}`;
    copy["shop_published"] = false;
    copy["status"] = "draft";
    const { error } = await db.from("products").insert(copy as never);
    if (error) throw new Error("Could not duplicate this product.");
    return { ok: true };
  });

export const shopSetProductState = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        shop_published: z.boolean().optional(),
        featured: z.boolean().optional(),
        status: z.enum(["active", "draft", "archived"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { db, logActivity } = await import("@/lib/hub.server");
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.shop_published !== undefined) patch["shop_published"] = data.shop_published;
    if (data.featured !== undefined) patch["featured"] = data.featured;
    if (data.status) patch["status"] = data.status;
    const { error } = await db.from("products").update(patch as never).eq("id", data.id);
    if (error) throw new Error("Could not update this product.");
    await logActivity("shop", "Product state changed", "success", `${data.id} ${JSON.stringify(patch)}`);
    return { ok: true };
  });

/** Permanently deletes a product that has never been ordered; ordered products must be archived instead. */
export const shopDeleteProduct = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data }) => {
    const { db, logActivity } = await import("@/lib/hub.server");
    const { count, error: countError } = await db.from("shop_order_items").select("id", { count: "exact", head: true }).eq("product_id", data.id);
    if (countError) throw new Error("Could not check this product's orders.");
    const { data: row } = await db.from("products").select("name,reseller_product_id").eq("id", data.id).maybeSingle();
    if (row?.reseller_product_id || (count ?? 0) > 0) {
      const removed = await db.from("products").update({ supplier_removed: Boolean(row?.reseller_product_id), shop_published: false, status: "archived", availability: "out_of_stock", updated_at: new Date().toISOString() }).eq("id", data.id);
      if (removed.error) throw new Error("Could not remove this product.");
      await logActivity("shop", "Product removed", "warning", `${row?.name ?? data.id}; order history retained`);
      return { ok: true };
    }
    await db.from("store_offers").update({ product_id: null, status: "archived" }).eq("product_id", data.id);
    await db.from("product_prices").delete().eq("product_id", data.id);
    await db.from("product_files").delete().eq("product_id", data.id);
    const { error } = await db.from("products").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete this product. Archive it instead.");
    await logActivity("shop", "Product deleted", "warning", row?.name ?? data.id);
    return { ok: true };
  });

/* --------------------------- Payment methods ------------------------------ */

export const shopPaymentMethods = createServerFn({ method: "POST" }).middleware([requireAdminPassword]).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  const { data } = await db.from("payment_methods").select("*").order("display_order");
  return data ?? [];
});

export const shopSavePaymentMethod = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(80),
        provider: z.string().trim().min(1).max(40),
        currency: z.string().trim().min(1).max(10),
        channel: z.enum(["website", "telegram"]),
        network: z.string().trim().max(40).optional(),
        recipient: z.string().trim().max(200).optional(),
        recipient_label: z.string().trim().max(60).optional(),
        settlement_asset: z.string().trim().max(20).optional(),
        reference_label: z.string().trim().max(80).optional(),
        instructions: z.string().trim().max(1500).optional(),
        config: z.object({ account_name: z.string().max(120).optional(), recipient_name: z.string().max(120).optional(), qr_url: z.string().max(1000).optional() }).optional(),
        enabled: z.boolean(),
        display_order: z.number().int().min(0).max(999),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { db, logActivity } = await import("@/lib/hub.server");
    const { id, ...rest } = data;
    const row = {
      ...rest,
      network: blank(rest.network),
      recipient: blank(rest.recipient),
      recipient_label: blank(rest.recipient_label),
      settlement_asset: blank(rest.settlement_asset),
      reference_label: blank(rest.reference_label),
      instructions: blank(rest.instructions),
      updated_at: new Date().toISOString(),
    };
    const { error } = id
      ? await db.from("payment_methods").update(row).eq("id", id)
      : await db.from("payment_methods").insert(row);
    if (error) throw new Error("Could not save this payment method.");
    await logActivity("payments", id ? "Payment method updated" : "Payment method added", "success", row.name);
    return { ok: true };
  });

/* --------------------- AI fulfillment email draft (admin) ------------------ */

export const shopDraftEmail = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => idInput.parse(input))
  .handler(async ({ data }) => {
    const { draftFulfillmentEmail } = await import("@/lib/shop.server");
    return await draftFulfillmentEmail(data.id);
  });

export const shopSaveEmailDraft = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        subject: z.string().trim().min(3).max(200),
        body: z.string().trim().min(10).max(8000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { saveFulfillmentEmailDraft } = await import("@/lib/shop.server");
    return await saveFulfillmentEmailDraft(data.id, data.subject, data.body);
  });

export const shopWalletAccounts = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => z.object({ search: z.string().trim().max(120).optional() }).parse(input))
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    let query = db
      .from("profiles")
      .select("id, first_name, last_name, telegram_username, telegram_user_id,member_number")
      .order("created_at", { ascending: false })
      .limit(40);
    const search = data.search?.trim();
    if (search) {
      query = query.or(
        `telegram_username.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`,
      );
    }
    const { data: profiles } = await query;
    const ids = (profiles ?? []).map((p) => p.id);
    const { data: wallets } = ids.length
      ? await db.from("wallets").select("profile_id, balance_usd").in("profile_id", ids)
      : { data: [] as Array<Record<string, unknown>> };
    return (profiles ?? []).map((p) => ({
      id: p.id as string,
      member_number: p.member_number,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || (p.telegram_username as string) || "Customer",
      username: (p.telegram_username as string) ?? null,
      telegram_user_id: p.telegram_user_id as number | null,
      balance: Number(
        (wallets ?? []).find((w) => w["profile_id"] === p.id)?.["balance_usd"] ?? 0,
      ),
    }));
  });

export const shopWalletTopUp = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) =>
    z
      .object({
        profileId: z.string().uuid(),
        amount: z.number().positive().max(100000),
        note: z.string().trim().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { db, logActivity } = await import("@/lib/hub.server");
    const { data: balance, error } = await db.rpc("wallet_credit", {
      _profile_id: data.profileId,
      _amount: data.amount,
      _kind: "topup",
      _note: data.note ?? "Added by admin",
      _order_id: undefined,
      _actor: "admin",
    });
    if (error) throw new Error("Could not add funds to this wallet.");
    await logActivity("shop", "Wallet funded", "success", `${data.amount.toFixed(2)} USD added`);
    return { balance: Number(balance) };
  });

export const shopWalletPendingTopUps = createServerFn({ method: "POST" }).middleware([requireAdminPassword]).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  const { data, error } = await db.from("wallet_topup_requests").select("*").eq("status", "pending").order("created_at").limit(100);
  if (error) throw new Error("Could not load top ups.");
  return data ?? [];
});
export const shopWalletReviewTopUp = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => walletReviewSchema.parse(input)).handler(async ({ data }) => {
    const { db, logActivity } = await import("@/lib/hub.server");
    const result = await db.rpc("shop_review_wallet_topup", { _id: data.id, _approve: data.approve, _note: data.note, _credit_usd: data.creditUsd });
    if (!result.error) void import("@/lib/shop-crm.server").then(m => m.kickCrmSync(), () => undefined);
    if (result.error) throw new Error("Request is no longer pending, or a verified USD credit is required.");
    const record = result.data as { profile_id: string; amount: number; currency: string; credit_usd: number | null; balance: number | null };
    const { notifyWalletReview } = await import("@/lib/wallet-topup.server");
    let notified = false;
    try { notified = await notifyWalletReview(record.profile_id, data.approve ? `Payment of ${record.amount} ${record.currency} verified. Added $${record.credit_usd} USD / USDT to your wallet. Balance: $${record.balance}. Referral credits are separate.` : `Your wallet top up was rejected: ${data.note}`); } catch { /* Funding decision is already committed; never repeat credit. */ }
    await logActivity("wallet", data.approve ? "Top up approved" : "Top up rejected", notified ? "success" : "warning", `Request ${data.id}${notified ? "" : "; Telegram notification failed"}`);
    return { ok: true, notified };
  });
export const shopWalletDeduct = createServerFn({ method: "POST" }).middleware([requireAdminPassword])
  .inputValidator((input: unknown) => walletDeductSchema.parse(input)).handler(async ({ data }) => {
    const { db, logActivity } = await import("@/lib/hub.server");
    const result = await db.rpc("shop_admin_wallet_deduct", { _profile: data.profileId, _amount: data.amount, _note: data.note });
    if (result.error || !result.data) throw new Error("Insufficient balance or deduction could not be applied.");
    await logActivity("wallet", "Wallet deducted", "warning", `${data.amount} USD: ${data.note}`);
    return { ok: true };
  });
