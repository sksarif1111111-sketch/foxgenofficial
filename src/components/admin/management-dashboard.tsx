import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, CircleCheck, Database, KeyRound, PackageCheck, RefreshCw, ShoppingBag, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { shopSummary } from "@/lib/shopadmin.functions";
import { percentageChange } from "@/lib/admin-dashboard.metrics";
import { adminDashboard } from "@/lib/admin-dashboard.functions";

const money = (n: number, currency: string) => `${currency} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
type Target = "Buying" | "Users" | "Referrals" | "Licenses" | "Bot" | "Extension";

/** Sales analytics from paid orders (Kolkata day/month boundaries, currencies kept separate). */
export function ManagementDashboard({ onOpen }: { onOpen: (section: Target) => void }) {
  const load = useServerFn(adminDashboard);
  const loadShop=useServerFn(shopSummary);
  const operational=useQuery({queryKey:["admin-shop-operations"],queryFn:()=>loadShop(),refetchOnWindowFocus:false});
  const { data, error, isFetching, refetch } = useQuery({ queryKey: ["admin-management-dashboard"], queryFn: () => load(), refetchOnWindowFocus: false });
  const [period, setPeriod] = useState("today");
  if (error)
    return (
      <div role="alert" className="flex items-center gap-3 py-8">
        <p className="text-destructive">Could not load sales figures.</p>
        <Button variant="outline" onClick={() => void refetch()}>Try again</Button>
      </div>
    );
  if (!data) return <div role="status" aria-label="Loading sales figures" className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i=><div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />)}</div>;
  const summary = period === "today" ? data.today : data.month;
  const labels: Array<[string, keyof (typeof summary.totals)[number]]> = [
    ["Sales", "sales"],
    ["Wholesale cost", "cost"],
    ["Other expenses", "expenses"],
    ["Payment fees", "fees"],
    ["Refunds", "refunds"],
    ["Estimated net profit", "net"],
  ];
  const tiles = [
    { label: "Awaiting payment / review", value: data.pending, icon: ShoppingBag, section: "Buying" as const },
    { label: "Awaiting delivery", value: data.delivery, icon: PackageCheck, section: "Buying" as const },
    { label: "Total members", value: data.members, icon: Users, section: "Users" as const },
    { label: "Active members", value: data.active, icon: CircleCheck, section: "Users" as const },
    { label: "Referrals", value: data.referrals, icon: Users, section: "Referrals" as const },
    { label: "Verified referrals", value: data.verified, icon: CircleCheck, section: "Referrals" as const },
    { label: "Redeemed licences", value: data.licenses, icon: KeyRound, section: "Licenses" as const },
    { label: "Paid store orders", value: data.paid, icon: ShoppingBag, section: "Buying" as const },
  ];
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Sales, costs & estimated profit</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Last updated {new Date(data.checkedAt).toLocaleString("en-GB", { timeZone: "Asia/Kolkata" })} · Kolkata time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={period} onValueChange={setPeriod}>
            <TabsList>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="month">This month</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" disabled={isFetching} onClick={() => {void refetch();void operational.refetch();}} className="gap-1.5">
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </header>
      {operational.isError && <p role="alert" className="text-destructive text-sm">Store overview unavailable. <Button variant="link" onClick={()=>void operational.refetch()}>Retry</Button></p>}
      {operational.data && <section className="space-y-3">
        <h3 className="font-semibold">Store today · Kolkata time</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Orders",operational.data.operations.today.orders],["Delivered",operational.data.operations.today.delivered],["Overdue",operational.data.operations.overdue],["Pending review",operational.data.pendingReview],["Wallet change",`$${operational.data.operations.walletChange.toFixed(2)}`],...['USD','INR','XTR','USDT'].map(c=>[`${c} revenue`,`${(operational.data?.operations.today.revenue.find(r=>r.currency===c)?.total??0).toFixed(2)} ${c}`])].map(([label,value])=><div key={label} className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 break-words font-mono text-xl font-bold">{value}</p></div>)}</div>
        <h3 className="font-semibold">This week vs last week</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Orders',operational.data.operations.thisWeek.orders,operational.data.operations.lastWeek.orders],['Delivered',operational.data.operations.thisWeek.delivered,operational.data.operations.lastWeek.delivered],...['USD','USDT','INR','XTR'].map(c=>[`${c} revenue`,operational.data?.operations.thisWeek.revenue.find(r=>r.currency===c)?.total??0,operational.data?.operations.lastWeek.revenue.find(r=>r.currency===c)?.total??0])].map(([label,current,previous])=>{const change=percentageChange(Number(current),Number(previous));return <div key={label} className="border-l border-border pl-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-mono text-sm">{Number(current).toFixed(2)} / {Number(previous).toFixed(2)}</p><p className="text-xs text-muted-foreground">{change===null?'New this week':`${change>=0?'↑':'↓'} ${Math.abs(change)}%`}</p></div>;})}</div>
      </section>}
      <p className="text-sm text-muted-foreground">Paid orders: {summary.orders} · website, bot and manual sales</p>
      {summary.totals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-5 py-6">
          <p className="font-semibold">No paid sales yet for this period</p>
          <p className="mt-1 text-sm text-muted-foreground">Sales 0 · Costs 0 · Profit 0</p>
        </div>
      ) : (
        summary.totals.map((row) => (
          <section key={row.currency} className="space-y-3">
            <p className="eyebrow text-primary">{row.currency}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {labels.map(([label, key]) => (
                <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-soft">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className={`mt-2 break-words font-display text-2xl font-bold tabular-nums ${key === "net" ? "text-primary" : ""}`}>{money(Number(row[key]), row.currency)}</p>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
      <details className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">How profit is calculated</summary>
        <p className="pt-3">
          Net profit = paid sales − wholesale cost saved at the time of sale − other expenses − payment fees − completed refunds. Each currency is
          calculated separately. Telegram Stars sales use the USD price saved on the order; this is not the actual Stars payout.
        </p>
      </details>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((item) => (
          <button key={item.label} type="button" onClick={() => onOpen(item.section)} className="rounded-xl border border-border bg-card p-4 text-left shadow-soft transition hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <item.icon className="size-5 text-primary" />
              <ArrowUpRight className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-3 font-display text-2xl font-bold tabular-nums">{item.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
          </button>
        ))}
      </section>
      <section className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <Database className="size-5 text-primary" />
          <h3 className="font-semibold">Bookkeeping records</h3>
        </div>
        <p className="mt-3 text-sm">Paid store orders {data.paid} · bookkeeping records {data.crmLinked}</p>
        <p className="mt-1 text-sm text-muted-foreground">Website and bot sales are recorded once, when payment is confirmed. Orders awaiting payment are not counted.</p>
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-semibold">Recent orders</h3>
          <Button variant="ghost" onClick={() => onOpen("Buying")} className="gap-1">All orders <ArrowUpRight className="size-4" /></Button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>{["Order", "Buyer", "Channel", "Total", "Status", "Recorded"].map((t) => <th className="whitespace-nowrap px-4 py-3 font-medium" key={t}>{t}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.recent.map((order) => (
                <tr key={order.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium">{order.order_number}</td>
                  <td className="px-4 py-3">{order.customer_name || "—"}</td>
                  <td className="px-4 py-3">{order.channel}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{money(Number(order.total), order.currency)}</td>
                  <td className="px-4 py-3">{order.status.replaceAll("_", " ")}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{order.crmLinked ? "Recorded" : "Payment not confirmed"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.recent.length && <p className="py-8 text-center text-muted-foreground">No orders yet.</p>}
        </div>
      </section>
    </div>
  );
}
