import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";

function matches(input: string, expected: string) {
  return timingSafeEqual(createHash("sha256").update(input).digest(), createHash("sha256").update(expected).digest());
}

/** Scheduled supplier sync. Callers must send the CRON_SECRET in the `x-cron-secret` header. */
export const Route = createFileRoute("/api/public/cron/supplier-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["CRON_SECRET"];
        if (!expected) return Response.json({ ok: false, error: "Scheduled sync is not configured." }, { status: 503 });
        const given = request.headers.get("x-cron-secret") ?? "";
        if (!given || !matches(given, expected)) return Response.json({ ok: false }, { status: 401 });
        const { syncSuppliers } = await import("@/lib/reseller.server");
        try {
          const result = await syncSuppliers("auto");
          return Response.json({ ok: true, suppliers: result.suppliers.map((s) => ({ id: s.id, ok: s.ok, total: s.total })) });
        } catch (err) {
          return Response.json({ ok: false, error: err instanceof Error ? err.message : "Sync failed" }, { status: 502 });
        }
      },
    },
  },
});
