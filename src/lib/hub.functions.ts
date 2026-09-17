import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(10).max(200) });

export type HubState = {
  profile: {
    id: string;
    name: string;
    username: string | null;
    initials: string;
    status: string;
    referral_code: string | null;
    credits_available: number;
    credits_earned: number;
    credits_spent: number;
  };
  referralLink: string | null;
  verifiedReferrals: number;
  pendingReferrals: number;
  bonusCredits: number;
  nextReward: { name: string; credit_cost: number; progress: number } | null;
  tasks: Array<{
    id: string;
    name: string;
    description: string | null;
    platform: string;
    url: string | null;
    verification_type: string;
    required: boolean;
    completed: boolean;
  }>;
  rewards: Array<{ id: string; name: string; duration_days: number; credit_cost: number }>;
  licenses: Array<{ license_key: string; duration_days: number; reward_name: string; redeemed_at: string; status: string }>;
  transactions: Array<{ id: string; amount: number; transaction_type: string; description: string | null; created_at: string }>;
  leaderboard: Array<{ name: string; referrals: number; credits: number }>;
  announcements: Array<{ title: string; message: string; button_text: string | null; button_url: string | null }>;
  links: Record<string, string>;
};

export const getHubState = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }): Promise<HubState> => {
    const { db, getSettings, profileByToken, activeTasks, completionsFor } = await import("@/lib/hub.server");
    const profile = await profileByToken(data.token);
    if (!profile) throw new Error("Invalid access link. Open the bot and press “My account”.");

    const settings = await getSettings();
    const tasks = await activeTasks();
    const completions = await completionsFor(profile.id);
    const doneIds = new Set(completions.filter((c) => c.completed).map((c) => c.task_id));

    const [refs, rewards, redemptions, txs, board, ann] = await Promise.all([
      db.from("referrals").select("status").eq("referrer_id", profile.id),
      db.from("rewards").select("id, name, duration_days, credit_cost").eq("enabled", true).order("display_order"),
      db
        .from("license_redemptions")
        .select("license_key, duration_days, reward_name, redeemed_at")
        .eq("user_id", profile.id)
        .order("redeemed_at", { ascending: false }),
      db
        .from("credit_transactions")
        .select("id, amount, transaction_type, description, created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("profiles")
        .select("first_name, telegram_username, credits_earned")
        .order("credits_earned", { ascending: false })
        .limit(20),
      db.from("announcements").select("title, message, button_text, button_url").eq("status", "published").order("publish_date", { ascending: false }).limit(5),
    ]);

    const botUser = settings["bot_username"] || "";
    const transactions = txs.data ?? [];
    const nextReward = (rewards.data ?? []).find((reward) => reward.credit_cost > profile.credits_available) ??
      (rewards.data ?? [])[0] ?? null;
    return {
      profile: {
        id: profile.id,
        name: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Member",
        username: profile.telegram_username,
        initials: [profile.first_name, profile.last_name]
          .filter(Boolean)
          .map((part) => part?.charAt(0).toUpperCase())
          .join("") || "FG",
        status: profile.status,
        referral_code: profile.status === "active" ? profile.referral_code : null,
        credits_available: profile.credits_available,
        credits_earned: profile.credits_earned,
        credits_spent: profile.credits_spent,
      },
      referralLink: profile.status !== "active"
        ? null
        : botUser
          ? `https://t.me/${botUser}?start=${profile.referral_code}`
          : `Referral code: ${profile.referral_code}`,
      verifiedReferrals: (refs.data ?? []).filter((r) => r.status === "verified").length,
      pendingReferrals: (refs.data ?? []).filter((r) => r.status === "pending").length,
      bonusCredits: transactions
        .filter((t) => t.amount > 0 && t.transaction_type !== "referral_reward")
        .reduce((sum, t) => sum + t.amount, 0),
      nextReward: nextReward
        ? { name: nextReward.name, credit_cost: nextReward.credit_cost, progress: Math.min(profile.credits_available, nextReward.credit_cost) }
        : null,
      tasks: tasks.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        platform: t.platform,
        url: t.url,
        verification_type: t.verification_type,
        required: t.required,
        completed: doneIds.has(t.id),
      })),
      rewards: rewards.data ?? [],
      licenses: (redemptions.data ?? []).map((license) => ({ ...license, status: "redeemed" })),
      transactions,
      leaderboard: (board.data ?? []).map((b) => ({
        name: b.telegram_username ? `@${b.telegram_username}` : (b.first_name ?? "Member"),
        referrals: b.credits_earned,
        credits: b.credits_earned,
      })),
      announcements: ann.data ?? [],
      links: settings,
    };
  });

export const completeTask = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.extend({ taskId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { db, profileByToken, refreshVerification } = await import("@/lib/hub.server");
    const profile = await profileByToken(data.token);
    if (!profile) throw new Error("Invalid access link.");
    const { error } = await db.from("task_completions").upsert(
      {
        user_id: profile.id,
        task_id: data.taskId,
        completed: true,
        verification_status: "completed",
        verification_method: "manual",
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,task_id" },
    );
    if (error) throw new Error("Could not save this task. Please try again.");
    return await refreshVerification(profile);
  });

export const verifyMembership = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.parse(input))
  .handler(async ({ data }) => {
    const { profileByToken, refreshVerification } = await import("@/lib/hub.server");
    const profile = await profileByToken(data.token);
    if (!profile) throw new Error("Invalid access link.");
    return await refreshVerification(profile);
  });

export const redeemReward = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenSchema.extend({ rewardId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { acquireLock, profileByToken, redeem } = await import("@/lib/hub.server");
    const profile = await profileByToken(data.token);
    if (!profile) throw new Error("Invalid access link.");
    const locked = await acquireLock(`${profile.id}:redeem:${data.rewardId}`);
    if (!locked) throw new Error("A license is already being generated. Please wait a moment.");
    try {
      return await redeem(profile.id, data.rewardId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("insufficient_credits")) throw new Error("Not enough credits yet.");
      if (msg.includes("account_not_active")) throw new Error("Complete every required task first.");
      throw new Error("This reward is unavailable right now.");
    }
  });
