import { createFileRoute } from "@tanstack/react-router";

type TgUser = { id: number; username?: string; first_name?: string; last_name?: string };

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const mod = await import("@/lib/hub.server");
        const {
          db,
          tg,
          getSettings,
          ensureProfile,
          profileByTelegramId,
          activeTasks,
          completionsFor,
          refreshVerification,
          redeem,
          webhookSecret,
        } = mod;

        const expected = await webhookSecret();
        if ((request.headers.get("x-telegram-bot-api-secret-token") ?? "") !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const update = (await request.json()) as {
          message?: { chat: { id: number }; from?: TgUser; text?: string };
          callback_query?: { id: string; from: TgUser; data?: string; message?: { chat: { id: number } } };
        };

        const from = update.message?.from ?? update.callback_query?.from;
        const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
        if (!from || !chatId) return Response.json({ ok: true });

        const text = update.message?.text?.trim() ?? "";
        const cb = update.callback_query?.data ?? "";
        const settings = await getSettings();

        const send = (body: string, keyboard?: unknown) =>
          tg("sendMessage", {
            chat_id: chatId,
            text: body,
            parse_mode: "HTML",
            disable_web_page_preview: true,
            ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
          });

        const S = (key: string, fallback: string) => (settings[key] || fallback).trim();
        const siteUrl = S("site_url", "https://nextgen.lovableunlimitedc.workers.dev");
        const supportUrl = S("support_url", "https://wa.me/917699355860");

        const mainMenu = [
          [{ text: "🚀 Start Earning", callback_data: "tasks" }],
          [{ text: "📢 Official Community", callback_data: "community" }],
          [{ text: "🌐 Official Website", url: siteUrl }],
          [{ text: "💬 Support", url: supportUrl }],
          [
            { text: "👤 My account", callback_data: "me" },
            { text: "🎁 Rewards", callback_data: "rewards" },
          ],
          [{ text: "✅ Verify tasks", callback_data: "verify" }],
        ];

        const communityRows = [
          [{ text: "▶️ YouTube Channel", url: S("youtube_url", "https://youtube.com/@mirza-p7x6s?si=er4Vs-kPWskxY_JW") }],
          [
            {
              text: "💬 WhatsApp Channel",
              url: S("whatsapp_url", "https://whatsapp.com/channel/0029VbDK6SHKLaHn5vxOQa0v"),
            },
          ],
          [{ text: "📘 Facebook Page", url: S("facebook_url", "https://www.facebook.com/share/1DYdDK9qCq/") }],
          [
            {
              text: `✈️ Telegram – ${S("telegram_channel_1_name", "FoxGEN Official")}`,
              url: S("telegram_channel_1", "https://t.me/foxgenofficial"),
            },
          ],
          [
            {
              text: `✈️ Telegram – ${S("telegram_channel_2_name", "Lovable Unlimited FoxGEN")}`,
              url: S("telegram_channel_2", "https://t.me/lovableunlimitedfoxgen"),
            },
          ],
          [{ text: "🌐 Official Website", url: siteUrl }],
          [{ text: "💬 Contact Support", url: supportUrl }],
          [{ text: "⬅️ Back", callback_data: "menu" }],
        ];

        const welcome =
          `🦊 <b>Welcome to FoxGEN PRO Rewards Hub!</b>\n` +
          `🎁 <b>FREE Lovable Unlimited Extension License Giveaway</b>\n\n` +
          `Welcome to the official FoxGEN PRO Rewards system.\n` +
          `Here you can earn FREE <b>Lovable Unlimited Extension</b> licenses by completing community tasks and inviting real friends.\n\n` +
          `━━━━━━━━━━━━━━━━\n\n` +
          `🚀 <b>How It Works</b>\n` +
          `1️⃣ Join our official community platforms\n` +
          `2️⃣ Complete the required tasks\n` +
          `3️⃣ Get your personal referral link\n` +
          `4️⃣ Invite friends\n` +
          `5️⃣ Each verified referral = 1 Credit\n` +
          `6️⃣ Collect credits\n` +
          `7️⃣ Redeem FREE Lovable Unlimited Extension licenses\n\n` +
          `━━━━━━━━━━━━━━━━\n\n` +
          `🎁 <b>Available License Rewards</b>\n` +
          `🟢 15 Days License — 5 Credits\n` +
          `🔵 30 Days License — 10 Credits\n` +
          `🟣 60 Days License — 20 Credits\n\n` +
          `━━━━━━━━━━━━━━━━\n\n` +
          `💰 <b>1 Verified Referral = 1 Credit</b>\n` +
          `The more real friends you invite, the more credits and rewards you can earn.\n\n` +
          `⚡ Complete your tasks and start earning now!`;

        // /start [referral code]
        if (text.startsWith("/start")) {
          const payload = text.split(/\s+/)[1] ?? "";
          const { profile } = await ensureProfile(from, payload);
          const botUser = settings["bot_username"] || "";
          const link = botUser ? `https://t.me/${botUser}?start=${profile.referral_code}` : profile.referral_code;
          await send(`${welcome}\n\n🔗 <b>Your invite link:</b>\n<code>${esc(link)}</code>`, mainMenu);
          return Response.json({ ok: true });
        }


        const profile = await profileByTelegramId(from.id);
        if (!profile) {
          await send("Please send /start first.");
          return Response.json({ ok: true });
        }

        if (update.callback_query) await tg("answerCallbackQuery", { callback_query_id: update.callback_query.id });

        const action = cb || text.replace(/^\//, "");

        if (action === "tasks") {
          const tasks = await activeTasks();
          const done = await completionsFor(profile.id);
          const doneIds = new Set(done.filter((d) => d.completed).map((d) => d.task_id));
          const rows = tasks.map((t) => {
            const btns: Array<{ text: string; url?: string; callback_data?: string }> = [];
            if (t.url) btns.push({ text: `🔗 ${t.name}`, url: t.url });
            if (t.verification_type === "manual_confirmation") {
              btns.push({
                text: doneIds.has(t.id) ? "✅ Done" : "I completed this",
                callback_data: `done:${t.id}`,
              });
            }
            return btns.length ? btns : [{ text: t.name, callback_data: "tasks" }];
          });
          rows.push([{ text: "✅ Verify membership", callback_data: "verify" }]);
          await send("<b>Required tasks</b>\nComplete every task, then press Verify.", rows);
          return Response.json({ ok: true });
        }

        if (action.startsWith("done:")) {
          const taskId = action.slice(5);
          await db.from("task_completions").upsert(
            {
              user_id: profile.id,
              task_id: taskId,
              completed: true,
              verification_status: "confirmed",
              completed_at: new Date().toISOString(),
            },
            { onConflict: "user_id,task_id" },
          );
          const state = await refreshVerification(profile);
          await send(
            state.allDone
              ? "🎉 All tasks completed — your account is now <b>active</b>!"
              : `Saved. Still missing:\n• ${state.missing.map(esc).join("\n• ")}`,
            mainMenu,
          );
          return Response.json({ ok: true });
        }

        if (action === "verify") {
          const state = await refreshVerification(profile);
          await send(
            state.allDone
              ? "✅ Verified! Your account is <b>active</b>."
              : `❌ Not verified yet. Missing:\n• ${state.missing.map(esc).join("\n• ")}`,
            mainMenu,
          );
          return Response.json({ ok: true });
        }

        if (action === "me") {
          const fresh = await profileByTelegramId(from.id);
          const { count } = await db
            .from("referrals")
            .select("id", { count: "exact", head: true })
            .eq("referrer_id", profile.id)
            .eq("status", "verified");
          const botUser = settings["bot_username"] || "";
          const link = botUser ? `https://t.me/${botUser}?start=${profile.referral_code}` : profile.referral_code;
          const site = settings["site_url"] || "";
          await send(
            `👤 <b>Account</b>\nStatus: <b>${esc(fresh?.status ?? profile.status)}</b>\nCredits: <b>${fresh?.credits_available ?? 0}</b>\nEarned: ${fresh?.credits_earned ?? 0} · Spent: ${fresh?.credits_spent ?? 0}\nVerified referrals: <b>${count ?? 0}</b>\n\nInvite link:\n<code>${esc(link)}</code>` +
              (site ? `\n\nWeb dashboard:\n${site}/hub?t=${profile.web_token}` : ""),
            mainMenu,
          );
          return Response.json({ ok: true });
        }

        if (action === "rewards") {
          const { data: rewards } = await db
            .from("rewards")
            .select("*")
            .eq("enabled", true)
            .order("display_order", { ascending: true });
          const rows = (rewards ?? []).map((r) => [
            { text: `${r.name} — ${r.credit_cost} credits`, callback_data: `redeem:${r.id}` },
          ]);
          await send("🎁 <b>License store</b>\nPick a reward to redeem instantly.", rows);
          return Response.json({ ok: true });
        }

        if (action.startsWith("redeem:")) {
          try {
            const row = await redeem(profile.id, action.slice(7));
            await send(
              `🎉 <b>${esc(row.reward_name)}</b> unlocked!\n\nYour license key:\n<code>${esc(row.license_key)}</code>\n\nValid for ${row.duration_days} days. Paste it into the FoxGEN Pro extension.`,
              mainMenu,
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : "error";
            const human = msg.includes("insufficient_credits")
              ? "You don't have enough credits yet."
              : msg.includes("account_not_active")
                ? "Complete all tasks first, then try again."
                : "Reward unavailable right now.";
            await send(`❌ ${human}`, mainMenu);
          }
          return Response.json({ ok: true });
        }

        await send("Use the menu below.", mainMenu);
        return Response.json({ ok: true });
      },
    },
  },
});
