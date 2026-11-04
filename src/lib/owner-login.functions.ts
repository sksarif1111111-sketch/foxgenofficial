import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const OWNER_EMAIL = "mirzawebsolution@gmail.com";

/**
 * Checks the typed CRM password against the CRM_OWNER_PASSWORD secret.
 * On a match, makes sure the owner account uses that password and is confirmed,
 * so the browser can then sign in normally (CRM data stays protected by RLS).
 */
export const prepareOwnerLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const expected = process.env["CRM_OWNER_PASSWORD"];
    if (!expected) return { ok: false as const };
    const { createHash, timingSafeEqual } = await import("node:crypto");
    const a = createHash("sha256").update(data.password, "utf8").digest();
    const b = createHash("sha256").update(expected, "utf8").digest();
    if (!timingSafeEqual(a, b)) return { ok: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error("Could not prepare sign-in");
    const owner = list.users.find((u) => u.email?.toLowerCase() === OWNER_EMAIL);
    if (!owner) throw new Error("Owner account not found");
    const { error: upd } = await supabaseAdmin.auth.admin.updateUserById(owner.id, {
      password: expected,
      email_confirm: true,
    });
    if (upd) throw new Error("Could not prepare sign-in");
    return { ok: true as const };
  });
