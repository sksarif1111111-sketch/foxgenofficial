import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/shop/v1/$resource")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { handleShopApi } = await import("@/lib/shop-api.server");
        return handleShopApi(request, params.resource);
      },
    },
  },
});