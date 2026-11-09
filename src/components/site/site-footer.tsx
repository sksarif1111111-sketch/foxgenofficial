import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/site/site-nav";
import { BRAND } from "@/lib/brand";

const COLUMNS = [
  {
    title: "Store",
    links: [
      { to: "/shop", label: "All products" },
      { to: "/offers", label: "Latest offers" },
      { to: "/extension", label: "FoxGEN Pro extension" },
    ],
  },
  {
    title: "Members",
    links: [
      { to: "/hub", label: "Free rewards" },
      { to: "/account", label: "My account" },
      { to: "/chat", label: "AI shopping help" },
    ],
  },
  {
    title: "Help",
    links: [
      { to: "/tutorials", label: "Tutorials" },
      { to: "/support", label: "Support" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="surface-ink mt-24">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="max-w-sm space-y-4">
          <BrandMark tone="inverse" />
          <p className="text-sm text-muted-foreground">
            Premium AI tools, software plans and licences — order on the website or in our Telegram bot. Every payment is
            checked by the owner before delivery.
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
          <span>© {new Date().getFullYear()} {BRAND.name}</span>
          <span>Payments are confirmed manually — a typed reference never marks an order paid.</span>
        </div>
      </div>
    </footer>
  );
}
