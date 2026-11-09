import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BadgeCheck,
  BookOpen,
  Bot,
  ExternalLink,
  Gift,
  KeyRound,
  Layers,
  LayoutDashboard,
  Link2,
  ListChecks,
  LogOut,
  Menu,
  Package,
  Palette,
  Puzzle,
  Receipt,
  ScrollText,
  Store,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { lockAdmin } from "@/lib/admin-access.functions";

export type AdminNavId =
  | "Overview" | "Shop" | "Buying" | "Products" | "Catalog" | "Activity"
  | "Bot" | "Users" | "Referrals" | "Rewards" | "Tasks" | "Branding" | "Links" | "Logs"
  | "Extension" | "Instructions" | "Licenses" | "Generator";

type NavItem = { id: AdminNavId; label: string; icon: LucideIcon; hint: string };

export const ADMIN_NAV: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Store",
    items: [
      { id: "Overview", label: "Overview", icon: LayoutDashboard, hint: "Sales, costs, profit and members at a glance" },
      { id: "Buying", label: "Orders & payments", icon: Receipt, hint: "Review payments, deliver orders and manage wallets" },
      { id: "Shop", label: "Store products", icon: Store, hint: "Prices, stock and what appears in the store" },
      { id: "Products", label: "Downloads", icon: Package, hint: "Downloadable products and files" },
      { id: "Catalog", label: "Catalog settings", icon: Layers, hint: "Categories, communities and payment methods" },
      { id: "Activity", label: "Activity", icon: Activity, hint: "Recent downloads and member actions" },
    ],
  },
  {
    label: "Telegram bot",
    items: [
      { id: "Bot", label: "Bot status", icon: Bot, hint: "Connection, webhook and broadcast messages" },
      { id: "Users", label: "Members", icon: Users, hint: "Search members, change status and adjust credits" },
      { id: "Referrals", label: "Referrals", icon: UserPlus, hint: "Approve or reject invited members" },
      { id: "Rewards", label: "Rewards", icon: Gift, hint: "Licence rewards members can redeem with credits" },
      { id: "Tasks", label: "Join tasks", icon: ListChecks, hint: "Channels and steps members must complete" },
      { id: "Branding", label: "Branding", icon: Palette, hint: "Store name, logo and bot button icons" },
      { id: "Links", label: "Links", icon: Link2, hint: "Support, social and channel links" },
      { id: "Logs", label: "Error logs", icon: ScrollText, hint: "Technical messages kept away from customers" },
    ],
  },
  {
    label: "Extension",
    items: [
      { id: "Generator", label: "Licence center", icon: KeyRound, hint: "Generate, block and track FoxGEN Pro licence keys" },
      { id: "Licenses", label: "Redeemed licences", icon: BadgeCheck, hint: "Licences members redeemed with credits" },
      { id: "Extension", label: "Release details", icon: Puzzle, hint: "Version, download link and guides" },
      { id: "Instructions", label: "Instructions", icon: BookOpen, hint: "Step-by-step guide shown in the bot" },
    ],
  },
];

export function adminNavItem(id: AdminNavId) {
  for (const group of ADMIN_NAV) {
    const item = group.items.find((i) => i.id === id);
    if (item) return { ...item, group: group.label };
  }
  return null;
}

function NavList({ active, onSelect, onNavigate }: { active: AdminNavId; onSelect?: (id: AdminNavId) => void; onNavigate?: () => void }) {
  return (
    <nav aria-label="Management" className="flex flex-col gap-6">
      {ADMIN_NAV.map((group) => (
        <div key={group.label}>
          <p className="eyebrow px-3 pb-2 text-[10px] text-sidebar-foreground/50">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = item.id === active;
              const cls = `flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
                isActive
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
              }`;
              const inner = (
                <>
                  <item.icon className={`size-4 ${isActive ? "text-sidebar-primary" : ""}`} />
                  <span className="truncate">{item.label}</span>
                  {isActive && <span className="ml-auto size-1.5 rounded-full bg-sidebar-primary" />}
                </>
              );
              return (
                <li key={item.id}>
                  {item.id === "Generator" ? (
                    <Link to="/admin" onClick={onNavigate} className={cls}>
                      {inner}
                    </Link>
                  ) : onSelect ? (
                    <button
                      type="button"
                      className={cls}
                      onClick={() => {
                        onSelect(item.id);
                        onNavigate?.();
                      }}
                    >
                      {inner}
                    </button>
                  ) : (
                    <Link to="/hub-admin" search={{ section: item.id }} onClick={onNavigate} className={cls}>
                      {inner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarBody({ active, onSelect, onNavigate }: { active: AdminNavId; onSelect?: (id: AdminNavId) => void; onNavigate?: () => void }) {
  const lock = useServerFn(lockAdmin);
  const navigate = useNavigate();
  const cache = useQueryClient();
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-5">
        <img src="/foxgen-logo.png" alt="" width={32} height={32} className="size-8 rounded-lg" />
        <div className="leading-tight">
          <p className="font-display text-sm font-bold text-sidebar-accent-foreground">FOXGEN</p>
          <p className="eyebrow text-[9px] text-sidebar-foreground/60">Control Center</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <NavList active={active} onSelect={onSelect} onNavigate={onNavigate} />
      </div>
      <div className="space-y-0.5 border-t border-sidebar-border p-3">
        <Link to="/" className="flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground">
          <ExternalLink className="size-4" /> View store
        </Link>
        <button
          type="button"
          onClick={async () => {
            await lock();
            await cache.cancelQueries();
            cache.clear();
            await navigate({ to: "/admin-access", search: { redirect: "/hub-admin" } });
          }}
          className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </div>
    </div>
  );
}

/** Sidebar layout for every management page (store, bot and extension). */
export function AdminShell({
  active,
  onSelect,
  actions,
  children,
}: {
  active: AdminNavId;
  onSelect?: (id: AdminNavId) => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const item = adminNavItem(active);
  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarBody active={active} onSelect={onSelect} />
      </aside>
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl">
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
          <div className="min-w-0 flex-1">
            <p className="eyebrow truncate text-[10px] text-muted-foreground">{item?.group ?? "Control Center"}</p>
            <h1 className="truncate text-lg font-bold sm:text-xl">{item?.label ?? active}</h1>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </header>
      <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        {item?.hint && <p className="mb-6 max-w-2xl text-sm text-muted-foreground">{item.hint}</p>}
        {children}
      </main>
    </div>
  );
}

/** Consistent metric tile for management pages. */
export function MetricCard({ label, value, icon: Icon, tone = "default" }: { label: string; value: ReactNode; icon?: LucideIcon; tone?: "default" | "primary" | "success" | "danger" }) {
  const toneCls = {
    default: "bg-muted text-foreground",
    primary: "bg-accent text-accent-foreground",
    success: "bg-success/10 text-success",
    danger: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && (
          <span className={`flex size-8 items-center justify-center rounded-lg ${toneCls}`}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-3xl font-bold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}
