import { createFileRoute } from "@tanstack/react-router";
import extensionZip from "@/assets/foxgen-extension.zip.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FoxGEN Old Vibe — Download the Licensed Extension" },
      {
        name: "description",
        content:
          "Download the FoxGEN Old Vibe browser extension. A valid FoxGEN license key is required inside the extension to unlock it.",
      },
      { property: "og:title", content: "FoxGEN Old Vibe — Download the Licensed Extension" },
      {
        property: "og:description",
        content:
          "Download the FoxGEN Old Vibe browser extension and activate it with your license key.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DownloadPage,
});

const steps = [
  "Download the ZIP file and unzip it on your computer.",
  "Open your browser and go to the Extensions page, then turn on Developer mode.",
  'Click "Load unpacked" and select the unzipped folder.',
  "Open the extension and paste your FoxGEN license key to activate it.",
];

function DownloadPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-20">
        <header className="flex flex-col gap-3">
          <span className="w-fit rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            FoxGEN
          </span>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            FoxGEN Old Vibe Extension
          </h1>
          <p className="max-w-xl text-muted-foreground">
            Download is open to everyone. The extension itself stays locked until you
            activate it with a valid FoxGEN license key.
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Latest build
            </p>
            <p className="text-2xl font-bold">Version 16.73</p>
            <p className="text-sm text-muted-foreground">
              ZIP archive · {(extensionZip.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <a
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90"
            href={extensionZip.url}
            download={extensionZip.original_filename}
          >
            Download extension
          </a>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">How to install</h2>
          <ol className="flex flex-col gap-3">
            {steps.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm text-muted-foreground">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-bold text-foreground">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
          <a className="font-semibold text-foreground hover:underline" href="/admin">
            Admin panel
          </a>
        </footer>
      </div>
    </main>
  );
}
