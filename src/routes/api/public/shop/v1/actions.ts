import { createFileRoute } from "@tanstack/react-router";
import { shopActionSchema } from "@/lib/shop-actions.contract";

export const Route = createFileRoute("/api/public/shop/v1/actions")({
  server: { handlers: { POST: async ({ request }) => {
    const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
    const key = process.env["SHOP_CRM_ACTION_KEY"];
    const { keyMatches } = await import("@/lib/shop-api.server");
    const supplied = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
    if (!key || !supplied || !await keyMatches(supplied, key)) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 16384) return json({ ok: false, error: "BODY_TOO_LARGE" }, 400);
    let input: unknown;
    try { input = JSON.parse(raw); } catch { return json({ ok: false, error: "INVALID_JSON" }, 400); }
    const parsed = shopActionSchema.safeParse(input);
    if (!parsed.success) return json({ ok: false, error: "INVALID_ACTION_INPUT" }, 400);
    const data = parsed.data;
    const { db } = await import("@/lib/hub.server");
    const { data: order, error } = await db.from("shop_orders").select("id").eq("id", data.order_id).maybeSingle();
    if (error) return json({ ok: false, error: "SERVICE_UNAVAILABLE" }, 503);
    if (!order) return json({ ok: false, error: "ORDER_NOT_FOUND" }, 404);
    const actions = await import("@/lib/shop-actions.server");
    const delivery = await import("@/lib/shop.server");
    try {
      let result: { ok: boolean; reason?: string; delivery?: string };
      switch (data.action) {
        case "approve": result = await actions.shopApproveOrder({ id: data.order_id, notes: data.notes, send: data.send }, "crm"); break;
        case "reject": result = await actions.shopRejectOrder({ id: data.order_id, reason: data.reason }, "crm"); break;
        case "request_info": result = await actions.shopRequestInfo({ id: data.order_id, message: data.message }, "crm"); break;
        case "add_fulfillment": result = await actions.shopAddFulfillment({ id: data.order_id, kind: data.kind, content: data.content }, "crm"); break;
        case "deliver_email": result = await delivery.sendFulfillmentEmail(data.order_id, "crm"); break;
        case "deliver_telegram": result = await delivery.sendTelegramDelivery(data.order_id, "crm"); break;
      }
      return json(result, result.ok ? 200 : 400);
    } catch {
      return json({ ok: false, error: "ACTION_NOT_ALLOWED", message: "Check the order state and delivery material before retrying." }, 400);
    }
  } } },
});