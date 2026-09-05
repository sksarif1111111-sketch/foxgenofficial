import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, KeyRound, Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkLicense, type LicenseResult } from "@/lib/license.functions";

function LicensePage() {
  const verify = useServerFn(checkLicense);
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LicenseResult | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim() || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await verify({ data: { key: key.trim() } });
      setResult(res);
      if (res.valid) localStorage.setItem("foxgen_license_key", key.trim());
    } catch {
      setResult({ valid: false, status: "error", message: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-accent/20 blur-[120px]" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-lg flex-col items-center justify-center px-6 py-16">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-lg">
            <KeyRound className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">FoxGen Extension</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Enter your license key to unlock the download.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="w-full rounded-2xl border border-border bg-card/80 p-6 shadow-xl backdrop-blur"
        >
          <Label htmlFor="license" className="text-sm">
            License key
          </Label>
          <Input
            id="license"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            className="mt-2 h-12 font-mono tracking-widest"
          />

          <Button type="submit" disabled={loading || !key.trim()} className="mt-4 h-12 w-full text-base">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…
              </>
            ) : (
              "Activate license"
            )}
          </Button>

          {result && (
            <div
              className={`mt-5 flex items-start gap-3 rounded-xl border p-4 text-sm ${
                result.valid
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-destructive/40 bg-destructive/10 text-foreground"
              }`}
              role="status"
            >
              {result.valid ? (
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              ) : (
                <ShieldX className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
              )}
              <div>
                <p>{result.message}</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                  Status: {result.status}
                </p>
              </div>
            </div>
          )}

          {result?.valid && result.downloadUrl && (
            <Button asChild variant="secondary" className="mt-4 h-12 w-full text-base">
              <a href={result.downloadUrl} download>
                <Download className="mr-2 h-4 w-4" aria-hidden />
                Download extension (.zip)
              </a>
            </Button>
          )}
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Licenses are verified in real time against the FoxGen license server.
        </p>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/")({
  component: LicensePage,
  head: () => ({
    meta: [
      { title: "FoxGen Extension — Activate Your License" },
      {
        name: "description",
        content:
          "Activate your FoxGen license key to verify your purchase and download the licensed extension package.",
      },
      { property: "og:title", content: "FoxGen Extension — Activate Your License" },
      {
        property: "og:description",
        content: "Enter your license key to unlock the FoxGen extension download.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
