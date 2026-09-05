import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  licenseKey: z.string().trim().min(4).max(200).optional(),
  key: z.string().trim().min(4).max(200).optional(),
  license_key: z.string().trim().min(4).max(200).optional(),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function deny(message: string, status = 401) {
  return new Response(JSON.stringify({ ok: false, message }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/ext/core")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return deny("Bad request.", 400);
        }
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) return deny("License key missing.", 400);
        const d = parsed.data;
        const licenseKey = (d.licenseKey ?? d.key ?? d.license_key ?? "").trim().toUpperCase();
        if (!licenseKey) return deny("License key missing.", 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: row, error } = await supabaseAdmin
          .from("licenses")
          .select("id, status, expires_at")
          .eq("license_key", licenseKey)
          .maybeSingle();

        if (error) return deny("Server error.", 500);
        if (!row || row.status !== "active") return deny("Invalid or blocked license.", 401);
        if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
          return deny("License expired.", 401);
        }

        const { data: file, error: dlError } = await supabaseAdmin.storage
          .from("ext-core")
          .download("core.js");
        if (dlError || !file) return deny("Core bundle unavailable.", 503);

        const code = await file.text();
        return new Response(code, {
          status: 200,
          headers: { ...cors, "Content-Type": "application/javascript; charset=utf-8" },
        });
      },
    },
  },
});
