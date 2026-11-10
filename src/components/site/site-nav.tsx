import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ShoppingBagOpen, Sparkle, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { AdminAccessDialog } from "@/components/admin/admin-access-form";
import { BRAND } from "@/lib/brand";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Explore offers" },
  { to: "/hub", label: "Free rewards" },
  { to: "/tutorials", label: "Tutorials" },
  { to: "/support", label: "Support" },
] as const;

const MORE = [
  { to: "/offers", label: "Latest offers" },
  { to: "/account", label: "My account" },
  { to: "/extension", label: "FoxGEN Pro extension" },
  { to: "/chat", label: "Ask Foxgen AI" },
] as const;

const ease = "ease-[cubic-bezier(0.22,1,0.36,1)]";

export function BrandMark({ compact = false, tone = "default" }: { compact?: boolean; tone?: "default" | "inverse" }) {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${BRAND.name} home`}>
      <img src={BRAND.mark} alt="" width={40} height={40} className="size-10 rounded-xl bg-ink object-cover shadow-ember" />
      {!compact && (
        <span className="flex flex-col">
          <span className="title-4 font-semibold tracking-tight">{BRAND.short}</span>
          <span className={`caption-5 ${tone === "inverse" ? "text-muted-foreground" : "text-muted-foreground"}`}>{BRAND.suffix}</span>
        </span>
      )}
    </Link>
  );
}

/** Primary call to action used everywhere: jumps to the live offers on Home. */
const TONES = {
  primary: "rounded-full bg-primary px-3 py-2 text-primary-foreground hover:bg-primary/90",
  navy: "rounded-xl bg-navy px-4 py-2 text-navy-foreground hover:bg-navy/90",
  glow: "btn-glow rounded-xl px-6 py-3",
} as const;

export function BuyNowLink({ className = "", children = "Buy now", onClick, tone = "primary" }: { className?: string; children?: ReactNode; onClick?: () => void; tone?: keyof typeof TONES }) {
  return (
    <Link
      to="/"
      hash="offers"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 transition duration-300 ${ease} active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${TONES[tone]} ${className}`}
    >
      {children}
    </Link>
  );
}

function MenuToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      aria-controls="mobile-menu"
      className="relative inline-flex size-10 items-center justify-center rounded-full transition duration-300 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
    >
      <span className={`absolute h-0.5 w-4 rounded-full bg-foreground transition-transform duration-500 ${ease} ${open ? "rotate-45" : "-translate-y-1"}`} />
      <span className={`absolute h-0.5 w-4 rounded-full bg-foreground transition-transform duration-500 ${ease} ${open ? "-rotate-45" : "translate-y-1"}`} />
    </button>
  );
}

/** Compact floating navigation (skill B7) with a full height mobile panel. */
export function SiteNav({ right, announcement }: { right?: ReactNode; announcement?: ReactNode }) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const [open, setOpen] = useState(false);
  const onChat = pathname.startsWith("/chat");
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const mobileItems = [...LINKS, ...MORE];

  return (
    <>
      <a href="#main" className="sr-only z-[60] rounded-lg bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
        {announcement && <div className="pointer-events-auto">{announcement}</div>}
        <div className="flex justify-center px-4 pt-4">
        <nav
          aria-label="Main"
          className="pointer-events-auto flex w-full max-w-5xl items-center gap-2 rounded-2xl border border-border/80 bg-card/85 py-2 pl-3 pr-2 shadow-lift backdrop-blur-xl animate-fade-up sm:gap-4 sm:pl-4"
        >
          <BrandMark />
          <ul className="mx-auto hidden items-center gap-1 lg:flex">
            {LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  aria-current={isActive(l.to) ? "page" : undefined}
                  className={`title-4 rounded-full px-3 py-2 transition duration-300 ${ease} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isActive(l.to) ? "bg-accent text-accent-foreground" : "text-foreground/75 hover:bg-muted/70 hover:text-foreground"
                  }`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="ml-auto flex items-center gap-1 lg:ml-0">
            {right}
            <Link
              to="/account"
              aria-label="My account"
              title="My account"
              className="hidden size-10 items-center justify-center rounded-full text-muted-foreground transition duration-300 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
            >
              <UserCircle size={22} />
            </Link>
            <BuyNowLink tone="navy" className="button-sm">
              <ShoppingBagOpen size={16} weight="bold" /> Buy now
            </BuyNowLink>
            <MenuToggle open={open} onClick={() => setOpen((v) => !v)} />
          </div>
        </nav>
        </div>
      </header>
      {announcement && <div aria-hidden="true" className="h-9" />}
      <div aria-hidden="true" className="h-20" />

      {/* Full height mobile panel */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`fixed inset-0 z-40 bg-background/95 backdrop-blur-2xl transition-opacity duration-300 ${ease} lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <div className={`flex h-full flex-col overflow-y-auto px-6 pb-8 ${announcement ? "pt-32" : "pt-24"}`}>
          <ul className="flex flex-col gap-1">
            {mobileItems.map((l, i) => (
              <li
                key={l.to}
                className={`transition duration-500 ${ease} ${open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}
                style={{ transitionDelay: open ? `${Math.min(i * 60, 400)}ms` : "0ms" }}
              >
                <Link
                  to={l.to}
                  tabIndex={open ? 0 : -1}
                  aria-current={isActive(l.to) ? "page" : undefined}
                  className={`heading-5 flex items-center justify-between rounded-xl px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive(l.to) ? "bg-muted" : "hover:bg-muted/70"}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-col gap-3 pt-8">
            <BuyNowLink className="button-md w-full py-3" onClick={() => setOpen(false)}>
              <ShoppingBagOpen size={18} weight="bold" /> Buy now
            </BuyNowLink>
            <AdminAccessDialog
              trigger={
                <button type="button" tabIndex={open ? 0 : -1} className="caption-1 rounded-full px-3 py-2 text-muted-foreground hover:bg-muted">
                  Admin access
                </button>
              }
            />
          </div>
        </div>
      </div>

      {!onChat && !open && (
        <Link
          to="/chat"
          aria-label="Ask Foxgen AI"
          className={`button-sm fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-ink px-3 py-3 text-ink-foreground shadow-lift transition duration-300 ${ease} hover:-translate-y-0.5 active:scale-[0.98] sm:bottom-6 sm:right-6 sm:px-4`}
        >
          <Sparkle size={18} weight="fill" />
          <span className="hidden sm:inline">Ask Foxgen AI</span>
        </Link>
      )}
    </>
  );
}
