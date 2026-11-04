import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { prepareOwnerLogin } from "@/lib/owner-login.functions";
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

const OWNER_EMAIL = "mirzawebsolution@gmail.com";

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  // Only the owner can open the CRM, so the email is fixed and only the password is asked.
  const email = OWNER_EMAIL;
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
    try {
      const prep = await prepareOwnerLogin({ data: { password } });
      if (!prep.ok) {
        setBusy(false);
        setMsg("Wrong password. Try again.");
        return;
      }
    } catch {
      setBusy(false);
      setMsg("Sign-in is temporarily unavailable. Please try again.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      if (/confirm/i.test(error.message)) {
        setUnconfirmed(true);
        setMsg("First-time setup: tap \"Create / reset password\" below. A link goes to your Gmail; open it and choose your password.");
      } else setMsg("Wrong password. Try again or tap \"Create / reset password\".");
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
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    setMsg(error ? error.message : "Link sent to your Gmail (check spam too). Open it and set your CRM password.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={signIn} className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">FoxGEN CRM</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Enter CRM password</h1>
        </div>
        <input type="hidden" name="username" autoComplete="username" value={email} readOnly />
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
            Create / reset password
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
