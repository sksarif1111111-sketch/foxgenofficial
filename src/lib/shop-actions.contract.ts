import { z } from "zod";
const base = { order_id: z.string().uuid() };
export const shopActionSchema = z.discriminatedUnion("action", [
  z.object({ ...base, action: z.literal("approve"), notes: z.string().max(600).optional(), send: z.boolean().optional() }),
  z.object({ ...base, action: z.literal("reject"), reason: z.string().trim().min(3).max(600) }),
  z.object({ ...base, action: z.literal("add_fulfillment"), kind: z.enum(["link", "code", "instructions"]), content: z.string().trim().min(3).max(4000) }),
  z.object({ ...base, action: z.literal("deliver_email") }),
  z.object({ ...base, action: z.literal("deliver_telegram") }),
  z.object({ ...base, action: z.literal("request_info"), message: z.string().trim().min(3).max(600) }),
]);