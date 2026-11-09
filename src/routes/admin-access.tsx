import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminDestination } from "@/lib/admin-access.policy";
import { unlockAdmin } from "@/lib/admin-access.functions";

export const Route = createFileRoute("/admin-access")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: adminDestination(s.redirect) }),
  head: () => ({ meta: [
    { title: "Admin Access — FoxGEN Store" },
    { name: "description", content: "Secure password access to FoxGEN administration." },
    { property: "og:title", content: "Admin Access — FoxGEN Store" },
    { property: "og:description", content: "FoxGEN Store administrator sign-in." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: AdminAccess,
});

function AdminAccess() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const unlock = useServerFn(unlockAdmin);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <main className="flex min-h-screen items-center justify-center bg-background px-4">
    <form className="w-full max-w-sm space-y-6" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError("");
      try {
        const result = await unlock({ data: { password } });
        if (result.ok) { setPassword(""); await navigate({ to: redirect }); }
        else setError("Incorrect password. Try again.");
      } catch { setError("Sign-in is temporarily unavailable. Please try again."); }
      finally { setBusy(false); }
    }}>
      <img src="/foxgen-logo.png" alt="FoxGEN" width={56} height={56} className="h-14 w-14 rounded-lg" />
      <h1 className="flex items-center gap-3 text-2xl font-bold"><LockKeyhole className="h-6 w-6 text-primary" />Admin access</h1>
      <div className="space-y-2"><Label htmlFor="admin-password">Password</Label>
        <Input id="admin-password" type="password" autoComplete="current-password" required maxLength={200} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : "Sign in"}</Button>
    </form>
  </main>;
}