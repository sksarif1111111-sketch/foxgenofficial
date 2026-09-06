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
  availableLicenses: number;
  inventory: Array<{ duration_days: number; available: number; redeemed: number; total: number }>;
};

export const adminOverview = createServerFn({ method: "POST" }).handler(async (): Promise<AdminOverview> => {
  const { db } = await import("@/lib/hub.server");
  const [profiles, refs, txs, redemptions, inv] = await Promise.all([
    db.from("profiles").select("status, created_at"),
    db.from("referrals").select("status"),
    db.from("credit_transactions").select("amount"),
    db.from("license_redemptions").select("id"),
    db.from("license_inventory").select("duration_days, status"),
  ]);
  const { data: productRows } = await db.from("products").select("status");
  const today = new Date().toISOString().slice(0, 10);
  const buckets = new Map<number, { available: number; redeemed: number; total: number }>();
  for (const row of inv.data ?? []) {
    const b = buckets.get(row.duration_days) ?? { available: 0, redeemed: 0, total: 0 };
    b.total += 1;
    if (row.status === "available") b.available += 1;
    if (row.status === "redeemed") b.redeemed += 1;
    buckets.set(row.duration_days, b);
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
    availableLicenses: (inv.data ?? []).filter((i) => i.status === "available").length,
    inventory: [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([duration_days, v]) => ({ duration_days, ...v })),
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
      const patch: Record<string, unknown> = { credit_cost: data.credit_cost, enabled: data.enabled };
      if (data.name !== undefined) patch['name'] = data.name;
      if (data.description !== undefined) patch['description'] = data.description;
      if (data.duration_days !== undefined) patch['duration_days'] = data.duration_days;
      if (data.display_order !== undefined) patch['display_order'] = data.display_order;
      await db.from("rewards").update(patch).eq("id", data.id);
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
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
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
    const { db } = await import("@/lib/hub.server");
    const { id, ...rest } = data;
    await db
      .from("social_tasks")
      .update({
        ...rest,
        description: rest.description ?? null,
        telegram_chat_id: rest.telegram_chat_id ?? null,
      })
      .eq("id", id);
    return { ok: true };
  });

export const adminResetUserTasks = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    await db.from("task_completions").delete().eq("user_id", data.userId);
    await db.from("profiles").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", data.userId);
    return { ok: true };
  });


export const adminImportLicenses = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ keys: z.string().max(200000), durationDays: z.number().int().min(1).max(3650) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    const rawLines = data.keys.split(/\r?\n/).map((line) => line.trim().toUpperCase()).filter(Boolean);
    const uniqueLines = [...new Set(rawLines)];
    const lines = uniqueLines.filter((key) => /^[A-Z0-9][A-Z0-9-]{5,127}$/.test(key));
    const invalid = uniqueLines.length - lines.length;
    const duplicateInput = rawLines.length - uniqueLines.length;
    let imported = 0;
    let duplicates = duplicateInput;
    for (const key of lines) {
      const { error } = await db
        .from("license_inventory")
        .insert({ license_key: key, duration_days: data.durationDays, status: "available" });
      if (error) duplicates += 1;
      else {
        imported += 1;
        await db
          .from("licenses")
          .insert({
            license_key: key,
            plan_days: data.durationDays,
            duration_seconds: data.durationDays * 86400,
            status: "active",
            note: "Rewards Hub inventory",
          });
      }
    }
    return { imported, duplicates, invalid, total: rawLines.length };
  });

export const adminInventory = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      search: z.string().max(150).optional(),
      status: z.enum(["all", "available", "redeemed", "disabled", "reserved"]).optional(),
      durationDays: z.number().int().min(0).max(3650).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    let query = db
      .from("license_inventory")
      .select("id, license_key, duration_days, status, redeemed_by, redeemed_at, added_at")
      .order("added_at", { ascending: false })
      .limit(1000);
    const search = (data.search ?? "").trim();
    if (search) query = query.ilike("license_key", `%${search}%`);
    if (data.status && data.status !== "all") query = query.eq("status", data.status);
    if (data.durationDays) query = query.eq("duration_days", data.durationDays);
    const { data: rows } = await query;
    return rows ?? [];
  });

export const adminSetInventoryStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["available", "disabled", "reserved"]) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    const { data: row } = await db.from("license_inventory").select("status").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("License not found.");
    if (row.status === "redeemed") throw new Error("Redeemed licenses cannot be changed.");
    await db.from("license_inventory").update({ status: data.status }).eq("id", data.id);
    return { ok: true };
  });

export const adminDeleteInventoryLicense = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db } = await import("@/lib/hub.server");
    const { data: row } = await db.from("license_inventory").select("license_key, status").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("License not found.");
    if (row.status === "redeemed") throw new Error("Redeemed licenses cannot be deleted.");
    await db.from("license_inventory").delete().eq("id", data.id);
    await db.from("licenses").delete().eq("license_key", row.license_key).is("activated_at", null);
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
      allowed_updates: ["message", "callback_query"],
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

/** Every license duration that exists in inventory or rewards, for dynamic tabs. */
export const adminLicenseDurations = createServerFn({ method: "POST" }).handler(async () => {
  const { db } = await import("@/lib/hub.server");
  const [inv, rewards] = await Promise.all([
    db.from("license_inventory").select("duration_days"),
    db.from("rewards").select("duration_days"),
  ]);
  const set = new Set<number>();
  for (const r of inv.data ?? []) set.add(r.duration_days);
  for (const r of rewards.data ?? []) set.add(r.duration_days);
  return [...set].sort((a, b) => a - b);
});
