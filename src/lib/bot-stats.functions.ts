import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only bot overview: clients, referrals and bot sales. */
export const getBotStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 7 * 864e5).toISOString();
    const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;

    const [total, active, pending, newWeek, referrals, paidReferrals] = await Promise.all([
      count(supabaseAdmin.from("profiles").select("id", { count: "exact", head: true })),
      count(supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("status", "active")),
      count(supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending")),
      count(supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since)),
      count(supabaseAdmin.from("referrals").select("id", { count: "exact", head: true })),
      count(supabaseAdmin.from("referrals").select("id", { count: "exact", head: true }).eq("credit_awarded", true)),
    ]);

    const { data: orders } = await supabaseAdmin
      .from("shop_orders")
      .select("status, total, stars_total, telegram_user_id")
      .eq("channel", "bot");
    const list = orders ?? [];
    const paid = list.filter((o) => ["confirmed", "delivered"].includes(o.status));
    const buyers = new Set(paid.map((o) => o.telegram_user_id).filter(Boolean)).size;

    const { data: recent } = await supabaseAdmin
      .from("profiles")
      .select("telegram_username, first_name, status, credits_available, created_at")
      .order("created_at", { ascending: false })
      .limit(15);

    return {
      clients: { total, active, pending, newWeek, buyers },
      referrals: { total: referrals, rewarded: paidReferrals },
      orders: {
        total: list.length,
        paid: paid.length,
        open: list.length - paid.length - list.filter((o) => o.status === "rejected").length,
        revenueUsd: paid.reduce((s, o) => s + Number(o.total ?? 0), 0),
        stars: paid.reduce((s, o) => s + Number(o.stars_total ?? 0), 0),
      },
      recent: recent ?? [],
    };
  });
