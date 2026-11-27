import { createFileRoute } from "@tanstack/react-router";
import {
  adjustCredits,
  creditCors,
  creditReply,
  deductSchema,
  loadActiveLicense,
} from "@/lib/license-credits.server";

export const Route = createFileRoute("/api/public/license/credits-deduct")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: creditCors }),
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return creditReply({ ok: false, success: false, error: "bad_request", message: "Bad request." }, 400);
        }
        const parsed = deductSchema.safeParse(raw);
        if (!parsed.success) {
          return creditReply({ ok: false, success: false, error: "bad_request", message: "Invalid credit request." }, 400);
        }
        const { amount, reason, ...keys } = parsed.data;
        const found = await loadActiveLicense(request, keys);
        if ("response" in found) return found.response;

        let result: Awaited<ReturnType<typeof adjustCredits>>;
        try {
          result = await adjustCredits(found.row.id, -amount, reason ?? "prompt");
        } catch (err) {
          console.error("credit deduct failed", err);
          return creditReply(
            { ok: false, success: false, error: "server_error", message: "Credits could not be updated. Try again." },
            500,
          );
        }
        if (!result.ok) {
          const credits = result.credits ?? 0;
          return creditReply(
            {
              ok: false,
              success: false,
              status: "active",
              error: "insufficient_credits",
              message: "Insufficient credits.",
              credits,
              credits_remaining: credits,
              required: amount,
              shortfall: amount - credits,
            },
            402,
          );
        }
        const credits = result.credits ?? 0;
        const total = result.total ?? credits;
        return creditReply({
          ok: true,
          success: true,
          status: "active",
          credits_deducted: amount,
          credits,
          credits_remaining: credits,
          balance: credits,
          max_credits: total,
          total_credits: total,
          message: "Credits updated.",
        });
      },
    },
  },
});
