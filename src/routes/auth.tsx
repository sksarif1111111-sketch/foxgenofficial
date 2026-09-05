import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "FoxGEN Admin Sign In" },
      { name: "description", content: "Sign in to the FoxGEN admin panel to generate and manage license keys." },
      { property: "og:title", content: "FoxGEN Admin Sign In" },
      { property: "og:description", content: "Sign in to manage FoxGEN license keys." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (err) throw err;
        setInfo("Account created. You can sign in now.");
        setMode("signin");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate({ to: "/admin" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-8">
        <h1 className="text-2xl font-black">FoxGEN Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin" ? "Sign in to manage licenses." : "Create the owner account."}
        </p>

        <label className="mt-6 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
        />

        <label className="mt-4 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Password
        </label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
        />

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        {info && <p className="mt-4 text-sm text-primary">{info}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "First time? Create the owner account" : "Already have an account? Sign in"}
        </button>
      </form>
    </main>
  );
}
