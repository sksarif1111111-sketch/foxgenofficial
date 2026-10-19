import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { db, fetchSummary, fmtDate, money, startOfDay, startOfMonth, type Row, type Summary } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/crm/")({
  head: () => ({
    meta: [
      { title: "CRM Dashboard — FoxGEN Admin" },
      { name: "description", content: "Today's and this month's sales, expenses, fees, refunds and estimated net profit." },
      { property: "og:title", content: "CRM Dashboard — FoxGEN Admin" },
      { property: "og:description", content: "Daily and monthly sales performance at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const now = new Date();
  const tomorrow = new Date(startOfDay(now).getTime() + 86400000);
  const today = useQuery({ queryKey: ["crm", "summary", "today"], queryFn: () => fetchSummary(startOfDay(now), tomorrow) });
  const month = useQuery({ queryKey: ["crm", "summary", "month"], queryFn: () => fetchSummary(startOfMonth(now), tomorrow) });
  const recent = useQuery({
    queryKey: ["crm", "recent-orders"],
    queryFn: async () => {
      const { data, error } = await db
        .from("crm_orders")
        .select("id, order_number, total, currency, status, payment_status, ordered_at, crm_customers(name)")
        .order("ordered_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Net profit = sales − product cost − expenses − payment fees − refunds (estimate).</p>
        </div>
        <Button asChild>
          <Link to="/crm/sale">+ Record a sale</Link>
        </Button>
      </div>

      <SummaryBlock title="Today" q={today} />
      <SummaryBlock title={now.toLocaleDateString(undefined, { month: "long", year: "numeric" })} q={month} />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent orders</h2>
          <Link to="/crm/orders" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {recent.isPending && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
          {recent.data?.length === 0 && <p className="p-4 text-sm text-muted-foreground">No orders yet.</p>}
          {recent.data?.map((o) => (
            <div key={String(o.id)} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
              <div>
                <p className="font-medium">{String(o.order_number)}</p>
                <p className="text-muted-foreground">
                  {String((o.crm_customers as Row | null)?.name ?? "Walk-in")} · {fmtDate(o.ordered_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{money(o.total, String(o.currency))}</p>
                <p className="text-xs text-muted-foreground">
                  {String(o.status)} · {String(o.payment_status).replace(/_/g, " ")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryBlock({ title, q }: { title: string; q: { data?: Summary; isPending: boolean; error: Error | null } }) {
  const s = q.data;
  const cards: [string, number | undefined, string?][] = [
    ["Sales", s?.sales, `${s?.orders ?? 0} order(s)`],
    ["Product cost", s?.cogs],
    ["Expenses", s?.expenses],
    ["Payment fees", s?.fees],
    ["Refunds", s?.refunds],
    ["Est. net profit", s?.net],
  ];
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {q.error && <p className="text-sm text-destructive">{q.error.message}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map(([label, value, sub], i) => (
          <div
            key={label}
            className={`rounded-xl border p-4 ${i === cards.length - 1 ? "border-primary/40 bg-primary/10" : "border-border bg-card"}`}
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${i === cards.length - 1 && (value ?? 0) < 0 ? "text-destructive" : ""}`}>
              {q.isPending ? "…" : money(value)}
            </p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
