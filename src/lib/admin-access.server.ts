import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { useSession, setResponseHeader, setResponseStatus } from "@tanstack/react-start/server";
import { ADMIN_SESSION_SECONDS, sessionGrantsAdmin } from "./admin-access.policy";

export function matchesAdminPassword(input: string, expected: string) {
  return timingSafeEqual(createHash("sha256").update(input).digest(), createHash("sha256").update(expected).digest());
}

export async function adminSession() {
  const secret = process.env["ADMIN_SESSION_SECRET"];
  const password = process.env["ADMIN_ACCESS_PASSWORD"];
  if (!secret || !password) throw new Error("Admin access is not configured.");
  setResponseHeader("Cache-Control", "no-store");
  // Rotating the password changes the encryption key, invalidating prior sessions.
  return useSession<{ unlocked?: boolean }>({
    password: createHmac("sha256", secret).update(password).digest("hex"),
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