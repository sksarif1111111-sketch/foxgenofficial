import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { getBotStats } from "@/lib/bot-stats.functions";
import { money } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/crm/bot")({
  head: () => ({
    meta: [
      { title: "Bot Management — FoxGEN Admin" },
      { name: "description", content: "Telegram bot clients, referrals, bot sales and extension downloads." },
      { property: "og:title", content: "Bot Management — FoxGEN Admin" },
      { property: "og:description", content: "Manage the FoxGEN Telegram bot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BotPage,
});

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function BotPage() {
  const fetchStats = useServerFn(getBotStats);
  const q = useQuery({ queryKey: ["crm", "bot-stats"], queryFn: () => fetchStats() });
  const s = q.data;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Bot Management</h1>
          <p className="text-sm text-muted-foreground">Telegram bot clients, referrals and sales.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/extension" className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
            Get extension
          </a>
          <a href="/hub-admin" className="rounded-xl border border-border px-4 py-2 text-sm font-bold">
            Bot settings
          </a>
          <a href="/admin" className="rounded-xl border border-border px-4 py-2 text-sm font-bold">
            Licences
          </a>
        </div>
      </div>

      {q.isPending && <p className="text-muted-foreground">Loading…</p>}
      {q.error && <p className="text-destructive">Could not load bot data.</p>}
      {s && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total clients" value={s.clients.total} hint={`${s.clients.newWeek} joined in last 7 days`} />
            <Stat label="Verified (active)" value={s.clients.active} />
            <Stat label="Not verified yet" value={s.clients.pending} />
            <Stat label="Paying clients" value={s.clients.buyers} />
          </section>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Bot orders" value={s.orders.total} hint={`${s.orders.open} open`} />
            <Stat label="Paid bot orders" value={s.orders.paid} />
            <Stat label="Bot revenue" value={money(s.orders.revenueUsd, "USD")} hint={`${s.orders.stars} Stars`} />
            <Stat label="Referrals" value={s.referrals.total} hint={`${s.referrals.rewarded} rewarded`} />
          </section>
          <section className="rounded-2xl border border-border bg-card">
            <h2 className="border-b border-border px-5 py-3 font-bold">Newest clients</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2">Client</th>
                    <th className="px-5 py-2">Status</th>
                    <th className="px-5 py-2">Credits</th>
                    <th className="px-5 py-2">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recent.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-5 py-2">{r.telegram_username ? `@${r.telegram_username}` : r.first_name ?? "—"}</td>
                      <td className="px-5 py-2">{r.status}</td>
                      <td className="px-5 py-2">{r.credits_available}</td>
                      <td className="px-5 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
