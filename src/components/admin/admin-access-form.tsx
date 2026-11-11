import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BRAND } from "@/lib/brand";
import { unlockAdmin } from "@/lib/admin-access.functions";

type Destination = "/hub-admin" | "/admin";

/** Compact password form shared by the access popup and the /admin-access screen. */
export function AdminAccessForm({ redirect, onDone }: { redirect: Destination; onDone?: () => void }) {
  const navigate = useNavigate();
  const unlock = useServerFn(unlockAdmin);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <form
      className="space-y-4 sm:space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const result = await unlock({ data: { password } });
          if (result.ok) {
            setPassword("");
            onDone?.();
            await navigate({ to: redirect });
          } else setError("Incorrect password. Try again.");
        } catch {
          setError("Sign-in is temporarily unavailable. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="admin-password" className="text-xs font-medium text-muted-foreground">
          Administrator password
        </Label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={200}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 pl-9 text-base sm:text-sm"
            placeholder="••••••••••••"
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="h-11 w-full gap-2 text-sm font-semibold" disabled={busy}>
        {busy ? "Checking…" : "Unlock control center"}
        {!busy && <ArrowRight className="size-4" />}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" /> Encrypted session · signs out after 8 hours
      </p>
    </form>
  );
}

export function AdminAccessHeader({ title = "Control Center" }: { title?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 pr-5">
      <img src={BRAND.mark} alt={BRAND.name} width={44} height={44} className="size-9 shrink-0 rounded-lg bg-ink object-cover ring-1 ring-border sm:size-11" />
      <div className="min-w-0">
        <p className="eyebrow text-primary">{BRAND.name}</p>
        <h2 className="text-lg font-bold sm:text-xl">{title}</h2>
      </div>
    </div>
  );
}

/** Popup used from the public header to open the management area without leaving the page. */
export function AdminAccessDialog({ trigger, redirect = "/hub-admin" }: { trigger: ReactNode; redirect?: Destination }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-[336px] gap-4 rounded-lg p-4 sm:max-w-sm sm:gap-6 sm:p-7">
        <DialogTitle className="sr-only">Administrator access</DialogTitle>
        <AdminAccessHeader />
        <DialogDescription className="-mt-2 text-sm text-muted-foreground">
          Store, Telegram bot, rewards and offers are managed here.
        </DialogDescription>
        <AdminAccessForm redirect={redirect} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
