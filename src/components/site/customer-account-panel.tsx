import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { ArrowUpRight, CheckCircle, Copy, GraduationCap, Receipt, ShoppingBag, UserCircle, Wallet } from "@phosphor-icons/react/dist/ssr";
import { supabase } from "@/integrations/supabase/client";
import { customerAccountSummary, customerMyOrders } from "@/lib/customer-shop.functions";
import { studentVoucher } from "@/lib/customer-account.policy";
import { memberLabel } from "@/lib/member-number";
import { ReviewCountdown } from "@/components/site/review-countdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function CustomerAccountPanel({ user, memberNumber, signOut }: { user: User; memberNumber: number | null | undefined; signOut: () => Promise<void> }) {
  const loadSummary = useServerFn(customerAccountSummary);
  const loadOrders = useServerFn(customerMyOrders);
  const queryClient = useQueryClient();
  const summary = useQuery({ queryKey: ["customer-account-summary", user.id], queryFn: () => loadSummary() });
  const orders = useQuery({ queryKey: ["customer-account-orders", user.id], queryFn: () => loadOrders() });
  const savedName = typeof user.user_metadata["display_name"] === "string" ? user.user_metadata["display_name"] : "";
  const [name, setName] = useState(savedName);
  const [student, setStudent] = useState(user.user_metadata["is_student"] === true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { setName(savedName); setStudent(user.user_metadata["is_student"] === true); }, [savedName, user]);
  const voucher = studentVoucher(user.user_metadata["is_student"] === true);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice(""); setError("");
    try {
      const result = await supabase.auth.updateUser({ data: { display_name: name.trim(), is_student: student } });
      if (result.error) { setError("Could not save your details. Please try again."); return; }
      setNotice("Your details have been saved.");
      await queryClient.invalidateQueries({ queryKey: ["customer-account-summary", user.id] });
    } catch { setError("Could not save your details. Please try again."); } finally { setBusy(false); }
  };
  const initials = (savedName || user.email || "F").slice(0, 1).toUpperCase();
  return <section className="space-y-8">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
      <div className="flex min-w-0 items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary heading-4">{initials}</span>
        <div className="min-w-0"><p className="caption-3 text-muted-foreground">{memberLabel(memberNumber)} · My account</p><h1 className="heading-4 mt-2 break-words">{savedName || "Your store account"}</h1><p className="body-6 mt-2 break-all text-muted-foreground">{user.email}</p><p className="caption-3 mt-2 flex items-center gap-2 text-success"><CheckCircle size={16} weight="fill"/>Email verified</p></div>
      </div>
      <Button variant="outline" onClick={signOut}>Sign out</Button>
    </header>
    {summary.isError ? <p role="alert" className="text-sm text-destructive">Could not load your totals. <Button variant="link" onClick={() => void summary.refetch()}>Try again</Button></p> : <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-lg border border-border bg-card p-5 shadow-soft"><Wallet size={22} className="text-primary"/><p className="caption-3 mt-3 text-muted-foreground">Total spent</p><div className="title-2 mt-2 tabular-nums">{summary.isPending ? "…" : summary.data?.spending.length ? summary.data.spending.map(s => <p key={s.currency}>{s.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span className="caption-3 text-muted-foreground">{s.currency}</span></p>) : "0.00"}</div><p className="caption-4 mt-2 text-muted-foreground">Confirmed purchases</p></div>
      <div className="rounded-lg border border-border bg-card p-5 shadow-soft"><ShoppingBag size={22} className="text-primary"/><p className="caption-3 mt-3 text-muted-foreground">Orders</p><p className="heading-4 mt-2 tabular-nums">{summary.isPending ? "…" : summary.data?.orderCount ?? 0}</p><p className="caption-4 mt-2 text-muted-foreground">{summary.data?.paidCount ?? 0} paid</p></div>
      <div className="rounded-lg border border-border bg-card p-5 shadow-soft"><CheckCircle size={22} className="text-success"/><p className="caption-3 mt-3 text-muted-foreground">Delivered</p><p className="heading-4 mt-2 tabular-nums">{summary.isPending ? "…" : summary.data?.deliveredCount ?? 0}</p><p className="caption-4 mt-2 text-muted-foreground">Completed orders</p></div>
    </div>}
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <section><h2 className="title-2 flex items-center gap-2"><UserCircle size={22}/>Personal details</h2>
        <form onSubmit={save} className="mt-4 space-y-4"><div className="space-y-2"><Label htmlFor="customer-display-name">Your name</Label><Input id="customer-display-name" autoComplete="name" maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Your name"/></div>
          <div className="flex items-center justify-between gap-4 border-y border-border py-4"><Label htmlFor="customer-student" className="flex items-center gap-2"><GraduationCap size={22}/>I'm a student</Label><Switch id="customer-student" checked={student} onCheckedChange={setStudent}/></div>
          {error && <p role="alert" className="body-6 text-destructive">{error}</p>}{notice && <p role="status" className="body-6 text-success">{notice}</p>}
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save details"}</Button>
        </form>
      </section>
      <section className="border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"><h2 className="title-2 flex items-center gap-2"><GraduationCap size={22}/>Student voucher</h2>
        {voucher ? <><div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4"><code className="title-3 font-mono">{voucher}</code><Button variant="ghost" size="icon" aria-label="Copy student voucher" onClick={async () => { try { await navigator.clipboard.writeText(voucher); setCopied(true); } catch { setError("Could not copy the code. Please select it and copy."); } }}>{copied ? <CheckCircle size={20}/> : <Copy size={20}/>}</Button></div><p className="caption-3 mt-3 text-muted-foreground">Discount activation pending. Eligibility and redemption terms are not yet available.</p>{copied && <p role="status" className="caption-3 mt-2 text-success">Code copied</p>}</> : <p className="body-6 mt-4 text-muted-foreground">Save your student status to see your student voucher.</p>}
      </section>
    </div>
    <section className="border-t border-border pt-6"><div className="flex items-center justify-between gap-3"><h2 className="title-2 flex items-center gap-2"><Receipt size={22}/>My orders</h2><Button asChild variant="ghost"><Link to="/shop" search={{view: "orders"}}>View all<ArrowUpRight size={18}/></Link></Button></div>
      {orders.isError ? <p role="alert" className="body-6 mt-4 text-destructive">Could not load orders. <Button variant="link" onClick={() => void orders.refetch()}>Try again</Button></p> : orders.isPending ? <p role="status" className="body-6 mt-4 text-muted-foreground">Loading orders…</p> : !orders.data?.length ? <div className="py-8 text-center"><ShoppingBag size={32} className="mx-auto text-muted-foreground"/><p className="title-3 mt-3">No orders yet</p><Button asChild className="mt-4"><Link to="/shop">Browse shop<ArrowUpRight size={18}/></Link></Button></div> : <ul className="mt-4 divide-y divide-border">{orders.data.slice(0, 5).map(o => <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="title-4 break-words">{o.items.map(i => i.product_name).join(", ") || o.order_number}</p><p className="caption-3 mt-1 text-muted-foreground">{o.order_number} · {new Date(o.created_at).toLocaleDateString("en-GB")}</p></div><div className="text-right"><p className="body-6 tabular-nums">{Number(o.total).toFixed(2)} {o.currency}</p><p className={`caption-3 mt-1 ${o.status === "delivered" ? "text-success" : "text-muted-foreground"}`}>{o.status.replaceAll("_", " ")}</p>{["under_review", "awaiting_email"].includes(o.status) && o.submitted_at && <ReviewCountdown submittedAt={o.submitted_at} className="caption-3 mt-1 text-primary"/>}</div></li>)}</ul>}
    </section>
  </section>;
}