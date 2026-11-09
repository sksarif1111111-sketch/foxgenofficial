import { createServerFn } from "@tanstack/react-start";
import { requireAdminPassword } from "./admin-access.middleware";
import { financialTotals, kolkataPeriods, PAID_SHOP_STATUSES } from "./admin-dashboard.metrics";

export const adminDashboard = createServerFn({ method: "POST" }).middleware([requireAdminPassword]).handler(async () => {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const period = kolkataPeriods();
  async function summary(from: string, date: string) {
    // Page every source: PostgREST's row cap must not silently reduce financial totals.
    async function pages<T>(query: (start: number, end: number) => PromiseLike<{data: T[] | null; error: unknown}>) {
      const rows: T[] = [];
      for (let start = 0; ; start += 500) {
        const result = await query(start, start + 499);
        if (result.error) throw new Error("Financial records could not be loaded.");
        rows.push(...(result.data ?? []));
        if ((result.data?.length ?? 0) < 500) return rows;
      }
    }
    const [orders, expenses, payments, refunds] = await Promise.all([
      pages((start,end) => db.from("crm_orders").select("id,currency,total,crm_order_items(line_cost)").in("payment_status", ["paid", "partially_refunded", "refunded"]).neq("status", "cancelled").gte("ordered_at",from).lte("ordered_at",period.end).order("id").range(start,end)),
      pages((start,end) => db.from("crm_expenses").select("id,currency,amount").gte("expense_date",date).lte("expense_date",period.day).order("id").range(start,end)),
      pages((start,end) => db.from("crm_payments").select("id,currency,fee").eq("status","completed").gte("paid_at",from).lte("paid_at",period.end).order("id").range(start,end)),
      pages((start,end) => db.from("crm_refunds").select("id,currency,amount").eq("status","completed").gte("refunded_at",from).lte("refunded_at",period.end).order("id").range(start,end)),
    ]);
    return { orders: orders.length, totals: financialTotals(orders.map(o => ({ currency:o.currency, total:Number(o.total), cost:(o.crm_order_items ?? []).reduce((n,i) => n + Number(i.line_cost),0) })), expenses, payments, refunds) };
  }
  const [today, month, recent, pending, delivery, paid, members, active, referrals, verified, licenses, crmLinked] = await Promise.all([
    summary(period.todayStart,period.day), summary(period.monthStart,period.month),
    db.from("shop_orders").select("id,order_number,customer_name,channel,status,currency,total,created_at").order("created_at",{ascending:false}).limit(15),
    db.from("shop_orders").select("id",{count:"exact",head:true}).in("status",["awaiting_payment","payment_submitted","under_review","info_requested"]),
    db.from("shop_orders").select("id",{count:"exact",head:true}).in("status",["awaiting_email","awaiting_fulfillment"]),
    db.from("shop_orders").select("id",{count:"exact",head:true}).in("status",PAID_SHOP_STATUSES),
    db.from("profiles").select("id",{count:"exact",head:true}),
    db.from("profiles").select("id",{count:"exact",head:true}).eq("status","active"),
    db.from("referrals").select("id",{count:"exact",head:true}),
    db.from("referrals").select("id",{count:"exact",head:true}).eq("status","verified"),
    db.from("license_redemptions").select("id",{count:"exact",head:true}),
    db.from("crm_orders").select("id",{count:"exact",head:true}).like("external_order_id","shop:%"),
  ]);
  if ([recent,pending,delivery,paid,members,active,referrals,verified,licenses,crmLinked].some(r => r.error)) throw new Error("Admin statistics could not be loaded.");
  const withCrm = recent.data?.length ? await db.from("crm_orders").select("external_order_id").in("external_order_id",recent.data.map(r => `shop:${r.id}`)) : {data:[],error:null};
  if(withCrm.error) throw new Error("CRM connection could not be checked.");
  const linked = new Set(withCrm.data?.map(r => r.external_order_id));
  return { today, month, checkedAt:period.end, pending:pending.count ?? 0, delivery:delivery.count ?? 0, paid:paid.count ?? 0, members:members.count ?? 0, active:active.count ?? 0, referrals:referrals.count ?? 0, verified:verified.count ?? 0, licenses:licenses.count ?? 0, crmLinked:crmLinked.count ?? 0, recent:(recent.data ?? []).map(r => ({...r,crmLinked:linked.has(`shop:${r.id}`)})) };
});