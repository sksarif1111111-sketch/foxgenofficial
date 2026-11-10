import type { ReactNode } from "react";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main id="main" className="container-page py-12 sm:py-16">
        <article className="mx-auto max-w-2xl">
          <h1 className="heading-4 sm:heading-3">{title}</h1>
          <p className="caption-5 mt-3 text-muted-foreground">Last updated {updated}</p>
          <div className="mt-10 space-y-8 [&_h2]:heading-6 [&_li]:body-3 [&_li]:text-muted-foreground [&_p]:body-3 [&_p]:mt-3 [&_p]:text-muted-foreground [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
            {children}
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
