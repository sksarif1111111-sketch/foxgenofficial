import { createFileRoute } from "@tanstack/react-router";
import { balanceReply, creditCors, loadActiveLicense } from "@/lib/license-credits.server";

export const Route = createFileRoute("/api/public/license/credits-balance")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: creditCors }),
      POST: async ({ request }) => {
        let raw: Record<string, unknown> = {};
        try {
          const parsed: unknown = await request.json();
          if (parsed && typeof parsed === "object") raw = parsed as Record<string, unknown>;
        } catch {
          // The key may come from the Bearer header instead of a body.
        }
        const str = (v: unknown) => (typeof v === "string" ? v : undefined);
        const found = await loadActiveLicense(request, {
          licenseKey: str(raw["licenseKey"]),
          key: str(raw["key"]),
          license_key: str(raw["license_key"]),
        });
        if ("response" in found) return found.response;
        return balanceReply(found.row);
      },
    },
  },
});
