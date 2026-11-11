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
export async function actionKeyMatches(a: string, b: string) {
  const digest = (s: string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  const x = new Uint8Array(left), y = new Uint8Array(right);
  let difference = 0;
  for (let i = 0; i < x.length; i++) difference |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return difference === 0;
}