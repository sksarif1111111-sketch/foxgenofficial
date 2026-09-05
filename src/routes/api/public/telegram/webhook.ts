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
          update_id?: number;
          message?: { chat: { id: number }; from?: TgUser; text?: string };
          callback_query?: { id: string; from: TgUser; data?: string; message?: { chat: { id: number } } };
        };

        if (typeof update.update_id === "number") {
          const { error: updateError } = await db
            .from("telegram_processed_updates")
            .insert({ update_id: update.update_id });
          if (updateError?.code === "23505") return Response.json({ ok: true, duplicate: true });
          if (updateError) return Response.json({ ok: false }, { status: 500 });
          if (update.update_id % 100 === 0) {
            const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            await db.from("telegram_processed_updates").delete().lt("processed_at", cutoff);
          }
        }

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
            { text: "👥 Invite friends", callback_data: "invite" },
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

        if (action === "community") {
          await send(
            `🦊 <b>FoxGEN PRO Official Community</b>\n\nStay connected with FoxGEN PRO for:\n🚀 Lovable Unlimited Updates\n📚 Tutorials\n🎁 Free License Giveaways\n🔥 Special Offers\n💡 Tips & Support\n\nChoose a platform below and join our community.`,
            communityRows,
          );
          return Response.json({ ok: true });
        }

        if (action === "menu" || action === "help") {
          await send(welcome, mainMenu);
          return Response.json({ ok: true });
        }



        const hubButton = [{ text: "🚀 Go to Rewards Hub", callback_data: "me" }];

        const activatedText =
          `🎉 <b>Account Activated!</b>\n\n` +
          `Your FoxGEN PRO Rewards account is now active.\n\n` +
          `You can now:\n👥 Invite Friends\n💰 Earn Credits\n🎁 Redeem Licenses`;

        const renderTasks = async () => {
          const tasks = await activeTasks();
          const done = await completionsFor(profile.id);
          const doneIds = new Set(done.filter((d) => d.completed).map((d) => d.task_id));
          const total = tasks.length || 1;
          const completed = tasks.filter((t) => doneIds.has(t.id)).length;
          const filled = Math.round((completed / total) * 10);
          const bar = "█".repeat(filled) + "░".repeat(10 - filled);

          let body = `🦊 <b>FOXGEN PRO TASKS</b>\n\n<b>Your Progress:</b>\n${bar}\n${completed} / ${tasks.length} Completed\n\n`;
          const rows: Array<Array<{ text: string; url?: string; callback_data?: string }>> = [];
          let hasTelegram = false;

          for (const t of tasks) {
            const isTg = t.verification_type === "telegram_auto_verification";
            const ok = doneIds.has(t.id);
            const status = ok ? (isTg ? "✅ Verified" : "✅ Completed") : isTg ? "❌ Not Joined" : "⏳ Pending";
            body += `${esc(t.name)}\nStatus: ${status}\n${t.description ? esc(t.description) + "\n" : ""}\n`;
            if (t.url) rows.push([{ text: t.name, url: t.url }]);
            if (isTg) hasTelegram = true;
            else if (!ok) rows.push([{ text: "✅ I Completed This Task", callback_data: `done:${t.id}` }]);
          }

          if (hasTelegram) rows.push([{ text: "🔍 Verify Telegram Membership", callback_data: "verify" }]);
          rows.push([{ text: "⬅️ Back", callback_data: "menu" }]);
          await send(body.trim(), rows);
        };

        if (action === "tasks") {
          await renderTasks();
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
          if (state.allDone) await send(activatedText, [hubButton]);
          else await renderTasks();
          return Response.json({ ok: true });
        }

        if (action === "verify") {
          const state = await refreshVerification(profile);
          const joined = state.telegram.filter((c) => c.ok);
          const pending = state.telegram.filter((c) => !c.ok);

          if (pending.length) {
            let body = `❌ <b>Verification Incomplete</b>\n\n`;
            if (joined.length) body += `You have joined:\n${joined.map((c) => `✅ ${esc(c.name)}`).join("\n")}\n\n`;
            body += `You still need to join:\n${pending.map((c) => `❌ ${esc(c.name)}${c.error ? `\n   ${esc(c.error)}` : ""}`).join("\n")}`;
            const rows: Array<Array<{ text: string; url?: string; callback_data?: string }>> = pending
              .filter((c) => c.url)
              .map((c) => [{ text: c.name, url: c.url as string }]);

            rows.push([{ text: "🔍 Verify Telegram Membership", callback_data: "verify" }]);
            rows.push([{ text: "📋 My tasks", callback_data: "tasks" }]);
            await send(body, rows);
            return Response.json({ ok: true });
          }

          await send(
            `🎉 <b>Telegram Verification Successful!</b>\n\nYou have successfully joined both official FoxGEN PRO Telegram channels.\n\nContinue to complete your remaining tasks.`,
            [[{ text: "📋 My tasks", callback_data: "tasks" }]],
          );
          if (state.allDone) await send(activatedText, [hubButton]);
          return Response.json({ ok: true });
        }


        if (action === "me") {
          const { profile: fresh } = await ensureProfile(from);
          const { count } = await db
            .from("referrals")
            .select("id", { count: "exact", head: true })
            .eq("referrer_id", profile.id)
            .eq("status", "verified");
          const botUser = settings["bot_username"] || "";
          const link = botUser ? `https://t.me/${botUser}?start=${profile.referral_code}` : profile.referral_code;
          const site = settings["site_url"] || "";
          await send(
            `👤 <b>${esc([fresh.first_name, fresh.last_name].filter(Boolean).join(" ") || "FoxGEN Member")}</b>\n` +
              (fresh.telegram_username ? `Username: <b>@${esc(fresh.telegram_username)}</b>\n` : "Username: <i>Not set in Telegram</i>\n") +
              `Status: <b>${esc(fresh.status)}</b>\nCredits: <b>${fresh.credits_available}</b>\nEarned: ${fresh.credits_earned} · Spent: ${fresh.credits_spent}\nVerified referrals: <b>${count ?? 0}</b>\n\nInvite link:\n<code>${esc(link)}</code>` +
              (site ? `\n\nWeb dashboard:\n${site}/hub?t=${profile.web_token}` : ""),
            mainMenu,
          );
          return Response.json({ ok: true });
        }

        if (action === "invite") {
          const fresh = await profileByTelegramId(from.id);
          const { count } = await db.from("referrals").select("id", { count: "exact", head: true }).eq("referrer_id", profile.id).eq("status", "verified");
          const botUser = settings["bot_username"] || "";
          const link = botUser ? `https://t.me/${botUser}?start=${profile.referral_code}` : profile.referral_code;
          const message = `🦊 Join FoxGEN PRO Rewards Hub!\n\n🎁 Earn FREE Lovable Unlimited Extension licenses.\n\nComplete tasks, invite friends and earn credits.\n\nJoin using my referral link:\n${link}`;
          await send(
            `👥 <b>INVITE & EARN</b>\n\nYour Referral Code:\n<code>${esc(profile.referral_code)}</code>\n\nYour Referral Link:\n<code>${esc(link)}</code>\n\nValid Referrals: <b>${count ?? 0}</b>\nCredits: <b>${fresh?.credits_available ?? 0}</b>`,
            [
              [{ text: "✈️ Share on Telegram", url: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(message.replace(link, ""))}` }],
              [{ text: "💬 Share on WhatsApp", url: `https://wa.me/?text=${encodeURIComponent(message)}` }],
              [{ text: "⬅️ Back", callback_data: "menu" }],
            ],
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
