import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const adminAccessStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { adminSession } = await import("./admin-access.server");
  const session = await adminSession();
  return { unlocked: session.data.unlocked === true, extension: session.data.unlocked === true && session.data.extension === true };
});

export const unlockAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ password: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { adminSession, matchesAdminPassword } = await import("./admin-access.server");
    const expected = process.env["ADMIN_ACCESS_PASSWORD"];
    if (!expected) return { ok: false };
    if (!matchesAdminPassword(data.password, expected)) return { ok: false };
    const session = await adminSession();
    await session.update({ unlocked: true, extension: false });
    return { ok: true };
  });

/** Second, separate unlock for the Extension Control Center (only from an unlocked Control Center). */
export const unlockExtension = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ password: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { adminSession, matchesAdminPassword, extensionPassword } = await import("./admin-access.server");
    const session = await adminSession();
    if (session.data.unlocked !== true) return { ok: false as const, reason: "signin" as const };
    const expected = extensionPassword();
    if (!expected || !matchesAdminPassword(data.password, expected)) return { ok: false as const, reason: "password" as const };
    await session.update({ ...session.data, extension: true });
    const { logActivity } = await import("@/lib/hub.server");
    await logActivity("extension", "Extension admin unlocked", "info");
    return { ok: true as const };
  });

export const lockExtension = createServerFn({ method: "POST" }).handler(async () => {
  const { adminSession } = await import("./admin-access.server");
  const session = await adminSession();
  await session.update({ ...session.data, extension: false });
  return { ok: true };
});

export const lockAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { adminSession } = await import("./admin-access.server");
  await (await adminSession()).clear();
  return { ok: true };
});
