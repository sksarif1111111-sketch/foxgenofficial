import { useState, type ReactNode } from "react";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Bot,
  ChevronDown,
  Coins,
  ExternalLink,
  ThumbsUp,
  Gift,
  History,
  KeyRound,
  Layers,
  LayoutDashboard,
  Link2,
  ListChecks,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  MessageCircle,
  Package,
  Palette,
  PlayCircle,
  PlugZap,
  Puzzle,
  Receipt,
  Send,
  ShieldCheck,
  Store,
  Tag,
  Trophy,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { adminAccessStatus, lockAdmin } from "@/lib/admin-access.functions";
import { botDashboard } from "@/lib/control.functions";
import { ExtensionAccessDialog } from "@/components/admin/extension-access";
import { BRAND } from "@/lib/brand";

export type AdminNavId =
  | "Dashboard" | "Analytics" | "Activity"
  | "Bot" | "Broadcast" | "Branding" | "Links"
  | "Shop" | "Catalog" | "Products" | "Offers" | "Buying"
  | "Rewards" | "Licenses" | "Referrals" | "Users" | "Leaderboard"
  | "Tasks" | "TasksYouTube" | "TasksWhatsApp" | "TasksFacebook" | "TasksTelegram"
  | "Integrations" | "SyncHistory"
  | "Logs" | "Security"
  | "Generator" | "Extension" | "Instructions";

type NavItem = { id: AdminNavId; label: string; icon: LucideIcon; hint: string };
type NavGroup = { label: string; items: NavItem[]; extension?: boolean };

export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { id: "Dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "Members, referrals, credits, licences and bot health at a glance." },
      { id: "Analytics", label: "Sales analytics", icon: BarChart3, hint: "Sales, costs, payment fees and estimated profit from paid orders." },
      { id: "Activity", label: "Activity logs", icon: Activity, hint: "Recent admin actions, downloads and member activity." },
    ],
  },
  {
    label: "Bot configuration",
    items: [
      { id: "Bot", label: "General settings", icon: Bot, hint: "Bot connection, webhook and required-channel checks." },
      { id: "Broadcast", label: "Messages & notifications", icon: Megaphone, hint: "Broadcast to members and edit the referral and pricing messages." },
      { id: "Branding", label: "Bot menu & icons", icon: Palette, hint: "Store name, tagline and every bot button icon." },
      { id: "Links", label: "Community settings", icon: Link2, hint: "Support, social and channel links used by the bot and website." },
    ],
  },
  {
    label: "Store management",
    items: [
      { id: "Shop", label: "Products", icon: Store, hint: "Add, edit, feature, publish or delete products. Changes appear in the store and bot." },
      { id: "Offers", label: "Promotional offers", icon: Tag, hint: "Banner and offer cards on the Home and Latest Offers pages." },
      { id: "Catalog", label: "Categories & payments", icon: Layers, hint: "Categories, communities and payment methods." },
      { id: "Products", label: "Product links", icon: Package, hint: "Downloadable products, files and links." },
      { id: "Buying", label: "Orders & payments", icon: Receipt, hint: "Review payments, deliver orders and manage wallets." },
    ],
  },
  {
    label: "Rewards system",
    items: [
      { id: "Rewards", label: "Free rewards", icon: Gift, hint: "Licence rewards members can redeem with credits." },
      { id: "Licenses", label: "Redemption history", icon: BadgeCheck, hint: "Every licence members redeemed with credits." },
      { id: "Referrals", label: "Referral management", icon: UserPlus, hint: "Approve or reject invited members. A verified referral earns 1 credit, once." },
      { id: "Users", label: "Credit management", icon: Coins, hint: "Search members, change status and adjust credits (every change is recorded)." },
      { id: "Leaderboard", label: "Leaderboard", icon: Trophy, hint: "Referral counts, verified status and credit balance per member." },
    ],
  },
  {
    label: "Task management",
    items: [
      { id: "Tasks", label: "All tasks", icon: ListChecks, hint: "Create, edit and order the tasks members complete in the bot." },
      { id: "TasksYouTube", label: "YouTube tasks", icon: PlayCircle, hint: "YouTube subscribe tasks." },
      { id: "TasksWhatsApp", label: "WhatsApp tasks", icon: MessageCircle, hint: "WhatsApp channel and community tasks." },
      { id: "TasksFacebook", label: "Facebook tasks", icon: ThumbsUp, hint: "Facebook follow tasks." },
      { id: "TasksTelegram", label: "Telegram verification", icon: Send, hint: "Channels the bot verifies automatically." },
    ],
  },
  {
    label: "Integrations",
    items: [
      { id: "Integrations", label: "Connection health", icon: PlugZap, hint: "Telegram, supplier APIs, email and AI — status, last sync and errors." },
      { id: "SyncHistory", label: "Sync history", icon: History, hint: "Every supplier synchronisation with its result." },
    ],
  },
  {
    label: "System",
    items: [
      { id: "Logs", label: "Error reports", icon: AlertTriangle, hint: "Technical messages kept away from customers." },
      { id: "Security", label: "Admin settings", icon: ShieldCheck, hint: "Session and access controls." },
    ],
  },
  {
    label: "Extension",
    extension: true,
    items: [
      { id: "Generator", label: "Licence center", icon: KeyRound, hint: "Generate, block and track FoxGEN Pro licence keys." },
      { id: "Extension", label: "Release details", icon: Puzzle, hint: "Version, download link and files." },
      { id: "Instructions", label: "Instructions", icon: BookOpen, hint: "Step-by-step guide shown in the bot and on Tutorials." },
    ],
  },
];

export function adminNavItem(id: AdminNavId) {
  for (const group of ADMIN_NAV) {
    const item = group.items.find((i) => i.id === id);
    if (item) return { ...item, group: group.label, extension: !!group.extension };
  }
  return null;
}

export function useAdminAccess() {
  const status = useServerFn(adminAccessStatus);
  return useQuery({ queryKey: ["admin-access"], queryFn: () => status(), staleTime: 30_000 });
}

function NavList({ active, onSelect, onNavigate }: { active: AdminNavId; onSelect?: (id: AdminNavId) => void; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const access = useAdminAccess();
  const extensionUnlocked = access.data?.extension === true;
  const activeGroup = ADMIN_NAV.find((g) => g.items.some((i) => i.id === active))?.label;
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(ADMIN_NAV.map((g) => [g.label, g.label === activeGroup || g.label === "Overview"])));
  const [pending, setPending] = useState<AdminNavId | null>(null);

  const go = (id: AdminNavId) => {
    if (id === "Generator") void navigate({ to: "/admin" });
    else if (onSelect) onSelect(id);
    else void navigate({ to: "/hub-admin", search: { section: id } });
    onNavigate?.();
  };

  return (
    <>
      <nav aria-label="Management" className="flex flex-col">
        {ADMIN_NAV.map((group) => {
          const isOpen = open[group.label] ?? false;
          return (
            <div key={group.label} className="border-b border-sidebar-border py-2 last:border-0">
              <button
                type="button"
                onClick={() => setOpen((o) => ({ ...o, [group.label]: !isOpen }))}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left"
              >
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                  {group.label}
                  {group.extension && !extensionUnlocked && <Lock className="size-3" />}
                </span>
                <ChevronDown className={`size-3.5 text-sidebar-foreground/40 transition ${isOpen ? "" : "-rotate-90"}`} />
              </button>
              {isOpen && (
                <ul className="mt-0.5 space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = item.id === active;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (group.extension && !extensionUnlocked) setPending(item.id);
                            else go(item.id);
                          }}
                          className={`relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-[15px] transition duration-300 ease-weighted ${
                            isActive
                              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                              : "text-sidebar-foreground hover:translate-x-0.5 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                          }`}
                        >
                          {isActive && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-sidebar-primary" />}
                          <item.icon className={`size-[18px] shrink-0 ${isActive ? "text-sidebar-primary" : ""}`} />
                          <span className="truncate">{item.label}</span>
                          {group.extension && !extensionUnlocked && <Lock className="ml-auto size-3.5 text-sidebar-foreground/40" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
      <ExtensionAccessDialog
        open={pending !== null}
        onOpenChange={(v) => !v && setPending(null)}
        onUnlocked={() => {
          const target = pending;
          setPending(null);
          if (target) go(target);
        }}
      />
    </>
  );
}

function ExtensionStatusCard() {
  const access = useAdminAccess();
  const [open, setOpen] = useState(false);
  const unlocked = access.data?.extension === true;
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border border-sidebar-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Extension admin</p>
        <span className={`text-xs font-semibold ${unlocked ? "text-success" : "text-muted-foreground"}`}>{access.isLoading ? "…" : unlocked ? "Unlocked" : "Locked"}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all duration-700 ease-weighted ${unlocked ? "w-full bg-success" : "w-1/4 bg-violet"}`} />
      </div>
      {unlocked ? (
        <button type="button" onClick={() => void navigate({ to: "/admin" })} className="mt-2 text-xs font-medium text-primary hover:underline">Open licence manager</button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <KeyRound className="size-3" /> Unlock with password
        </button>
      )}
      <ExtensionAccessDialog
        open={open}
        onOpenChange={setOpen}
        onUnlocked={() => {
          setOpen(false);
          void access.refetch();
        }}
      />
    </div>
  );
}

function SidebarBody({ active, onSelect, onNavigate }: { active: AdminNavId; onSelect?: (id: AdminNavId) => void; onNavigate?: () => void }) {
  const lock = useServerFn(lockAdmin);
  const navigate = useNavigate();
  const cache = useQueryClient();
  return (
    <div className="flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="space-y-4 px-4 pb-3 pt-5">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={BRAND.mark} alt="" width={36} height={36} className="size-9 rounded-xl bg-ink object-cover shadow-ember" />
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            {BRAND.short}<span className="text-primary">.store</span>
          </span>
        </Link>
        <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar p-2.5 shadow-soft">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">{BRAND.short.charAt(0)}</span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold text-foreground">{BRAND.name}</p>
            <p className="truncate text-xs text-muted-foreground">Control Center</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto border-t border-sidebar-border px-3 py-2">
        <NavList active={active} onSelect={onSelect} onNavigate={onNavigate} />
      </div>
      <div className="space-y-2 border-t border-sidebar-border p-3">
        <ExtensionStatusCard />
        <div className="flex gap-1">
          <Link to="/" className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground">
            <ExternalLink className="size-4" /> Store
          </Link>
          <button
            type="button"
            onClick={async () => {
              await lock();
              await cache.cancelQueries();
              cache.clear();
              await navigate({ to: "/admin-access", search: { redirect: "/hub-admin" } });
            }}
            className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg text-sm text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function BotStatusPill() {
  const load = useServerFn(botDashboard);
  const q = useQuery({ queryKey: ["bot-dashboard"], queryFn: () => load(), staleTime: 60_000 });
  if (q.isLoading) return <span className="hidden h-9 w-36 animate-pulse rounded-full bg-muted sm:inline-block" />;
  if (!q.data) return null;
  const on = q.data.bot.connected;
  return (
    <span className="hidden items-center gap-2 rounded-full border border-border bg-card py-1 pl-3 pr-1 text-sm shadow-soft sm:inline-flex">
      <Bot className="size-4 text-muted-foreground" />
      <span className="max-w-[140px] truncate">{on && q.data.bot.username ? `@${q.data.bot.username}` : "Telegram bot"}</span>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${on ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
        <span className="relative inline-flex size-1.5">
          {on && <span className="absolute inset-0 rounded-full bg-current animate-glow-ping" />}
          <span className="relative size-1.5 rounded-full bg-current" />
        </span>
        {on ? "Online" : "Offline"}
      </span>
    </span>
  );
}

/** Sidebar layout for every management page (store, bot and extension). */
export function AdminShell({
  active,
  onSelect,
  actions,
  children,
  tone = "default",
}: {
  active: AdminNavId;
  onSelect?: (id: AdminNavId) => void;
  actions?: ReactNode;
  children: ReactNode;
  tone?: "default" | "violet";
}) {
  const [open, setOpen] = useState(false);
  const item = adminNavItem(active);
  return (
    <div className="min-h-screen bg-background lg:pl-[17rem]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] lg:block">
        <SidebarBody active={active} onSelect={onSelect} />
      </aside>
      <header className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-10">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button type="button" aria-label="Open management menu" className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-card lg:hidden">
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-0 p-0">
              <SheetTitle className="sr-only">Management menu</SheetTitle>
              <SidebarBody active={active} onSelect={onSelect} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <p className="truncate text-sm text-muted-foreground">
            {item?.group ?? "Control Center"} <span className="text-border">/</span> <span className="text-foreground">{item?.label ?? active}</span>
          </p>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <BotStatusPill />
            {actions}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className={`min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 ${tone === "violet" ? "surface-violet min-h-[calc(100vh-4rem)]" : ""}`}>
        <div className="mb-8 flex items-start gap-3 animate-fade-up">
          {item && (
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${tone === "violet" ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-card text-primary shadow-soft"}`}>
              <item.icon className="size-5" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">{item?.label ?? active}</h1>
            {item?.hint && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{item.hint}</p>}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

/** Consistent metric tile for management pages. */
export function MetricCard({ label, value, icon: Icon, tone = "default", hint }: { label: string; value: ReactNode; icon?: LucideIcon; tone?: "default" | "primary" | "success" | "danger" | "warning"; hint?: ReactNode }) {
  const toneCls = {
    default: "bg-muted text-foreground",
    primary: "bg-accent text-accent-foreground",
    success: "bg-success/10 text-success",
    danger: "bg-destructive/10 text-destructive",
    warning: "bg-warning/15 text-warning-foreground",
  }[tone];
  return (
    <div className="h-full rounded-2xl border border-border bg-card p-5 shadow-soft transition duration-300 ease-weighted hover:shadow-lift">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon && (
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${toneCls}`}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-3xl font-bold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Section card used by admin panels. */
export function Panel({ title, description, actions, children, className = "", icon: Icon }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; icon?: LucideIcon }) {
  return (
    <section className={`rounded-2xl border border-border bg-card shadow-soft ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </span>
            )}
            <div className="min-w-0">
            {title && <h2 className="font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Small status pill with a dot. */
export function StatusDot({ tone, children }: { tone: "success" | "danger" | "warning" | "muted" | "primary"; children: ReactNode }) {
  const cls = {
    success: "bg-success/10 text-success",
    danger: "bg-destructive/10 text-destructive",
    warning: "bg-warning/15 text-warning-foreground",
    muted: "bg-muted text-muted-foreground",
    primary: "bg-accent text-accent-foreground",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
