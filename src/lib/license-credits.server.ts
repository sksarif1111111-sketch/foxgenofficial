import { z } from "zod";
import { creditPayload, MAX_DEDUCT_PER_CALL, type CreditFields } from "./license-credits";

export const creditCors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

export function creditReply(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: creditCors });
}

const keySchema = z.object({
  licenseKey: z.string().trim().min(4).max(200).optional(),
  key: z.string().trim().min(4).max(200).optional(),
  license_key: z.string().trim().min(4).max(200).optional(),
});

export const deductSchema = keySchema.extend({
  amount: z.coerce.number().int().min(1).max(MAX_DEDUCT_PER_CALL).default(1),
  reason: z.string().trim().max(60).optional(),
});

type LicenseCreditRow = CreditFields & {
  id: string;
  license_key: string;
  status: string;
  expires_at: string | null;
};

/** Finds the key in the body or the Bearer header and checks it is active and not expired. */
export async function loadActiveLicense(
  request: Request,
  body: { licenseKey?: string | undefined; key?: string | undefined; license_key?: string | undefined },
): Promise<{ row: LicenseCreditRow } | { response: Response }> {
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const licenseKey = (body.licenseKey ?? body.key ?? body.license_key ?? bearer).trim().toUpperCase();
  if (licenseKey.length < 4 || licenseKey.length > 200) {
    return {
      response: creditReply(
        { ok: false, success: false, status: "invalid", error: "invalid_license", message: "License key missing." },
        400,
      ),
    };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin
    .from("licenses")
    .select("id, license_key, status, expires_at, credit_total, credit_balance")
    .eq("license_key", licenseKey)
    .maybeSingle();
  if (error) {
    console.error("credit licence lookup failed", error);
    return {
      response: creditReply(
        { ok: false, success: false, status: "error", error: "server_error", message: "Server error. Try again." },
        500,
      ),
    };
  }
  if (!row) {
    return {
      response: creditReply(
        { ok: false, success: false, status: "invalid", error: "invalid_license", message: "Invalid license key." },
        401,
      ),
    };
  }
  if (row.status !== "active") {
    return {
      response: creditReply(
        { ok: false, success: false, status: row.status, error: "license_revoked", message: "This license key has been blocked." },
        401,
      ),
    };
  }
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return {
      response: creditReply(
        { ok: false, success: false, status: "expired", error: "license_expired", message: "This license key has expired." },
        401,
      ),
    };
  }
  return { row };
}

export function balanceReply(row: CreditFields, extra: Record<string, unknown> = {}) {
  return creditReply({ ok: true, success: true, status: "active", ...creditPayload(row), ...extra });
}

/** Atomic spend or top-up through the locking database function. */
export async function adjustCredits(licenseId: string, delta: number, reason: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("license_adjust_credits", {
    p_license_id: licenseId,
    p_delta: delta,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  return data as { ok: boolean; error?: string; credits?: number; total?: number; delta?: number };
}
