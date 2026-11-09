import { externalOrderId, normalizeChannel, paidStatuses, querySchema, resourceSchema, validKeyHeader } from "./shop-api.contract";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });

async function keyMatches(a: string, b: string) {
  const digest = (s: string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  const x = new Uint8Array(left), y = new Uint8Array(right);
  let difference = 0;
  for (let i = 0; i < x.length; i++) difference |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return difference === 0;
}

export async function handleShopApi(request: Request, resource: string) {
  const configured = process.env["SHOP_CRM_API_KEY"];
  const supplied = validKeyHeader(request.headers.get("authorization"));
  if (!configured || configured.length < 32) return json({ error: "API_NOT_CONFIGURED" }, 503);
  if (!supplied || !await keyMatches(supplied, configured)) return json({ error: "UNAUTHORIZED" }, 401);
  const parsedResource = resourceSchema.safeParse(resource);
  if (!parsedResource.success) return json({ error: "NOT_FOUND" }, 404);
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return json({ error: "INVALID_QUERY" }, 400);
  const q = parsed.data;
  const until = q.until ?? new Date().toISOString();
  const r = parsedResource.data;
  if (r === "health") return json({ version: "1", status: "ok", access: "read_only", resources: ["products", "orders", "sales", "bot"] });

  try {
    // External bearer credential grants only the narrow projections below.
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    if (r === "bot") {
      const [clients, orders, paid] = await Promise.all([
        db.from("profiles").select("id", { count: "exact", head: true }),
        db.from("shop_orders").select("id", { count: "exact", head: true }).in("channel", ["bot", "telegram"]),
        db.from("shop_orders").select("id", { count: "exact", head: true }).in("channel", ["bot", "telegram"]).in("status", [...paidStatuses]),
      ]);
      if (clients.error || orders.error || paid.error) throw new Error("Bot summary query failed");
      return json({ clients: clients.count ?? 0, orders: orders.count ?? 0, paid_orders: paid.count ?? 0, generated_at: until });
    }

    const filter = <T extends {
      gte: (column: string, value: string) => T;
      lte: (column: string, value: string) => T;
      or: (filter: string) => T;
      order: (column: string, options: { ascending: boolean }) => T;
      limit: (value: number) => T;
    }>(query: T): T => {
      let result = query.lte("updated_at", until);
      if (q.since) result = result.gte("updated_at", q.since);
      if (q.cursor_time && q.cursor_id) {
        result = result.or(`updated_at.gt.${q.cursor_time},and(updated_at.eq.${q.cursor_time},id.gt.${q.cursor_id})`);
      }
      return result.order("updated_at", { ascending: true }).order("id", { ascending: true }).limit(q.limit + 1);
    };
    const page = <T extends { id: string; updated_at: string }>(rows: T[]) => {
      const data = rows.slice(0, q.limit);
      const last = data.at(-1);
      return { data, until, has_more: rows.length > q.limit,
        next_cursor: rows.length > q.limit && last ? { cursor_time: last.updated_at, cursor_id: last.id } : null };
    };

    if (r === "products") {
      const result = await filter(db.from("products").select("id,name,slug,short_description,product_type,price_usdt,price_inr,price_stars,stock_mode,stock_quantity,availability,status,shop_published,logo_url,image_url,updated_at").eq("shop_published", true).neq("status", "archived"));
      if (result.error) throw result.error;
      return json(page(result.data ?? []));
    }
    let ordersQuery = db.from("shop_orders").select("id,order_number,channel,status,currency,total,stars_total,payment_method_name,created_at,updated_at,confirmed_at,delivered_at");
    if (r === "sales") ordersQuery = ordersQuery.in("status", [...paidStatuses]);
    if (q.channel) ordersQuery = ordersQuery.in("channel", normalizeChannel(q.channel) === "Bot" ? ["bot", "telegram"] : ["web", "website"]);
    const orders = await filter(ordersQuery);
    if (orders.error) throw orders.error;
    const result = page(orders.data ?? []);
    const ids = result.data.map((o) => o.id);
    const items = ids.length ? await db.from("shop_order_items").select("id,order_id,product_id,product_name,quantity,currency,unit_price,unit_stars,line_total").in("order_id", ids) : { data: [], error: null };
    if (items.error) throw items.error;
    const crm = ids.length ? await db.from("crm_orders").select("external_order_id,currency,total,crm_order_items(product_name,quantity,unit_sale_price,unit_cost_price,line_total,line_cost)").in("external_order_id", ids.map(externalOrderId)) : { data: [], error: null };
    if (crm.error) throw crm.error;
    return json({ ...result, data: result.data.map((o) => ({ ...o,
      external_order_id: externalOrderId(o.id), source: normalizeChannel(o.channel),
      items: (items.data ?? []).filter((i) => i.order_id === o.id),
      accounting: (crm.data ?? []).find((c) => c.external_order_id === externalOrderId(o.id)) ?? null,
    })) });
  } catch (error) {
    console.error("Shop CRM API query failed", error);
    return json({ error: "SERVICE_UNAVAILABLE" }, 503);
  }
}