import { adminAccessStatus } from "@/lib/admin-access.functions";
import { AdminSessionBar } from "@/components/admin/admin-session-bar";
import { useCallback, useEffect, useState } from "react";
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
      { title: "FoxGEN Pro Admin — License Generator" },
      {
        name: "description",
        content:
          "Generate 15, 30, 60 day or fully custom FoxGEN license keys and manage every key in one place.",
      },
      { property: "og:title", content: "FoxGEN Pro Admin — License Generator" },
      { property: "og:description", content: "Generate and manage FoxGEN Pro license keys." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <><AdminSessionBar /><AdminPage /></>,
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

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-primary/20 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-[140px]" />

      <div className="relative mx-auto flex max-w-5xl flex-col gap-8 px-6 py-14">
        <header className="flex items-center gap-4">
          <img
            src="/foxgen-logo.png"
            alt="FoxGEN Pro logo"
            width={56}
            height={56}
            className="h-14 w-14 rounded-2xl shadow-[0_0_40px_-8px_var(--color-primary)]"
          />
          <div>
            <h1 className="bg-gradient-to-r from-primary to-accent bg-clip-text text-3xl font-black tracking-tight text-transparent">
              License panel
            </h1>
            <p className="text-sm text-muted-foreground">
              One click generates a key. The clock starts when the extension first activates it.
            </p>
          </div>
        </header>

        <section className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
          <label className="text-xs font-bold uppercase tracking-[0.3em] text-primary" htmlFor="key-name">
            Custom name (optional)
          </label>
          <p className="mt-1 text-sm text-muted-foreground">
            Example: RAM → RAM-AB3-K9X. Leave empty for FOXGEN-XXX-XXX. Applies to every button below.
          </p>
          <input
            id="key-name"
            value={keyName}
            maxLength={24}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="e.g. RAM, DG, LOVABLE"
            className="mt-4 w-full max-w-sm rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold uppercase outline-none focus:border-primary"
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <button
              key={plan}
              onClick={() => generate(plan * 86400, String(plan))}
              disabled={busy !== null}
              className="rounded-2xl border border-border bg-card/60 p-6 text-left backdrop-blur transition hover:border-primary hover:shadow-[0_0_40px_-18px_var(--color-primary)] disabled:opacity-50"
            >
              <p className="text-3xl font-black">{plan}</p>
              <p className="text-sm text-muted-foreground">days plan</p>
              <span className="mt-4 inline-block rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-bold uppercase tracking-wider text-primary-foreground">
                {busy === String(plan) ? "Generating…" : "Generate key"}
              </span>
            </button>
          ))}
        </section>

        <section className="rounded-2xl border border-accent/30 bg-card/60 p-6 backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-accent">Custom duration</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Perfect for tests — 10 seconds, 30 minutes, 5 hours, anything you want.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-28 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as Unit)}
              className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold outline-none focus:border-primary"
            >
              <option value="seconds">seconds</option>
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
            <button
              onClick={onCustom}
              disabled={busy !== null}
              className="rounded-xl bg-gradient-to-r from-accent to-primary px-6 py-3 text-xs font-black uppercase tracking-widest text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
            >
              {busy === "custom" ? "Generating…" : "Generate custom key"}
            </button>
          </div>
        </section>

        {copied && (
          <p className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 font-mono text-sm">
            {copied}{" "}
            <span className="font-sans text-xs text-muted-foreground">— copied to clipboard</span>
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <section className="overflow-x-auto rounded-2xl border border-border bg-card/40 backdrop-blur">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Activated</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No licenses yet.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs text-primary">{row.license_key}</td>
                  <td className="px-4 py-3">{duration(row)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.status === "active"
                          ? "font-semibold text-primary"
                          : "font-semibold text-destructive"
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmt(row.activated_at)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmt(row.expires_at)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(row.license_key).catch(() => undefined);
                        setCopied(row.license_key);
                      }}
                      className="mr-2 rounded-lg border border-border px-3 py-1 text-xs font-semibold"
                    >
                      Copy
                    </button>
                    <button
                      onClick={async () => {
                        await setStatus({
                          data: { id: row.id, status: row.status === "active" ? "blocked" : "active" },
                        });
                        await refresh();
                      }}
                      className="mr-2 rounded-lg border border-border px-3 py-1 text-xs font-semibold"
                    >
                      {row.status === "active" ? "Block" : "Unblock"}
                    </button>
                    <button
                      onClick={async () => {
                        await remove({ data: { id: row.id } });
                        await refresh();
                      }}
                      className="rounded-lg border border-destructive/50 px-3 py-1 text-xs font-semibold text-destructive"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="flex flex-wrap gap-5 text-sm font-semibold text-primary">
          <a className="hover:underline" href="/">
            Back to download page
          </a>
          <a className="hover:underline" href="/hub-admin">
            Rewards Hub admin
          </a>
          <a className="hover:underline" href="/hub">
            Rewards Hub (member view)
          </a>
        </div>

      </div>
    </main>
  );
}
