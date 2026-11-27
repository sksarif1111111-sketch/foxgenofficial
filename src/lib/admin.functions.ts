import { requireExtensionPassword } from "@/lib/admin-access.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MAX_CREDITS } from "@/lib/license-credits";

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
  credit_total: number | null;
  credit_balance: number | null;
};

const SELECT =
  "id, license_key, plan_days, duration_seconds, status, note, device_id, activated_at, expires_at, last_seen_at, created_at, credit_total, credit_balance";

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

export const listLicenses = createServerFn({ method: "POST" }).middleware([requireExtensionPassword]).handler(async (): Promise<LicenseRow[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("licenses")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(1000);
  return (data ?? []) as LicenseRow[];
});

export const generateLicense = createServerFn({ method: "POST" }).middleware([requireExtensionPassword])
  .inputValidator((input: unknown) =>
    z
      .object({
        durationSeconds: z.number().int().min(1).max(60 * 60 * 24 * 3650),
        note: z.string().trim().max(120).optional(),
        name: z.string().trim().max(40).optional(),
        creditTotal: z.number().int().min(1).max(MAX_CREDITS).optional(),
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
          license_key: makeKey(data.name),
          plan_days: planDays,
          duration_seconds: data.durationSeconds,
          note: data.note ?? null,
          ...(data.creditTotal ? { credit_total: data.creditTotal, credit_balance: data.creditTotal } : {}),
        })
        .select(SELECT)
        .single();
      if (!error && row) {
        const { logActivity } = await import("@/lib/hub.server");
        await logActivity("extension", "Licence generated", "success", `${row.license_key} · ${planDays}d${data.creditTotal ? ` · ${data.creditTotal} credits` : ""}`);
        return row as LicenseRow;
      }
    }
    throw new Error("Could not generate a license key. Please try again.");
  });

export const setLicenseStatus = createServerFn({ method: "POST" }).middleware([requireExtensionPassword])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "blocked"]) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("licenses").update({ status: data.status }).eq("id", data.id).select("license_key").single();
    if (error || !row) throw new Error("Could not update this licence.");
    const { logActivity } = await import("@/lib/hub.server");
    await logActivity("extension", data.status === "active" ? "Licence activated" : "Licence blocked", "success", row.license_key);
    return { ok: true };
  });

export const deleteLicense = createServerFn({ method: "POST" }).middleware([requireExtensionPassword])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("licenses").delete().eq("id", data.id).select("license_key").single();
    if (error || !row) throw new Error("Could not delete this licence.");
    const { logActivity } = await import("@/lib/hub.server");
    await logActivity("extension", "Licence deleted", "warning", row.license_key);
    return { ok: true };
  });

export const addLicenseCredits = createServerFn({ method: "POST" }).middleware([requireExtensionPassword])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), amount: z.number().int().min(1).max(MAX_CREDITS) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true; credits: number }> => {
    const { adjustCredits } = await import("@/lib/license-credits.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("licenses").select("license_key").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Licence not found.");
    const result = await adjustCredits(data.id, data.amount, "admin top-up");
    if (!result.ok) throw new Error("Could not add credits.");
    const { logActivity } = await import("@/lib/hub.server");
    await logActivity("extension", "Credits added", "success", `${row.license_key} · +${data.amount}`);
    return { ok: true, credits: result.credits ?? 0 };
  });
