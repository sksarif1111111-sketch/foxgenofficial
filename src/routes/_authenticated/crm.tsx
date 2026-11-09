import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({
    meta: [
      { title: "Sales CRM — FoxGEN Admin" },
      { name: "description", content: "Admin-only sales CRM: sales, expenses, fees, refunds and net profit." },
      { property: "og:title", content: "Sales CRM — FoxGEN Admin" },
      { property: "og:description", content: "Track digital product sales and profit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CrmLayout,
});

const NAV = [
  { to: "/crm", label: "Dashboard" },
  { to: "/crm/sale", label: "New sale" },
  { to: "/crm/orders", label: "Orders" },
  { to: "/crm/customers", label: "Customers" },
  { to: "/crm/products", label: "Products" },
  { to: "/crm/inventory", label: "Inventory" },
  { to: "/crm/payments", label: "Payments" },
  { to: "/crm/expenses", label: "Expenses" },
  { to: "/crm/refunds", label: "Refunds" },
  { to: "/crm/reports", label: "Reports" },
  { to: "/crm/bot", label: "Bot management" },
] as const;

function CrmLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const admin = useQuery({
    queryKey: ["crm", "is-admin", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_admin", { _user_id: user.id });
      if (error) throw error;
      return Boolean(data);
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { redirect: "/crm" }, replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster />
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black tracking-tight">FoxGEN</span>
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Sales CRM</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
            <Button size="sm" variant="outline" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/crm" }}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              activeProps={{ className: "bg-muted text-foreground font-semibold" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        {admin.isPending ? (
          <p className="text-muted-foreground">Checking access…</p>
        ) : admin.data ? (
          <Outlet />
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <h1 className="text-xl font-bold">Admins only</h1>
            <p className="mt-2 text-muted-foreground">This account does not have access to the sales CRM.</p>
          </div>
        )}
      </main>
    </div>
  );
}
