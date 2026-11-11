import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { CustomerAuthShell } from "@/components/site/customer-auth-shell";
import { useCustomerSession } from "@/components/site/customer-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeCustomerRedirect } from "@/lib/customer-auth.policy";
import { Eye, EyeSlash, EnvelopeSimple, LockKey, ArrowRight, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({ redirect: safeCustomerRedirect(s["redirect"]) }),
  head: () => ({ meta: [
    { title: "Sign in & create account — Foxgen AI Store" },
    { name: "description", content: "Sign in to Foxgen AI Store with email, Google, Microsoft or Apple to place and track your website orders." },
    { property: "og:title", content: "Your account — Foxgen AI Store" },
    { property: "og:description", content: "Secure shopping with email verification and your preferred sign-in method." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" },
  ] }), component: LoginPage,
});

function GoogleMark() {
  return <svg aria-hidden="true" className="size-[18px] shrink-0" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>;
}

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const { user, refresh } = useCustomerSession();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"login" | "signup" | "otp" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (user?.email_confirmed_at) void navigate({ to: redirect, replace: true }); }, [user, navigate, redirect]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (params.get("error") || hash.get("error")) setError("Sign-in could not be completed. Please try again.");
    const tokenHash = params.get("token_hash");
    if (tokenHash && params.get("type") === "signup") {
      void supabase.auth.verifyOtp({ token_hash: tokenHash, type: "signup" }).then(async result => {
        if (result.error) setError("This verification link is invalid or expired."); else await refresh();
        window.history.replaceState(null, "", `/login?redirect=${encodeURIComponent(redirect)}`);
      });
    }
  }, [redirect]);
  const complete = async () => { await refresh(); queryClient.clear(); await navigate({ to: redirect, replace: true }); };
  const switchMode = (next: typeof mode) => { setMode(next); setError(""); setNotice(""); setPassword(""); };
  const work = async (fn: () => Promise<void>) => { setBusy(true); setError(""); setNotice(""); try { await fn(); } catch { setError("This request could not be completed. Please try again."); } finally { setBusy(false); } };
  const social = (provider: "google" | "microsoft" | "apple") => void work(async () => {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: `${window.location.origin}/login?redirect=${encodeURIComponent(redirect)}` });
    if (result.error) { setError("Sign-in could not be completed. Please try again."); return; }
    if (!result.redirected) await complete();
  });
  const submit = (event: React.FormEvent) => { event.preventDefault(); void work(async () => {
    const address = email.trim().toLowerCase();
    if (mode === "otp") {
      const result = await supabase.auth.verifyOtp({ email: address, token: otp.trim(), type: "signup" });
      if (result.error) { setError("That code is invalid or expired. Try again or request a new code."); return; }
      await complete(); return;
    }
    if (mode === "forgot") {
      const result = await supabase.auth.resetPasswordForEmail(address, { redirectTo: `${window.location.origin}/reset-password` });
      if (result.error) { setError("Could not send the reset email. Please try again later."); return; }
      setNotice("If this email has an account, a password reset link is on its way. Check your inbox and spam folder."); return;
    }
    if (mode === "signup") {
      const result = await supabase.auth.signUp({ email: address, password, options: { emailRedirectTo: `${window.location.origin}/login?redirect=${encodeURIComponent(redirect)}` } });
      if (result.error) { setError(result.error.status === 429 ? "Please wait before requesting another email." : "Could not create the account. Check your email and password, then try again."); return; }
      setPassword(""); setMode("otp"); setResendAt(Date.now() + 60000); setNow(Date.now());
      setNotice("Check your email for the verification code or confirmation link. Your account is ready only after verification."); return;
    }
    const result = await supabase.auth.signInWithPassword({ email: address, password });
    if (result.error) { setError(/confirm/i.test(result.error.message) ? "Verify your email before signing in. Create account again to request verification." : "Email or password is incorrect."); return; }
    await complete();
  }); };
  const heading = mode === "signup" ? "Create your account" : mode === "otp" ? "Verify your email" : mode === "forgot" ? "Reset your password" : "Welcome back";
  return <CustomerAuthShell>
    <h1 className="heading-6 sm:heading-4 text-center">{heading}</h1>
    <p className="body-6 mb-3 mt-2 break-words text-center text-muted-foreground sm:mb-4">{mode === "otp" ? email : mode === "signup" ? "Your next purchase starts here." : mode === "forgot" ? "A fresh start for your store account." : "Sign in to your Foxgen store account."}</p>
    {(mode === "login" || mode === "signup") && <>
      <div className="space-y-2">
        <Button className="google-login w-full justify-center gap-[10px] px-3" disabled={busy} onClick={() => social("google")}><GoogleMark />Continue with Google</Button>
        <Button variant="outline" className="w-full gap-3 bg-card" disabled={busy} onClick={() => social("microsoft")}><span aria-hidden="true" className="microsoft-mark"><i/><i/><i/><i/></span>Continue with Microsoft</Button>
        <Button className="apple-login w-full" disabled={busy} onClick={() => social("apple")}>Continue with Apple</Button>
      </div>
      <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/>or with email<span className="h-px flex-1 bg-border"/></div>
    </>}
    <form onSubmit={submit} className="space-y-3">
      {mode !== "otp" && <div className="space-y-2"><Label htmlFor="customer-email">Email address</Label><div className="relative"><EnvelopeSimple className="absolute left-3 top-3.5 text-muted-foreground" size={18}/><Input id="customer-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} className="h-11 bg-card/70 pl-10" placeholder="you@example.com"/></div></div>}
      {(mode === "login" || mode === "signup") && <div className="space-y-2"><Label htmlFor="customer-password">Password</Label><div className="relative"><LockKey className="absolute left-3 top-3.5 text-muted-foreground" size={18}/><Input id="customer-password" type={show ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : undefined} maxLength={200} required value={password} onChange={e => setPassword(e.target.value)} className="h-11 bg-card/70 pl-10 pr-10" placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"}/><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 size-9" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}>{show ? <EyeSlash size={18}/> : <Eye size={18}/>}</Button></div></div>}
      {mode === "otp" && <div className="space-y-2"><Label htmlFor="verification-code">Verification code</Label><Input id="verification-code" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={8} pattern="[0-9]{6,8}" required value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="Enter your email code" className="h-12 bg-card/70 text-center font-mono text-lg"/></div>}
      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-card/70 p-3 text-sm text-foreground">{notice}</p>}
      <Button type="submit" disabled={busy} className="h-11 w-full gap-2">{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "otp" ? "Verify email" : mode === "forgot" ? "Send reset link" : "Sign in"}<ArrowRight size={18}/></Button>
    </form>
    <div className="mt-2 flex flex-wrap items-center justify-center gap-0 text-sm sm:mt-4 sm:gap-2">
      {mode === "login" ? <><Button variant="link" disabled={busy} onClick={() => switchMode("forgot")}>Forgot password?</Button><Button variant="link" disabled={busy} onClick={() => switchMode("signup")}>Create account</Button></> : <Button variant="link" disabled={busy} onClick={() => switchMode("login")}>Back to sign in</Button>}
      {mode === "otp" && <Button variant="link" disabled={busy || now < resendAt} onClick={() => void work(async () => { const r = await supabase.auth.resend({ type: "signup", email: email.trim().toLowerCase(), options: { emailRedirectTo: `${window.location.origin}/login?redirect=${encodeURIComponent(redirect)}` } }); if (r.error) setError("Could not resend. Wait a moment and try again."); else { setNotice("Verification email sent. Check your inbox."); setResendAt(Date.now() + 60000); } })}>{now < resendAt ? `Resend in ${Math.ceil((resendAt - now) / 1000)}s` : "Resend code"}</Button>}
    </div>
    <p className="caption-3 mt-3 flex items-center justify-center gap-2 text-muted-foreground sm:mt-5"><ShieldCheck size={16}/>Secure account · Verified email</p>
    <p className="caption-4 mt-2 text-center text-muted-foreground sm:mt-3"><Link to="/terms" className="underline">Terms</Link> · <Link to="/privacy" className="underline">Privacy</Link></p>
  </CustomerAuthShell>;
}