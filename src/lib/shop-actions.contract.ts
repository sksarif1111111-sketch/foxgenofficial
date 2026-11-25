import { z } from "zod";
const base = { order_id: z.string().uuid() };
export const shopActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("upsert_product"), reseller_product_id: z.string().trim().min(1).max(150), name: z.string().trim().min(1).max(200), short_description: z.string().max(1500).optional(), price_usdt: z.number().nonnegative().max(100000).nullable(), price_inr: z.number().nonnegative().max(10000000).nullable(), price_stars: z.number().int().nonnegative().max(10000000).nullable(), stock_quantity: z.number().int().nonnegative().max(1000000), image_url: z.string().url().max(2000).refine(s => s.startsWith("https://")).nullable().optional() }),
  z.object({ ...base, action: z.literal("approve"), notes: z.string().max(600).optional(), send: z.boolean().optional() }),
  z.object({ ...base, action: z.literal("reject"), reason: z.string().trim().min(3).max(600) }),
  z.object({ ...base, action: z.literal("add_fulfillment"), kind: z.enum(["link", "code", "instructions"]), content: z.string().trim().min(3).max(4000) }),
  z.object({ ...base, action: z.literal("deliver_email") }),
  z.object({ ...base, action: z.literal("deliver_telegram") }),
  z.object({ ...base, action: z.literal("request_info"), message: z.string().trim().min(3).max(600) }),
  z.object({ action: z.literal("message_customer"), order_id: z.string().uuid().optional(), customer_id: z.string().uuid().optional(), message: z.string().trim().min(1).max(2000), channels: z.array(z.enum(["telegram", "email", "account"])).min(1).max(3) }),
  z.object({ ...base, action: z.literal("approve_and_deliver"), fields: z.object({ account_email: z.string().trim().max(320).optional(), account_username: z.string().trim().max(200).optional(), account_number: z.string().trim().max(200).optional(), password: z.string().max(500).optional(), link: z.string().trim().max(2000).optional(), notes: z.string().max(2000).optional() }) }),
  z.object({ action: z.literal("adjust_wallet"), customer_id: z.string().uuid(), amount_usd: z.number().finite().refine(n => n !== 0 && Math.abs(n) <= 100000), reason: z.string().trim().min(3).max(500) }),
]);