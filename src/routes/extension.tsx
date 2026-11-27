import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Download, FolderOpen, KeyRound, MonitorCog, ToggleRight } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { FOXGEN_540 } from "@/lib/extension-releases";
import { ExtensionDownloadButton } from "@/components/site/extension-download-button";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";

export const Route = createFileRoute("/extension")({
  head: () => ({
    meta: [
      { title: "FoxGEN Pro Extension — Download | Foxgen AI Store" },
      {
        name: "description",
        content: "Download the FoxGEN Pro browser extension for lovable.dev. Activate it with a FoxGEN licence key on any number of devices.",
      },
      { property: "og:title", content: "FoxGEN Pro Extension — Download" },
      { property: "og:description", content: "Download FoxGEN Pro and activate it with your licence key." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DownloadPage,
});

type Release = {
  name: string;
  version: string;
  tag: string;
  notes: string;
  href: string;
  file: string;
  logo?: string;
  recommended?: boolean;
};

const RELEASES: Release[] = [
  {
    name: "FoxGEN Pro",
    version: "6.20",
    tag: "Latest · Smooth send fix",
    notes: "No screen shaking, no send cooldown and the new premium panel.",
    href: "/foxgen-pro-6.20.zip",
    file: "FoxGEN-Pro-6.20.zip",
    recommended: true,
  },
  {
    name: "FoxGEN Pro · Lovable edition",
    version: "6.3.0",
    tag: "Stable",
    notes: "Reliable activation, direct Approve action.",
    href: "/foxgen-pro-lovable-extension.zip",
    file: "FoxGEN-Pro-Lovable-6.3.0.zip",
  },
  {
    name: "FoxGEN Pro · Classic",
    version: "5.1.5",
    tag: "Classic",
    notes: "Original build with licence gate on lovable.dev.",
    href: "/foxgen-pro-extension.zip",
    file: "FoxGEN-Pro-5.1.5.zip",
  },
  {
    ...FOXGEN_540,
    tag: "New edition",
    logo: BRAND.mark,
  },
];

const STEPS = [
  { icon: Download, title: "Download & unzip", text: "Save the ZIP and extract it to a folder on your computer." },
  { icon: ToggleRight, title: "Developer mode", text: "Open your browser’s Extensions page and switch on Developer mode." },
  { icon: FolderOpen, title: "Load unpacked", text: "Click “Load unpacked” and choose the extracted folder." },
  { icon: KeyRound, title: "Activate", text: "Open lovable.dev and paste your FoxGEN licence key." },
];

export default function DownloadPage() {
  const [latest, ...others] = RELEASES;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />

      <section className="container-page pt-4 sm:pt-6">
        <div className="surface-ink relative overflow-hidden rounded-3xl">
          <div className="bg-grid-ink pointer-events-none absolute inset-0 opacity-70" />
          <div className="relative grid gap-10 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1fr_auto] lg:items-center lg:px-14">
            <div className="max-w-xl">
              <p className="eyebrow text-primary">FoxGEN Pro · Browser extension</p>
              <h1 className="mt-4 text-4xl font-bold leading-[1.05] sm:text-6xl">Build faster on lovable.dev.</h1>
              <p className="mt-4 text-muted-foreground sm:text-lg">
                Free to download. The extension unlocks with a valid FoxGEN licence key and works on multiple devices.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ExtensionDownloadButton
                  href={latest.href}
                  file={latest.file}
                  className="h-12 px-6 shadow-ember"
                >
                  Download {latest.version}
                </ExtensionDownloadButton>
                <Link to="/shop" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border px-6 text-sm font-semibold hover:bg-card">
                  Get a licence key <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
            <div className="relative mx-auto">
              <div className="absolute inset-0 rounded-full bg-primary/30 blur-3xl" />
              <img src={BRAND.mark} alt="FoxGEN Pro logo" width={200} height={200} className="relative size-40 rounded-[2.25rem] ring-1 ring-border sm:size-48" />
            </div>
          </div>
        </div>
      </section>

      <main id="main" className="container-page mt-16 space-y-20">
        <section>
          <div className="mb-6">
            <p className="eyebrow text-primary">Releases</p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Choose your build</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            {[latest, ...others].map((r) => (
              <div key={r.file} className="flex flex-col gap-4 border-b border-border p-5 last:border-0 sm:flex-row sm:items-center sm:p-6">
                <img src={r.logo ?? BRAND.mark} alt="" width={48} height={48} className="size-12 shrink-0 rounded-xl object-cover ring-1 ring-border" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{r.name}</p>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">v{r.version}</span>
                    {r.recommended ? (
                      <span className="rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground">Recommended</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{r.tag}</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.notes}</p>
                </div>
                <ExtensionDownloadButton
                  href={r.href}
                  file={r.file}
                  variant={r.recommended ? "default" : "outline"}
                  className="h-10 shrink-0 px-4"
                >
                  {r.version === FOXGEN_540.version ? 'Download 5.40' : 'Download'}
                </ExtensionDownloadButton>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-6 flex items-center gap-3">
            <MonitorCog className="size-5 text-primary" />
            <h2 className="text-2xl font-bold sm:text-3xl">Install in four steps</h2>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <s.icon className="size-5" />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                </div>
                <p className="mt-5 font-semibold">{s.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-muted-foreground">Replacing an older version? Remove it from the Extensions page first, then load the new folder.</p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
