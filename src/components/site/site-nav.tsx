import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Store" },
  { to: "/extension", label: "Extension" },
] as const;

/** Sticky top menu shared by the public store pages. */
export function SiteNav({ right }: { right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/foxgen-logo.png" alt="FoxGEN" width={36} height={36} className="h-9 w-9 rounded-lg" />
          <span className="hidden text-base font-black tracking-wide sm:inline">FOXGEN</span>
        </Link>
        <nav className="flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-soft">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: true }}
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
              activeProps={{ className: "bg-primary text-primary-foreground hover:text-primary-foreground" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">{right}</div>
      </div>
    </header>
  );
}
