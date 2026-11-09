import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const adminAccessStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { adminSession } = await import("./admin-access.server");
  const session = await adminSession();
  return { unlocked: session.data.unlocked === true };
});

export const unlockAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ password: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { adminSession, matchesAdminPassword } = await import("./admin-access.server");
    const expected = process.env["ADMIN_ACCESS_PASSWORD"];
    if (!expected) return { ok: false };
    if (!matchesAdminPassword(data.password, expected)) return { ok: false };
    const session = await adminSession();
    await session.update({ unlocked: true });
    return { ok: true };
  });

export const lockAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { adminSession } = await import("./admin-access.server");
  await (await adminSession()).clear();
  return { ok: true };
});