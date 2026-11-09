import { expect, test } from "bun:test";
import { adminDestination, sessionGrantsAdmin } from "./admin-access.policy";
test("Admin access requires a server-verified unlock", () => {
  expect(sessionGrantsAdmin(true)).toBe(true);
  for (const value of [false, undefined, null, "true", 1]) expect(sessionGrantsAdmin(value)).toBe(false);
});
test("Admin login cannot redirect to another site or restore CRM pages", () => {
  expect(adminDestination("/admin")).toBe("/admin");
  expect(adminDestination("/hub-admin")).toBe("/hub-admin");
  expect(adminDestination("https://example.com")).toBe("/hub-admin");
  expect(adminDestination("/crm")).toBe("/hub-admin");
});