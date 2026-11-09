import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { adminDestination } from "@/lib/admin-access.policy";
import { AdminAccessForm, AdminAccessHeader } from "@/components/admin/admin-access-form";

export const Route = createFileRoute("/admin-access")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: adminDestination(s.redirect) }),
  head: () => ({
    meta: [
      { title: "Admin Access — Foxgen AI Store" },
      { name: "description", content: "Secure password access to the Foxgen AI Store control center." },
      { property: "og:title", content: "Admin Access — Foxgen AI Store" },
      { property: "og:description", content: "Foxgen AI Store administrator sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAccess,
});

function AdminAccess() {
  const { redirect } = Route.useSearch();
  return (
    <main className="surface-ink relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="bg-grid-ink pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[140px]" />
      <div className="relative w-full max-w-sm">
        <Link to="/" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to store
        </Link>
        {/* Light dialog card on the ink backdrop */}
        <div className="rounded-2xl border border-border surface-light bg-background p-6 text-foreground shadow-lift sm:p-7">
          <AdminAccessHeader title={redirect === "/admin" ? "Licence Center" : "Control Center"} />
          <p className="mt-3 text-sm text-muted-foreground">Store, Telegram bot, rewards and offers are managed here.</p>
          <div className="mt-6">
            <AdminAccessForm redirect={redirect} />
          </div>
        </div>
      </div>
    </main>
  );
}
