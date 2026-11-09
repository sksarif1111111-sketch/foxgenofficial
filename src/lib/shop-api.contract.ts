import { z } from "zod";

export const resourceSchema = z.enum(["health", "products", "orders", "sales", "bot"]);
export const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  since: z.string().datetime({ offset: true }).optional(),
  until: z.string().datetime({ offset: true }).optional(),
  cursor_time: z.string().datetime({ offset: true }).optional(),
  cursor_id: z.string().uuid().optional(),
  channel: z.enum(["web", "website", "bot", "telegram"]).optional(),
}).superRefine((q, ctx) => {
  if (Boolean(q.cursor_time) !== Boolean(q.cursor_id)) {
    ctx.addIssue({ code: "custom", message: "Both cursor fields are required" });
  }
  if (q.since && q.until && Date.parse(q.since) > Date.parse(q.until)) {
    ctx.addIssue({ code: "custom", message: "Invalid time range" });
  }
});

export const paidStatuses = ["confirmed", "delivered"] as const;
export function isPaid(status: string) {
  return paidStatuses.some((paid) => paid === status);
}

/** CRM imports must upsert this stable identifier rather than create on every poll. */
export function externalOrderId(id: string) { return `shop:${id}`; }

export function normalizeChannel(channel: string) {
  return channel === "bot" || channel === "telegram" ? "Bot" : "Website";
}

export function validKeyHeader(header: string | null): string | null {
  const match = header?.match(/^Bearer ([A-Za-z0-9_-]{32,256})$/);
  return match?.[1] ?? null;
}