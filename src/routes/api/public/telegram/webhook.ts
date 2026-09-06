import { createFileRoute } from "@tanstack/react-router";

type TgUser = { id: number; username?: string; first_name?: string; last_name?: string };
type Btn = { text: string; url?: string; callback_data?: string };
type Keyboard = Btn[][];

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
          callback_query?: {
            id: string;
            from: TgUser;
            data?: string;
            message?: { chat: { id: number }; message_id: number };
          };
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
        const editMessageId = update.callback_query?.message?.message_id;
        const settings = await getSettings();

        const send = (body: string, keyboard?: Keyboard) =>
          tg("sendMessage", {
            chat_id: chatId,
            text: body,
            parse_mode: "HTML",
            disable_web_page_preview: true,
            ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
          });

        /** Single-message navigation: edit the current menu message instead of spamming new ones. */
        const show = async (body: string, keyboard?: Keyboard) => {
          if (editMessageId) {
            const res = await tg("editMessageText", {
              chat_id: chatId,
              message_id: editMessageId,
              text: body,
              parse_mode: "HTML",
              disable_web_page_preview: true,
              ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
            });
            if (res.ok) return;
            if (res.description?.includes("message is not modified")) return;
          }
          await send(body, keyboard);
        };

        const S = (key: string, fallback: string) => (settings[key] || fallback).trim();
        const siteUrl = S("site_url", "https://nextgen.lovableunlimitedc.workers.dev");
        const supportUrl = S("support_url", "https://wa.me/917699355860");
        const youtubeUrl = S("youtube_url", "https://youtube.com/@mirza-p7x6s?si=er4Vs-kPWskxY_JW");
        const whatsappUrl = S("whatsapp_url", "https://whatsapp.com/channel/0029VbDK6SHKLaHn5vxOQa0v");
        const facebookUrl = S("facebook_url", "https://www.facebook.com/share/1DYdDK9qCq/");
        const channel1Url = S("telegram_channel_1", "https://t.me/foxgenofficial");
        const channel1Name = S("telegram_channel_1_name", "FoxGEN Official");
        const channel2Url = S("telegram_channel_2", "https://t.me/lovableunlimitedfoxgen");
        const channel2Name = S("telegram_channel_2_name", "Lovable Unlimited FoxGEN");
        const extensionName = S("extension_name", "Lovable Unlimited Extension");
        const extensionVersion = S("extension_version", "16.73");
        const extensionDate = S("extension_release_date", "");
        const extensionDesc = S("extension_description", "Latest official FoxGEN PRO release for Lovable Unlimited.");
        const extensionUrl = S(
          "extension_download_url",
          "https://first-word-platform.lovable.app/__l5e/assets-v1/1f749969-6e26-4877-b944-e0875747752b/FoxGEN-Pro-Extension-16.73.zip",
        );

        const mainMenu: Keyboard = [
          [{ text: "🚀 Start Earning", callback_data: "tasks" }],
          [
            { text: "📋 Tasks", callback_data: "tasks" },
            { text: "👥 My Referral", callback_data: "invite" },
          ],
          [
            { text: "🎁 Rewards", callback_data: "rewards" },
            { text: "🏆 Leaderboard", callback_data: "board" },
          ],
          [
            { text: "👤 My Account", callback_data: "me" },
            { text: "📥 Download Extension", callback_data: "download" },
          ],
          [{ text: "📢 Official Community", callback_data: "community" }],
          [{ text: "🌐 Official Website", url: siteUrl }],
          [{ text: "💬 Support", url: supportUrl }],
        ];

        const backRow: Btn[] = [{ text: "⬅️ Back", callback_data: "menu" }];

        const communityRows: Keyboard = [
          [{ text: "▶️ YouTube", url: youtubeUrl }],
          [{ text: "💬 WhatsApp Channel", url: whatsappUrl }],
          [{ text: "📘 Facebook", url: facebookUrl }],
          [{ text: `✈️ ${channel1Name}`, url: channel1Url }],
          [{ text: `✈️ ${channel2Name}`, url: channel2Url }],
          [{ text: "🌐 Official Website", url: siteUrl }],
          [{ text: "💬 Support", url: supportUrl }],
          backRow,
        ];

        const welcome =
          `🦊 <b>Welcome to FoxGEN PRO!</b>\n\n` +
          `🎁 Earn FREE Lovable Unlimited Extension licenses.\n\n` +
          `Complete tasks → Invite friends → Earn credits → Unlock rewards.\n\n` +
          `<b>How it works:</b>\n` +
          `👥 1 verified referral = 1 credit\n` +
          `🎁 Collect credits and redeem available licenses\n\n` +
          `⚡ Premium Access • Unlimited Possibilities\n\n` +
          `🚀 Start earning now!`;

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
          await show(
            `🦊 <b>FOXGEN PRO COMMUNITY</b>\n\n` +
              `Stay connected with the official FoxGEN PRO community.\n\n` +
              `▶️ <b>YouTube</b>\nWatch tutorials, updates and guides.\n\n` +
              `💬 <b>WhatsApp Channel</b>\nGet latest updates and offers.\n\n` +
              `📘 <b>Facebook</b>\nFollow our official Facebook page.\n\n` +
              `✈️ <b>${esc(channel1Name)}</b>\nFollow our official Telegram channel.\n\n` +
              `✈️ <b>${esc(channel2Name)}</b>\nFollow our second official Telegram channel.\n\n` +
              `🌐 <b>Official Website</b>\nVisit our official platform.\n\n` +
              `💬 <b>Support</b>\nContact official support.`,
            communityRows,
          );
          return Response.json({ ok: true });
        }

        if (action === "menu" || action === "help") {
          await show(welcome, mainMenu);
          return Response.json({ ok: true });
        }

        const activatedText =
          `🎉 <b>Congratulations!</b>\n\n` +
          `All required community tasks are completed successfully.\n` +
          `Your FoxGEN PRO Rewards account is now active.\n\n` +
          `You can now:\n👥 Invite friends\n💰 Earn credits\n🎁 Redeem license rewards\n\n` +
          `Remember: 1 verified referral = 1 credit.`;

        const activatedRows: Keyboard = [
          [{ text: "👥 Get My Referral Link", callback_data: "invite" }],
          [{ text: "🎁 View Rewards", callback_data: "rewards" }],
          [{ text: "🏠 Dashboard", callback_data: "menu" }],
        ];


        const renderTasks = async () => {
          const tasks = await activeTasks();
          const done = await completionsFor(profile.id);
          const doneIds = new Set(done.filter((d) => d.completed).map((d) => d.task_id));
          const total = tasks.length || 1;
          const completed = tasks.filter((t) => doneIds.has(t.id)).length;
          const filled = Math.round((completed / total) * 10);
          const bar = "█".repeat(filled) + "░".repeat(10 - filled);

          let body = `📋 <b>TASK PROGRESS</b>\n\n${bar}\n${completed} / ${tasks.length} Completed\n\n`;
          const rows: Keyboard = [];
          let hasTelegram = false;

          for (const t of tasks) {
            const isTg = t.verification_type === "telegram_auto_verification";
            const ok = doneIds.has(t.id);
            const status = ok ? (isTg ? "✅ Verified" : "✅ Completed") : isTg ? "❌ Not Followed" : "⏳ Pending";
            body += `${esc(t.name)}\nStatus: ${status}\n\n`;
            if (t.url) rows.push([{ text: t.name, url: t.url }]);
            if (isTg) hasTelegram = true;
            else if (!ok) rows.push([{ text: `✅ I Completed This Task — ${t.name}`, callback_data: `done:${t.id}` }]);
          }

          if (hasTelegram) rows.push([{ text: "🔄 VERIFY AGAIN", callback_data: "verify" }]);
          else rows.push([{ text: "✅ Verify Tasks", callback_data: "verify" }]);
          rows.push(backRow);
          await show(body.trim(), rows);
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
          if (state.allDone) await show(activatedText, activatedRows);
          else await renderTasks();
          return Response.json({ ok: true });
        }

        if (action === "verify") {
          const state = await refreshVerification(profile);
          const tasks = await activeTasks();
          const done = await completionsFor(profile.id);
          const doneIds = new Set(done.filter((d) => d.completed).map((d) => d.task_id));

          let body = `📋 <b>VERIFICATION RESULT</b>\n\n`;
          for (const t of tasks) {
            const isTg = t.verification_type === "telegram_auto_verification";
            const ok = doneIds.has(t.id);
            body += `${esc(t.name)}\n${ok ? (isTg ? "✅ Verified" : "✅ Completed") : "❌ Not completed"}\n\n`;
          }
          body += `━━━━━━━━━━━━\n\n`;

          const pending = state.telegram.filter((c) => !c.ok);
          const rows: Keyboard = [];

          if (state.allDone) {
            await show(activatedText, activatedRows);
            return Response.json({ ok: true });
          }

          const apiIssue = pending.some((c) => c.error && !c.error.includes("has not joined"));
          body += apiIssue
            ? `⚠️ <b>Unable to verify channel membership right now.</b>\n\nPlease make sure you followed both official Telegram channels and try again.\n\n`
            : `❌ <b>Verification Incomplete</b>\n\nYou still need to follow:\n`;
          for (const c of pending) body += `✈️ ${esc(c.name)}${c.error ? `\n   <i>${esc(c.error)}</i>` : ""}\n`;
          for (const t of tasks) {
            if (t.verification_type === "telegram_auto_verification") continue;
            if (!doneIds.has(t.id)) body += `• ${esc(t.name)}\n`;
          }
          for (const c of pending) if (c.url) rows.push([{ text: `FOLLOW ${c.name.toUpperCase()}`, url: c.url }]);
          rows.push([{ text: "🔄 VERIFY AGAIN", callback_data: "verify" }]);
          rows.push([{ text: "📋 My Tasks", callback_data: "tasks" }]);

          rows.push(backRow);
          await show(body.trim(), rows);
          return Response.json({ ok: true });
        }

        if (action === "download") {
          const fresh = (await profileByTelegramId(from.id)) ?? profile;
          if (fresh.status !== "active") {
            await show(
              `❌ <b>Locked</b>\n\nComplete all required tasks first to unlock the official ${esc(extensionName)} download.`,
              [[{ text: "📋 My Tasks", callback_data: "tasks" }], backRow],
            );
            return Response.json({ ok: true });
          }

          const body =
            `🦊 <b>FoxGEN PRO Extension</b>\n${esc(extensionName)}\n\n` +
            `Download the latest official FoxGEN PRO Extension below.\n\n` +
            `📦 Version: <b>${esc(extensionVersion)}</b>\n` +
            (extensionDate ? `📅 Release Date: ${esc(extensionDate)}\n` : "") +
            `📝 ${esc(extensionDesc)}`;

          const sent = extensionUrl.startsWith("http")
            ? await tg("sendDocument", {
                chat_id: chatId,
                document: extensionUrl,
                caption:
                  `🦊 <b>FoxGEN PRO Extension</b>\nLatest official Lovable Unlimited Extension release.\n\n📦 Version: ${esc(extensionVersion)}\n\nDownload and install the extension using the official installation guide.`,
                parse_mode: "HTML",
              })
            : { ok: false };

          const rows: Keyboard = [];
          if (!sent.ok && extensionUrl.startsWith("http"))
            rows.push([{ text: "📥 DOWNLOAD EXTENSION", url: extensionUrl }]);
          const guide = settings["installation_guide_url"];
          if (guide) rows.push([{ text: "📚 Installation Guide", url: guide }]);
          rows.push(backRow);
          await show(body, rows);
          return Response.json({ ok: true });
        }

        const verifiedReferrals = async (id: string) => {
          const { count } = await db
            .from("referrals")
            .select("id", { count: "exact", head: true })
            .eq("referrer_id", id)
            .eq("status", "verified");
          return count ?? 0;
        };

        const botUser = settings["bot_username"] || "";
        const inviteLink = botUser
          ? `https://t.me/${botUser}?start=${profile.referral_code}`
          : profile.referral_code;

        if (action === "me") {
          const { profile: fresh } = await ensureProfile(from);
          const [refs, licenses, ranked] = await Promise.all([
            verifiedReferrals(profile.id),
            db.from("redemptions").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
            db.from("profiles").select("id, credits_earned").order("credits_earned", { ascending: false }).limit(500),
          ]);
          const rank = (ranked.data ?? []).findIndex((p) => p.id === profile.id) + 1;
          await show(
            `👤 <b>MY ACCOUNT</b>\n\n` +
              `Name: <b>${esc([fresh.first_name, fresh.last_name].filter(Boolean).join(" ") || "FoxGEN Member")}</b>\n` +
              (fresh.telegram_username
                ? `Username: <b>@${esc(fresh.telegram_username)}</b>\n`
                : "Username: <i>Not set in Telegram</i>\n") +
              `Status: <b>${esc(fresh.status)}</b>\n\n━━━━━━━━━━\n\n` +
              `💰 Available Credits: <b>${fresh.credits_available}</b>\n` +
              `👥 Valid Referrals: <b>${refs}</b>\n` +
              `📈 Total Credits Earned: <b>${fresh.credits_earned}</b>\n` +
              `📉 Total Credits Spent: <b>${fresh.credits_spent}</b>\n` +
              `🔑 Licenses Claimed: <b>${licenses.count ?? 0}</b>\n` +
              `🏆 Global Rank: <b>${rank > 0 ? `#${rank}` : "—"}</b>\n` +
              `📅 Registered: ${new Date(fresh.created_at).toISOString().slice(0, 10)}\n\n` +
              `🔗 Web dashboard:\n${siteUrl}/hub?t=${profile.web_token}`,
            [
              [{ text: "👥 Invite Friends", callback_data: "invite" }],
              [
                { text: "🔑 My Licenses", url: `${siteUrl}/hub?t=${profile.web_token}` },
                { text: "🏆 Leaderboard", callback_data: "board" },
              ],
              [{ text: "🏠 Back Home", callback_data: "menu" }],
            ],
          );
          return Response.json({ ok: true });
        }

        if (action === "board") {
          const { data: top } = await db
            .from("profiles")
            .select("id, first_name, telegram_username, credits_earned")
            .order("credits_earned", { ascending: false })
            .limit(500);
          const list = top ?? [];
          const medals = ["🥇", "🥈", "🥉"];
          let body = `🏆 <b>FOXGEN PRO LEADERBOARD</b>\n🌍 All Time\n\n`;
          for (let i = 0; i < Math.min(10, list.length); i++) {
            const p = list[i];
            const label = p.telegram_username ? `@${p.telegram_username}` : p.first_name || "FoxGEN Member";
            body += `${medals[i] ?? `#${i + 1}`} <b>${esc(label)}</b> — 💰 ${p.credits_earned} credits\n`;
          }
          const myRank = list.findIndex((p) => p.id === profile.id) + 1;
          const myRefs = await verifiedReferrals(profile.id);
          body +=
            `\n━━━━━━━━━━\n\n<b>YOUR POSITION</b>\nRank: <b>${myRank > 0 ? `#${myRank}` : "—"}</b>\n` +
            `Referrals: <b>${myRefs}</b>\n\n🔥 Invite more friends and climb the leaderboard!`;
          await show(body, [[{ text: "👥 Invite Friends", callback_data: "invite" }], backRow]);
          return Response.json({ ok: true });
        }

        if (action === "invite") {
          const fresh = await profileByTelegramId(from.id);
          const refs = await verifiedReferrals(profile.id);
          const credits = fresh?.credits_available ?? 0;
          const { data: nextReward } = await db
            .from("rewards")
            .select("name, credit_cost")
            .eq("enabled", true)
            .gt("credit_cost", credits - 1)
            .order("credit_cost", { ascending: true })
            .limit(1)
            .maybeSingle();
          const target = nextReward?.credit_cost ?? 0;
          const filled = target > 0 ? Math.min(10, Math.round((credits / target) * 10)) : 10;
          const bar = "█".repeat(filled) + "░".repeat(10 - filled);
          const message = `🦊 Join FoxGEN PRO!\n\nEarn FREE Lovable Unlimited Extension licenses.\nComplete community tasks and invite friends.\n\n🎁 1 verified referral = 1 credit.\n\nJoin using my link:\n${inviteLink}`;
          await show(
            `👥 <b>INVITE FRIENDS</b>\n\nInvite real friends and earn free license rewards.\n\n` +
              `Your Referral Link:\n<code>${esc(inviteLink)}</code>\n\n` +
              `Valid Referrals: <b>${refs}</b>\nAvailable Credits: <b>${credits}</b>\n\n` +
              (nextReward
                ? `Next Reward: <b>${esc(nextReward.name)}</b>\nProgress:\n${bar}\n${credits} / ${target} Credits\n\n` +
                  `🔥 Invite ${Math.max(1, target - credits)} more verified friend(s) to unlock your next reward!`
                : `🎉 You have enough credits to redeem a reward now!`),
            [
              [
                {
                  text: "📤 Share on Telegram",
                  url: `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(message.replace(inviteLink, ""))}`,
                },
              ],
              [{ text: "📤 Share on WhatsApp", url: `https://wa.me/?text=${encodeURIComponent(message)}` }],
              [{ text: "🎁 Rewards", callback_data: "rewards" }],
              backRow,
            ],
          );
          return Response.json({ ok: true });
        }

        if (action === "rewards") {
          const fresh = await profileByTelegramId(from.id);
          const { data: rewards } = await db
            .from("rewards")
            .select("*")
            .eq("enabled", true)
            .order("display_order", { ascending: true });
          let body = `🎁 <b>LICENSE REWARDS</b>\n\nRedeem your credits for a FREE Lovable Unlimited Extension license.\n\n💰 Your Credits: <b>${fresh?.credits_available ?? 0}</b>\n\n━━━━━━━━━━\n\n`;
          const rows: Keyboard = [];
          for (const r of rewards ?? []) {
            body += `🦊 <b>${esc(r.name)}</b>\n💰 ${r.credit_cost} Credits\n\n`;
            rows.push([{ text: `🦊 ${r.name} — ${r.credit_cost} Credits`, callback_data: `redeem:${r.id}` }]);
          }
          rows.push(backRow);
          await show(body.trim(), rows);
          return Response.json({ ok: true });
        }


        if (action.startsWith("redeem:")) {
          try {
            const row = await redeem(profile.id, action.slice(7));
            await send(
              `🎉 <b>${esc(row.reward_name)}</b> unlocked!\n\nYour license key:\n<code>${esc(row.license_key)}</code>\n\nValid for ${row.duration_days} days. Paste it into the Lovable Unlimited Extension.`,
            );
            await show("🎁 <b>License Rewards</b>\n\nYour license key was sent above.", [backRow]);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "error";
            const human = msg.includes("insufficient_credits")
              ? "You don't have enough credits yet."
              : msg.includes("account_not_active")
                ? "Complete all tasks first, then try again."
                : msg.includes("inventory_empty")
                  ? "This license is out of stock right now. Please try again later."
                  : "Reward unavailable right now.";
            await show(`❌ ${human}`, [[{ text: "🎁 Rewards", callback_data: "rewards" }], backRow]);
          }
          return Response.json({ ok: true });
        }

        await send("Use the menu below.", mainMenu);
        return Response.json({ ok: true });
      },
    },
  },
});
