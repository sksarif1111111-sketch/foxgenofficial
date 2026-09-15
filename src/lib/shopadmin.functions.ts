import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const idInput = z.object({ id: z.string().uuid() });

/* --------------------------------- Buying --------------------------------- */

export type BuyingSummary = {
  pendingReview: number;
  awaitingEmail: number;
  awaitingDelivery: number;
  completed: number;
  rejected: number;
  revenue: Array<{ currency: string; total: number }>;
};

export const shopSummary = createServerFn({ method: "POST" }).handler(async (): Promise<BuyingSummary> => {
  const { db } = await import("@/lib/hub.server");
  const { data } = await db.from("shop_orders").select("status, currency, total, stars_total");
  const rows = data ?? [];
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
    pendingReview: rows.filter((r) => r.status === "under_review" || r.status === "payment_submitted").length,
    awaitingEmail: rows.filter((r) => r.status === "awaiting_email").length,
    awaitingDelivery: rows.filter((r) => r.status === "awaiting_fulfillment" || r.status === "payment_confirmed").length,
    completed: rows.filter((r) => r.status === "delivered").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
    revenue: [...revenueMap.entries()].map(([currency, total]) => ({ currency, total })),
  };
});

export const shopOrders = createServerFn({ method: "POST" })
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

export const shopOrderDetail = createServerFn({ method: "POST" })
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
      order: { ...order, total: order.total === null ? null : Number(order.total) },
      items: items ?? [],
      events: events ?? [],
      fulfillments: fulfillments ?? [],
      jobs: jobs ?? [],
      telegram,
    };
  });

export const shopApproveOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), notes: z.string().max(600).optional(), send: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { db, logActivity } = await import("@/lib/hub.server");
    const { orderEvent, notifyBuyerTelegram, sendFulfillmentEmail } = await import("@/lib/shop.server");
    const { data: order } = await db.from("shop_orders").select("*").eq("id", data.id).maybeSingle();
    if (!order) throw new Error("Order not found.");

    if (!order.stock_consumed) {
      const now = new Date().toISOString();
      const { data: updated } = await db
        .from("shop_orders")
        .update({
          status: "awaiting_fulfillment",
          stock_consumed: true,
          confirmed_at: now,
          reviewed_at: now,
          review_notes: data.notes ?? null,
          updated_at: now,
        })
        .eq("id", data.id)
        .eq("stock_consumed", false)
        .in("status", ["payment_submitted", "awaiting_email", "under_review"])
        .select("id");
      if (!updated || updated.length === 0) {
        if (!data.send) throw new Error("This order is not waiting for payment approval.");
      } else {
        await orderEvent(data.id, "payment_confirmed", "admin", data.notes ?? "");
        await logActivity("shop", "Payment approved", "success", order.order_number);
        await notifyBuyerTelegram(
          data.id,
          "Payment successful. Please wait while we prepare your access. We will notify you when your activation email is sent.",
        );
      }
    }

    if (data.send) {
      const result = await sendFulfillmentEmail(data.id);
      if (!result.ok) return { ok: true, delivery: result.reason };
      return { ok: true, delivery: "sent" };
    }
    return { ok: true, delivery: "pending" };
  });

export const shopRejectOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), reason: z.string().trim().min(3).max(600) }).parse(input))
  .handler(async ({ data }) => {
    const { db, logActivity } = await import("@/lib/hub.server");
    const { orderEvent, notifyBuyerTelegram } = await import("@/lib/shop.server");
    const { data: order } = await db.from("shop_orders").select("*").eq("id", data.id).maybeSingle();
    if (!order) throw new Error("Order not found.");
    if (order.stock_consumed) throw new Error("A confirmed order cannot be rejected here.");
    await db.rpc("shop_release_stock", { _order_id: data.id });
    await db
      .from("shop_orders")
      .update({
        status: "rejected",
        reject_reason: data.reason,
        rejected_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    await orderEvent(data.id, "rejected", "admin", data.reason);
    await logActivity("shop", "Payment rejected", "warning", `${order.order_number} — ${data.reason}`);
    await notifyBuyerTelegram(
      data.id,
      `Your order ${order.order_number} could not be confirmed.\nReason: ${data.reason}\nIf you believe this is a mistake, contact support with your transaction reference.`,
    );
    return { ok: true };
  });

export const shopRequestInfo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), message: z.string().trim().min(3).max(600) }).parse(input))
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    const { orderEvent, notifyBuyerTelegram } = await import("@/lib/shop.server");
    const { data: order } = await db.from("shop_orders").select("order_number").eq("id", data.id).maybeSingle();
    if (!order) throw new Error("Order not found.");
    await db
      .from("shop_orders")
      .update({ info_request: data.message, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    await orderEvent(data.id, "info_requested", "admin", data.message);
    await notifyBuyerTelegram(
      data.id,
      `We need a little more information for order ${order.order_number}:\n${data.message}`,
    );
    return { ok: true };
  });

export const shopAddFulfillment = createServerFn({ method: "POST" })
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
    const { db } = await import("@/lib/hub.server");
    const { orderEvent } = await import("@/lib/shop.server");
    await db.from("shop_fulfillments").insert({ order_id: data.id, kind: data.kind, content: data.content });
    await orderEvent(data.id, "fulfillment_added", "admin", data.kind);
    return { ok: true };
  });

export const shopSendDelivery = createServerFn({ method: "POST" })
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
  duration_label: z.string().trim().max(60).optional(),
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

export const shopAdminProducts = createServerFn({ method: "POST" }).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  const { data } = await db.from("products").select("*").order("shop_order").order("created_at");
  return data ?? [];
});

export const shopSaveProduct = createServerFn({ method: "POST" })
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
    }
    await logActivity("shop", id ? "Shop product updated" : "Shop product added", "success", row.name);
    return { ok: true };
  });

export const shopDuplicateProduct = createServerFn({ method: "POST" })
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

export const shopSetProductState = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        shop_published: z.boolean().optional(),
        status: z.enum(["active", "draft", "archived"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.shop_published !== undefined) patch["shop_published"] = data.shop_published;
    if (data.status) patch["status"] = data.status;
    await db.from("products").update(patch as never).eq("id", data.id);
    return { ok: true };
  });

/* --------------------------- Payment methods ------------------------------ */

export const shopPaymentMethods = createServerFn({ method: "POST" }).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  const { data } = await db.from("payment_methods").select("*").order("display_order");
  return data ?? [];
});

export const shopSavePaymentMethod = createServerFn({ method: "POST" })
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
