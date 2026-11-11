import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/cron/crm-sync")({ server: { handlers: { POST: async ({ request }) => {
  const denied = await authenticateCronRequest(request);
  if (denied) return denied;
  try {
    const { flushCrmOutbox } = await import("@/lib/shop-crm.server");
    const result = await flushCrmOutbox();
    return Response.json(result, { status: result.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ ok: false, error: "SYNC_UNAVAILABLE" }, { status: 503 }); }
} } } });