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
    if (data.action === "message_customer" || data.action === "approve_and_deliver" || data.action === "adjust_wallet") {
      if (data.action === "message_customer" && !data.order_id && !data.customer_id) return json({ ok: false, error: "INVALID_ACTION_INPUT" }, 400);
      const crm = await import("@/lib/shop-crm-actions.server");
      // Idempotency-Key header wins; otherwise the exact request body identifies a retry.
      const header = request.headers.get("idempotency-key")?.trim();
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
      const requestKey = header && header.length <= 200 ? `key:${header}` : `body:${Array.from(digest, b => b.toString(16).padStart(2, "0")).join("")}`;
      const result = await crm.onceForRequest(requestKey, data.action, () =>
        data.action === "message_customer" ? crm.messageCustomer(data)
        : data.action === "approve_and_deliver" ? crm.approveAndDeliver(data)
        : crm.adjustWallet(data));
      return json(result.body, result.status);
    }
    if (data.action === "upsert_product") {
      const { data: product, error } = await db.rpc("shop_crm_upsert_product", { _input: data });
      if (error) return json({ ok: false, error: "PRODUCT_UPDATE_FAILED" }, 400);
      return json({ ok: true, product_id: product });
    }
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