import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomerAuthShell } from "@/components/site/customer-auth-shell";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Foxgen AI Store" },
      { name: "description", content: "Securely reset your Foxgen AI Store account password." },
      { property: "og:title", content: "Reset password — Foxgen AI Store" },
      { property: "og:description", content: "Choose a new password from your recovery email." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const search = new URLSearchParams(window.location.search);
    if (hash.get("type") === "recovery") setRecovery(true);
    const { data } = supabase.auth.onAuthStateChange(event => { if (event === "PASSWORD_RECOVERY") setRecovery(true); });
    const tokenHash = search.get("token_hash");
    if (tokenHash && search.get("type") === "recovery") void supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }).then(r => { if (!r.error) setRecovery(true); else setMsg("This reset link is invalid or expired."); });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!recovery) return setMsg("Open the password reset link from your email first.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setMsg(error.message);
    navigate({ to: "/account", replace: true });
  }

  return (
    <CustomerAuthShell>
      <form onSubmit={submit} className="space-y-5">
        <h1 className="text-2xl font-bold text-foreground">Set a new password</h1>
        <div className="space-y-2">
          <Label htmlFor="pw">New password</Label>
          <Input id="pw" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {msg && <p className="text-sm text-destructive">{msg}</p>}
        {!recovery && <p className="text-sm text-muted-foreground">Open your recovery email to reset your password.</p>}
        <Button type="submit" className="w-full" disabled={busy || !recovery}>
          Save password
        </Button>
      </form>
    </CustomerAuthShell>
  );
}
