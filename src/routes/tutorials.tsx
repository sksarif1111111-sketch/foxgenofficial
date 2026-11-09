import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Download, ExternalLink, PlayCircle } from "lucide-react";
import { publicSiteInfo } from "@/lib/site.functions";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";

export const Route = createFileRoute("/tutorials")({
  head: () => ({
    meta: [
      { title: "Tutorials — Foxgen AI Store" },
      { name: "description", content: "Step-by-step guides for installing and using the FoxGEN Pro extension and Foxgen products." },
      { property: "og:title", content: "Tutorials — Foxgen AI Store" },
      { property: "og:description", content: "Setup and usage guides for FoxGEN Pro and Foxgen products." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TutorialsPage,
});

function TutorialsPage() {
  const load = useServerFn(publicSiteInfo);
  const { data, isLoading, isError } = useQuery({ queryKey: ["site-info"], queryFn: () => load() });
  const links = data?.links ?? {};
  const guide = data?.guide ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <header className="border-b border-border bg-card">
        <div className="container-page py-10 sm:py-14">
          <p className="eyebrow text-primary">Tutorials</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-5xl">{links.guide_title ?? "Guides & how-tos"}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">Install the FoxGEN Pro extension, activate your licence and get the most from your products.</p>
        </div>
      </header>
      <main className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_320px] sm:py-14">
        <section className="space-y-4">
          {isLoading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-card" />)}
          {isError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">Guides could not be loaded. Please refresh.</p>}
          {!isLoading && !isError && guide.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">Written guides are coming soon.</div>
          )}
          {guide.map((g, i) => (
            <article key={g.id} className="rounded-2xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-start gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent font-display text-sm font-bold text-accent-foreground">{i + 1}</span>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">{g.heading}</h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{g.body}</p>
                </div>
              </div>
            </article>
          ))}
        </section>
        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          {links.tutorial_url && (
            <a href={links.tutorial_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft hover:border-primary/40">
              <PlayCircle className="size-6 text-primary" />
              <span className="flex-1"><span className="block font-semibold">Video tutorial</span><span className="text-xs text-muted-foreground">Watch the full walkthrough</span></span>
              <ExternalLink className="size-4 text-muted-foreground" />
            </a>
          )}
          {links.installation_guide_url && (
            <a href={links.installation_guide_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft hover:border-primary/40">
              <BookOpen className="size-6 text-primary" />
              <span className="flex-1"><span className="block font-semibold">Installation guide</span><span className="text-xs text-muted-foreground">Step-by-step setup</span></span>
              <ExternalLink className="size-4 text-muted-foreground" />
            </a>
          )}
          <Link to="/extension" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft hover:border-primary/40">
            <Download className="size-6 text-primary" />
            <span className="flex-1"><span className="block font-semibold">Download FoxGEN Pro</span><span className="text-xs text-muted-foreground">{links.extension_version ? `Version ${links.extension_version}` : "Latest releases"}</span></span>
          </Link>
          <Link to="/support" className="block rounded-2xl bg-ink p-5 text-ink-foreground">
            <span className="block font-semibold">Still stuck?</span>
            <span className="mt-1 block text-sm opacity-80">Our support team can help →</span>
          </Link>
        </aside>
      </main>
      <SiteFooter />
    </div>
  );
}
