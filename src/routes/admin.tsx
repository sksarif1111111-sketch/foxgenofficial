import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { checkLicense, type LicenseResult } from "@/lib/license.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "FoxGEN Admin — License Key Checker" },
      {
        name: "description",
        content:
          "Admin panel for FoxGEN: check any license key against the FoxGEN license server and see its status.",
      },
      { property: "og:title", content: "FoxGEN Admin — License Key Checker" },
      {
        property: "og:description",
        content: "Check any FoxGEN license key and see whether it is active.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const run = useServerFn(checkLicense);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LicenseResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim() || busy) return;
    setBusy(true);
    setResult(null);
    try {
      setResult(await run({ data: { key: key.trim(), deviceId: "admin-panel" } }));
    } catch {
      setResult({
        valid: false,
        status: "error",
        message: "Could not reach the license server.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-20">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight">Admin panel</h1>
          <p className="text-sm text-muted-foreground">
            Check any license key against the FoxGEN license server.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 sm:flex-row"
        >
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="FOXGEN-XXXX-XXXX"
            className="flex-1 rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Checking…" : "Check key"}
          </button>
        </form>

        {result && (
          <div
            className={`rounded-2xl border p-6 ${
              result.valid
                ? "border-primary/40 bg-primary/5"
                : "border-destructive/40 bg-destructive/5"
            }`}
          >
            <p className="text-sm font-bold uppercase tracking-widest">
              {result.valid ? "Active" : result.status}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{result.message}</p>
          </div>
        )}

        <a className="text-sm font-semibold hover:underline" href="/">
          Back to download
        </a>
      </div>
    </main>
  );
}
