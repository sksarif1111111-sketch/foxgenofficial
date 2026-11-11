import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ownsWebsiteOrder } from "@/lib/customer-auth.policy";
import type { MyOrder } from "@/lib/shop.functions";

async function ownOrder(id: string, userId: string) {
  const { db } = await import("@/lib/hub.server");
  const { data, error } = await db.from("shop_orders").select("*").eq("id", id).eq("customer_user_id", userId).maybeSingle();
  if (error || !data || !ownsWebsiteOrder(data, userId)) throw new Error("Order not found.");
  return data;
}
export const customerPlaceOrder = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
 .inputValidator((input: unknown) => z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(50), paymentMethodId: z.string().uuid() }).parse(input))
 .handler(async ({ data, context }) => {
   const { data: identity, error } = await context.supabase.auth.getUser();
   if (error || !identity.user?.email_confirmed_at) throw new Error("Verify your email before ordering.");
   const { createOrder } = await import("@/lib/shop.server");
   return createOrder({ channel: "website", profileId: null, telegramUserId: null, customerUserId: context.userId, customerName: identity.user.email ?? null, ...data });
 });
export const customerSubmitPayment = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
 .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid(), reference: z.string().trim().min(6).max(200), evidenceUrl: z.string().url().max(700).optional() }).parse(input))
 .handler(async ({ data, context }) => { await ownOrder(data.orderId, context.userId); const { submitPayment } = await import("@/lib/shop.server"); return submitPayment(data.orderId, data.reference, data.evidenceUrl ?? null); });
export const customerConfirmEmails = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
 .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid(), emails: z.string().trim().min(5).max(600) }).parse(input))
 .handler(async ({ data, context }) => { await ownOrder(data.orderId, context.userId); const { setOrderEmails } = await import("@/lib/shop.server"); return setOrderEmails(data.orderId, data.emails); });
export const customerCancelOrder = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
 .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
 .handler(async ({ data, context }) => { await ownOrder(data.orderId, context.userId); const { cancelOrder } = await import("@/lib/shop.server"); return cancelOrder(data.orderId, "customer", "Cancelled by customer"); });
export const customerMyOrders = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<MyOrder[]> => {
  const { db } = await import("@/lib/hub.server");
  const result = await db.from("shop_orders").select("*").eq("customer_user_id", context.userId).eq("channel", "website").order("created_at", { ascending: false }).limit(50);
  if (result.error) throw new Error("Could not read your orders.");
  const orders = result.data ?? [], ids = orders.map(o => o.id);
  if (!ids.length) return [];
  const [items, material] = await Promise.all([db.from("shop_order_items").select("*").in("order_id", ids), db.from("shop_fulfillments").select("order_id,content").in("order_id", ids)]);
  if (items.error || material.error) throw new Error("Could not read your orders.");
  return orders.map(o => ({ ...o, items: (items.data ?? []).filter(i => i.order_id === o.id).map(i => ({ product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price, currency: i.currency })), fulfillment: o.status === "delivered" ? (material.data ?? []).filter(m => m.order_id === o.id).map(m => m.content) : [] }));
});