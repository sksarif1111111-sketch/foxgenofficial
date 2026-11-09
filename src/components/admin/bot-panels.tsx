import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusDot } from "@/components/admin/admin-shell";
import { adminAdjustCredits, adminDeleteTask, adminResetUserTasks, adminSaveTask, adminSetUserStatus, adminTasks, adminUsers } from "@/lib/hubadmin.functions";
import { shortDate } from "@/lib/format";

type Notify = (message: string) => void;
const field = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/15";
const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/* ---------------------------------- Tasks --------------------------------- */

export type TaskFilter = "all" | "youtube" | "whatsapp" | "facebook" | "telegram";
type TaskRow = Awaited<ReturnType<typeof adminTasks>>[number];
type TaskInput = {
  id?: string;
  name: string;
  platform: string;
  description: string;
  url: string;
  telegram_chat_id: string;
  verification_type: "manual_confirmation" | "telegram_auto_verification";
  display_order: number;
  required: boolean;
  enabled: boolean;
};

const PLATFORMS = ["youtube", "whatsapp", "facebook", "telegram", "instagram", "x", "website", "other"];

function matchesFilter(t: { platform: string; verification_type: string }, f: TaskFilter) {
  if (f === "all") return true;
  if (f === "telegram") return t.verification_type === "telegram_auto_verification" || t.platform.toLowerCase().includes("telegram");
  return t.platform.toLowerCase().includes(f);
}

function toInput(t: TaskRow): TaskInput {
  return {
    id: t.id,
    name: t.name,
    platform: t.platform,
    description: t.description ?? "",
    url: t.url ?? "",
    telegram_chat_id: t.telegram_chat_id ?? "",
    verification_type: t.verification_type as TaskInput["verification_type"],
    display_order: t.display_order,
    required: t.required,
    enabled: t.enabled,
  };
}

function TaskForm({ value, onChange }: { value: TaskInput; onChange: (v: TaskInput) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-medium text-muted-foreground">Task name (shown in the bot)</span>
        <input className={field} value={value.name} maxLength={120} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="▶️ Subscribe to YouTube" />
      </label>
      <label className="space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Platform</span>
        <select className={field} value={PLATFORMS.includes(value.platform) ? value.platform : "other"} onChange={(e) => onChange({ ...value, platform: e.target.value })}>
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <label className="space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Verification</span>
        <select className={field} value={value.verification_type} onChange={(e) => onChange({ ...value, verification_type: e.target.value as TaskInput["verification_type"] })}>
          <option value="manual_confirmation">Member confirms (manual)</option>
          <option value="telegram_auto_verification">Bot checks Telegram membership</option>
        </select>
      </label>
      <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-medium text-muted-foreground">Task link</span>
        <input className={field} value={value.url} maxLength={500} onChange={(e) => onChange({ ...value, url: e.target.value })} placeholder="https://…" />
      </label>
      {value.verification_type === "telegram_auto_verification" && (
        <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-medium text-muted-foreground">Telegram channel (@username or -100… id). The bot must be an admin there.</span>
          <input className={field} value={value.telegram_chat_id} maxLength={120} onChange={(e) => onChange({ ...value, telegram_chat_id: e.target.value })} />
        </label>
      )}
      <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-medium text-muted-foreground">Description</span>
        <textarea className={`${field} h-20 py-2`} value={value.description} maxLength={500} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </label>
      <label className="space-y-1.5"><span className="text-xs font-medium text-muted-foreground">Priority (lower shows first)</span>
        <input type="number" min={0} max={999} className={field} value={value.display_order} onChange={(e) => onChange({ ...value, display_order: Math.max(0, Math.min(999, Math.floor(Number(e.target.value) || 0))) })} />
      </label>
      <div className="flex flex-wrap items-end gap-4 pb-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={value.enabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />Enabled</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={value.required} onChange={(e) => onChange({ ...value, required: e.target.checked })} />Required to unlock Invite &amp; Earn</label>
      </div>
    </div>
  );
}

function TaskCard({ task, notify, onSaved }: { task: TaskRow; notify: Notify; onSaved: () => Promise<void> }) {
  const fSave = useServerFn(adminSaveTask);
  const fDelete = useServerFn(adminDeleteTask);
  const [value, setValue] = useState<TaskInput>(toInput(task));
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(toInput(task));
  const save = useMutation({
    mutationFn: () => fSave({ data: value }),
    onSuccess: async () => { notify(`“${value.name}” saved. The bot uses it on the next tap.`); await onSaved(); },
    onError: (e) => notify(errMsg(e, "Could not save this task.")),
  });
  const del = useMutation({
    mutationFn: () => fDelete({ data: { id: task.id } }),
    onSuccess: async () => { notify("Task deleted."); await onSaved(); },
    onError: (e) => notify(errMsg(e, "Could not delete this task.")),
  });
  const vis = task.bot_visibility;
  return (
    <article className="rounded-xl border border-border bg-card shadow-soft">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left">
        <span className="w-8 text-center font-mono text-xs text-muted-foreground">{task.display_order}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{task.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{task.platform} · {task.verification_type === "telegram_auto_verification" ? "auto-checked" : "member confirms"} · {task.required ? "required" : "optional"}</span>
        </span>
        {vis === "shown" ? <StatusDot tone="success">Shown in bot</StatusDot> : vis === "disabled" ? <StatusDot tone="muted">Disabled</StatusDot> : <StatusDot tone="warning">Hidden — same link as another task</StatusDot>}
      </button>
      {open && (
        <div className="space-y-4 border-t border-border p-4">
          <TaskForm value={value} onChange={setValue} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!dirty || save.isPending || !value.name.trim()} onClick={() => save.mutate()} className="gap-1.5">
              {save.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save changes
            </Button>
            {dirty && <Button size="sm" variant="outline" onClick={() => setValue(toInput(task))}>Discard</Button>}
            <Button size="sm" variant="outline" className="ml-auto gap-1.5 text-destructive hover:bg-destructive/10" onClick={() => setConfirm(true)}><Trash2 className="size-3.5" /> Delete</Button>
          </div>
        </div>
      )}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete this task?</AlertDialogTitle>
          <AlertDialogDescription>“{task.name}” will disappear from the bot. Members' existing completions for it are removed.</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => del.mutate()}>Delete task</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

export function TasksPanel({ notify, filter }: { notify: Notify; filter: TaskFilter }) {
  const fList = useServerFn(adminTasks);
  const fSave = useServerFn(adminSaveTask);
  const cache = useQueryClient();
  const q = useQuery({ queryKey: ["admin-tasks"], queryFn: () => fList() });
  const blank = (): TaskInput => ({
    name: "",
    platform: filter === "all" ? "youtube" : filter,
    description: "",
    url: "",
    telegram_chat_id: "",
    verification_type: filter === "telegram" ? "telegram_auto_verification" : "manual_confirmation",
    display_order: (q.data?.length ?? 0) + 1,
    required: true,
    enabled: true,
  });
  const [draft, setDraft] = useState<TaskInput | null>(null);
  const refresh = async () => { await cache.invalidateQueries({ queryKey: ["admin-tasks"] }); };
  const create = useMutation({
    mutationFn: (v: TaskInput) => fSave({ data: v }),
    onSuccess: async () => { notify("Task added. It now appears in the bot's task list."); setDraft(null); await refresh(); },
    onError: (e) => notify(errMsg(e, "Could not add this task.")),
  });
  const rows = (q.data ?? []).filter((t) => matchesFilter(t, filter));
  const shown = (q.data ?? []).filter((t) => t.bot_visibility === "shown").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{q.data ? `${shown} of ${q.data.length} tasks are shown in the bot. Invite & Earn unlocks only after every required task is verified.` : " "}</p>
        <Button onClick={() => setDraft(blank())} className="gap-1.5"><Plus className="size-4" /> Add task</Button>
      </div>
      {draft && (
        <div className="space-y-4 rounded-xl border border-primary/40 bg-card p-4 shadow-soft">
          <p className="font-semibold">New task</p>
          <TaskForm value={draft} onChange={setDraft} />
          <div className="flex gap-2">
            <Button disabled={create.isPending || !draft.name.trim()} onClick={() => create.mutate(draft)} className="gap-1.5">{create.isPending && <Loader2 className="size-4 animate-spin" />}Add task</Button>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </div>
      )}
      {q.isLoading ? (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading tasks…</p>
      ) : q.isError ? (
        <p role="alert" className="text-sm text-destructive">Could not load tasks.</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">No tasks in this group yet.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((t) => <TaskCard key={`${t.id}-${t.display_order}-${t.name}-${t.enabled}`} task={t} notify={notify} onSaved={refresh} />)}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Members -------------------------------- */

type UserRow = Awaited<ReturnType<typeof adminUsers>>[number];

export function MembersPanel({ notify }: { notify: Notify }) {
  const fUsers = useServerFn(adminUsers);
  const fStatus = useServerFn(adminSetUserStatus);
  const fCredits = useServerFn(adminAdjustCredits);
  const fReset = useServerFn(adminResetUserTasks);
  const cache = useQueryClient();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [adjust, setAdjust] = useState<{ user: UserRow; amount: string; reason: string } | null>(null);
  const q = useQuery({ queryKey: ["admin-users", term], queryFn: () => fUsers({ data: { search: term } }) });
  const refresh = () => cache.invalidateQueries({ queryKey: ["admin-users"] });

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); notify(ok); await refresh(); } catch (e) { notify(errMsg(e, "Action failed.")); }
  };

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setTerm(search.trim()); }}>
        <label className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search username, name or referral code" className={`${field} pl-9`} />
        </label>
        <Button type="submit" variant="outline">Search</Button>
      </form>
      {q.isLoading ? (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading members…</p>
      ) : q.isError ? (
        <p role="alert" className="text-sm text-destructive">Could not load members.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>{["Member", "Code", "Status", "Credits (avail. / earned / spent)", "Joined", "Actions"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(q.data ?? []).map((u) => (
                  <tr key={u.id} className="align-top hover:bg-muted/30">
                    <td className="px-4 py-3"><p className="font-medium">{u.telegram_username ? `@${u.telegram_username}` : (u.first_name ?? "Member")}</p><p className="text-xs text-muted-foreground">TG {u.telegram_user_id}</p></td>
                    <td className="px-4 py-3 font-mono text-xs">{u.referral_code}</td>
                    <td className="px-4 py-3">
                      <select
                        aria-label="Member status"
                        value={u.status}
                        onChange={(e) => void run(() => fStatus({ data: { id: u.id, status: e.target.value as "active" | "pending" | "banned" | "suspicious" } }), "Status updated.")}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        {["active", "pending", "banned", "suspicious"].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 tabular-nums"><b>{u.credits_available}</b> <span className="text-muted-foreground">/ {u.credits_earned} / {u.credits_spent}</span></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{shortDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setAdjust({ user: u, amount: "1", reason: "" })}>Adjust credits</Button>
                        <Button size="sm" variant="ghost" title="Reset task progress" onClick={() => void run(() => fReset({ data: { userId: u.id } }), "Task progress reset — member is pending again.")}><RotateCcw className="size-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!(q.data ?? []).length && <p className="px-4 py-10 text-center text-sm text-muted-foreground">No members found.</p>}
          </div>
        </div>
      )}
      <AlertDialog open={!!adjust} onOpenChange={(v) => !v && setAdjust(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Adjust credits</AlertDialogTitle>
          <AlertDialogDescription>Recorded as a credit transaction for {adjust?.user.telegram_username ? `@${adjust.user.telegram_username}` : adjust?.user.first_name ?? "this member"}. Use a negative number to remove credits.</AlertDialogDescription>
          {adjust && (
            <div className="grid gap-3">
              <input type="number" className={field} value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} aria-label="Credit amount" />
              <input className={field} value={adjust.reason} maxLength={200} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} placeholder="Reason (required)" aria-label="Reason" />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!adjust || !adjust.reason.trim() || !Number.isInteger(Number(adjust.amount)) || Number(adjust.amount) === 0}
              onClick={() => adjust && void run(() => fCredits({ data: { id: adjust.user.id, amount: Number(adjust.amount), reason: adjust.reason.trim() } }), `${Number(adjust.amount) > 0 ? "+" : ""}${adjust.amount} credits applied.`)}
            >
              Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
