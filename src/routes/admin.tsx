import { adminAccessStatus } from "@/lib/admin-access.functions";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, Check, CheckCircle2, Copy, KeyRound, Plus, RefreshCw, Search, Timer, Trash2, Zap } from "lucide-react";
import { AdminShell, MetricCard } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  deleteLicense,
  generateLicense,
  listLicenses,
  setLicenseStatus,
  type LicenseRow,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const status = await adminAccessStatus();
    if (!status.unlocked) throw redirect({ to: "/admin-access", search: { redirect: "/admin" } });
  },
  head: () => ({
    meta: [
      { title: "Licence Center — FoxGEN Pro Control" },
      {
        name: "description",
        content:
          "Generate 15, 30, 60 day or fully custom FoxGEN license keys and manage every key in one place.",
      },
      { property: "og:title", content: "Licence Center — FoxGEN Pro Control" },
      { property: "og:description", content: "Generate and manage FoxGEN Pro license keys." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const PLANS = [15, 30, 60] as const;

const UNITS = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
} as const;

type Unit = keyof typeof UNITS;

function fmt(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function duration(row: LicenseRow) {
  const s = row.duration_seconds ?? (row.plan_days ?? 0) * 86400;
  if (s >= 86400) return `${Math.round(s / 86400)}d`;
  if (s >= 3600) return `${Math.round(s / 3600)}h`;
  if (s >= 60) return `${Math.round(s / 60)}m`;
  return `${s}s`;
}

function AdminPage() {
  const load = useServerFn(listLicenses);
  const create = useServerFn(generateLicense);
  const setStatus = useServerFn(setLicenseStatus);
  const remove = useServerFn(deleteLicense);

  const [rows, setRows] = useState<LicenseRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [amount, setAmount] = useState("30");
  const [unit, setUnit] = useState<Unit>("minutes");
  const [keyName, setKeyName] = useState("");

  const refresh = useCallback(async () => {
    try {
      setRows(await load({ data: undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load licenses.");
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function generate(durationSeconds: number, tag: string) {
    setBusy(tag);
    setError(null);
    try {
      const row = await create({ data: { durationSeconds, name: keyName.trim() || undefined } });
      setRows((prev) => [row, ...prev]);
      await navigator.clipboard.writeText(row.license_key).catch(() => undefined);
      setCopied(row.license_key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the key.");
    } finally {
      setBusy(null);
    }
  }

  function onCustom() {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < 1) {
      setError("Enter a duration of at least 1.");
      return;
    }
    void generate(n * UNITS[unit], "custom");
  }

  const [filter, setFilter] = useState<"all" | "active" | "blocked" | "unused">("all");
  const [query, setQuery] = useState("");

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status === "active").length;
    const activated = rows.filter((r) => r.activated_at).length;
    return { total: rows.length, active, blocked: rows.length - active, activated };
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toUpperCase();
    return rows.filter((r) => {
      if (filter === "active" && r.status !== "active") return false;
      if (filter === "blocked" && r.status === "active") return false;
      if (filter === "unused" && r.activated_at) return false;
      return !q || r.license_key.toUpperCase().includes(q);
    });
  }, [rows, filter, query]);

  const fieldCls =
    "h-11 rounded-xl border border-input bg-card px-3.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/20";

  return (
    <AdminShell
      active="Generator"
      actions={
        <Button variant="outline" size="sm" onClick={() => void refresh()} className="gap-1.5">
          <RefreshCw className="size-3.5" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      }
    >
      <div className="space-y-8">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Total keys" value={stats.total} icon={KeyRound} />
          <MetricCard label="Active" value={stats.active} icon={CheckCircle2} tone="success" />
          <MetricCard label="Activated on a device" value={stats.activated} icon={Zap} tone="primary" />
          <MetricCard label="Blocked" value={stats.blocked} icon={Ban} tone="danger" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Generate a licence</h2>
                <p className="mt-1 text-sm text-muted-foreground">The clock starts when the extension first activates the key. Keys are copied automatically.</p>
              </div>
            </div>
            <label className="mt-5 block text-sm font-medium" htmlFor="key-name">
              Key prefix <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="key-name"
              value={keyName}
              maxLength={24}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="RAM → RAM-AB3-K9X · empty → FOXGEN-XXX-XXX"
              className={`${fieldCls} mt-1.5 w-full font-mono uppercase`}
            />
            <div className="mt-5 grid grid-cols-3 gap-3">
              {PLANS.map((plan) => (
                <button
                  key={plan}
                  onClick={() => generate(plan * 86400, String(plan))}
                  disabled={busy !== null}
                  className="group flex flex-col items-start rounded-xl border border-border bg-background p-4 text-left transition hover:border-primary hover:bg-accent disabled:opacity-50"
                >
                  <span className="font-display text-3xl font-bold tabular-nums">{plan}</span>
                  <span className="text-xs text-muted-foreground">days</span>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                    {busy === String(plan) ? "Generating…" : (<><Plus className="size-3.5" />Generate</>)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
            <div className="flex items-center gap-2">
              <Timer className="size-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Custom duration</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">For tests or special plans — seconds to days.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <input type="number" min={1} aria-label="Duration amount" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${fieldCls} w-24 tabular-nums`} />
              <select value={unit} aria-label="Duration unit" onChange={(e) => setUnit(e.target.value as Unit)} className={`${fieldCls} flex-1`}>
                <option value="seconds">seconds</option>
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
                <option value="days">days</option>
              </select>
            </div>
            <Button onClick={onCustom} disabled={busy !== null} className="mt-3 h-11 w-full">
              {busy === "custom" ? "Generating…" : "Generate custom key"}
            </Button>
          </div>
        </section>

        {copied && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3">
            <span className="flex items-center gap-2 text-sm">
              <Check className="size-4 text-success" />
              <span className="font-mono font-medium">{copied}</span>
            </span>
            <span className="text-xs text-muted-foreground">Copied to clipboard</span>
          </div>
        )}
        {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

        <section className="rounded-2xl border border-border bg-card shadow-soft">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {(["all", "active", "unused", "blocked"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`h-8 rounded-md px-3 text-xs font-medium capitalize transition ${filter === f ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <label className="relative sm:w-72">
              <span className="sr-only">Search keys</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search key" className={`${fieldCls} h-9 w-full pl-9 font-mono`} />
            </label>
          </div>

          {/* Mobile list */}
          <ul className="divide-y divide-border md:hidden">
            {visible.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">No licences found.</li>}
            {visible.map((row) => (
              <li key={row.id} className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-sm font-medium">{row.license_key}</span>
                  <LicenseStatus status={row.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {duration(row)} · Activated {fmt(row.activated_at)} · Expires {fmt(row.expires_at)}
                </p>
                <LicenseActions row={row} onCopy={setCopied} onChanged={refresh} setStatus={setStatus} remove={remove} />
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-5 py-3 font-medium">Key</th>
                  <th className="px-5 py-3 font-medium">Duration</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Activated</th>
                  <th className="px-5 py-3 font-medium">Expires</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">No licences found.</td>
                  </tr>
                )}
                {visible.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-5 py-3 font-mono text-xs font-medium">{row.license_key}</td>
                    <td className="px-5 py-3 tabular-nums">{duration(row)}</td>
                    <td className="px-5 py-3"><LicenseStatus status={row.status} /></td>
                    <td className="px-5 py-3 text-muted-foreground">{fmt(row.activated_at)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{fmt(row.expires_at)}</td>
                    <td className="px-5 py-3">
                      <LicenseActions row={row} onCopy={setCopied} onChanged={refresh} setStatus={setStatus} remove={remove} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

function LicenseStatus({ status }: { status: string }) {
  const ok = status === "active";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function LicenseActions({
  row,
  onCopy,
  onChanged,
  setStatus,
  remove,
}: {
  row: LicenseRow;
  onCopy: (key: string) => void;
  onChanged: () => Promise<void>;
  setStatus: (args: { data: { id: string; status: "active" | "blocked" } }) => Promise<unknown>;
  remove: (args: { data: { id: string } }) => Promise<unknown>;
}) {
  const icon = "inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card transition hover:bg-muted";
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        title="Copy key"
        aria-label="Copy key"
        onClick={async () => {
          await navigator.clipboard.writeText(row.license_key).catch(() => undefined);
          onCopy(row.license_key);
        }}
        className={icon}
      >
        <Copy className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={async () => {
          await setStatus({ data: { id: row.id, status: row.status === "active" ? "blocked" : "active" } });
          await onChanged();
        }}
        className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium transition hover:bg-muted"
      >
        {row.status === "active" ? "Block" : "Unblock"}
      </button>
      <button
        type="button"
        title="Delete key"
        aria-label="Delete key"
        onClick={async () => {
          if (!window.confirm(`Delete ${row.license_key}? This cannot be undone.`)) return;
          await remove({ data: { id: row.id } });
          await onChanged();
        }}
        className={`${icon} text-destructive hover:bg-destructive/10`}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
