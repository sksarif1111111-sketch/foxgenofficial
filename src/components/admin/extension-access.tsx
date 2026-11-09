import { useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, KeyRound, Loader2, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { unlockExtension } from "@/lib/admin-access.functions";

/** Compact unlock form for the Extension Control Center (server-verified, never stores the password). */
export function ExtensionAccessForm({ onUnlocked }: { onUnlocked: () => void }) {
  const unlock = useServerFn(unlockExtension);
  const cache = useQueryClient();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const res = await unlock({ data: { password } });
          if (res.ok) {
            setPassword("");
            await cache.invalidateQueries({ queryKey: ["admin-access"] });
            onUnlocked();
          } else setError(res.reason === "signin" ? "Your Control Center session ended. Sign in again." : "Incorrect password. Try again.");
        } catch {
          setError("Unlock is temporarily unavailable. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="extension-password" className="text-xs font-medium text-muted-foreground">Extension admin password</Label>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="extension-password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            autoFocus
            required
            maxLength={200}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 pl-9 pr-11"
            placeholder="••••••••••••"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <Button type="submit" className="h-11 w-full gap-2" disabled={busy || !password}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Puzzle className="size-4" />}
        {busy ? "Checking…" : "Unlock Extension Admin"}
      </Button>
    </form>
  );
}

export function ExtensionAccessHeader() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-11 items-center justify-center rounded-xl bg-ink text-ink-foreground"><Puzzle className="size-5" /></span>
      <div>
        <p className="eyebrow text-primary">FoxGEN Pro</p>
        <h2 className="text-xl font-bold">Extension Admin</h2>
      </div>
    </div>
  );
}

export function ExtensionAccessDialog({ open, onOpenChange, onUnlocked }: { open: boolean; onOpenChange: (open: boolean) => void; onUnlocked: () => void; children?: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-5 rounded-2xl p-6 sm:p-7">
        <DialogTitle className="sr-only">Extension admin access</DialogTitle>
        <ExtensionAccessHeader />
        <DialogDescription className="-mt-1 text-sm text-muted-foreground">
          Licence generation, blocking and deletion need a separate unlock. It stays active for this admin session.
        </DialogDescription>
        <ExtensionAccessForm
          onUnlocked={() => {
            onOpenChange(false);
            onUnlocked();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
