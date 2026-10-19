import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Untyped handle for generic CRM table access; RLS (is_admin) still applies. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as unknown as SupabaseClient<any, "public", any>;

export type Row = Record<string, unknown>;

export function money(v: unknown, currency = "USD") {
  const n = Number(v ?? 0);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function fmtDate(v: unknown) {
  if (!v) return "—";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function csvCell(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const blob = new Blob(["\ufeff" + toCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Orders that count as sales (draft and cancelled are excluded). */
export const SALE_STATUSES = ["pending", "confirmed", "fulfilled", "refunded"] as const;

export type Summary = {
  orders: number;
  sales: number;
  cogs: number;
  expenses: number;
  fees: number;
  refunds: number;
  net: number;
};

/** Sum sales, cost of goods, expenses, payment fees and refunds for [from, to). */
export async function fetchSummary(from: Date, to: Date): Promise<Summary> {
  const f = from.toISOString();
  const t = to.toISOString();
  const fd = f.slice(0, 10);
  const td = t.slice(0, 10);
  const [orders, expenses, payments, refunds] = await Promise.all([
    db
      .from("crm_orders")
      .select("id, total, crm_order_items(line_cost)")
      .in("status", SALE_STATUSES as unknown as string[])
      .gte("ordered_at", f)
      .lt("ordered_at", t),
    db.from("crm_expenses").select("amount").gte("expense_date", fd).lt("expense_date", td),
    db.from("crm_payments").select("fee, paid_at, created_at").eq("status", "completed").gte("created_at", f).lt("created_at", t),
    db.from("crm_refunds").select("amount").in("status", ["approved", "completed"]).gte("created_at", f).lt("created_at", t),
  ]);
  for (const r of [orders, expenses, payments, refunds]) if (r.error) throw r.error;
  const sum = (rows: Row[] | null, k: string) => (rows ?? []).reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const orderRows = (orders.data ?? []) as Row[];
  const sales = sum(orderRows, "total");
  const cogs = orderRows.reduce(
    (a, o) => a + sum((o.crm_order_items as Row[] | null) ?? [], "line_cost"),
    0,
  );
  const exp = sum(expenses.data as Row[], "amount");
  const fees = sum(payments.data as Row[], "fee");
  const ref = sum(refunds.data as Row[], "amount");
  return {
    orders: orderRows.length,
    sales,
    cogs,
    expenses: exp,
    fees,
    refunds: ref,
    net: sales - cogs - exp - fees - ref,
  };
}

export const PAYMENT_METHODS = ["cash", "bank_transfer", "upi", "binance_pay", "crypto", "paypal", "card", "telegram_stars", "other"];
export const SOURCES = ["website", "telegram", "whatsapp", "direct", "referral", "other"];
export const ORDER_STATUSES = ["draft", "pending", "confirmed", "fulfilled", "cancelled", "refunded"];
export const ORDER_PAYMENT_STATUSES = ["unpaid", "partially_paid", "paid", "partially_refunded", "refunded"];
export const PAYMENT_STATUSES = ["pending", "completed", "failed", "cancelled"];
export const REFUND_STATUSES = ["requested", "approved", "completed", "rejected"];
export const EXPENSE_CATEGORIES = ["inventory", "software", "marketing", "hosting", "fees", "salary", "other"];
