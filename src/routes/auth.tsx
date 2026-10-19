import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") && !s.redirect.startsWith("//") ? s.redirect : "/crm",
  }),
  head: () => ({
    meta: [
      { title: "Admin Sign In — FoxGEN CRM" },
      { name: "description", content: "Sign in to the FoxGEN sales CRM admin dashboard." },
      { property: "og:title", content: "Admin Sign In — FoxGEN CRM" },
      { property: "og:description", content: "Secure admin sign-in for the FoxGEN sales CRM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: redirect, replace: true });
    });
  }, [navigate, redirect]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setUnconfirmed(false);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      if (/confirm/i.test(error.message)) {
        setUnconfirmed(true);
        setMsg("This email is not confirmed yet. Send a new confirmation link, open it, then sign in.");
      } else setMsg(error.message);
      return;
    }
    navigate({ to: redirect, replace: true });
  }

  async function resend() {
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
    setBusy(false);
    setMsg(error ? error.message : "Confirmation link sent. Check your inbox (and spam folder).");
  }

  async function forgot() {
    if (!email.trim()) return setMsg("Enter your email first.");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    setMsg(error ? error.message : "Password reset link sent to your email.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={signIn} className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">FoxGEN CRM</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Admin sign in</h1>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : "Sign in"}
        </Button>
        <div className="flex justify-between text-sm">
          <button type="button" onClick={forgot} className="text-muted-foreground hover:text-foreground">
            Forgot password?
          </button>
          {unconfirmed && (
            <button type="button" onClick={resend} className="text-primary hover:underline">
              Resend confirmation
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
