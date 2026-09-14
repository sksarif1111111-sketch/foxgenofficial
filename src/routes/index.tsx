import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FoxGEN Pro — Download the Licensed Extension" },
      {
        name: "description",
        content:
          "Download the FoxGEN Pro browser extension. A valid FoxGEN license key unlocks the extension on lovable.dev.",
      },
      { property: "og:title", content: "FoxGEN Pro — Download the Licensed Extension" },
      {
        property: "og:description",
        content: "Download FoxGEN Pro and activate it with your license key.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DownloadPage,
});

const BUILD_TAG = "2026-09-05c";

const steps = [
  "Download the ZIP file and unzip it on your computer.",
  "Open your browser Extensions page and turn on Developer mode.",
  'Click "Load unpacked" and select the unzipped folder.',
  "Open lovable.dev, paste your FoxGEN license key and it unlocks instantly.",
];

export default function DownloadPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-primary/20 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-[30rem] w-[30rem] rounded-full bg-accent/20 blur-[140px]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto flex max-w-4xl flex-col gap-14 px-6 py-20">
        <header className="flex flex-col items-center gap-6 text-center">
          <img
            src="/foxgen-logo.png"
            alt="FoxGEN Pro logo"
            width={112}
            height={112}
            className="h-28 w-28 rounded-3xl shadow-[0_0_60px_-10px_var(--color-primary)]"
          />
          <span className="rounded-full border border-primary/40 bg-primary/10 px-4 py-1 text-[0.7rem] font-bold uppercase tracking-[0.35em] text-primary">
            FoxGEN Pro
          </span>
          <h1 className="bg-gradient-to-r from-primary via-foreground to-accent bg-clip-text text-4xl font-black tracking-tight text-transparent sm:text-6xl">
            FoxGEN Pro Extension
          </h1>
          <p className="max-w-xl text-muted-foreground">
            Free to download. The extension stays locked until you activate it with a valid
            FoxGEN license key.
          </p>
        </header>

        <section className="relative overflow-hidden rounded-3xl border border-primary/25 bg-card/70 p-8 backdrop-blur-xl shadow-[0_30px_90px_-40px_var(--color-primary)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
                Latest build
              </p>
              <p className="text-2xl font-bold">Zokys × Trivis 5.1.5</p>
              <p className="text-sm text-muted-foreground">
                ZIP archive · build {BUILD_TAG} · license gate on lovable.dev
              </p>
            </div>
            <a
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-primary to-accent px-7 py-4 text-sm font-black uppercase tracking-widest text-primary-foreground transition hover:brightness-110"
              href="/zokys-x-trivis.zip"
              download="Zokys-X-Trivis-5.1.5.zip"
            >
              Download extension
            </a>
          </div>
        </section>

        <section className="flex flex-col gap-5">
          <h2 className="text-xl font-bold">How to install</h2>
          <ol className="grid gap-3 sm:grid-cols-2">
            {steps.map((step, i) => (
              <li
                key={step}
                className="flex gap-3 rounded-2xl border border-border bg-card/50 p-4 text-sm text-muted-foreground backdrop-blur"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-black text-primary-foreground">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <footer className="flex items-center justify-between border-t border-border pt-6 text-sm text-muted-foreground">
          <span>© FoxGEN Pro</span>
          <a className="font-semibold text-primary hover:underline" href="/admin">
            Admin panel
          </a>
        </footer>
      </div>
    </main>
  );
}
