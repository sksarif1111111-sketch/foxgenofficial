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
    const identity = `${task.platform.trim().toLowerCase()}:${(task.telegram_chat_id || task.url || task.name).trim().toLowerCase()}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

export async function completionsFor(userId: string) {
  const { data } = await db.from("task_completions").select("*").eq("user_id", userId);
  return data ?? [];
}

/** Re-checks Telegram channel membership, then activates the account when everything is done. */
export async function refreshVerification(profile: Profile) {
  const tasks = await activeTasks();
  const missing: string[] = [];
  const telegram: Array<{ id: string; name: string; url: string | null; ok: boolean; error: string | null }> = [];

  for (const task of tasks) {
    if (task.verification_type !== "telegram_auto_verification") continue;
    const chat = (task.telegram_chat_id || "").trim();
    if (!chat) {
      telegram.push({ id: task.id, name: task.name, url: task.url, ok: false, error: "Channel ID is not configured." });
      continue;
    }
    let ok = false;
    const res = await tg<{ status: string; is_member?: boolean }>("getChatMember", {
      chat_id: chat.startsWith("-") ? chat : `@${chat.replace(/^@/, "")}`,
      user_id: profile.telegram_user_id,
    });
    if (res.ok && res.result) {
      ok = ["creator", "administrator", "member"].includes(res.result.status) ||
        (res.result.status === "restricted" && res.result.is_member === true);
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
      await db.from("task_completions").upsert(
        {
          user_id: profile.id,
          task_id: task.id,
          completed: true,
          verification_status: "verified",
          completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,task_id" },
      );
    } else {
      const { data: prev } = await db
        .from("task_completions")
        .select("completed")
        .eq("user_id", profile.id)
        .eq("task_id", task.id)
        .maybeSingle();
      if (!prev?.completed) {
        await db.from("task_completions").upsert(
          { user_id: profile.id, task_id: task.id, completed: false, verification_status: "pending" },
          { onConflict: "user_id,task_id" },
        );
      }
    }
  }

  const done = await completionsFor(profile.id);
  const doneIds = new Set(done.filter((d) => d.completed).map((d) => d.task_id));
  for (const task of tasks) {
    if (task.required && !doneIds.has(task.id)) missing.push(task.name);
  }

  const allDone = missing.length === 0;
  if (allDone && profile.status !== "active") {
    await db.from("profiles").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", profile.id);
    await db.from("notifications").insert({
      user_id: profile.id,
      title: "Account activated",
      body: "All tasks completed. You can now earn credits and redeem licenses.",
      kind: "account",
    });
    const { data: awarded } = await db.rpc("award_referral", { _referred_user_id: profile.id });
    if (awarded) await notifyReferralReward(profile.id);
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

  await tg("sendMessage", {
    chat_id: referrer.telegram_user_id,
    parse_mode: "HTML",
    text:
      `🎉 <b>New Referral Verified!</b>\n\n` +
      `You earned:\n💰 <b>+1 Credit</b>\n\n━━━━━━━━━━\n\n` +
      `👥 Valid Referrals: <b>${count ?? 0}</b>\n` +
      `💰 Available Credits: <b>${referrer.credits_available}</b>\n\n` +
      `Keep inviting friends to unlock free Lovable Unlimited licenses!`,
  });
}


export async function redeem(profileId: string, rewardId: string) {
  const { data, error } = await db.rpc("redeem_reward", {
    _user_id: profileId,
    _reward_id: rewardId,
    _generated_key: makeLicenseKey(),
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("redemption_failed");
  return row as { license_key: string; duration_days: number; credits_used: number; reward_name: string };
}
