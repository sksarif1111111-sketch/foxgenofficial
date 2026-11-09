import { createMiddleware } from "@tanstack/react-start";

export const requireAdminPassword = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { requireAdminAccess } = await import("./admin-access.server");
  await requireAdminAccess();
  return next();
});