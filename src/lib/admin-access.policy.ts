export const ADMIN_SESSION_SECONDS = 60 * 60 * 8;
export function adminDestination(value: unknown): "/admin" | "/hub-admin" {
  return value === "/admin" ? "/admin" : "/hub-admin";
}
export function sessionGrantsAdmin(unlocked: unknown): boolean {
  return unlocked === true;
}