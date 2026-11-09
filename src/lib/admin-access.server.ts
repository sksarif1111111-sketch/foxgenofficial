import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { useSession, setResponseHeader, setResponseStatus } from "@tanstack/react-start/server";
import { ADMIN_SESSION_SECONDS, sessionGrantsAdmin, sessionGrantsExtension } from "./admin-access.policy";

export type AdminSessionData = { unlocked?: boolean; extension?: boolean };

export function matchesAdminPassword(input: string, expected: string) {
  return timingSafeEqual(createHash("sha256").update(input).digest(), createHash("sha256").update(expected).digest());
}

/** Extension admin password: its own secret when configured, otherwise the Control Center password. */
export function extensionPassword() {
  return process.env["EXTENSION_ADMIN_PASSWORD"] || process.env["ADMIN_ACCESS_PASSWORD"] || "";
}

export async function adminSession() {
  const secret = process.env["ADMIN_SESSION_SECRET"];
  const password = process.env["ADMIN_ACCESS_PASSWORD"];
  if (!secret || !password) throw new Error("Admin access is not configured.");
  setResponseHeader("Cache-Control", "no-store");
  // Rotating either password changes the encryption key, invalidating prior sessions.
  return useSession<AdminSessionData>({
    password: createHmac("sha256", secret).update(password).update(process.env["EXTENSION_ADMIN_PASSWORD"] ?? "").digest("hex"),
    name: "foxgen-admin",
    maxAge: ADMIN_SESSION_SECONDS,
    cookie: { httpOnly: true, secure: true, sameSite: "strict", path: "/" },
  });
}

export async function requireAdminAccess() {
  const session = await adminSession();
  if (!sessionGrantsAdmin(session.data.unlocked)) {
    setResponseStatus(401);
    throw new Error("Admin sign-in required.");
  }
}

export async function requireExtensionAccess() {
  const session = await adminSession();
  if (!sessionGrantsExtension(session.data)) {
    setResponseStatus(401);
    throw new Error("Extension admin unlock required.");
  }
}
