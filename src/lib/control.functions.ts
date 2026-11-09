/** Control Center data: bot dashboard, referral leaderboard and integrations. All password-guarded. */
import { requireAdminPassword } from "@/lib/admin-access.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type Db = Awaited<typeof import("@/lib/hub.server")>["db"];

/** Reads every row in pages so totals are never cut off at the API's 1000-row default. */
async function allRows<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 200_000; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw new Error("Could not read statistics.");
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function count(q: PromiseLike<{ count: number | null; error: unknown }>) {
  const { count: n, error } = await q;
  if (error) throw new Error("Could not read statistics.");
  return n ?? 0;
}

export type BotDashboard = {
  users: { total: number; active: number; pending: number; newToday: number };
  referrals: { total: number; verified: number; pending: number };
  credits: { issued: number; spent: number; available: number };
  licenses: { active: number; total: number; redeemedByMembers: number };
  tasks: { enabled: number; total: number };
  bot: { connected: boolean; username: string | null; webhookSet: boolean; pending: number; lastError: string | null };
  recent: Array<{ id: string; module: string; action: string; status: string; details: string | null; created_at: string }>;
  checkedAt: string;
};

export const botDashboard = createServerFn({ method: "POST" }).middleware([requireAdminPassword]).handler(async (): Promise<BotDashboard> => {
  const { db, tg } = await import("@/lib/hub.server");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const nowIso = new Date().toISOString();
  const head = { count: "exact" as const, head: true };
  const [total, active, pending, newToday, refTotal, refVerified, refPending, licTotal, redeemed, tasksTotal, tasksEnabled] = await Promise.all([
    count(db.from("profiles").select("id", head)),
    count(db.from("profiles").select("id", head).eq("status", "active")),
    count(db.from("profiles").select("id", head).eq("status", "pending")),
    count(db.from("profiles").select("id", head).gte("created_at", today.toISOString())),
    count(db.from("referrals").select("id", head)),
    count(db.from("referrals").select("id", head).eq("status", "verified")),
    count(db.from("referrals").select("id", head).eq("status", "pending")),
    count(db.from("licenses").select("id", head)),
    count(db.from("license_redemptions").select("id", head)),
    count(db.from("social_tasks").select("id", head)),
    count(db.from("social_tasks").select("id", head).eq("enabled", true)),
  ]);
  // Active = not blocked and not past its expiry (unused keys have no expiry yet).
  const licActive = await count(
    db.from("licenses").select("id", head).eq("status", "active").or(`expires_at.is.null,expires_at.gt.${nowIso}`),
  );
  const txs = await allRows<{ amount: number }>((from, to) => db.from("credit_transactions").select("amount").order("id").range(from, to));
  const balances = await allRows<{ credits_available: number }>((from, to) => db.from("profiles").select("credits_available").order("id").range(from, to));
  const { data: recent } = await db
    .from("activity_logs")
    .select("id, module, action, status, details, created_at")
    .order("created_at", { ascending: false })
    .limit(8);

  let bot: BotDashboard["bot"] = { connected: false, username: null, webhookSet: false, pending: 0, lastError: null };
  try {
    const [me, hook] = await Promise.all([
      tg<{ username: string }>("getMe"),
      tg<{ url: string; pending_update_count: number; last_error_message?: string }>("getWebhookInfo"),
    ]);
    bot = {
      connected: Boolean(me.ok),
      username: me.result?.username ?? null,
      webhookSet: Boolean(hook.result?.url),
      pending: hook.result?.pending_update_count ?? 0,
      lastError: hook.result?.last_error_message ?? (me.ok ? null : (me.description ?? "Bot token rejected")),
    };
  } catch (err) {
    bot.lastError = err instanceof Error ? err.message : "Bot token missing";
  }

  return {
    users: { total, active, pending, newToday },
    referrals: { total: refTotal, verified: refVerified, pending: refPending },
    credits: {
      issued: txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
      spent: txs.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0),
      available: balances.reduce((s, p) => s + (p.credits_available ?? 0), 0),
    },
    licenses: { active: licActive, total: licTotal, redeemedByMembers: redeemed },
    tasks: { enabled: tasksEnabled, total: tasksTotal },
    bot,
    recent: recent ?? [],
    checkedAt: nowIso,
  };
});

export type LeaderRow = {
  id: string;
  name: string;
  username: string | null;
  status: string;
  referrals: number;
  verified: number;
  pending: number;
  credits_available: number;
  credits_earned: number;
  credits_spent: number;
  last_activity: string | null;
};

/** One row per member who invited someone: referral counts, verified status and credit balance. */
export const referralLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((input: unknown) => z.object({ search: z.string().trim().max(80).optional() }).parse(input ?? {}))
  .handler(async ({ data }): Promise<LeaderRow[]> => {
    const { db } = await import("@/lib/hub.server");
    const refs = await allRows<{ referrer_id: string; status: string; created_at: string }>((from, to) =>
      db.from("referrals").select("referrer_id, status, created_at").order("id").range(from, to),
    );
    const agg = new Map<string, { referrals: number; verified: number; pending: number; last: string }>();
    for (const r of refs) {
      const a = agg.get(r.referrer_id) ?? { referrals: 0, verified: 0, pending: 0, last: r.created_at };
      a.referrals++;
      if (r.status === "verified") a.verified++;
      if (r.status === "pending") a.pending++;
      if (r.created_at > a.last) a.last = r.created_at;
      agg.set(r.referrer_id, a);
    }
    const ids = [...agg.keys()];
    if (!ids.length) return [];
    const profiles: Array<{ id: string; first_name: string | null; telegram_username: string | null; status: string; credits_available: number; credits_earned: number; credits_spent: number }> = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data: rows } = await db
        .from("profiles")
        .select("id, first_name, telegram_username, status, credits_available, credits_earned, credits_spent")
        .in("id", ids.slice(i, i + 200));
      profiles.push(...(rows ?? []));
    }
    const q = (data.search ?? "").toLowerCase();
    return profiles
      .map((p) => {
        const a = agg.get(p.id)!;
        return {
          id: p.id,
          name: p.first_name ?? (p.telegram_username ? `@${p.telegram_username}` : "Member"),
          username: p.telegram_username,
          status: p.status,
          referrals: a.referrals,
          verified: a.verified,
          pending: a.pending,
          credits_available: p.credits_available,
          credits_earned: p.credits_earned,
          credits_spent: p.credits_spent,
          last_activity: a.last,
        };
      })
      .filter((r) => !q || r.name.toLowerCase().includes(q) || (r.username ?? "").toLowerCase().includes(q))
      .sort((a, b) => b.verified - a.verified || b.referrals - a.referrals)
      .slice(0, 300);
  });

/** Recent credit transactions for one member (credit activity drill-down). */
export const memberCreditHistory = createServerFn({ method: "POST" })
  .middleware([requireAdminPassword])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    const { data: rows, error } = await db
      .from("credit_transactions")
      .select("id, amount, transaction_type, description, created_at")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Could not load credit activity.");
    return rows ?? [];
  });

/* ------------------------------ Integrations ------------------------------ */

export type IntegrationCard = {
  id: string;
  name: string;
  kind: "messaging" | "supplier" | "email" | "ai";
  configured: boolean;
  status: "connected" | "error" | "not_configured";
  detail: string;
  capabilities: string[];
  lastSuccess: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  products: number | null;
  syncable: boolean;
};

async function lastRuns(db: Db, provider: string) {
  const [ok, bad] = await Promise.all([
    db.from("integration_sync_runs").select("finished_at").eq("provider", provider).eq("status", "success").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("integration_sync_runs").select("message, finished_at").eq("provider", provider).eq("status", "failed").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return { lastSuccess: ok.data?.finished_at ?? null, lastError: bad.data?.message ?? null, lastErrorAt: bad.data?.finished_at ?? null };
}

export const integrationsStatus = createServerFn({ method: "POST" }).middleware([requireAdminPassword]).handler(async (): Promise<IntegrationCard[]> => {
  const { db, tg, getSettings } = await import("@/lib/hub.server");
  const { SUPPLIERS, checkSupplier, DIGIHUP_PREFIX } = await import("@/lib/reseller.server");
  const cards: IntegrationCard[] = [];

  // Telegram bot
  const hasToken = Boolean(process.env["TELEGRAM_BOT_TOKEN"]);
  let tgCard: IntegrationCard = {
    id: "telegram", name: "Telegram bot", kind: "messaging", configured: hasToken, status: hasToken ? "error" : "not_configured",
    detail: hasToken ? "Checking…" : "Bot token secret is missing.", capabilities: ["Store & checkout", "Stars payments", "Tasks & referrals", "Broadcasts"],
    lastSuccess: null, lastError: null, lastErrorAt: null, products: null, syncable: false,
  };
  if (hasToken) {
    try {
      const [me, hook] = await Promise.all([
        tg<{ username: string }>("getMe"),
        tg<{ url: string; last_error_message?: string; last_error_date?: number }>("getWebhookInfo"),
      ]);
      const ok = Boolean(me.ok) && Boolean(hook.result?.url);
      tgCard = {
        ...tgCard,
        status: ok ? "connected" : "error",
        detail: me.ok ? `@${me.result?.username} · webhook ${hook.result?.url ? "set" : "not set"}` : (me.description ?? "Token rejected"),
        lastSuccess: ok ? new Date().toISOString() : null,
        lastError: hook.result?.last_error_message ?? null,
        lastErrorAt: hook.result?.last_error_date ? new Date(hook.result.last_error_date * 1000).toISOString() : null,
      };
    } catch (err) {
      tgCard = { ...tgCard, detail: err instanceof Error ? err.message : "Could not reach Telegram." };
    }
  }
  cards.push(tgCard);

  // Suppliers
  const { data: storeRows } = await db.from("products").select("reseller_product_id").not("reseller_product_id", "is", null);
  for (const s of SUPPLIERS) {
    const configured = Boolean(process.env[s.secret]);
    const runs = await lastRuns(db, s.id);
    const products = (storeRows ?? []).filter((r) => (s.id === "digihup") === String(r.reseller_product_id).startsWith(DIGIHUP_PREFIX)).length;
    const check = configured ? await checkSupplier(s.id) : { ok: false, detail: `${s.secret} secret is missing.` };
    cards.push({
      id: s.id, name: s.name, kind: "supplier", configured, status: !configured ? "not_configured" : check.ok ? "connected" : "error",
      detail: check.detail, capabilities: s.capabilities, ...runs, products, syncable: configured,
    });
  }

  // Email delivery
  const settings = await getSettings();
  const emailReady = Boolean(process.env["RESEND_API_KEY"]) && Boolean((settings["shop_email_from"] ?? "").trim());
  cards.push({
    id: "email", name: "Order email delivery", kind: "email", configured: emailReady, status: emailReady ? "connected" : "not_configured",
    detail: emailReady ? `Sends from ${settings["shop_email_from"]}` : "Needs an email API key and a verified sender address. Orders can still be delivered manually.",
    capabilities: ["Delivery emails to buyers"], lastSuccess: null, lastError: null, lastErrorAt: null, products: null, syncable: false,
  });

  // AI
  const aiReady = Boolean(process.env["LOVABLE_API_KEY"]);
  cards.push({
    id: "ai", name: "Lovable AI", kind: "ai", configured: aiReady, status: aiReady ? "connected" : "not_configured",
    detail: aiReady ? "Powers the shopping assistant and email drafts." : "AI key is missing.",
    capabilities: ["Shopping assistant", "Delivery email drafts"], lastSuccess: null, lastError: null, lastErrorAt: null, products: null, syncable: false,
  });
  return cards;
});

export const integrationsSync = createServerFn({ method: "POST" }).middleware([requireAdminPassword]).handler(async () => {
  const { syncSuppliers } = await import("@/lib/reseller.server");
  const { logActivity } = await import("@/lib/hub.server");
  const result = await syncSuppliers("manual");
  const summary = result.suppliers.map((s) => `${s.id}: ${s.ok ? `${s.total} products (${s.added} new)` : `failed — ${s.error}`}`).join(" · ");
  await logActivity("integrations", "Supplier sync", result.suppliers.every((s) => s.ok) ? "success" : "warning", summary);
  return result;
});

export const integrationsHistory = createServerFn({ method: "POST" }).middleware([requireAdminPassword]).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  const { data, error } = await db.from("integration_sync_runs").select("*").order("started_at", { ascending: false }).limit(100);
  if (error) throw new Error("Could not load sync history.");
  return data ?? [];
});
