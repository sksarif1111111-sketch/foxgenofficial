export async function shopApproveOrder(data: { id: string; notes?: string; send?: boolean }, actor: "admin" | "crm" = "admin") {
    const { db, logActivity } = await import("@/lib/hub.server");
    const { orderEvent, notifyBuyerTelegram, sendFulfillmentEmail, orderRequiresEmail, sendTelegramDelivery } = await import("@/lib/shop.server");
    const { data: order } = await db.from("shop_orders").select("*").eq("id", data.id).maybeSingle();
    if (!order) throw new Error("Order not found.");
    const requiresEmail = await orderRequiresEmail(order);
    const awaitingEmail = requiresEmail && !order.delivery_emails && (order.channel === "telegram" || order.telegram_user_id != null);

    if (!order.stock_consumed) {
      const now = new Date().toISOString();
      const { data: updated } = await db
        .from("shop_orders")
        .update({
          status: awaitingEmail ? "awaiting_email" : "awaiting_fulfillment",
          stock_consumed: true,
          confirmed_at: now,
          reviewed_at: now,
          review_notes: data.notes ?? null,
          updated_at: now,
        })
        .eq("id", data.id)
        .eq("stock_consumed", false)
        .in("status", ["payment_submitted", "awaiting_email", "under_review"])
        .select("id");
      if (!updated || updated.length === 0) {
        if (!data.send) throw new Error("This order is not waiting for payment approval.");
      } else {
        await orderEvent(data.id, "payment_confirmed", actor, data.notes ?? "");
        await logActivity("shop", "Payment approved", "success", order.order_number);
        await notifyBuyerTelegram(
          data.id,
          awaitingEmail ? "Payment successful. This product requires an email. Please send your delivery email address here." : "Payment successful. Please wait while we prepare your access. We will notify you when your access is ready.",
        );
      }
    }

    if (data.send) {
      const channels: Record<string, string> = {};
      if (order.delivery_emails || requiresEmail) {
        const result = await sendFulfillmentEmail(data.id, actor);
        channels['email'] = result.ok ? 'sent' : result.reason ?? 'email_send_failed';
      }
      if (order.telegram_user_id) {
        const result = await sendTelegramDelivery(data.id, actor);
        channels['telegram'] = result.ok ? 'sent' : result.reason ?? 'telegram_send_failed';
      }
      const sent = Object.values(channels).includes('sent');
      return { ok: sent, delivery: sent ? 'sent' : 'delivery_failed', channels };
    }
    return { ok: true, delivery: "pending" };
}

export async function shopRejectOrder(data: { id: string; reason: string }, actor: "admin" | "crm" = "admin") {
    const { db, logActivity } = await import("@/lib/hub.server");
    const { orderEvent, notifyBuyerTelegram, refundWalletOrder } = await import("@/lib/shop.server");
    const { data: order } = await db.from("shop_orders").select("*").eq("id", data.id).maybeSingle();
    if (!order) throw new Error("Order not found.");
    const result=await db.rpc("shop_cancel_atomic",{_id:data.id,_status:"rejected",_reason:data.reason,_actor:actor});
    if(result.error)throw new Error(result.error.message);
    await logActivity("shop", "Payment rejected", "warning", `${order.order_number} — ${data.reason}`);
    await notifyBuyerTelegram(
      data.id,
      `Your order ${order.order_number} could not be confirmed.\nReason: ${data.reason}\nIf you believe this is a mistake, contact support with your transaction reference.`,
    );
    return { ok: true };
}

export async function shopRequestInfo(data: { id: string; message: string }, actor: "admin" | "crm" = "admin") {
    const { db } = await import("@/lib/hub.server");
    const { orderEvent, notifyBuyerTelegram } = await import("@/lib/shop.server");
    const { data: order } = await db.from("shop_orders").select("order_number").eq("id", data.id).maybeSingle();
    if (!order) throw new Error("Order not found.");
    await db
      .from("shop_orders")
      .update({ info_request: data.message, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    await orderEvent(data.id, "info_requested", actor, data.message);
    await notifyBuyerTelegram(
      data.id,
      `We need a little more information for order ${order.order_number}:\n${data.message}`,
    );
    return { ok: true };
}

export async function shopAddFulfillment(data: { id: string; kind: "link" | "code" | "instructions"; content: string }, actor: "admin" | "crm" = "admin") {
    const { db } = await import("@/lib/hub.server");
    const { orderEvent } = await import("@/lib/shop.server");
    const { data: order } = await db.from("shop_orders").select("id").eq("id", data.id).maybeSingle();
    if (!order) throw new Error("Order not found.");
    const { error } = await db.from("shop_fulfillments").insert({ order_id: data.id, kind: data.kind, content: data.content });
    if (error) throw new Error("Could not save delivery material.");
    await orderEvent(data.id, "fulfillment_added", actor, data.kind);
    return { ok: true };
}
