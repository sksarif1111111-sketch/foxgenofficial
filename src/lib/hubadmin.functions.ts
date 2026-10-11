import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AdminOverview = {
  totalUsers: number;
  newToday: number;
  activeUsers: number;
  totalReferrals: number;
  verifiedReferrals: number;
  pendingReferrals: number;
  creditsIssued: number;
  creditsSpent: number;
  redemptions: number;
  totalProducts: number;
  activeProducts: number;
  generatedLicenses: number;
  generatedByDuration: Array<{ duration_days: number; total: number }>;
};

export const adminOverview = createServerFn({ method: "POST" }).handler(async (): Promise<AdminOverview> => {
  const { db } = await import("@/lib/hub.server");
  const [profiles, refs, txs, redemptions] = await Promise.all([
    db.from("profiles").select("status, created_at"),
    db.from("referrals").select("status"),
    db.from("credit_transactions").select("amount"),
    db.from("license_redemptions").select("id, duration_days"),
  ]);
  const { data: productRows } = await db.from("products").select("status");
  const today = new Date().toISOString().slice(0, 10);
  const buckets = new Map<number, number>();
  for (const row of redemptions.data ?? []) {
    buckets.set(row.duration_days, (buckets.get(row.duration_days) ?? 0) + 1);
  }
  return {
    totalUsers: (profiles.data ?? []).length,
    newToday: (profiles.data ?? []).filter((p) => p.created_at.slice(0, 10) === today).length,
    activeUsers: (profiles.data ?? []).filter((p) => p.status === "active").length,
    totalReferrals: (refs.data ?? []).length,
    verifiedReferrals: (refs.data ?? []).filter((r) => r.status === "verified").length,
    pendingReferrals: (refs.data ?? []).filter((r) => r.status === "pending").length,
    creditsIssued: (txs.data ?? []).filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
    creditsSpent: (txs.data ?? []).filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0),
    redemptions: (redemptions.data ?? []).length,
    totalProducts: (productRows ?? []).length,
    activeProducts: (productRows ?? []).filter((p) => p.status === "active").length,
    generatedLicenses: (redemptions.data ?? []).length,
    generatedByDuration: [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([duration_days, total]) => ({ duration_days, total })),
  };
});

export const adminUsers = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ search: z.string().max(100).optional() }).parse(input))
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    let query = db
      .from("profiles")
      .select(
        "id, telegram_user_id, telegram_username, first_name, status, referral_code, credits_available, credits_earned, credits_spent, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    const s = (data.search ?? "").trim();
    if (s) query = query.or(`telegram_username.ilike.%${s}%,first_name.ilike.%${s}%,referral_code.ilike.%${s}%`);
    const { data: rows } = await query;
    return rows ?? [];
  });

export const adminSetUserStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["pending", "active", "banned", "suspicious"]) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    await db.from("profiles").update({ status: data.status, updated_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: true };
  });

export const adminAdjustCredits = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        amount: z.number().int().min(-10000).max(10000),
        reason: z.string().trim().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    const { data: p } = await db
      .from("profiles")
      .select("credits_available, credits_earned, credits_spent")
      .eq("id", data.id)
      .maybeSingle();
    if (!p) throw new Error("User not found.");
    const next = Math.max(0, p.credits_available + data.amount);
    await db
      .from("profiles")
      .update({
        credits_available: next,
        credits_earned: data.amount > 0 ? p.credits_earned + data.amount : p.credits_earned,
        credits_spent: data.amount < 0 ? p.credits_spent - data.amount : p.credits_spent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    await db.from("credit_transactions").insert({
      user_id: data.id,
      amount: data.amount,
      transaction_type: data.amount > 0 ? "admin_bonus" : "admin_adjustment",
      description: data.reason,
    });
    return { ok: true };
  });

export const adminRewards = createServerFn({ method: "POST" }).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  const { data } = await db.from("rewards").select("*").order("display_order");
  return data ?? [];
});

export const adminSaveReward = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(400).optional(),
        duration_days: z.number().int().min(1).max(3650).optional(),
        credit_cost: z.number().int().min(1).max(100000),
        display_order: z.number().int().min(0).max(999).optional(),
        enabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    if (data.id) {
      await db
        .from("rewards")
        .update({
          credit_cost: data.credit_cost,
          enabled: data.enabled,
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.duration_days !== undefined ? { duration_days: data.duration_days } : {}),
          ...(data.display_order !== undefined ? { display_order: data.display_order } : {}),
        })
        .eq("id", data.id);

      return { ok: true };
    }
    if (!data.name || !data.duration_days) throw new Error("Reward name and duration are required.");
    const { error } = await db.from("rewards").insert({
      name: data.name,
      description: data.description ?? null,
      duration_days: data.duration_days,
      credit_cost: data.credit_cost,
      enabled: data.enabled,
      display_order: data.display_order ?? 0,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteReward = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    await db.from("rewards").delete().eq("id", data.id);
    return { ok: true };
  });


export const adminTasks = createServerFn({ method: "POST" }).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  const { data } = await db.from("social_tasks").select("*").order("display_order");
  return data ?? [];
});

export const adminSaveTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(120),
        platform: z.string().trim().min(1).max(40),
        description: z.string().trim().max(500).optional(),
        url: z.string().trim().max(500),
        telegram_chat_id: z.string().trim().max(120).optional(),
        verification_type: z.enum(["manual_confirmation", "telegram_auto_verification"]),
        display_order: z.number().int().min(0).max(999).optional(),
        required: z.boolean(),
        enabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { db, normalizeTelegramChat } = await import("@/lib/hub.server");
    const { id, ...rest } = data;
    const values = {
      ...rest,
      description: rest.description ?? null,
      telegram_chat_id: rest.verification_type === "telegram_auto_verification"
        ? normalizeTelegramChat(rest.telegram_chat_id || rest.url)
        : null,
    };
    const result = id
      ? await db.from("social_tasks").update(values).eq("id", id)
      : await db.from("social_tasks").insert(values);
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });

export const adminDeleteTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    const { error } = await db.from("social_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminTestTelegramChannels = createServerFn({ method: "POST" }).handler(async () => {
  const { activeTasks, normalizeTelegramChat, tg } = await import("@/lib/hub.server");
  const me = await tg<{ id: number; username?: string }>("getMe");
  if (!me.ok || !me.result) {
    return { botOk: false, botUsername: null, channels: [], error: me.description ?? "Bot token is invalid." };
  }
  const tasks = (await activeTasks()).filter((task) => task.verification_type === "telegram_auto_verification");
  const channels = [];
  for (const task of tasks) {
    const chatId = normalizeTelegramChat(task.telegram_chat_id || task.url || "");
    const chat = chatId ? await tg<{ title?: string; username?: string }>("getChat", { chat_id: chatId }) : { ok: false, description: "Channel ID is missing." };
    const access = chat.ok ? await tg<{ status: string }>("getChatMember", { chat_id: chatId, user_id: me.result.id }) : { ok: false, description: chat.description };
    const status = access.ok ? access.result?.status ?? "unknown" : "unavailable";
    const ready = chat.ok && access.ok && ["creator", "owner", "administrator"].includes(status);
    channels.push({
      id: task.id,
      name: task.name,
      url: task.url,
      chatId,
      channelFound: Boolean(chat.ok),
      botHasAccess: Boolean(access.ok),
      botStatus: status,
      ready,
      reason: ready ? null : access.description ?? chat.description ?? "Add @FoxicGEN_BOT as a channel administrator.",
    });
  }
  return { botOk: true, botUsername: me.result.username ?? null, channels, error: null };
});

export const adminResetUserTasks = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    await db.from("task_completions").delete().eq("user_id", data.userId);
    await db.from("profiles").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", data.userId);
    return { ok: true };
  });


export const adminRedemptions = createServerFn({ method: "POST" }).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  const { data } = await db
    .from("license_redemptions")
    .select("id, license_key, duration_days, credits_used, reward_name, redeemed_at, user:profiles!license_redemptions_user_id_fkey(telegram_username,first_name,telegram_user_id)")
    .order("redeemed_at", { ascending: false })
    .limit(500);
  return data ?? [];
});

export const adminSettings = createServerFn({ method: "POST" }).handler(async () => {
  const { getSettings } = await import("@/lib/hub.server");
  return await getSettings();
});

export const adminSaveSettings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ values: z.record(z.string(), z.string()) }).parse(input))
  .handler(async ({ data }) => {
    const { setSetting } = await import("@/lib/hub.server");
    for (const [key, value] of Object.entries(data.values)) await setSetting(key, value);
    return { ok: true };
  });

export const adminLogs = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ category: z.string().max(40).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    let query = db
      .from("bot_error_logs")
      .select("id, category, message, telegram_user_id, context, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.category && data.category !== "all") query = query.eq("category", data.category);
    const { data: rows } = await query;
    return rows ?? [];
  });

export const adminClearLogs = createServerFn({ method: "POST" }).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  await db.from("bot_error_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  return { ok: true };
});

export const adminBotStatus = createServerFn({ method: "POST" }).handler(async () => {

  const { tg, setSetting } = await import("@/lib/hub.server");
  try {
    const me = await tg<{ username: string; first_name: string }>("getMe");
    const hook = await tg<{ url: string; pending_update_count: number; last_error_message?: string }>("getWebhookInfo");
    if (me.ok && me.result?.username) await setSetting("bot_username", me.result.username);
    return {
      connected: Boolean(me.ok),
      username: me.result?.username ?? null,
      webhookUrl: hook.result?.url ?? "",
      pending: hook.result?.pending_update_count ?? 0,
      lastError: hook.result?.last_error_message ?? null,
    };
  } catch (err) {
    return {
      connected: false,
      username: null,
      webhookUrl: "",
      pending: 0,
      lastError: err instanceof Error ? err.message : "Bot token missing",
    };
  }
});

export const adminSetWebhook = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ baseUrl: z.string().trim().url() }).parse(input))
  .handler(async ({ data }) => {
    const { tg, webhookSecret, setSetting } = await import("@/lib/hub.server");
    const url = `${data.baseUrl.replace(/\/$/, "")}/api/public/telegram/webhook`;
    const res = await tg("setWebhook", {
      url,
      secret_token: await webhookSecret(),
      // pre_checkout_query is required for Telegram Stars payments to complete.
      allowed_updates: ["message", "callback_query", "pre_checkout_query"],
    });
    if (res.ok) await setSetting("site_url", data.baseUrl.replace(/\/$/, ""));
    return { ok: Boolean(res.ok), url, description: res.description ?? "" };
  });

export const adminBroadcast = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ message: z.string().trim().min(1).max(3000) }).parse(input))
  .handler(async ({ data }) => {
    const { db, tg } = await import("@/lib/hub.server");
    const { data: rows } = await db.from("profiles").select("telegram_user_id").limit(5000);
    let sent = 0;
    for (const row of rows ?? []) {
      const res = await tg("sendMessage", {
        chat_id: row.telegram_user_id,
        text: data.message,
        parse_mode: "HTML",
      });
      if (res.ok) sent += 1;
    }
    await db.from("announcements").insert({ title: "Broadcast", message: data.message, status: "published" });
    return { sent, total: (rows ?? []).length };
  });

export const adminReferrals = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ search: z.string().max(100).optional(), status: z.enum(["all", "pending", "verified", "rejected", "suspicious"]).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
  const { db } = await import("@/lib/hub.server");
  let query = db
    .from("referrals")
    .select("id, status, credit_awarded, created_at, verified_at, referrer_id, referred_user_id, referrer:profiles!referrals_referrer_id_fkey(telegram_username,first_name,referral_code), referred:profiles!referrals_referred_user_id_fkey(telegram_username,first_name,telegram_user_id,status)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (data.status && data.status !== "all" && data.status !== "suspicious") query = query.eq("status", data.status);
  const { data: rows } = await query;
  const search = (data.search ?? "").trim().toLowerCase();
  const filtered = (rows ?? []).filter((row) => {
    const haystack = JSON.stringify(row).toLowerCase();
    return !search || haystack.includes(search);
  });
  if (data.status !== "suspicious") return filtered;
  const userIds = filtered.map((row) => row.referred_user_id);
  if (!userIds.length) return [];
  const { data: flags } = await db.from("fraud_flags").select("user_id").in("user_id", userIds).eq("status", "open");
  const flagged = new Set((flags ?? []).map((flag) => flag.user_id));
  return filtered.filter((row) => flagged.has(row.referred_user_id));
});

export const adminApproveReferral = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db, notifyReferralReward } = await import("@/lib/hub.server");
    const { data: referral } = await db.from("referrals").select("referred_user_id").eq("id", data.id).maybeSingle();
    if (!referral) throw new Error("Referral not found.");
    const { data: awarded, error } = await db.rpc("award_referral", { _referred_user_id: referral.referred_user_id });
    if (error) throw new Error("Could not approve this referral.");
    if (!awarded) throw new Error("Only a pending referral with an active referred account can be approved.");
    await notifyReferralReward(referral.referred_user_id);
    return { ok: true };
  });

export const adminRejectReferral = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    const { data: rejected, error } = await db.rpc("reject_referral", { _referral_id: data.id });
    if (error) throw new Error("Could not reject this referral.");
    if (!rejected) throw new Error("Only an uncredited pending referral can be rejected.");
    return { ok: true };
  });

/** Every configured reward duration, for dynamic reward controls. */
export const adminLicenseDurations = createServerFn({ method: "POST" }).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  const { data: rewards } = await db.from("rewards").select("duration_days");
  const set = new Set<number>();
  for (const r of rewards ?? []) set.add(r.duration_days);
  return [...set].sort((a, b) => a - b);
});

// ---------- Extension Instructions (setup & usage guide shown in the bot) ----------
export const adminGuidePages = createServerFn({ method: "POST" }).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  const { data } = await db.from("extension_guide_pages").select("*").order("display_order");
  return data ?? [];
});

export const adminSaveGuidePage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        heading: z.string().trim().min(1).max(160),
        body: z.string().trim().min(1).max(4000),
        display_order: z.number().int().min(0).max(999).optional(),
        published: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    const row = {
      heading: data.heading,
      body: data.body,
      display_order: data.display_order ?? 0,
      published: data.published ?? true,
    };
    if (data.id) await db.from("extension_guide_pages").update(row).eq("id", data.id);
    else await db.from("extension_guide_pages").insert(row);
    return { ok: true };
  });

export const adminDeleteGuidePage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    await db.from("extension_guide_pages").delete().eq("id", data.id);
    return { ok: true };
  });
