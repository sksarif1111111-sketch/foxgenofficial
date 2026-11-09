import { Link, useLocation } from "@tanstack/react-router";
import { Menu, Sparkles, Shield } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AdminAccessDialog } from "@/components/admin/admin-access-form";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Store" },
  { to: "/extension", label: "FoxGEN Pro" },
  { to: "/hub", label: "Rewards" },
  { to: "/chat", label: "AI Help" },
] as const;

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="FOXGEN OFFICIAL home">
      <img src="/foxgen-logo.png" alt="" width={34} height={34} className="size-[34px] rounded-[10px] ring-1 ring-border" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[15px] font-bold tracking-tight">FOXGEN</span>
          <span className="eyebrow mt-0.5 text-[9px] text-muted-foreground">Official</span>
        </span>
      )}
    </Link>
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
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <BrandMark />
            <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
              {LINKS.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(l.to) ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="relative">
                    {l.label}
                    {isActive(l.to) && <span className="absolute -bottom-[21px] left-0 right-0 h-0.5 rounded-full bg-primary" />}
                  </span>
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {right}
            <AdminAccessDialog
              trigger={
                <button
                  type="button"
                  className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
                >
                  <Shield className="size-4" /> Admin
                </button>
              }
            />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open menu"
                  className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-card lg:hidden"
                >
                  <Menu className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="flex w-[86vw] max-w-xs flex-col gap-6 p-6">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                <BrandMark />
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
                <div className="mt-auto border-t border-border pt-4">
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
          aria-label="Ask FoxGEN AI"
          className="fixed bottom-4 right-4 z-50 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-ink-foreground shadow-lift transition hover:-translate-y-0.5 sm:bottom-6 sm:right-6"
        >
          <Sparkles className="size-4 text-primary" />
          <span className="hidden sm:inline">Ask FoxGEN AI</span>
        </Link>
      )}
    </>
  );
}
