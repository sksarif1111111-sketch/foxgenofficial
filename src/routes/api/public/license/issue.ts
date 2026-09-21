import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  durationSeconds: z.number().int().min(60).max(60 * 60 * 24 * 3650).optional(),
  days: z.number().int().min(1).max(3650).optional(),
  plan_days: z.number().int().min(1).max(3650).optional(),
  note: z.string().trim().max(120).optional(),
});

const cors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-api-key, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function reply(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: cors });
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
function block(len: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
function makeKey() {
  return `FOXGEN-${block(3)}-${block(3)}`;
}

export const Route = createFileRoute("/api/public/license/issue")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const expected = process.env["LICENSE_ADMIN_KEY"];
        if (!expected) return reply({ ok: false, message: "Issuing is not configured." }, 503);

        const header =
          request.headers.get("x-api-key") ??
          (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!header || header !== expected) {
          return reply({ ok: false, message: "Unauthorized." }, 401);
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          raw = {};
        }
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) return reply({ ok: false, message: "Invalid request." }, 400);
        const d = parsed.data;

        const durationSeconds =
          d.durationSeconds ?? (d.days ?? d.plan_days ?? 0) * 86400;
        if (!durationSeconds) return reply({ ok: false, message: "Duration missing." }, 400);
        const planDays = Math.max(1, Math.round(durationSeconds / 86400));

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        for (let i = 0; i < 6; i++) {
          const { data: row, error } = await supabaseAdmin
            .from("licenses")
            .insert({
              license_key: makeKey(),
              plan_days: planDays,
              duration_seconds: durationSeconds,
              note: d.note ?? "external-api",
            })
            .select("id, license_key, plan_days, duration_seconds, status, created_at")
            .single();
          if (!error && row) {
            return reply({
              ok: true,
              success: true,
              license_key: row.license_key,
              key: row.license_key,
              plan_days: row.plan_days,
              duration_seconds: row.duration_seconds,
              status: row.status,
              multi_device: true,
              device_limit: null,
              created_at: row.created_at,
            });
          }
        }
        return reply({ ok: false, message: "Could not generate a key." }, 500);
      },
    },
  },
});
