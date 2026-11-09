import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/site/site-nav";

const COLUMNS = [
  { title: "Marketplace", links: [{ to: "/shop", label: "All products" }, { to: "/extension", label: "FoxGEN Pro extension" }] },
  { title: "Members", links: [{ to: "/hub", label: "Rewards hub" }, { to: "/chat", label: "AI shopping help" }] },
] as const;

export function SiteFooter() {
  return (
    <footer className="surface-ink mt-24">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm space-y-4">
          <BrandMark />
          <p className="text-sm text-muted-foreground">
            Premium software, AI tools and licences — ordered on the website or in our Telegram bot, delivered after
            owner-verified payment.
          </p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title} className="space-y-3">
            <p className="eyebrow text-muted-foreground">{c.title}</p>
            <ul className="space-y-2">
              {c.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-foreground/90 hover:text-primary">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} FOXGEN OFFICIAL</span>
          <span>Payments are confirmed manually — a typed reference never marks an order paid.</span>
        </div>
      </div>
    </footer>
  );
}
