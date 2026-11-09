export const ADMIN_SESSION_SECONDS = 60 * 60 * 8;
export function adminDestination(value: unknown): "/admin" | "/hub-admin" {
  return value === "/admin" ? "/admin" : "/hub-admin";
}
export function sessionGrantsAdmin(unlocked: unknown): boolean {
  return unlocked === true;
}
/** Extension licence controls need the Control Center session plus a separate extension unlock. */
export function sessionGrantsExtension(data: { unlocked?: unknown; extension?: unknown } | null | undefined): boolean {
  return data?.unlocked === true && data?.extension === true;
}
