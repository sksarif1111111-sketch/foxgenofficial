import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const db = supabaseAdmin;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";

function block(len: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function makeLicenseKey() {
  return `FOXGEN-${block(3)}-${block(3)}`;
}

export function makeReferralCode() {
  return `FOXGEN-${block(5)}`;
}

export async function getSettings(): Promise<Record<string, string>> {
  const { data } = await db.from("app_settings").select("key, value");
  const out: Record<string, string> = {};
  for (const row of data ?? []) out[row.key] = row.value ?? "";
  return out;
}

export async function setSetting(key: string, value: string) {
  await db.from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() });
}

export function botToken(): string {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  return token;
}

export async function tg<T = unknown>(method: string, payload: Record<string, unknown> = {}) {
  const res = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  return json;
}

export function normalizeTelegramChat(raw: string): string {
  const value = raw.trim().replace(/^https?:\/\/(?:www\.)?t\.me\//i, "").replace(/^@/, "").split(/[/?#]/)[0] ?? "";
  if (!value) return "";
  return /^-?\d+$/.test(value) ? value : `@${value.toLowerCase()}`;
}

/** Records a technical failure for the admin debug page. Users never see these strings. */
export async function logBotError(
  category: string,
  message: string,
  telegramUserId?: number | null,
  context?: string | null,
) {
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: duplicate } = await db
      .from("bot_error_logs")
      .select("id")
      .eq("category", category)
      .eq("message", message.slice(0, 1000))
      .gte("created_at", cutoff)
      .limit(1)
      .maybeSingle();
    if (duplicate) return;
    await db.from("bot_error_logs").insert({
      category,
      message: message.slice(0, 1000),
      telegram_user_id: telegramUserId ?? null,
      context: context ? context.slice(0, 1000) : null,
    });
  } catch {
    // logging must never break the bot
  }
}

/** Platform-wide activity trail shown in the admin Activity page. */
export async function logActivity(
  module: string,
  action: string,
  status: "success" | "warning" | "error" | "info" = "info",
  details?: string | null,
  userId?: string | null,
  actor?: string | null,
) {
  try {
    await db.from("activity_logs").insert({
      module,
      action,
      status,
      details: details ? details.slice(0, 1000) : null,
      user_id: userId ?? null,
      actor: actor ?? "admin",
    });
  } catch {
    // logging must never break a request
  }
}

/** Short-lived lock so rapid double taps cannot run the same action twice. */
export async function acquireLock(key: string, ttlMs = 15000): Promise<boolean> {
  const cutoff = new Date(Date.now() - ttlMs).toISOString();
  await db.from("bot_action_locks").delete().lt("created_at", cutoff);
  const { error } = await db.from("bot_action_locks").insert({ lock_key: key });
  return !error;
}

export async function releaseLock(key: string) {
  await db.from("bot_action_locks").delete().eq("lock_key", key);
}

export async function webhookSecret(): Promise<string> {
  const data = new TextEncoder().encode(`foxgen-webhook:${botToken()}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type Profile = {
  id: string;
  telegram_user_id: number;
  telegram_username: string | null;
  first_name: string | null;
  last_name: string | null;
  referral_code: string;
  referred_by: string | null;
  status: string;
  web_token: string;
  credits_available: number;
  credits_earned: number;
  credits_spent: number;
  created_at: string;
};

export async function profileByTelegramId(tgId: number) {
  const { data } = await db.from("profiles").select("*").eq("telegram_user_id", tgId).maybeSingle();
  return (data ?? null) as Profile | null;
}

export async function profileByToken(token: string) {
  if (!token || token.length < 10) return null;
  const { data } = await db.from("profiles").select("*").eq("web_token", token).maybeSingle();
  return (data ?? null) as Profile | null;
}

/** Creates the profile if missing and records a pending referral. */
export async function ensureProfile(
  tgUser: { id: number; username?: string; first_name?: string; last_name?: string },
  startPayload?: string,
): Promise<{ profile: Profile; created: boolean }> {
  const existing = await profileByTelegramId(tgUser.id);
  if (existing) {
    const nextProfile = {
      telegram_username: tgUser.username ?? null,
      first_name: tgUser.first_name ?? null,
      last_name: tgUser.last_name ?? null,
      updated_at: new Date().toISOString(),
    };
    const profileChanged =
      existing.telegram_username !== nextProfile.telegram_username ||
      existing.first_name !== nextProfile.first_name ||
      existing.last_name !== nextProfile.last_name;
    if (profileChanged) {
      await db.from("profiles").update(nextProfile).eq("id", existing.id);
      existing.telegram_username = nextProfile.telegram_username;
      existing.first_name = nextProfile.first_name;
      existing.last_name = nextProfile.last_name;
    }
    const attemptedCode = startPayload?.trim().toUpperCase();
    if (attemptedCode && attemptedCode !== existing.referral_code) {
      const { data: attemptedReferrer } = await db
        .from("profiles")
        .select("id")
        .eq("referral_code", attemptedCode)
        .maybeSingle();
      if (attemptedReferrer) {
        await db.from("fraud_flags").insert({
          user_id: existing.id,
          reason: attemptedReferrer.id === existing.id ? "self_referral_attempt" : "existing_user_referral_attempt",
          details: "An existing Telegram account attempted to enter through a referral link. The original referrer was not changed.",
        });
      }
    }
    return { profile: existing, created: false };
  }

  let referrer: Profile | null = null;
  if (startPayload) {
    const { data } = await db
      .from("profiles")
      .select("*")
      .eq("referral_code", startPayload.trim().toUpperCase())
      .eq("status", "active")
      .maybeSingle();
    referrer = (data ?? null) as Profile | null;
  }

  let profile: Profile | null = null;
  for (let i = 0; i < 6 && !profile; i++) {
    const { data } = await db
      .from("profiles")
      .insert({
        telegram_user_id: tgUser.id,
        telegram_username: tgUser.username ?? null,
        first_name: tgUser.first_name ?? null,
        last_name: tgUser.last_name ?? null,
        referral_code: makeReferralCode(),
        referred_by: referrer?.id ?? null,
        status: "pending",
      })
      .select("*")
      .maybeSingle();
    profile = (data ?? null) as Profile | null;
  }
  if (!profile) throw new Error("Could not create profile");

  if (referrer && referrer.id !== profile.id) {
    await db.from("referrals").insert({ referrer_id: referrer.id, referred_user_id: profile.id });
  }
  return { profile, created: true };
}

export type TaskRow = {
  id: string;
  name: string;
  description: string | null;
  platform: string;
  url: string | null;
  verification_type: string;
  telegram_chat_id: string | null;
  required: boolean;
  enabled: boolean;
  display_order: number;
};

export async function activeTasks(): Promise<TaskRow[]> {
  const { data } = await db
    .from("social_tasks")
    .select("*")
    .eq("enabled", true)
    .order("display_order", { ascending: true });
  const rows = (data ?? []) as TaskRow[];
  const seen = new Set<string>();
  return rows.filter((task) => {
    const telegramChat = normalizeTelegramChat(task.telegram_chat_id || task.url || "");
    const identity = task.verification_type === "telegram_auto_verification"
      ? `telegram:${telegramChat || task.id}`
      : `${task.platform.trim().toLowerCase()}:${(task.url || task.name).trim().toLowerCase()}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export async function completionsFor(userId: string) {
  const { data, error } = await db.from("task_completions").select("*").eq("user_id", userId);
  if (error) throw new Error(`Could not load task progress: ${error.message}`);
  return data ?? [];
}

/** Re-checks Telegram channel membership, then activates the account when everything is done. */
export async function refreshVerification(profile: Profile) {
  const tasks = await activeTasks();
  const missing: string[] = [];
  const telegram: Array<{ id: string; name: string; url: string | null; ok: boolean; error: string | null }> = [];

  for (const task of tasks) {
    if (task.verification_type !== "telegram_auto_verification") continue;
    const chat = normalizeTelegramChat(task.telegram_chat_id || task.url || "");
    if (!chat) {
      telegram.push({ id: task.id, name: task.name, url: task.url, ok: false, error: "Channel ID is not configured." });
      continue;
    }
    let ok = false;
    const res = await tg<{ status: string; is_member?: boolean }>("getChatMember", {
      chat_id: chat,
      user_id: profile.telegram_user_id,
    });
    if (res.ok && res.result) {
      ok = ["creator", "owner", "administrator", "member"].includes(res.result.status);
    }
    const error = ok
      ? null
      : res.ok
        ? "Telegram reports that this account has not joined yet."
        : res.description?.includes("member list is inaccessible") || res.description?.includes("not enough rights")
          ? "The FoxGEN bot must be an administrator in this channel before it can verify members."
          : res.description || "Telegram could not verify this channel right now.";
    telegram.push({ id: task.id, name: task.name, url: task.url, ok, error });
    // Never downgrade a previously verified membership on a transient API failure.
    if (ok) {
      const { error: completionError } = await db.from("task_completions").upsert(
        {
          user_id: profile.id,
          task_id: task.id,
          completed: true,
          verification_status: "verified",
          verification_method: "telegram_api",
          verified_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,task_id" },
      );
      if (completionError) throw new Error(`Could not save ${task.name}: ${completionError.message}`);
    } else {
      const { data: prev } = await db
        .from("task_completions")
        .select("completed")
        .eq("user_id", profile.id)
        .eq("task_id", task.id)
        .maybeSingle();
      if (!prev?.completed) {
        const { error: completionError } = await db.from("task_completions").upsert(
          {
            user_id: profile.id,
            task_id: task.id,
            completed: false,
            verification_status: res.ok ? "failed" : "pending",
            verification_method: "telegram_api",
          },
          { onConflict: "user_id,task_id" },
        );
        if (completionError) throw new Error(`Could not save ${task.name}: ${completionError.message}`);
      }
    }
  }

  const done = await completionsFor(profile.id);
  const doneIds = new Set(done.filter((d) => d.completed).map((d) => d.task_id));
  for (const task of tasks) {
    if (task.required && !doneIds.has(task.id)) missing.push(task.name);
  }

  const allDone = missing.length === 0;
  if (allDone) {
    // Activation and referral credit are committed together. The referral award
    // remains idempotent, so retrying verification cannot issue duplicate credit.
    const { data, error } = await db.rpc("activate_verified_profile", { _user_id: profile.id });
    if (error) {
      await logBotError("referral_activation", error.message, profile.telegram_user_id, "refreshVerification");
      throw new Error("Account activation could not be completed. Please try again.");
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (result?.referral_awarded) await notifyReferralReward(profile.id);
  }
  return { allDone, missing, telegram, doneIds: [...doneIds] };
}

export async function notifyReferralReward(referredUserId: string) {
  const { data: referral } = await db
    .from("referrals")
    .select("referrer_id")
    .eq("referred_user_id", referredUserId)
    .eq("status", "verified")
    .maybeSingle();
  if (!referral) return;

  const [{ data: referrer }, { count }] = await Promise.all([
    db.from("profiles").select("telegram_user_id, credits_available").eq("id", referral.referrer_id).maybeSingle(),
    db
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", referral.referrer_id)
      .eq("status", "verified"),
  ]);
  if (!referrer) return;

  const sent = await tg("sendMessage", {
    chat_id: referrer.telegram_user_id,
    parse_mode: "HTML",
    text:
      `🎉 <b>New Referral Verified!</b>\n\n` +
      `You earned:\n💰 <b>+1 Credit</b>\n\n━━━━━━━━━━\n\n` +
      `👥 Valid Referrals: <b>${count ?? 0}</b>\n` +
      `💰 Available Credits: <b>${referrer.credits_available}</b>\n\n` +
      `Keep inviting friends to unlock free Lovable Unlimited licenses!`,
  });
  if (!sent.ok) {
    await logBotError("telegram_api", sent.description ?? "Referral notification failed", referrer.telegram_user_id, "notifyReferralReward");
  }
}


export async function redeem(profileId: string, rewardId: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db.rpc("redeem_reward", {
      _user_id: profileId,
      _reward_id: rewardId,
      _generated_key: makeLicenseKey(),
    });
    if (error) {
      // A generated-key collision rolls back the whole database transaction,
      // so retrying cannot double-charge credits or create a partial redemption.
      if (error.code === "23505" && attempt < 2) continue;
      throw new Error(error.message);
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("redemption_failed");
    return row as { license_key: string; duration_days: number; credits_used: number; reward_name: string };
  }
  throw new Error("license_key_generation_failed");
}
