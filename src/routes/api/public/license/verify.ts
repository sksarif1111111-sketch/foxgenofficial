import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  licenseKey: z.string().trim().min(4).max(200).optional(),
  key: z.string().trim().min(4).max(200).optional(),
  license_key: z.string().trim().min(4).max(200).optional(),
  deviceId: z.string().trim().max(200).optional(),
  device_id: z.string().trim().max(200).optional(),
  hwid: z.string().trim().max(200).optional(),
});

const cors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function reply(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: cors });
}

export const Route = createFileRoute("/api/public/license/verify")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return reply(
            { ok: false, valid: false, status: "invalid", reason: "invalid_license", message: "Bad request." },
            400,
          );
        }

        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) {
          return reply(
            { ok: false, valid: false, status: "invalid", reason: "invalid_license", message: "License key missing." },
            400,
          );
        }
        const d = parsed.data;
        const licenseKey = (d.licenseKey ?? d.key ?? d.license_key ?? "").trim().toUpperCase();
        if (!licenseKey) {
          return reply(
            { ok: false, valid: false, status: "invalid", reason: "invalid_license", message: "License key missing." },
            400,
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: row, error } = await supabaseAdmin
          .from("licenses")
          .select(
            "id, license_key, plan_days, duration_seconds, status, device_id, activated_at, expires_at, check_count",
          )
          .eq("license_key", licenseKey)
          .maybeSingle();

        if (error) {
          console.error("license lookup failed", error);
          return reply(
            { ok: false, valid: false, status: "error", reason: "server_error", message: "Server error. Try again." },
            500,
          );
        }
        if (!row) {
          return reply(
            {
              ok: false,
              valid: false,
              status: "invalid",
              reason: "invalid_license",
              message: "Invalid license key.",
            },
            401,
          );
        }
        if (row.status !== "active") {
          return reply(
            {
              ok: false,
              valid: false,
              status: row.status,
              reason: "license_revoked",
              message: "This license key has been blocked.",
            },
            401,
          );
        }

        const now = new Date();
        let expiresAt = row.expires_at ? new Date(row.expires_at) : null;
        const patch: {
          last_seen_at: string;
          check_count: number;
          activated_at?: string;
          expires_at?: string;
        } = {
          last_seen_at: now.toISOString(),
          check_count: (row.check_count ?? 0) + 1,
        };

        const durationSeconds =
          row.duration_seconds && row.duration_seconds > 0
            ? Number(row.duration_seconds)
            : (row.plan_days ?? 1) * 24 * 60 * 60;

        if (!row.activated_at || !expiresAt) {
          expiresAt = new Date(now.getTime() + durationSeconds * 1000);
          patch.activated_at = now.toISOString();
          patch.expires_at = expiresAt.toISOString();
        }

        if (expiresAt.getTime() <= now.getTime()) {
          await supabaseAdmin.from("licenses").update(patch).eq("id", row.id);
          return reply(
            {
              ok: false,
              valid: false,
              status: "expired",
              reason: "license_expired",
              message: "This license key has expired.",
            },
            401,
          );
        }

        const { error: updateError } = await supabaseAdmin.from("licenses").update(patch).eq("id", row.id);
        if (updateError) {
          console.error("license state update failed", updateError);
          return reply(
            { ok: false, valid: false, status: "error", reason: "server_error", message: "License check could not be completed. Try again." },
            500,
          );
        }

        return reply({
          status: "valid",
          valid: true,
          ok: true,
          success: true,
          token: row.id,
          session_id: row.id,
          license_id: row.id,
          user_name: "FoxGEN User",
          activated_at: (patch.activated_at ?? row.activated_at),
          online_count: 0,
          multi_device: true,
          device_limit: null,
          ttl: Math.max(5, Math.min(900, Math.floor((expiresAt.getTime() - now.getTime()) / 1000))),
          plan_days: row.plan_days,
          duration_seconds: durationSeconds,
          expires_at: expiresAt.toISOString(),
          message: "License active.",
          license: {
            plan: durationSeconds >= 86400 ? `${Math.round(durationSeconds / 86400)}-day` : `${durationSeconds}s`,
            expires_at: expiresAt.toISOString(),
            max_devices: null,
            multi_device: true,
            is_trial: false,
          },
        });

      },
    },
  },
});
