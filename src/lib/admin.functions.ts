import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type LicenseRow = {
  id: string;
  license_key: string;
  plan_days: number;
  status: string;
  note: string | null;
  device_id: string | null;
  activated_at: string | null;
  expires_at: string | null;
  last_seen_at: string | null;
  created_at: string;
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBlock(len: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

function makeKey(planDays: number) {
  return `FOXGEN-${planDays}D-${randomBlock(4)}-${randomBlock(4)}-${randomBlock(4)}`;
}

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Forbidden: this account is not an admin.");
  return supabaseAdmin;
}

/** First signed-in account becomes the owner/admin. After that it is closed. */
export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean; claimed: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("admin_users")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) return { isAdmin: true, claimed: false };

    const { count } = await supabaseAdmin
      .from("admin_users")
      .select("user_id", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { isAdmin: false, claimed: false };

    const email = (context.claims as { email?: string } | null)?.email ?? null;
    await supabaseAdmin.from("admin_users").insert({ user_id: context.userId, email });
    return { isAdmin: true, claimed: true };
  });

export const listLicenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LicenseRow[]> => {
    const db = await assertAdmin(context.userId);
    const { data } = await db
      .from("licenses")
      .select(
        "id, license_key, plan_days, status, note, device_id, activated_at, expires_at, last_seen_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    return (data ?? []) as LicenseRow[];
  });

export const generateLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ planDays: z.union([z.literal(15), z.literal(30), z.literal(60)]), note: z.string().trim().max(120).optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<LicenseRow> => {
    const db = await assertAdmin(context.userId);
    for (let i = 0; i < 5; i++) {
      const { data: row, error } = await db
        .from("licenses")
        .insert({
          license_key: makeKey(data.planDays),
          plan_days: data.planDays,
          note: data.note ?? null,
          created_by: context.userId,
        })
        .select(
          "id, license_key, plan_days, status, note, device_id, activated_at, expires_at, last_seen_at, created_at",
        )
        .single();
      if (!error && row) return row as LicenseRow;
    }
    throw new Error("Could not generate a license key. Please try again.");
  });

export const setLicenseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "blocked"]) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = await assertAdmin(context.userId);
    await db.from("licenses").update({ status: data.status }).eq("id", data.id);
    return { ok: true };
  });

export const deleteLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const db = await assertAdmin(context.userId);
    await db.from("licenses").delete().eq("id", data.id);
    return { ok: true };
  });
