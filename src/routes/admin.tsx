import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  claimAdmin,
  deleteLicense,
  generateLicense,
  listLicenses,
  setLicenseStatus,
  type LicenseRow,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "FoxGEN Admin — License Generator" },
      {
        name: "description",
        content: "Generate 15, 30 and 60 day FoxGEN license keys and manage every active key in one place.",
      },
      { property: "og:title", content: "FoxGEN Admin — License Generator" },
      { property: "og:description", content: "Generate and manage FoxGEN license keys." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const PLANS = [15, 30, 60] as const;

function fmt(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function AdminPage() {
  const navigate = useNavigate();
  const claim = useServerFn(claimAdmin);
  const load = useServerFn(listLicenses);
  const create = useServerFn(generateLicense);
  const setStatus = useServerFn(setLicenseStatus);
  const remove = useServerFn(deleteLicense);

  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [rows, setRows] = useState<LicenseRow[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setRows(await load({ data: undefined }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load licenses.");
    }
  }, [load]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      try {
        const res = await claim({ data: undefined });
        if (!active) return;
        setAllowed(res.isAdmin);
        if (res.isAdmin) await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not verify admin access.");
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [claim, navigate, refresh]);

  async function onGenerate(planDays: (typeof PLANS)[number]) {
    setBusy(planDays);
    setError(null);
    try {
      const row = await create({ data: { planDays } });
      setRows((prev) => [row, ...prev]);
      await navigator.clipboard.writeText(row.license_key).catch(() => undefined);
      setCopied(row.license_key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the key.");
    } finally {
      setBusy(null);
    }
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <h1 className="text-2xl font-black">Not an admin account</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {error ?? "This account does not have access to the license panel."}
        </p>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
          className="rounded-xl border border-border px-5 py-2 text-sm font-semibold"
        >
          Sign out
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-14">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">License panel</h1>
            <p className="text-sm text-muted-foreground">
              One click generates a key. The clock starts when the extension first activates it.
            </p>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
          >
            Sign out
          </button>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <button
              key={plan}
              onClick={() => onGenerate(plan)}
              disabled={busy !== null}
              className="rounded-2xl border border-border bg-card p-6 text-left transition hover:border-primary disabled:opacity-50"
            >
              <p className="text-3xl font-black">{plan}</p>
              <p className="text-sm text-muted-foreground">days plan</p>
              <span className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
                {busy === plan ? "Generating…" : "Generate key"}
              </span>
            </button>
          ))}
        </section>

        {copied && (
          <p className="rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 font-mono text-sm">
            {copied} <span className="font-sans text-xs text-muted-foreground">— copied to clipboard</span>
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <section className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Plan</th>
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
                  <td className="px-4 py-3 font-mono text-xs">{row.license_key}</td>
                  <td className="px-4 py-3">{row.plan_days}d</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.status === "active" ? "font-semibold text-primary" : "font-semibold text-destructive"
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmt(row.activated_at)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmt(row.expires_at)}</td>
                  <td className="px-4 py-3 text-right">
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

        <a className="text-sm font-semibold hover:underline" href="/">
          Back to download page
        </a>
      </div>
    </main>
  );
}
