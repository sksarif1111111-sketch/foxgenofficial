import { createMiddleware } from "@tanstack/react-start";

export const requireAdminPassword = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { requireAdminAccess } = await import("./admin-access.server");
  await requireAdminAccess();
  return next();
});

/** Licence-management functions: Control Center session plus the extension unlock. */
export const requireExtensionPassword = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { requireExtensionAccess } = await import("./admin-access.server");
  await requireExtensionAccess();
  return next();
});
