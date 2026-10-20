import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db, downloadCsv, money, SALE_STATUSES, type Row } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/crm/reports")({
  head: () => ({
    meta: [
      { title: "Reports — FoxGEN CRM" },
      { name: "description", content: "Monthly profit, product and source reports with CSV export." },
      { property: "og:title", content: "Reports — FoxGEN CRM" },
      { property: "og:description", content: "Sales and profit reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
});

type Agg = { key: string; orders: number; units: number; sales: number; cogs: number; expenses: number; fees: number; refunds: number };
const blank = (key: string): Agg => ({ key, orders: 0, units: 0, sales: 0, cogs: 0, expenses: 0, fees: 0, refunds: 0 });
const net = (a: Agg) => a.sales - a.cogs - a.expenses - a.fees - a.refunds;
const n = (v: unknown) => Number(v ?? 0);

function ReportsPage() {
  const year = new Date().getFullYear();
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const data = useQuery({
    queryKey: ["crm", "reports", from, to],
    queryFn: async () => {
      const end = new Date(to);
      end.setDate(end.getDate() + 1);
      const t = end.toISOString().slice(0, 10);
      const [orders, expenses, payments, refunds] = await Promise.all([
        db
          .from("crm_orders")
          .select("id, ordered_at, total, source, crm_order_items(product_name, quantity, line_total, line_cost)")
          .in("status", SALE_STATUSES as unknown as string[])
          .gte("ordered_at", from)
          .lt("ordered_at", t)
          .limit(10000),
        db.from("crm_expenses").select("expense_date, amount, category").gte("expense_date", from).lt("expense_date", t).limit(10000),
        db.from("crm_payments").select("created_at, method, amount, fee").eq("status", "completed").gte("created_at", from).lt("created_at", t).limit(10000),
        db.from("crm_refunds").select("created_at, amount").in("status", ["approved", "completed"]).gte("created_at", from).lt("created_at", t).limit(10000),
      ]);
      for (const r of [orders, expenses, payments, refunds]) if (r.error) throw r.error;
      return {
        orders: (orders.data ?? []) as unknown as Row[],
        expenses: (expenses.data ?? []) as unknown as Row[],
        payments: (payments.data ?? []) as unknown as Row[],
        refunds: (refunds.data ?? []) as unknown as Row[],
      };
    },
  });

  const reports = useMemo(() => {
    const d = data.data;
    if (!d) return null;
    const month = new Map<string, Agg>();
    const product = new Map<string, Agg>();
    const source = new Map<string, Agg>();
    const method = new Map<string, Agg>();
    const get = (m: Map<string, Agg>, k: string) => {
      if (!m.has(k)) m.set(k, blank(k));
      return m.get(k)!;
    };
    for (const o of d.orders) {
      const items = (o.crm_order_items as Row[] | null) ?? [];
      const cogs = items.reduce((a, i) => a + n(i.line_cost), 0);
      const units = items.reduce((a, i) => a + n(i.quantity), 0);
      for (const a of [get(month, String(o.ordered_at).slice(0, 7)), get(source, String(o.source ?? "unknown"))]) {
        a.orders++;
        a.units += units;
        a.sales += n(o.total);
        a.cogs += cogs;
      }
      for (const i of items) {
        const a = get(product, String(i.product_name));
        a.orders++;
        a.units += n(i.quantity);
        a.sales += n(i.line_total);
        a.cogs += n(i.line_cost);
      }
    }
    for (const e of d.expenses) get(month, String(e.expense_date).slice(0, 7)).expenses += n(e.amount);
    for (const p of d.payments) {
      get(month, String(p.created_at).slice(0, 7)).fees += n(p.fee);
      const a = get(method, String(p.method));
      a.orders++;
      a.sales += n(p.amount);
      a.fees += n(p.fee);
    }
    for (const r of d.refunds) get(month, String(r.created_at).slice(0, 7)).refunds += n(r.amount);
    const sortBy = (m: Map<string, Agg>, fn: (a: Agg, b: Agg) => number) => [...m.values()].sort(fn);
    const months = sortBy(month, (a, b) => a.key.localeCompare(b.key));
    const total = months.reduce((t, a) => {
      for (const k of ["orders", "units", "sales", "cogs", "expenses", "fees", "refunds"] as const) t[k] += a[k];
      return t;
    }, blank("Total"));
    return {
      months,
      total,
      products: sortBy(product, (a, b) => b.sales - a.sales),
      sources: sortBy(source, (a, b) => b.sales - a.sales),
      methods: sortBy(method, (a, b) => b.sales - a.sales),
    };
  }, [data.data]);

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">All amounts are summed as-is; keep one currency for accurate totals.</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      </div>

      {data.isPending && <p className="text-muted-foreground">Loading…</p>}
      {data.error && <p className="text-destructive">{(data.error as Error).message}</p>}

      {reports && (
        <>
          <ReportTable
            title="Profit by month"
            file="profit-by-month"
            rows={[...reports.months, reports.total]}
            cols={[
              ["Month", (a) => a.key],
              ["Orders", (a) => a.orders],
              ["Sales", (a) => a.sales, true],
              ["Product cost", (a) => a.cogs, true],
              ["Expenses", (a) => a.expenses, true],
              ["Fees", (a) => a.fees, true],
              ["Refunds", (a) => a.refunds, true],
              ["Est. net profit", net, true],
            ]}
          />
          <ReportTable
            title="By product"
            file="sales-by-product"
            rows={reports.products}
            cols={[
              ["Product", (a) => a.key],
              ["Units", (a) => a.units],
              ["Sales", (a) => a.sales, true],
              ["Product cost", (a) => a.cogs, true],
              ["Gross profit", (a) => a.sales - a.cogs, true],
            ]}
          />
          <div className="grid gap-8 lg:grid-cols-2">
            <ReportTable
              title="By source"
              file="sales-by-source"
              rows={reports.sources}
              cols={[
                ["Source", (a) => a.key],
                ["Orders", (a) => a.orders],
                ["Sales", (a) => a.sales, true],
                ["Gross profit", (a) => a.sales - a.cogs, true],
              ]}
            />
            <ReportTable
              title="By payment method"
              file="payments-by-method"
              rows={reports.methods}
              cols={[
                ["Method", (a) => a.key],
                ["Payments", (a) => a.orders],
                ["Received", (a) => a.sales, true],
                ["Fees", (a) => a.fees, true],
              ]}
            />
          </div>
        </>
      )}
    </section>
  );
}

function ReportTable({
  title,
  file,
  rows,
  cols,
}: {
  title: string;
  file: string;
  rows: Agg[];
  cols: [string, (a: Agg) => string | number, boolean?][];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button
          size="sm"
          variant="outline"
          disabled={!rows.length}
          onClick={() =>
            downloadCsv(
              `${file}.csv`,
              cols.map((c) => c[0]),
              rows.map((r) => cols.map(([, fn, isMoney]) => (isMoney ? Number(fn(r)).toFixed(2) : fn(r)))),
            )
          }
        >
          Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map(([h, , m]) => (
                <TableHead key={h} className={m ? "text-right" : ""}>
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={cols.length} className="text-muted-foreground">
                  No data for this period.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.key} className={r.key === "Total" ? "font-semibold" : ""}>
                  {cols.map(([h, fn, m]) => (
                    <TableCell key={h} className={m ? "text-right tabular-nums" : ""}>
                      {m ? money(fn(r)) : fn(r)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
