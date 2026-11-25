import { createFileRoute } from "@tanstack/react-router";

const base = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const json = (body: unknown, status: number) => Response.json(body, { status, headers: base });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/public/shop/v1/payment-proof/$id")({
  server: { handlers: { GET: async ({ request, params }) => {
    const { keyMatches } = await import("@/lib/shop-api.server");
    const { validKeyHeader } = await import("@/lib/shop-api.contract");
    const key = process.env["SHOP_CRM_ACTION_KEY"];
    const supplied = validKeyHeader(request.headers.get("authorization"));
    if (!key || !supplied || !await keyMatches(supplied, key)) return json({ ok: false, error: "UNAUTHORIZED" }, 401);
    if (!UUID.test(params.id)) return json({ ok: false, error: "INVALID_ID" }, 400);
    const { db } = await import("@/lib/hub.server");
    const { loadProof, proofHeaders } = await import("@/lib/payment-proof.server");
    const order = await db.from("shop_orders").select("payment_evidence_url").eq("id", params.id).maybeSingle();
    if (order.error) return json({ ok: false, error: "UPSTREAM_FAILED" }, 502);
    const proof = await loadProof(order.data?.payment_evidence_url);
    if (!proof.ok) return proof.status === 404 ? json({ ok: false, error: "PROOF_NOT_FOUND" }, 404) : json({ ok: false, error: "UPSTREAM_FAILED" }, 502);
    return new Response(proof.bytes as Uint8Array<ArrayBuffer>, { headers: proofHeaders(proof.type) });
  } } },
});
