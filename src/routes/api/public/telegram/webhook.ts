import { createFileRoute } from "@tanstack/react-router";

type TgUser = { id: number; username?: string; first_name?: string; last_name?: string };
type Btn = { text: string; url?: string; callback_data?: string };
type Keyboard = Btn[][];

const LINE = "━━━━━━━━━━━━━━";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function bar(done: number, total: number) {
  const filled = total > 0 ? Math.max(0, Math.min(10, Math.round((done / total) * 10))) : 0;
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

/** Compact premium label for a task, so Telegram never compresses or cuts the button. */
function shortLabel(platform: string, name: string) {
  const p = (platform || "").toLowerCase();
  if (p.includes("youtube")) return "▶️ YouTube";
  if (p.includes("whatsapp")) return "💬 WhatsApp";
  if (p.includes("facebook")) return "📘 Facebook";
  const clean = name.replace(/^follow\s+/i, "").replace(/follow/gi, "").trim();
  const compact = clean.replace(/foxgen official/i, "FoxGEN Official").replace(/lovable unlimited.*/i, "Lovable Unlimited");
  const label = compact.length > 22 ? `${compact.slice(0, 21)}…` : compact;
  return /^[^\w\s]/.test(label) ? label : `✈️ ${label}`;
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
          logBotError,
          acquireLock,
          releaseLock,
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

        // 1. ALWAYS acknowledge the callback first so the button never spins.
        if (update.callback_query) {
          void tg("answerCallbackQuery", { callback_query_id: update.callback_query.id }).catch(() => undefined);
        }

        if (typeof update.update_id === "number") {
          const { error: updateError } = await db
            .from("telegram_processed_updates")
            .insert({ update_id: update.update_id });
          if (updateError?.code === "23505") return Response.json({ ok: true, duplicate: true });
          if (updateError) {
            await logBotError("webhook", updateError.message, update.callback_query?.from.id ?? null, "dedupe insert");
            return Response.json({ ok: false }, { status: 500 });
          }
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

        const send = (body: string, keyboard: Keyboard) =>
          tg("sendMessage", {
            chat_id: chatId,
            text: body,
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: { inline_keyboard: keyboard },
          });

        /**
         * Centralised page renderer: one message, one fresh keyboard, no duplicates.
         * Every navigation edits the current message and safely ignores "not modified".
         */
        const render = async (body: string, keyboard: Keyboard) => {
          const markup = { inline_keyboard: keyboard.map((row) => row.map((btn) => ({ ...btn }))) };
          if (editMessageId) {
            const res = await tg("editMessageText", {
              chat_id: chatId,
              message_id: editMessageId,
              text: body,
              parse_mode: "HTML",
              disable_web_page_preview: true,
              reply_markup: markup,
            });
            if (res.ok) return;
            if (res.description?.includes("message is not modified")) return;
            await logBotError("telegram_api", res.description ?? "editMessageText failed", from.id, "render");
          }
          const sent = await tg("sendMessage", {
            chat_id: chatId,
            text: body,
            parse_mode: "HTML",
            disable_web_page_preview: true,
            reply_markup: markup,
          });
          if (!sent.ok) await logBotError("telegram_api", sent.description ?? "sendMessage failed", from.id, "render");
        };

        const S = (key: string, fallback: string) => (settings[key] || fallback).trim();
        const siteUrl = S("site_url", "https://first-word-platform.lovable.app");
        const supportUrl = S("support_url", "https://wa.me/917699355860");
        const youtubeUrl = S("youtube_url", "https://youtube.com/@mirza-p7x6s?si=er4Vs-kPWskxY_JW");
        const whatsappUrl = S("whatsapp_url", "https://whatsapp.com/channel/0029VbDK6SHKLaHn5vxOQa0v");
        const facebookUrl = S("facebook_url", "https://www.facebook.com/share/1DYdDK9qCq/");
        const channel1Url = S("telegram_channel_1", "https://t.me/foxgenofficial");
        const channel1Name = S("telegram_channel_1_name", "FoxGEN Official");
        const channel2Url = S("telegram_channel_2", "https://t.me/lovableunlimitedfoxgen");
        const channel2Name = S("telegram_channel_2_name", "Lovable Unlimited");
        const extensionName = S("extension_name", "Lovable Unlimited Extension");
        const extensionVersion = S("extension_version", "16.73");
        const extensionDate = S("extension_release_date", "");
        const extensionDesc = S("extension_description", "Latest official FoxGEN PRO release for Lovable Unlimited.");
        const extensionUrl = S(
          "extension_download_url",
          "https://first-word-platform.lovable.app/__l5e/assets-v1/1f749969-6e26-4877-b944-e0875747752b/FoxGEN-Pro-Extension-16.73.zip",
        );
        const extensionFileUrl = S("extension_file_url", "");
        const extensionFileId = S("extension_telegram_file_id", "");
        const guideUrl = S("installation_guide_url", "");
        const tutorialUrl = S("tutorial_url", "");

        // ---------- keyboard builders (always a brand new array) ----------
        const backRow = (to = "menu"): Btn[] => [{ text: "⬅️ Back", callback_data: to }];

        const buildHomeKeyboard = (): Keyboard => [
          [{ text: "🚀 Start Earning", callback_data: "tasks" }],
          [
            { text: "📋 Tasks", callback_data: "tasks" },
            { text: "👥 Invite", callback_data: "invite" },
          ],
          [
            { text: "🎁 Rewards", callback_data: "rewards" },
            { text: "🏆 Ranking", callback_data: "board" },
          ],
          [
            { text: "👤 My Account", callback_data: "me" },
            { text: "📦 Extension", callback_data: "extension" },
          ],
          [{ text: "📢 Community", callback_data: "community" }],
          [{ text: "💬 Support", url: supportUrl }],
        ];

        const buildCommunityKeyboard = (): Keyboard => [
          [{ text: "▶️ YouTube", url: youtubeUrl }],
          [{ text: "💬 WhatsApp", url: whatsappUrl }],
          [{ text: "📘 Facebook", url: facebookUrl }],
          [{ text: `✈️ ${channel1Name}`, url: channel1Url }],
          [{ text: `✈️ ${channel2Name}`, url: channel2Url }],
          [{ text: "🌐 Official Website", url: S("official_website_url", "https://nextgen.lovableunlimitedc.workers.dev") }],
          [{ text: "💬 Support", url: supportUrl }],
          backRow(),
        ];


        const buildExtensionKeyboard = (): Keyboard => {
          const rows: Keyboard = [];
          if (extensionUrl.startsWith("http")) rows.push([{ text: "📥 Download Extension", url: extensionUrl }]);
          rows.push([{ text: "📦 Receive File in Telegram", callback_data: "extfile" }]);
          if (guideUrl.startsWith("http")) rows.push([{ text: "📖 Installation Guide", url: guideUrl }]);
          if (tutorialUrl.startsWith("http")) rows.push([{ text: "▶️ Video Tutorial", url: tutorialUrl }]);
          rows.push([{ text: "💬 Contact Support", url: supportUrl }]);
          rows.push(backRow());
          return rows;
        };

        const homeText =
          `🦊 <b>FOXGEN PRO</b>\n` +
          `<i>Lovable Unlimited Extension Rewards</i>\n` +
          `${LINE}\n` +
          `🎁 Earn free license rewards\n` +
          `👥 1 verified referral = 1 credit\n` +
          `${LINE}\n` +
          `🚀 Complete tasks and start earning!`;

        /** Premium home screen with live stats. */
        const homeBody = async (p: { id: string; credits_available: number; credits_earned: number }) => {
          const [refs, lic, ahead] = await Promise.all([
            db
              .from("referrals")
              .select("id", { count: "exact", head: true })
              .eq("referrer_id", p.id)
              .eq("status", "verified"),
            db.from("license_redemptions").select("id", { count: "exact", head: true }).eq("user_id", p.id),
            db
              .from("profiles")
              .select("id", { count: "exact", head: true })
              .gt("credits_earned", p.credits_earned),
          ]);
          return (
            `🦊 <b>FOXGEN PRO</b>\n` +
            `<i>Lovable Unlimited Extension Rewards</i>\n` +
            `${LINE}\n` +
            `💰 Credits: <b>${p.credits_available}</b>\n` +
            `👥 Verified Referrals: <b>${refs.count ?? 0}</b>\n` +
            `🔑 Licenses Claimed: <b>${lic.count ?? 0}</b>\n` +
            `🏆 Global Rank: <b>#${(ahead.count ?? 0) + 1}</b>\n` +
            `${LINE}\n` +
            `Complete tasks and invite friends to earn free rewards.`
          );
        };

        const buildWelcomeKeyboard = (): Keyboard => [
          [{ text: "🚀 Start Earning", callback_data: "tasks" }],
          [
            { text: "🎁 Rewards", callback_data: "rewards" },
            { text: "👥 Invite", callback_data: "invite" },
          ],
          [{ text: "📢 Official Community", callback_data: "community" }],
          [{ text: "📥 Extension Download", callback_data: "extension" }],
          [{ text: "💬 Support", url: supportUrl }],
        ];

        // ---------- /start ----------
        if (text.startsWith("/start")) {
          const payload = text.split(/\s+/)[1] ?? "";
          await ensureProfile(from, payload);
          await send(
            `🦊 <b>Welcome to FoxGEN PRO</b>\n${LINE}\n` +
              `Get FREE Lovable Unlimited Extension licenses through our community rewards program.\n\n` +
              `🎁 Complete tasks\n👥 Invite friends\n💰 Earn credits\n🔑 Redeem licenses\n${LINE}\n` +
              `<b>How it works</b>\n` +
              `1️⃣ Complete community tasks\n` +
              `2️⃣ Get your referral link\n` +
              `3️⃣ Invite real friends\n` +
              `4️⃣ 1 verified referral = 1 credit\n` +
              `5️⃣ Collect credits and unlock rewards`,
            buildWelcomeKeyboard(),
          );
          await tg("setMyCommands", {
            commands: [
              { command: "start", description: "🏠 Open FoxGEN PRO" },
              { command: "menu", description: "🏠 Main menu" },
              { command: "home", description: "🏠 Home screen" },
              { command: "tasks", description: "📋 My tasks" },
              { command: "invite", description: "👥 Invite friends" },
              { command: "rewards", description: "🎁 View rewards" },
              { command: "licenses", description: "🔑 My licenses" },
              { command: "profile", description: "👤 My credits & account" },
              { command: "leaderboard", description: "🏆 Leaderboard" },
              { command: "download", description: "📥 Download extension" },
              { command: "community", description: "📢 Official community" },
              { command: "support", description: "💬 Support" },
              { command: "rules", description: "📜 Program rules" },
            ],
          });
          return Response.json({ ok: true });
        }


        const profile = await profileByTelegramId(from.id);
        if (!profile) {
          await send("Please send /start first.", [[{ text: "🦊 Start", callback_data: "menu" }]]);
          return Response.json({ ok: true });
        }

        const COMMAND_ALIASES: Record<string, string> = {
          home: "menu",
          help: "menu",
          rules: "menu",
          profile: "me",
          account: "me",
          credits: "me",
          licenses: "me",
          leaderboard: "board",
          ranking: "board",
          support: "community",
          links: "community",
          task: "tasks",
          referral: "invite",
        };
        const rawAction = cb || text.replace(/^\//, "").split(/[\s@]/)[0] || "menu";
        const action = cb ? rawAction : (COMMAND_ALIASES[rawAction.toLowerCase()] ?? rawAction.toLowerCase());

        // ---------- double-click protection for slow actions ----------
        const guarded = ["verify", "extfile"].includes(action) || action.startsWith("redeem:") || action.startsWith("done:");
        const lockKey = `${profile.id}:${action}`;
        if (guarded && !(await acquireLock(lockKey))) return Response.json({ ok: true, locked: true });
        const unlock = async () => {
          if (guarded) await releaseLock(lockKey);
        };

        try {
          if (action === "menu" || action === "help" || action === "home") {
            await render(await homeBody(profile), buildHomeKeyboard());
            return Response.json({ ok: true });
          }

          if (action === "community") {
            await render(
              `🦊 <b>FOXGEN PRO COMMUNITY</b>\n${LINE}\n` +
                `Stay connected with official updates, tutorials and offers.`,
              buildCommunityKeyboard(),
            );
            return Response.json({ ok: true });
          }


          // ---------- tasks ----------
          const activatedText =
            `🎉 <b>ACCOUNT ACTIVATED</b>\n${LINE}\n` +
            `All tasks completed.\n\n👥 Invite friends\n💰 Earn credits\n🎁 Redeem licenses\n\n` +
            `1 verified referral = 1 credit.`;

          const buildActivatedKeyboard = (): Keyboard => [
            [{ text: "👥 Invite Friends", callback_data: "invite" }],
            [{ text: "🎁 Rewards", callback_data: "rewards" }],
            [{ text: "📦 Extension", callback_data: "extension" }],
            [{ text: "🏠 Home", callback_data: "menu" }],
          ];

          const renderTasks = async () => {
            const tasks = await activeTasks();
            const done = await completionsFor(profile.id);
            const doneIds = new Set(done.filter((d) => d.completed).map((d) => d.task_id));
            const completed = tasks.filter((t) => doneIds.has(t.id)).length;

            let body =
              `📋 <b>TASK CENTER</b>\n${LINE}\n` +
              `Progress: ${bar(completed, tasks.length)}\n<b>${completed} / ${tasks.length} Completed</b>\n${LINE}\n`;
            const rows: Keyboard = [];
            for (const t of tasks) {
              const label = shortLabel(t.platform, t.name);
              const isTg = t.verification_type === "telegram_auto_verification";
              const ok = doneIds.has(t.id);
              body += `${esc(label)}\nStatus: <b>${ok ? "Completed ✅" : "Pending ❌"}</b>\n\n`;
              if (t.url) rows.push([{ text: `${isTg ? "FOLLOW" : "OPEN"} — ${label}`.slice(0, 40), url: t.url }]);
              if (!isTg && !ok)
                rows.push([{ text: `✅ I Completed This — ${label}`.slice(0, 40), callback_data: `done:${t.id}` }]);
            }

            body += `${LINE}\nComplete all tasks to activate referrals.`;
            rows.push([{ text: "🔄 Verify Telegram Tasks", callback_data: "verify" }]);
            rows.push(backRow());

            await render(body, rows);
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
            if (state.allDone) await render(activatedText, buildActivatedKeyboard());
            else await renderTasks();
            return Response.json({ ok: true });
          }

          if (action === "verify") {
            let state: Awaited<ReturnType<typeof refreshVerification>> | null = null;
            try {
              state = await refreshVerification(profile);
            } catch (err) {
              await logBotError("verification", err instanceof Error ? err.message : "verify failed", from.id);
            }
            if (!state) {
              await render(
                `⚠️ <b>Verification unavailable</b>\n${LINE}\nPlease try again shortly.`,
                [[{ text: "🔄 Verify Again", callback_data: "verify" }], backRow("tasks")],
              );
              return Response.json({ ok: true });
            }
            if (state.allDone) {
              await render(activatedText, buildActivatedKeyboard());
              return Response.json({ ok: true });
            }

            const pending = state.telegram.filter((c) => !c.ok);
            for (const c of pending) {
              if (c.error && !c.error.includes("has not joined"))
                await logBotError("channel_verification", `${c.name}: ${c.error}`, from.id);
            }
            const apiIssue = pending.some((c) => c.error && !c.error.includes("has not joined"));

            const rows: Keyboard = [];
            let body: string;
            if (apiIssue) {
              body = `⚠️ <b>Verification temporarily unavailable</b>\n${LINE}\nPlease try again shortly.`;
            } else {
              body = `❌ <b>Verification Incomplete</b>\n${LINE}\nPlease complete:\n`;
              for (const name of state.missing) body += `• ${esc(name.replace(/^follow\s+/i, ""))}\n`;
              body += `${LINE}\nAfter following, tap Verify Again.`;
            }
            for (const c of pending) if (c.url) rows.push([{ text: shortLabel("", c.name), url: c.url }]);
            rows.push([{ text: "🔄 Verify Again", callback_data: "verify" }]);
            rows.push(backRow("tasks"));
            await render(body, rows);
            return Response.json({ ok: true });
          }

          // ---------- extension ----------
          if (action === "extension" || action === "download") {
            const fresh = (await profileByTelegramId(from.id)) ?? profile;
            if (fresh.status !== "active") {
              await render(
                `🔒 <b>Locked</b>\n${LINE}\nComplete all tasks to unlock the official download.`,
                [[{ text: "📋 Tasks", callback_data: "tasks" }], backRow()],
              );
              return Response.json({ ok: true });
            }
            await render(
              `🦊 <b>FOXGEN PRO EXTENSION</b>\n<i>${esc(extensionName)}</i>\n${LINE}\n` +
                `Get the latest version of FoxGEN PRO.\n\n` +
                `📦 Version: <b>${esc(extensionVersion)}</b>\n` +
                (extensionDate ? `📅 Released: ${esc(extensionDate)}\n` : "") +
                `📝 ${esc(extensionDesc)}`,
              buildExtensionKeyboard(),
            );
            return Response.json({ ok: true });
          }

          if (action === "extfile") {
            const fresh = (await profileByTelegramId(from.id)) ?? profile;
            if (fresh.status !== "active") {
              await render(`🔒 <b>Locked</b>\n${LINE}\nComplete all tasks first.`, [
                [{ text: "📋 Tasks", callback_data: "tasks" }],
                backRow(),
              ]);
              return Response.json({ ok: true });
            }
            const document = extensionFileId || extensionFileUrl;
            if (!document) {
              await render(
                `⚠️ <b>Extension file delivery is currently unavailable.</b>\n${LINE}\nPlease use the official download link.`,
                buildExtensionKeyboard(),
              );
              return Response.json({ ok: true });
            }
            const sent = await tg("sendDocument", {
              chat_id: chatId,
              document,
              parse_mode: "HTML",
              caption: `🦊 <b>FoxGEN PRO Extension</b>\n📦 Version ${esc(extensionVersion)}`,
            });
            if (!sent.ok) {
              await logBotError("telegram_api", sent.description ?? "sendDocument failed", from.id, "extfile");
              await render(
                `⚠️ <b>Extension file delivery is currently unavailable.</b>\n${LINE}\nPlease use the official download link.`,
                buildExtensionKeyboard(),
              );
              return Response.json({ ok: true });
            }
            await render(
              `📦 <b>File sent</b>\n${LINE}\nThe extension file was delivered above.`,
              buildExtensionKeyboard(),
            );
            return Response.json({ ok: true });
          }

          // ---------- shared helpers ----------
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
              db.from("license_redemptions").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
              db.from("profiles").select("id, credits_earned").order("credits_earned", { ascending: false }).limit(500),
            ]);
            const rank = (ranked.data ?? []).findIndex((p) => p.id === profile.id) + 1;
            await render(
              `👤 <b>MY ACCOUNT</b>\n${LINE}\n` +
                `💰 Credits: <b>${fresh.credits_available}</b>\n` +
                `👥 Referrals: <b>${refs}</b>\n` +
                `🏆 Global Rank: <b>${rank > 0 ? `#${rank}` : "—"}</b>\n` +
                `🔑 Licenses: <b>${licenses.count ?? 0}</b>\n` +
                `${LINE}`,
              [
                [{ text: "🔑 My Licenses", url: `${siteUrl}/hub?t=${profile.web_token}` }],
                [{ text: "👥 Invite Friends", callback_data: "invite" }],
                [{ text: "📦 Extension", callback_data: "extension" }],
                backRow(),
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
            let body = `🏆 <b>LEADERBOARD</b>\n${LINE}\n`;
            for (let i = 0; i < Math.min(10, list.length); i++) {
              const p = list[i];
              const label = p.telegram_username ? `@${p.telegram_username}` : p.first_name || "FoxGEN Member";
              body += `${medals[i] ?? `#${i + 1}`} ${esc(label)} — 💰 ${p.credits_earned}\n`;
            }
            const myRank = list.findIndex((p) => p.id === profile.id) + 1;
            body += `${LINE}\nYour rank: <b>${myRank > 0 ? `#${myRank}` : "—"}</b>`;
            await render(body, [[{ text: "👥 Invite Friends", callback_data: "invite" }], backRow()]);
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
            const message = `🦊 Join FoxGEN PRO and earn a FREE Lovable Unlimited license!\n\n${inviteLink}`;
            await render(
              `👥 <b>INVITE & EARN</b>\n${LINE}\n` +
                `👤 Valid Referrals: <b>${refs}</b>\n` +
                `💰 Available Credits: <b>${credits}</b>\n` +
                (nextReward ? `🎯 Next Reward: <b>${esc(nextReward.name)}</b>\n\n${bar(credits, target)}\n${credits} / ${target} Credits\n` : `🎉 Ready to redeem a reward!\n`) +
                `${LINE}\nYour referral link:\n<code>${esc(inviteLink)}</code>`,
              [
                [
                  {
                    text: "📤 Share on Telegram",
                    url: `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent("Join FoxGEN PRO and earn a free license!")}`,
                  },
                ],
                [{ text: "💬 Share on WhatsApp", url: `https://wa.me/?text=${encodeURIComponent(message)}` }],
                [{ text: "🎁 Rewards", callback_data: "rewards" }],
                backRow(),
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
            const dots = ["🟢", "🔵", "🟣", "🟡"];
            let body = `🎁 <b>LICENSE REWARDS</b>\n${LINE}\n`;
            const rows: Keyboard = [];
            (rewards ?? []).forEach((r, i) => {
              const dot = dots[i] ?? "🎁";
              body += `${dot} ${esc(r.name)}\n💰 ${r.credit_cost} Credits\n\n`;
              rows.push([{ text: `${dot} ${r.duration_days} Days`, callback_data: `redeem:${r.id}` }]);
            });
            body += `${LINE}\nYour Credits: <b>${fresh?.credits_available ?? 0}</b>`;
            rows.push(backRow());
            await render(body, rows);
            return Response.json({ ok: true });
          }

          if (action.startsWith("redeem:")) {
            try {
              const row = await redeem(profile.id, action.slice(7));
              await send(
                `🎉 <b>License Redeemed</b>\n${LINE}\n🔑 <code>${esc(row.license_key)}</code>\n\n` +
                  `📅 ${row.duration_days} Days\n💰 ${row.credits_used} Credits used`,
                [[{ text: "📦 Extension", callback_data: "extension" }], [{ text: "⬅️ Back", callback_data: "rewards" }]],
              );
              await render(`🎁 <b>LICENSE REWARDS</b>\n${LINE}\nYour license key was sent above.`, [
                [{ text: "🎁 Rewards", callback_data: "rewards" }],
                backRow(),
              ]);
            } catch (err) {
              const msg = err instanceof Error ? err.message : "error";
              await logBotError("redemption", msg, from.id, action);
              const human = msg.includes("insufficient_credits")
                ? "You don't have enough credits yet."
                : msg.includes("account_not_active")
                  ? "Complete all tasks first, then try again."
                  : msg.includes("inventory_empty")
                    ? "This license is out of stock right now."
                    : "Reward unavailable right now.";
              await render(`❌ ${human}`, [[{ text: "🎁 Rewards", callback_data: "rewards" }], backRow()]);
            }
            return Response.json({ ok: true });
          }

          await render(homeText, buildHomeKeyboard());
          return Response.json({ ok: true });
        } catch (err) {
          await logBotError("callback", err instanceof Error ? err.message : "unhandled error", from.id, action);
          await render(`⚠️ Something went wrong. Please try again shortly.`, [[{ text: "🏠 Home", callback_data: "menu" }]]);
          return Response.json({ ok: true });
        } finally {
          await unlock();
        }
      },
    },
  },
});
