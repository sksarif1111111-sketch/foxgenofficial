import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const token = z.string().min(10).max(200);

export type ShopCatalog = {
  products: Array<{
    id: string;
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
    price_label: string;
    stock_label: string;
    availability: string;
    purchasable: boolean;
    max_units: number;
    delivery_method: string;
  }>;
  methods: Array<{
    id: string;
    name: string;
    currency: string;
    network: string | null;
    recipient: string | null;
    recipient_label: string | null;
    reference_label: string | null;
    instructions: string | null;
  }>;
  reviewMinutes: number;
  support: string;
};

export const shopCatalog = createServerFn({ method: "POST" }).handler(async (): Promise<ShopCatalog> => {
  const { shopProductRows, websitePaymentMethods, maxUnits, reviewMinutes } = await import("@/lib/shop.server");
  const { getSettings } = await import("@/lib/hub.server");
  const [rows, methods, settings, minutes] = await Promise.all([
    shopProductRows("website"),
    websitePaymentMethods(),
    getSettings(),
    reviewMinutes(),
  ]);
  return {
    products: rows.map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      short_description: p.short_description,
      description: p.description,
      features: p.features,
      terms: p.terms,
      image_url: p.image_url,
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
    })),
    methods: (methods as Array<Record<string, unknown>>).map((m) => ({
      id: String(m["id"]),
      name: String(m["name"]),
      currency: String(m["currency"]),
      network: (m["network"] as string) ?? null,
      recipient: (m["recipient"] as string) ?? null,
      recipient_label: (m["recipient_label"] as string) ?? null,
      reference_label: (m["reference_label"] as string) ?? null,
      instructions: (m["instructions"] as string) ?? null,
    })),
    reviewMinutes: minutes,
    support: settings["support_url"] ?? "",
  };
});

async function requireProfile(rawToken: string) {
  const { profileByToken } = await import("@/lib/hub.server");
  const profile = await profileByToken(rawToken);
  if (!profile) throw new Error("Invalid access link. Open the bot and press “My account”.");
  return profile;
}

async function requireOwnOrder(orderId: string, profileId: string) {
  const { db } = await import("@/lib/hub.server");
  const { data } = await db.from("shop_orders").select("*").eq("id", orderId).maybeSingle();
  if (!data || data.profile_id !== profileId) throw new Error("Order not found.");
  return data;
}

export const shopPlaceOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token,
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(50),
        paymentMethodId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const profile = await requireProfile(data.token);
    const { createOrder } = await import("@/lib/shop.server");
    const order = await createOrder({
      channel: "website",
      profileId: profile.id,
      telegramUserId: profile.telegram_user_id ?? null,
      customerName: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || null,
      productId: data.productId,
      quantity: data.quantity,
      paymentMethodId: data.paymentMethodId,
    });
    return {
      id: order.id as string,
      order_number: order.order_number as string,
      total: order.total as number | null,
      currency: order.currency as string,
      payment_method_name: order.payment_method_name as string | null,
      payment_network: order.payment_network as string | null,
      payment_recipient: order.payment_recipient as string | null,
      expires_at: order.expires_at as string | null,
    };
  });

export const shopSubmitPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token,
        orderId: z.string().uuid(),
        reference: z.string().trim().min(6).max(200),
        evidenceUrl: z.string().trim().max(700).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const profile = await requireProfile(data.token);
    await requireOwnOrder(data.orderId, profile.id);
    const { submitPayment } = await import("@/lib/shop.server");
    return submitPayment(data.orderId, data.reference, data.evidenceUrl?.trim() || null);
  });

export const shopConfirmEmails = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token, orderId: z.string().uuid(), emails: z.string().trim().min(5).max(600) }).parse(input),
  )
  .handler(async ({ data }) => {
    const profile = await requireProfile(data.token);
    await requireOwnOrder(data.orderId, profile.id);
    const { setOrderEmails } = await import("@/lib/shop.server");
    return setOrderEmails(data.orderId, data.emails);
  });

export const shopCancelOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token, orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const profile = await requireProfile(data.token);
    await requireOwnOrder(data.orderId, profile.id);
    const { cancelOrder } = await import("@/lib/shop.server");
    return cancelOrder(data.orderId, "customer", "Cancelled by customer");
  });

export type MyOrder = {
  id: string;
  order_number: string;
  status: string;
  currency: string;
  total: number | null;
  stars_total: number | null;
  payment_method_name: string | null;
  payment_recipient: string | null;
  payment_network: string | null;
  payment_reference: string | null;
  delivery_emails: string | null;
  reject_reason: string | null;
  info_request: string | null;
  created_at: string;
  items: Array<{ product_name: string; quantity: number; unit_price: number | null; currency: string }>;
  fulfillment: string[];
};

export const shopMyOrders = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token }).parse(input))
  .handler(async ({ data }): Promise<MyOrder[]> => {
    const profile = await requireProfile(data.token);
    const { db } = await import("@/lib/hub.server");
    const { data: orders } = await db
      .from("shop_orders")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50);
    const ids = (orders ?? []).map((o) => o.id);
    const [{ data: items }, { data: fulfillments }] = await Promise.all([
      ids.length ? db.from("shop_order_items").select("*").in("order_id", ids) : Promise.resolve({ data: [] as never[] }),
      ids.length
        ? db.from("shop_fulfillments").select("order_id, content").in("order_id", ids)
        : Promise.resolve({ data: [] as never[] }),
    ]);
    return (orders ?? []).map((order) => ({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      currency: order.currency,
      total: order.total === null ? null : Number(order.total),
      stars_total: order.stars_total,
      payment_method_name: order.payment_method_name,
      payment_recipient: order.payment_recipient,
      payment_network: order.payment_network,
      payment_reference: order.payment_reference,
      delivery_emails: order.delivery_emails,
      reject_reason: order.reject_reason,
      info_request: order.info_request,
      created_at: order.created_at,
      items: (items ?? [])
        .filter((item) => item.order_id === order.id)
        .map((item) => ({
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price === null ? null : Number(item.unit_price),
          currency: item.currency,
        })),
      fulfillment:
        order.status === "delivered"
          ? (fulfillments ?? [])
              .filter((f) => f.order_id === order.id)
              .map((f) => f.content)
          : [],
    }));
  });

export type WalletView = {
  balance: number;
  transactions: Array<{ id: string; amount: number; balance_after: number; kind: string; note: string | null; created_at: string }>;
};

export const shopWallet = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token }).parse(input))
  .handler(async ({ data }): Promise<WalletView> => {
    const profile = await requireProfile(data.token);
    const { db } = await import("@/lib/hub.server");
    const [{ data: wallet }, { data: rows }] = await Promise.all([
      db.from("wallets").select("balance_usd").eq("profile_id", profile.id).maybeSingle(),
      db
        .from("wallet_transactions")
        .select("id, amount_usd, balance_after, kind, note, created_at")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);
    return {
      balance: Number(wallet?.balance_usd ?? 0),
      transactions: (rows ?? []).map((r) => ({
        id: r.id as string,
        amount: Number(r.amount_usd),
        balance_after: Number(r.balance_after),
        kind: r.kind as string,
        note: (r.note as string) ?? null,
        created_at: r.created_at as string,
      })),
    };
  });
