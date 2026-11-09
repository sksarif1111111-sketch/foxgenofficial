import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Menu, Search, Shield, Sparkles, UserRound } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AdminAccessDialog } from "@/components/admin/admin-access-form";
import { BRAND } from "@/lib/brand";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/offers", label: "Latest Offers" },
  { to: "/hub", label: "Free Rewards" },
  { to: "/tutorials", label: "Tutorials" },
  { to: "/support", label: "Support" },
] as const;

export function BrandMark({ compact = false, tone = "default" }: { compact?: boolean; tone?: "default" | "inverse" }) {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${BRAND.name} home`}>
      <img src={BRAND.mark} alt="" width={36} height={36} className="size-9 rounded-[10px] bg-ink object-cover ring-1 ring-border" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-bold tracking-tight">{BRAND.short}</span>
          <span className={`eyebrow mt-1 text-[9px] ${tone === "inverse" ? "text-muted-foreground" : "text-primary"}`}>{BRAND.suffix}</span>
        </span>
      )}
    </Link>
  );
}

function NavSearch({ onDone, className = "" }: { onDone?: () => void; className?: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    void navigate({ to: "/shop", search: term ? { q: term } : {} });
    onDone?.();
  };
  return (
    <form role="search" onSubmit={submit} className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search products"
        aria-label="Search products"
        maxLength={80}
        className="h-10 w-full rounded-full border border-input bg-muted/60 pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:bg-card focus:ring-2 focus:ring-ring/15"
      />
    </form>
  );
}

/** Sticky storefront header with a slide-in menu on mobile. */
export function SiteNav({ right }: { right?: ReactNode }) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const [open, setOpen] = useState(false);
  const onChat = pathname.startsWith("/chat");
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center gap-4">
          <BrandMark />
          <nav aria-label="Main" className="ml-4 hidden items-center gap-0.5 xl:flex">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(l.to) ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l.label}
                {isActive(l.to) && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-primary" />}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <NavSearch className="hidden w-56 md:block 2xl:w-64" />
            {right}
            <Link
              to="/account"
              className="hidden h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-ink-foreground transition hover:opacity-90 sm:inline-flex"
            >
              <UserRound className="size-4" /> Account
            </Link>
            <AdminAccessDialog
              trigger={
                <button
                  type="button"
                  aria-label="Admin access"
                  title="Admin access"
                  className="hidden size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
                >
                  <Shield className="size-4" />
                </button>
              }
            />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open menu"
                  className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card xl:hidden"
                >
                  <Menu className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="flex w-[86vw] max-w-xs flex-col gap-5 overflow-y-auto p-6">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <BrandMark />
                <NavSearch onDone={() => setOpen(false)} />
                <nav aria-label="Mobile" className="flex flex-col gap-1">
                  {LINKS.map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      onClick={() => setOpen(false)}
                      className={`flex h-12 items-center rounded-xl px-4 text-base font-medium ${
                        isActive(l.to) ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {l.label}
                    </Link>
                  ))}
                </nav>
                <div className="mt-auto space-y-1 border-t border-border pt-4">
                  <Link
                    to="/account"
                    onClick={() => setOpen(false)}
                    className="flex h-12 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-ink-foreground"
                  >
                    <UserRound className="size-4" /> My account
                  </Link>
                  <AdminAccessDialog
                    trigger={
                      <button type="button" className="flex h-12 w-full items-center gap-2 rounded-xl px-4 text-sm font-medium text-muted-foreground hover:bg-muted">
                        <Shield className="size-4" /> Admin access
                      </button>
                    }
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      {!onChat && (
        <Link
          to="/chat"
          aria-label="Ask Foxgen AI"
          className="fixed bottom-4 right-4 z-50 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-ink-foreground shadow-lift transition hover:-translate-y-0.5 sm:bottom-6 sm:right-6"
        >
          <Sparkles className="size-4 text-primary-foreground/80" />
          <span className="hidden sm:inline">Ask Foxgen AI</span>
        </Link>
      )}
    </>
  );
}
