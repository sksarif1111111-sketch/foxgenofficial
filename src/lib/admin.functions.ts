import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type LicenseRow = {
  id: string;
  license_key: string;
  plan_days: number | null;
  duration_seconds: number | null;
  status: string;
  note: string | null;
  device_id: string | null;
  activated_at: string | null;
  expires_at: string | null;
  last_seen_at: string | null;
  created_at: string;
};

const SELECT =
  "id, license_key, plan_days, duration_seconds, status, note, device_id, activated_at, expires_at, last_seen_at, created_at";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";

function block(len: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

function cleanPrefix(name?: string) {
  const p = (name ?? "").normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "").toUpperCase().slice(0, 24);
  return p || "FOXGEN";
}

/** NAME-XXX-XXX (defaults to FOXGEN) */
function makeKey(name?: string) {
  return `${cleanPrefix(name)}-${block(3)}-${block(3)}`;
}

export const listLicenses = createServerFn({ method: "POST" }).handler(async (): Promise<LicenseRow[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("licenses")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []) as LicenseRow[];
});

export const generateLicense = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        durationSeconds: z.number().int().min(1).max(60 * 60 * 24 * 3650),
        note: z.string().trim().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<LicenseRow> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const planDays = Math.max(1, Math.round(data.durationSeconds / 86400));
    for (let i = 0; i < 6; i++) {
      const { data: row, error } = await supabaseAdmin
        .from("licenses")
        .insert({
          license_key: makeKey(),
          plan_days: planDays,
          duration_seconds: data.durationSeconds,
          note: data.note ?? null,
        })
        .select(SELECT)
        .single();
      if (!error && row) return row as LicenseRow;
    }
    throw new Error("Could not generate a license key. Please try again.");
  });

export const setLicenseStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "blocked"]) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("licenses").update({ status: data.status }).eq("id", data.id);
    return { ok: true };
  });

export const deleteLicense = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("licenses").delete().eq("id", data.id);
    return { ok: true };
  });
