import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "@phosphor-icons/react/dist/ssr";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/** Account → Notifications: store messages for this customer only (owner-scoped access rules). */
export function CustomerNotices({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const notices = useQuery({
    queryKey: ["customer-notices", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("customer_notices").select("id,title,body,created_at,read_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  const unread = (notices.data ?? []).filter((n) => !n.read_at);
  const markRead = async () => {
    if (!unread.length) return;
    await supabase.from("customer_notices").update({ read_at: new Date().toISOString() }).in("id", unread.map((n) => n.id));
    await qc.invalidateQueries({ queryKey: ["customer-notices", userId] });
  };
  return (
    <section className="border-t border-border pt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="title-2 flex items-center gap-2"><Bell size={22} />Notifications{unread.length > 0 && <span className="caption-3 rounded-full bg-primary px-2 py-0.5 text-primary-foreground">{unread.length}</span>}</h2>
        {unread.length > 0 && <Button variant="ghost" onClick={() => void markRead()}>Mark all read</Button>}
      </div>
      {notices.isPending ? <p role="status" className="body-6 mt-4 text-muted-foreground">Loading…</p>
        : !notices.data?.length ? <p className="body-6 mt-4 text-muted-foreground">No notifications yet.</p>
        : <ul className="mt-4 space-y-3">{notices.data.map((n) => (
          <li key={n.id} className={`rounded-lg border p-4 ${n.read_at ? "border-border" : "border-primary/30 bg-primary/5"}`}>
            <p className="title-4">{n.title}</p>
            <p className="body-6 mt-1 whitespace-pre-line break-words">{n.body}</p>
            <p className="caption-3 mt-2 text-muted-foreground">{new Date(n.created_at).toLocaleString("en-GB")}</p>
          </li>))}</ul>}
    </section>
  );
}
