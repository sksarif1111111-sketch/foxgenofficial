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

/** Compact premium label for a task button, so Telegram never cuts it. */
function shortLabel(platform: string, name: string) {
  const clean = name
    .replace(/^follow\s+/i, "")
    .replace(/^subscribe to\s+/i, "")
    .replace(/^join\s+/i, "")
    .trim();
  const label = clean.length > 26 ? `${clean.slice(0, 25)}…` : clean;
  if (/^[^\w\s]/.test(label)) return label;
  const p = (platform || "").toLowerCase();
  const icon = p.includes("youtube")
    ? "▶️"
    : p.includes("whatsapp")
      ? "💬"
      : p.includes("facebook")
        ? "📘"
        : p.includes("telegram")
          ? "✈️"
          : "🔗";
  return `${icon} ${label}`;
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
          message?: {
            chat: { id: number };
            from?: TgUser;
            text?: string;
            successful_payment?: {
              currency: string;
              total_amount: number;
              invoice_payload: string;
              telegram_payment_charge_id: string;
            };
          };
          pre_checkout_query?: { id: string; from: TgUser; total_amount: number; invoice_payload: string };
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

        // ---------- Telegram Stars: pre-checkout validation ----------
        if (update.pre_checkout_query) {
          const q = update.pre_checkout_query;
          const { data: order } = await db
            .from("shop_orders")
            .select("id, status, stars_total")
            .eq("id", q.invoice_payload)
            .maybeSingle();
          const valid =
            !!order && order.status === "awaiting_payment" && Number(order.stars_total) === Number(q.total_amount);
          await tg("answerPreCheckoutQuery", {
            pre_checkout_query_id: q.id,
            ok: valid,
            ...(valid ? {} : { error_message: "This order is no longer available. Please open the Shop and start again." }),
          });
          return Response.json({ ok: true });
        }

        // ---------- Telegram Stars: confirmed payment ----------
        if (update.message?.successful_payment) {
          const sp = update.message.successful_payment;
          const now = new Date().toISOString();
          const { data: updated } = await db
            .from("shop_orders")
            .update({
              status: "awaiting_email",
              stock_consumed: true,
              telegram_charge_id: sp.telegram_payment_charge_id,
              submitted_at: now,
              confirmed_at: now,
              updated_at: now,
            })
            .eq("id", sp.invoice_payload)
            .eq("status", "awaiting_payment")
            .select("order_number")
            .maybeSingle();
          await db.from("shop_order_events").insert({
            order_id: sp.invoice_payload,
            event: "stars_payment_received",
            actor: "telegram",
            details: sp.telegram_payment_charge_id,
          });
          await tg("sendMessage", {
            chat_id: update.message.chat.id,
            text:
              `⭐ Payment received for order <b>${updated?.order_number ?? ""}</b>.\n\n` +
              `Please enter the email address where you want to receive your activation link or product access.`,
            parse_mode: "HTML",
          });
          return Response.json({ ok: true });
        }

        const from = update.message?.from ?? update.callback_query?.from;
        const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
        if (!from || !chatId) return Response.json({ ok: true });

        const text = update.message?.text?.trim() ?? "";
        const cb = update.callback_query?.data ?? "";
        const editMessageId = update.callback_query?.message?.message_id;
        const settings = await getSettings();

        const S = (key: string, fallback: string) => (settings[key] || fallback).trim();
        /** Every icon is admin-configurable through Admin → Branding (emoji_* settings). */
        const E = (key: string, fallback: string) => (settings[`emoji_${key}`] || fallback).trim();

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

        const storeName = S("store_name", "FoxGEN Store");
        const storeTagline = S("store_tagline", "Premium digital products at affordable prices.");
        const siteUrl = S("site_url", "https://foxgenofficial.lovable.app");
        const supportUrl = S("support_url", "https://t.me/FoXGENSPORT");
        const youtubeUrl = S("youtube_url", "https://youtube.com/@mirza-p7x6s");
        const whatsappUrl = S("whatsapp_url", "https://whatsapp.com/channel/0029VbDK6SHKLaHn5vxOQa0v");
        const whatsappOfficialUrl = S("whatsapp_official_url", "https://whatsapp.com/channel/0029VbDdgc9HVvTgM4YWFv0Q");
        const communityUrl = S("community_url", "https://chat.whatsapp.com/KvOy0Fw8IWL0NGwc5zVTxf");
        const facebookUrl = S("facebook_url", "https://www.facebook.com/share/18PfyFqPJ3/");
        const channel1Url = S("telegram_channel_1", "https://t.me/foxgenofficial");
        const channel1Name = S("telegram_channel_1_name", "FoxGEN Official");
        const channel2Url = S("telegram_channel_2", "https://t.me/lovableunlimitedfoxgen");
        const channel2Name = S("telegram_channel_2_name", "Lovable Unlimited FoxGEN");
        const officialWebsite = S("official_website_url", S("pricing_url", "https://nextgen.lovableunlimitedc.workers.dev"));
        const pricingUrl = S("pricing_url", officialWebsite);
        const pricingMessage = S("pricing_message", "").replace(/\\n/g, "\n");
        const extensionName = S("extension_name", "Lovable Unlimited Extension");
        const extensionVersion = S("extension_version", "16.73");
        const extensionDate = S("extension_release_date", "");
        const extensionDesc = S("extension_description", "Latest official FoxGEN release for Lovable Unlimited.");
        const extensionUrl = S("extension_download_url", "");
        const extensionFileUrl = S("extension_file_url", "");
        const extensionFileId = S("extension_telegram_file_id", "");
        const guideUrl = S("installation_guide_url", "");
        const tutorialUrl = S("tutorial_url", "");

        const who = from.username ? `@${from.username}` : from.first_name || "there";

        // ---------- keyboard builders (always a brand new array) ----------
        const backRow = (to = "menu"): Btn[] => [{ text: `${E("back", "⬅️")} Back`, callback_data: to }];

        const buildHomeKeyboard = (): Keyboard => [
          [
            { text: `${E("shop", "🛍️")} Shop`, callback_data: "shop" },
            { text: `${E("rewards", "🎁")} Free Rewards`, callback_data: "rewards" },
          ],
          [
            { text: `${E("profile", "👤")} My Profile`, callback_data: "me" },
            { text: `${E("invite", "👥")} Invite & Earn`, callback_data: "invite" },
          ],
          [
            { text: `${E("tasks", "📋")} Tasks`, callback_data: "tasks" },
            { text: `${E("extension", "📦")} Extension`, callback_data: "extension" },
          ],
          [
            { text: `${E("community", "📢")} Community`, callback_data: "community" },
            { text: `${E("help", "ℹ️")} Help`, callback_data: "help" },
          ],
          [{ text: `${E("support", "💬")} Support`, callback_data: "support" }],
        ];

        const buildCommunityKeyboard = (): Keyboard => [
          [{ text: "▶️ YouTube", url: youtubeUrl }],
          [{ text: "💬 Lovable Unlimited WhatsApp", url: whatsappUrl }],
          [{ text: "💬 FoxGEN Official WhatsApp", url: whatsappOfficialUrl }],
          [{ text: "👥 FoxGEN Community Group", url: communityUrl }],
          [{ text: "📘 Facebook", url: facebookUrl }],
          [{ text: `✈️ ${channel1Name}`, url: channel1Url }],
          [{ text: `✈️ ${channel2Name}`, url: channel2Url }],
          [{ text: "🌐 Official Website", url: officialWebsite }],
          [{ text: `${E("support", "💬")} Support`, url: supportUrl }],
          backRow(),
        ];

        const buildExtensionKeyboard = (): Keyboard => {
          const rows: Keyboard = [];
          if (extensionUrl.startsWith("http")) rows.push([{ text: "📥 Download Extension", url: extensionUrl }]);
          if (extensionFileId || extensionFileUrl.startsWith("http")) {
            rows.push([{ text: "📦 Receive File in Telegram", callback_data: "extfile" }]);
          }
          if (guideUrl.startsWith("http")) rows.push([{ text: "📖 Installation Guide", url: guideUrl }]);
          if (tutorialUrl.startsWith("http")) rows.push([{ text: "▶️ Video Tutorial", url: tutorialUrl }]);
          rows.push([{ text: "📘 How to Use", callback_data: "guide:1" }]);
          rows.push([{ text: `${E("license", "🔑")} My Licenses`, callback_data: "mylic" }]);
          rows.push([{ text: `${E("support", "💬")} Contact Support`, url: supportUrl }]);
          rows.push(backRow());
          return rows;
        };

        const welcomeText =
          `${E("brand", "🦊")} <b>Welcome to ${esc(storeName)}</b>\n` +
          `${LINE}\n` +
          `Hey ${esc(who)} 👋\n\n` +
          `${esc(storeTagline)}\n\n` +
          `${E("rewards", "🎁")} Free Lovable Unlimited rewards\n` +
          `${E("shop", "🛍️")} Premium products\n` +
          `${E("credits", "💰")} Earn credits\n` +
          `${E("invite", "👥")} Invite friends\n` +
          `${E("license", "🔑")} Redeem rewards\n` +
          `${LINE}\n` +
          `Choose an option below.`;

        /** Premium home screen with live stats. */
        const homeBody = async (p: { id: string; credits_available: number; credits_earned: number }) => {
          const [refs, lic, ahead] = await Promise.all([
            db
              .from("referrals")
              .select("id", { count: "exact", head: true })
              .eq("referrer_id", p.id)
              .eq("status", "verified"),
            db.from("license_redemptions").select("id", { count: "exact", head: true }).eq("user_id", p.id),
            db.from("profiles").select("id", { count: "exact", head: true }).gt("credits_earned", p.credits_earned),
          ]);
          return (
            `${E("brand", "🦊")} <b>${esc(storeName.toUpperCase())}</b>\n` +
            `<i>${esc(storeTagline)}</i>\n` +
            `${LINE}\n` +
            `${E("credits", "💰")} Credits: <b>${p.credits_available}</b>\n` +
            `${E("invite", "👥")} Verified Referrals: <b>${refs.count ?? 0}</b>\n` +
            `${E("license", "🔑")} Licenses Claimed: <b>${lic.count ?? 0}</b>\n` +
            `${E("rank", "🏆")} Global Rank: <b>#${(ahead.count ?? 0) + 1}</b>\n` +
            `${LINE}\n` +
            `Choose an option below.`
          );
        };

        // ---------- /start ----------
        if (text.startsWith("/start")) {
          const payload = text.split(/\s+/)[1] ?? "";
          // Fast first response: show the store immediately, then do the slower work.
          await send(welcomeText, buildHomeKeyboard());
          await ensureProfile(from, payload);
          void tg("setMyCommands", {
            commands: [
              { command: "start", description: `${E("brand", "🦊")} Open ${storeName}` },
              { command: "menu", description: "🏠 Main menu" },
              { command: "shop", description: `${E("shop", "🛍️")} Shop products` },
              { command: "rewards", description: `${E("rewards", "🎁")} Free rewards` },
              { command: "profile", description: `${E("profile", "👤")} My profile` },
              { command: "invite", description: `${E("invite", "👥")} Invite & earn` },
              { command: "tasks", description: `${E("tasks", "📋")} My tasks` },
              { command: "support", description: `${E("support", "💬")} Support` },
              { command: "help", description: `${E("help", "ℹ️")} Help & rules` },
            ],
          }).catch(() => undefined);
          return Response.json({ ok: true });
        }

        const profile = await profileByTelegramId(from.id);
        if (!profile) {
          await send("Please send /start first.", [[{ text: `${E("brand", "🦊")} Start`, callback_data: "menu" }]]);
          return Response.json({ ok: true });
        }

        // ---------- delivery email capture for a paid Telegram order ----------
        if (text && !text.startsWith("/") && text.includes("@")) {
          const { data: pending } = await db
            .from("shop_orders")
            .select("id, order_number")
            .eq("profile_id", profile.id)
            .eq("channel", "telegram")
            .eq("status", "awaiting_email")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (pending) {
            const { setOrderEmails, reviewMinutes } = await import("@/lib/shop.server");
            try {
              const result = await setOrderEmails(pending.id, text);
              await db
                .from("shop_orders")
                .update({ status: "awaiting_fulfillment", updated_at: new Date().toISOString() })
                .eq("id", pending.id)
                .eq("status", "under_review");
              const minutes = await reviewMinutes();
              await send(
                `Please wait. My owner is checking your payment.\n` +
                  `Your delivery email: ${esc(result.emails.join(", "))}\n` +
                  `Estimated review time: about ${minutes} minutes.\n` +
                  `Order ID: ${esc(result.order_number)}\n` +
                  `You will receive an update when your order is confirmed.`,
                [[{ text: "🧾 My Orders", callback_data: "myorders" }], [{ text: `${E("back", "⬅️")} Home`, callback_data: "menu" }]],
              );
            } catch (error) {
              await send(
                `${E("error", "⚠️")} ${esc(error instanceof Error ? error.message : "That email could not be saved.")}\nPlease send the email address again.`,
                [],
              );
            }
            return Response.json({ ok: true });
          }
        }

        const COMMAND_ALIASES: Record<string, string> = {
          home: "menu",
          start: "menu",
          rules: "help",
          profile: "me",
          account: "me",
          credits: "me",
          licenses: "mylic",
          license: "mylic",
          guide: "guide:1",
          howto: "guide:1",
          leaderboard: "board",
          ranking: "board",
          links: "community",
          task: "tasks",
          referral: "invite",
          products: "shop",
          orders: "myorders",
          myorders: "myorders",
          store: "shop",
          download: "extension",
        };
        const rawAction = cb || text.replace(/^\//, "").split(/[\s@]/)[0] || "menu";
        const action = cb ? rawAction : (COMMAND_ALIASES[rawAction.toLowerCase()] ?? rawAction.toLowerCase());

        // ---------- double-click protection for slow actions ----------
        const guarded = ["verify", "extfile"].includes(action) || action.startsWith("redeem:") || action.startsWith("done:");
        const redemptionAction = action.startsWith("redeem:");
        const lockKey = `${profile.id}:${action}`;
        if (guarded && !(await acquireLock(lockKey))) return Response.json({ ok: true, locked: true });
        const unlock = async () => {
          // Keep successful/failed redemption locks until their short TTL expires.
          // This prevents a second Telegram callback from spending credits twice.
          if (guarded && !redemptionAction) await releaseLock(lockKey);
        };

        try {
          if (action === "menu") {
            await render(await homeBody(profile), buildHomeKeyboard());
            return Response.json({ ok: true });
          }

          if (action === "help") {
            await render(
              `${E("help", "ℹ️")} <b>HELP &amp; RULES</b>\n${LINE}\n` +
                `1️⃣ Complete all community tasks\n` +
                `2️⃣ Share your personal invite link\n` +
                `3️⃣ 1 verified referral = 1 credit\n` +
                `4️⃣ Redeem credits for free licenses\n\n` +
                `⚠️ Fake or duplicate accounts are rejected and never earn credits.\n` +
                `${LINE}\nNeed a hand? Tap Support.`,
              [
                [{ text: `${E("tasks", "📋")} Tasks`, callback_data: "tasks" }],
                [{ text: `${E("support", "💬")} Support`, url: supportUrl }],
                backRow(),
              ],
            );
            return Response.json({ ok: true });
          }

          if (action === "support") {
            await render(
              `${E("support", "💬")} <b>SUPPORT</b>\n${LINE}\n` +
                `Our team replies fast on Telegram and WhatsApp.\n\n` +
                `🕐 24/7 customer support\n⚡ Fast license activation\n📖 Installation help included`,
              [
                [{ text: "💬 Telegram Support", url: supportUrl }],
                [{ text: "📞 WhatsApp Support", url: S("whatsapp_support_url", "https://wa.me/917699355860") }],
                [{ text: "🌐 Official Website", url: officialWebsite }],
                backRow(),
              ],
            );
            return Response.json({ ok: true });
          }

          if (action === "community") {
            await render(
              `${E("community", "📢")} <b>${esc(storeName.toUpperCase())} COMMUNITY</b>\n${LINE}\n` +
                `Stay connected with official updates, tutorials and offers.`,
              buildCommunityKeyboard(),
            );
            return Response.json({ ok: true });
          }

          // ---------- shop (database-driven, Telegram Stars channel) ----------
          if (action === "shop" || action.startsWith("shop:")) {
            const { shopProductRows } = await import("@/lib/shop.server");
            const page = Math.max(1, Number(action.split(":")[1] ?? 1) || 1);
            const perPage = 5;
            const all = await shopProductRows("telegram");
            const totalPages = Math.max(1, Math.ceil(all.length / perPage));
            const current = Math.min(page, totalPages);
            const slice = all.slice((current - 1) * perPage, current * perPage);
            const rows: Keyboard = [];
            let body =
              `${E("brand", "🦊")} <b>${esc(storeName.toUpperCase())}</b>\n` +
              `Choose a product to view its details.\n` +
              `📄 Page ${current} of ${totalPages}\n${LINE}\n`;
            if (slice.length === 0) {
              body += `No products are published yet.\n`;
            }
            for (const p of slice) {
              body += `${p.emoji ?? "💎"} <b>${esc(p.name)}</b> — ${esc(p.price_label)} · ${esc(p.stock_label)}\n`;
              rows.push([{ text: `${p.emoji ?? "💎"} ${p.name.slice(0, 30)}`, callback_data: `prod:${p.id}` }]);
            }
            const nav: Btn[] = [];
            if (current > 1) nav.push({ text: "◀️ Previous", callback_data: `shop:${current - 1}` });
            if (current < totalPages) nav.push({ text: "Next ▶️", callback_data: `shop:${current + 1}` });
            if (nav.length) rows.push(nav);
            rows.push([
              { text: "🔄 Refresh", callback_data: `shop:${current}` },
              { text: "🧾 My Orders", callback_data: "myorders" },
            ]);
            rows.push([{ text: `${E("support", "💬")} Support`, url: supportUrl }]);
            rows.push(backRow());
            await render(body, rows);
            return Response.json({ ok: true });
          }

          if (action.startsWith("prod:")) {
            const { shopProductById, maxUnits } = await import("@/lib/shop.server");
            const product = await shopProductById(action.slice(5), "telegram");
            if (!product) {
              await render(`${E("error", "⚠️")} This product is no longer available.`, [backRow("shop")]);
              return Response.json({ ok: true });
            }
            let body =
              `${product.emoji ?? "💎"} <b>${esc(product.name)}</b>\n${LINE}\n` +
              (product.description ? `${esc(product.description)}\n\n` : "");
            for (const feature of product.features) body += `✅ ${esc(feature)}\n`;
            if (product.duration_label) body += `\n⏳ Duration: <b>${esc(product.duration_label)}</b>\n`;
            if (product.credits_per_interval !== null) {
              body += `💠 Includes ${product.credits_per_interval} credits every ${esc(product.renewal_interval ?? "month")}.\n`;
            }
            body += `\n💰 Price: <b>${esc(product.price_label)}</b>\n📦 ${esc(product.stock_label)}\n`;
            body += `📧 Access details are emailed to you after your payment is confirmed.\n`;
            if (product.terms) body += `\n<i>${esc(product.terms)}</i>\n`;
            const rows: Keyboard = [];
            if (product.purchasable && maxUnits(product) > 0) {
              rows.push([{ text: "🛒 Buy Now", callback_data: `qty:${product.id}` }]);
            } else if (product.price_stars === null) {
              body += `\n<i>Telegram purchase is not enabled for this product yet. Details only.</i>\n`;
            }
            rows.push([{ text: `${E("support", "💬")} Support`, url: supportUrl }]);
            rows.push(backRow("shop"));
            await render(body, rows);
            return Response.json({ ok: true });
          }

          if (action.startsWith("qty:")) {
            const { shopProductById, maxUnits } = await import("@/lib/shop.server");
            const product = await shopProductById(action.slice(4), "telegram");
            if (!product || !product.purchasable) {
              await render(`${E("error", "⚠️")} This product cannot be purchased right now.`, [backRow("shop")]);
              return Response.json({ ok: true });
            }
            const limit = maxUnits(product);
            const rows: Keyboard = [];
            const choices: Btn[] = [];
            for (let n = 1; n <= Math.min(4, limit); n += 1) {
              choices.push({ text: `${n}x`, callback_data: `buy:${product.id}:${n}` });
            }
            rows.push(choices);
            rows.push([{ text: `${E("back", "⬅️")} Back`, callback_data: `prod:${product.id}` }]);
            await render(
              `🛒 <b>${esc(product.name)}</b>\n${LINE}\nHow many units would you like?\nMaximum for this product: <b>${limit}</b>\nUnit price: <b>${esc(product.price_label)}</b>`,
              rows,
            );
            return Response.json({ ok: true });
          }

          if (action.startsWith("buy:")) {
            const [, productId, qtyRaw] = action.split(":");
            const quantity = Math.max(1, Number(qtyRaw) || 1);
            const { createOrder, shopProductById } = await import("@/lib/shop.server");
            const product = await shopProductById(productId ?? "", "telegram");
            if (!product || !product.price_stars) {
              await render(`${E("error", "⚠️")} Telegram purchase is not configured for this product.`, [backRow("shop")]);
              return Response.json({ ok: true });
            }
            try {
              const order = await createOrder({
                channel: "telegram",
                profileId: profile.id,
                telegramUserId: from.id,
                customerName: [from.first_name, from.last_name].filter(Boolean).join(" ") || null,
                productId: product.id,
                quantity,
              });
              await tg("sendInvoice", {
                chat_id: chatId,
                title: product.name.slice(0, 32),
                description: (product.short_description ?? product.name).slice(0, 255),
                payload: order.id,
                currency: "XTR",
                prices: [{ label: `${product.name} x${quantity}`.slice(0, 32), amount: product.price_stars * quantity }],
              });
              await render(
                `🧾 Order <b>${esc(String(order.order_number))}</b> created.\n${LINE}\n${esc(product.name)} x${quantity}\nTotal: <b>${product.price_stars * quantity} ⭐</b>\n\nComplete the Telegram Stars invoice sent below.`,
                [[{ text: "🧾 My Orders", callback_data: "myorders" }], backRow("shop")],
              );
            } catch (error) {
              await render(
                `${E("error", "⚠️")} ${esc(error instanceof Error ? error.message : "Could not create this order.")}`,
                [backRow("shop")],
              );
            }
            return Response.json({ ok: true });
          }

          if (action === "myorders") {
            const { data: orders } = await db
              .from("shop_orders")
              .select("order_number, status, currency, total, stars_total, delivery_emails, created_at")
              .eq("profile_id", profile.id)
              .order("created_at", { ascending: false })
              .limit(10);
            let body = `🧾 <b>MY ORDERS</b>\n${LINE}\n`;
            if (!orders || orders.length === 0) body += "You have no orders yet.\n";
            for (const o of orders ?? []) {
              const amount = o.currency === "XTR" ? `${o.stars_total ?? 0} ⭐` : `${Number(o.total ?? 0).toFixed(2)} ${o.currency}`;
              body += `• <b>${esc(o.order_number)}</b> — ${esc(amount)}\n  Status: ${esc(String(o.status).replace(/_/g, " "))}\n`;
            }
            await render(body, [[{ text: `${E("shop", "🛍️")} Shop`, callback_data: "shop" }], backRow()]);
            return Response.json({ ok: true });
          }

          // ---------- tasks ----------
          const activatedText =
            `${E("success", "🎉")} <b>ACCOUNT ACTIVATED</b>\n${LINE}\n` +
            `All tasks completed.\n\n${E("invite", "👥")} Invite friends\n${E("credits", "💰")} Earn credits\n${E("rewards", "🎁")} Redeem licenses\n\n` +
            `1 verified referral = 1 credit.`;

          const buildActivatedKeyboard = (): Keyboard => [
            [{ text: `${E("invite", "👥")} Invite Friends`, callback_data: "invite" }],
            [{ text: `${E("rewards", "🎁")} Free Rewards`, callback_data: "rewards" }],
            [{ text: `${E("extension", "📦")} Extension`, callback_data: "extension" }],
            [{ text: "🏠 Home", callback_data: "menu" }],
          ];

          const renderTasks = async () => {
            const tasks = await activeTasks();
            const done = await completionsFor(profile.id);
            const doneIds = new Set(done.filter((d) => d.completed).map((d) => d.task_id));
            const completed = tasks.filter((t) => doneIds.has(t.id)).length;

            let body =
              `${E("tasks", "📋")} <b>TASK CENTER</b>\n${LINE}\n` +
              `Progress: ${bar(completed, tasks.length)}\n<b>${completed} / ${tasks.length} Completed</b>\n${LINE}\n`;
            const rows: Keyboard = [];
            for (const t of tasks) {
              const label = shortLabel(t.platform, t.name);
              const isTg = t.verification_type === "telegram_auto_verification";
              const ok = doneIds.has(t.id);
              body += `${esc(label)} — <b>${ok ? "Completed ✅" : "Pending ❌"}</b>\n`;
              const platform = t.platform.toLowerCase();
              const actionWord = platform.includes("youtube") ? "SUBSCRIBE" : "FOLLOW";
              if (t.url) rows.push([{ text: `${actionWord} · ${label}`.slice(0, 40), url: t.url }]);
              if (!isTg && !ok) rows.push([{ text: `✅ Done · ${label}`.slice(0, 40), callback_data: `done:${t.id}` }]);
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
                verification_status: "completed",
                verification_method: "manual",
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
            await render(`${E("loading", "⏳")} <b>Checking your Telegram memberships...</b>\n${LINE}\nThis takes a moment.`, [
              backRow("tasks"),
            ]);
            let state: Awaited<ReturnType<typeof refreshVerification>> | null = null;
            try {
              state = await refreshVerification(profile);
            } catch (err) {
              await logBotError("verification", err instanceof Error ? err.message : "verify failed", from.id);
            }
            if (!state) {
              await render(`${E("error", "⚠️")} <b>Verification unavailable</b>\n${LINE}\nPlease try again shortly.`, [
                [{ text: "🔄 Verify Again", callback_data: "verify" }],
                backRow("tasks"),
              ]);
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
              body = `${E("error", "⚠️")} <b>Verification temporarily unavailable</b>\n${LINE}\nPlease try again shortly.`;
            } else {
              const tgMissing = pending.map((c) => c.name.replace(/^follow\s+/i, "").trim());
              if (tgMissing.length === 1) {
                body = `❌ <b>Please follow ${esc(tgMissing[0]!)} first.</b>\n${LINE}\n`;
              } else if (tgMissing.length > 1) {
                body = `❌ <b>Please follow both required Telegram channels.</b>\n${LINE}\n`;
              } else {
                body = `❌ <b>Verification Incomplete</b>\n${LINE}\nPlease complete:\n`;
              }
              for (const name of state.missing) body += `• ${esc(name.replace(/^follow\s+/i, ""))}\n`;
              body += `${LINE}\nAfter following, tap Verify Again.`;
            }

            for (const c of pending) if (c.url) rows.push([{ text: shortLabel("telegram", c.name), url: c.url }]);
            rows.push([{ text: "🔄 Verify Again", callback_data: "verify" }]);
            rows.push(backRow("tasks"));
            await render(body, rows);
            return Response.json({ ok: true });
          }

          // ---------- extension ----------
          if (action === "extension") {
            const fresh = (await profileByTelegramId(from.id)) ?? profile;
            if (fresh.status !== "active") {
              await render(`🔒 <b>Locked</b>\n${LINE}\nComplete all tasks to unlock the official download.`, [
                [{ text: `${E("tasks", "📋")} Tasks`, callback_data: "tasks" }],
                backRow(),
              ]);
              return Response.json({ ok: true });
            }
            await render(
              `${E("extension", "📦")} <b>${esc(extensionName.toUpperCase())}</b>\n${LINE}\n` +
                `📦 Version: <b>${esc(extensionVersion)}</b>\n` +
                (extensionDate ? `📅 Released: ${esc(extensionDate)}\n` : "") +
                (S("extension_file_size", "") ? `💾 Size: ${esc(S("extension_file_size", ""))}\n` : "") +
                `${LINE}\n${esc(extensionDesc)}`,
              buildExtensionKeyboard(),
            );
            return Response.json({ ok: true });
          }

          if (action === "extfile") {
            const fresh = (await profileByTelegramId(from.id)) ?? profile;
            if (fresh.status !== "active") {
              await render(`🔒 <b>Locked</b>\n${LINE}\nComplete all tasks first.`, [
                [{ text: `${E("tasks", "📋")} Tasks`, callback_data: "tasks" }],
                backRow(),
              ]);
              return Response.json({ ok: true });
            }
            const document = extensionFileId || extensionFileUrl;
            if (!document) {
              await render(
                `${E("error", "⚠️")} <b>Extension file delivery is currently unavailable.</b>\n${LINE}\nPlease use the official download link.`,
                buildExtensionKeyboard(),
              );
              return Response.json({ ok: true });
            }
            const sent = await tg("sendDocument", {
              chat_id: chatId,
              document,
              parse_mode: "HTML",
              caption: `${E("brand", "🦊")} <b>${esc(extensionName)}</b>\n📦 Version ${esc(extensionVersion)}`,
            });
            if (!sent.ok) {
              await logBotError("telegram_api", sent.description ?? "sendDocument failed", from.id, "extfile");
              await render(
                `${E("error", "⚠️")} <b>Extension file delivery is currently unavailable.</b>\n${LINE}\nPlease use the official download link.`,
                buildExtensionKeyboard(),
              );
              return Response.json({ ok: true });
            }
            await render(`📦 <b>File sent</b>\n${LINE}\nThe extension file was delivered above.`, buildExtensionKeyboard());
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
          const inviteLink = botUser ? `https://t.me/${botUser}?start=${profile.referral_code}` : profile.referral_code;

          if (action === "me") {
            const { profile: fresh } = await ensureProfile(from);
            const [refs, licenses, ranked] = await Promise.all([
              verifiedReferrals(profile.id),
              db.from("license_redemptions").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
              db.from("profiles").select("id, credits_earned").order("credits_earned", { ascending: false }).limit(500),
            ]);
            const rank = (ranked.data ?? []).findIndex((p) => p.id === profile.id) + 1;
            await render(
              `${E("profile", "👤")} <b>MY PROFILE</b>\n${LINE}\n` +
                `Name: <b>${esc(who)}</b>\n` +
                `Status: <b>${fresh.status === "active" ? "Active ✅" : "Pending ⏳"}</b>\n` +
                `${E("credits", "💰")} Credits: <b>${fresh.credits_available}</b>\n` +
                `${E("invite", "👥")} Referrals: <b>${refs}</b>\n` +
                `${E("rank", "🏆")} Global Rank: <b>${rank > 0 ? `#${rank}` : "—"}</b>\n` +
                `${E("license", "🔑")} Licenses: <b>${licenses.count ?? 0}</b>\n` +
                `${LINE}`,
              [
                [{ text: `${E("license", "🔑")} My Licenses`, url: `${siteUrl}/hub?t=${profile.web_token}` }],
                [
                  { text: `${E("invite", "👥")} Invite`, callback_data: "invite" },
                  { text: `${E("rank", "🏆")} Ranking`, callback_data: "board" },
                ],
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
            let body = `${E("rank", "🏆")} <b>LEADERBOARD</b>\n${LINE}\n`;
            for (let i = 0; i < Math.min(10, list.length); i++) {
              const p = list[i]!;
              const label = p.telegram_username ? `@${p.telegram_username}` : p.first_name || "FoxGEN Member";
              body += `${medals[i] ?? `#${i + 1}`} ${esc(label)} — ${E("credits", "💰")} ${p.credits_earned}\n`;
            }
            const myRank = list.findIndex((p) => p.id === profile.id) + 1;
            body += `${LINE}\nYour rank: <b>${myRank > 0 ? `#${myRank}` : "—"}</b>`;
            await render(body, [[{ text: `${E("invite", "👥")} Invite Friends`, callback_data: "invite" }], backRow()]);
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
            const shareText = S("referral_message", `Join ${storeName} and earn a FREE Lovable Unlimited license!`);
            const message = `${shareText}\n\n${inviteLink}`;
            await render(
              `${E("invite", "👥")} <b>INVITE &amp; EARN</b>\n${LINE}\n` +
                `👤 Valid Referrals: <b>${refs}</b>\n` +
                `${E("credits", "💰")} Available Credits: <b>${credits}</b>\n` +
                (nextReward
                  ? `🎯 Next Reward: <b>${esc(nextReward.name)}</b>\n${bar(credits, target)}\n${credits} / ${target} Credits\n`
                  : `${E("success", "🎉")} Ready to redeem a reward!\n`) +
                `${LINE}\nYour referral link:\n<code>${esc(inviteLink)}</code>`,
              [
                [
                  {
                    text: "📤 Share on Telegram",
                    url: `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareText)}`,
                  },
                ],
                [{ text: "💬 Share on WhatsApp", url: `https://wa.me/?text=${encodeURIComponent(message)}` }],
                [{ text: `${E("rewards", "🎁")} Free Rewards`, callback_data: "rewards" }],
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
            let body = `${E("rewards", "🎁")} <b>FREE LICENSE REWARDS</b>\n${LINE}\n`;
            const rows: Keyboard = [];
            (rewards ?? []).forEach((r, i) => {
              const dot = dots[i] ?? "🎁";
              body += `${dot} ${esc(r.name)} — ${E("credits", "💰")} ${r.credit_cost} Credits\n`;
              rows.push([{ text: `${dot} ${r.duration_days} Days · ${r.credit_cost} Credits`, callback_data: `redeem:${r.id}` }]);
            });
            body += `${LINE}\nYour Credits: <b>${fresh?.credits_available ?? 0}</b>`;
            rows.push([{ text: `${E("invite", "👥")} Earn More Credits`, callback_data: "invite" }]);
            rows.push(backRow());
            await render(body, rows);
            return Response.json({ ok: true });
          }

          // ---------- license detail + setup guide ----------
          /** Buttons shown under a license: copy, download, tutorial, guide, my licenses. */
          const licenseKeyboard = (redemptionId: string): Keyboard => {
            const rows: Keyboard = [];
            if (extensionUrl.startsWith("http")) rows.push([{ text: "📥 Download Extension", url: extensionUrl }]);
            if (tutorialUrl.startsWith("http")) rows.push([{ text: "▶️ Watch Tutorial", url: tutorialUrl }]);
            rows.push([{ text: "📘 How to Use", callback_data: `guide:1:${redemptionId}` }]);
            rows.push([{ text: `${E("license", "🔑")} My Licenses`, callback_data: "mylic" }]);
            rows.push(backRow());
            return rows;
          };

          const licenseBody = async (r: {
            id: string;
            license_key: string;
            duration_days: number;
            credits_used: number;
            reward_name: string;
          }) => {
            const [{ data: lic }, fresh] = await Promise.all([
              db.from("licenses").select("status, expires_at, activated_at").eq("license_key", r.license_key).maybeSingle(),
              profileByTelegramId(from.id),
            ]);
            const status = lic?.status ? lic.status : "active";
            const expiry = lic?.expires_at
              ? new Date(lic.expires_at).toISOString().slice(0, 10)
              : "Pending activation";
            return (
              `${E("success", "✅")} <b>License details</b>\n${LINE}\n` +
              `Product: <b>Lovable Extension</b>\n` +
              `Plan: <b>${esc(r.reward_name)}</b>\n` +
              `Duration: <b>${r.duration_days} days</b>\n` +
              `License: <code>${esc(r.license_key)}</code>\n` +
              `Credits used: <b>${r.credits_used}</b>\n` +
              `Remaining credits: <b>${fresh?.credits_available ?? 0}</b>\n` +
              `Status: <b>${esc(status)}</b>\n` +
              `Expires: <b>${esc(expiry)}</b>\n${LINE}\n` +
              `Tap the license above to copy it. Read the setup guide before using your extension.` +
              (tutorialUrl.startsWith("http") ? "" : "\n\n<i>A video tutorial has not been configured yet — the written guide is available.</i>")
            );
          };

          if (action === "mylic") {
            const { data: rows } = await db
              .from("license_redemptions")
              .select("id, license_key, duration_days, credits_used, reward_name, redeemed_at")
              .eq("user_id", profile.id)
              .order("redeemed_at", { ascending: false })
              .limit(20);
            const list = rows ?? [];
            if (list.length === 0) {
              await render(
                `${E("license", "🔑")} <b>MY LICENSES</b>\n${LINE}\nYou have not redeemed a license yet.\n\nInvite friends to earn credits, then redeem a free license.`,
                [
                  [{ text: `${E("rewards", "🎁")} Free Rewards`, callback_data: "rewards" }],
                  [{ text: `${E("invite", "👥")} Invite Friends`, callback_data: "invite" }],
                  backRow(),
                ],
              );
              return Response.json({ ok: true });
            }
            let body = `${E("license", "🔑")} <b>MY LICENSES</b>\n${LINE}\n`;
            const keys: Keyboard = [];
            for (const r of list) {
              body += `• ${esc(r.reward_name)} — ${r.duration_days} days\n`;
              keys.push([{ text: `🔑 ${r.reward_name} · ${r.duration_days}d`.slice(0, 40), callback_data: `lic:${r.id}` }]);
            }
            body += `${LINE}\nSelect a license to view its key and setup guide.`;
            keys.push([{ text: "📘 Setup Guide", callback_data: "guide:1" }]);
            keys.push(backRow());
            await render(body, keys);
            return Response.json({ ok: true });
          }

          if (action.startsWith("lic:")) {
            const { data: r } = await db
              .from("license_redemptions")
              .select("id, license_key, duration_days, credits_used, reward_name")
              .eq("id", action.slice(4))
              .eq("user_id", profile.id) // customers only ever see their own keys
              .maybeSingle();
            if (!r) {
              await render(`${E("error", "⚠️")} License not found.`, [backRow("mylic")]);
              return Response.json({ ok: true });
            }
            await render(await licenseBody(r), licenseKeyboard(r.id));
            return Response.json({ ok: true });
          }

          if (action.startsWith("guide:")) {
            const [, pageRaw, licId] = action.split(":");
            const { data: pages } = await db
              .from("extension_guide_pages")
              .select("heading, body, updated_at")
              .eq("published", true)
              .order("display_order", { ascending: true });
            const list = pages ?? [];
            const title = S("guide_title", "Lovable Extension — Setup & Usage Guide");
            if (list.length === 0) {
              await render(
                `📘 <b>${esc(title)}</b>\n${LINE}\nThe setup guide has not been published yet. Please contact support.`,
                [[{ text: `${E("support", "💬")} Support`, url: supportUrl }], backRow()],
              );
              return Response.json({ ok: true });
            }
            const page = Math.min(Math.max(1, Number(pageRaw) || 1), list.length);
            const p = list[page - 1]!;
            const body =
              `📘 <b>${esc(title)}</b>\n${LINE}\n<b>${esc(p.heading)}</b>\n\n${esc(p.body)}\n${LINE}\n` +
              `Page ${page} of ${list.length}` +
              (tutorialUrl.startsWith("http") ? "" : "\n<i>Video tutorial not configured yet.</i>");
            const nav: Btn[] = [];
            const suffix = licId ? `:${licId}` : "";
            if (page > 1) nav.push({ text: "⬅️ Previous", callback_data: `guide:${page - 1}${suffix}` });
            if (page < list.length) nav.push({ text: "Next ➡️", callback_data: `guide:${page + 1}${suffix}` });
            const rows: Keyboard = [];
            if (nav.length > 0) rows.push(nav);
            if (extensionUrl.startsWith("http")) rows.push([{ text: "📥 Download Extension", url: extensionUrl }]);
            if (tutorialUrl.startsWith("http")) rows.push([{ text: "▶️ Watch Tutorial", url: tutorialUrl }]);
            if (licId) rows.push([{ text: `${E("license", "🔑")} Back to License`, callback_data: `lic:${licId}` }]);
            rows.push([{ text: `${E("support", "💬")} Support`, url: supportUrl }]);
            rows.push(backRow());
            await render(body, rows);
            return Response.json({ ok: true });
          }

          if (action.startsWith("redeem:")) {
            try {
              const row = await redeem(profile.id, action.slice(7));
              const { data: saved } = await db
                .from("license_redemptions")
                .select("id, license_key, duration_days, credits_used, reward_name")
                .eq("user_id", profile.id)
                .eq("license_key", row.license_key)
                .maybeSingle();
              const detail = saved ?? { id: "", ...row };
              await send(
                `${E("success", "✅")} <b>License redeemed successfully!</b>\n${LINE}\n` + (await licenseBody(detail)),
                detail.id ? licenseKeyboard(detail.id) : [[{ text: "📘 How to Use", callback_data: "guide:1" }], backRow("rewards")],
              );
              await render(`${E("rewards", "🎁")} <b>FREE LICENSE REWARDS</b>\n${LINE}\nYour license details were sent above.`, [
                [{ text: `${E("license", "🔑")} My Licenses`, callback_data: "mylic" }],
                [{ text: `${E("rewards", "🎁")} Rewards`, callback_data: "rewards" }],
                backRow(),
              ]);
            } catch (err) {
              const msg = err instanceof Error ? err.message : "error";
              const known =
                msg.includes("insufficient_credits") ||
                msg.includes("account_not_active") ||
                msg.includes("reward_unavailable");
              // Expected user-side situations are not critical errors.
              if (!known) await logBotError("redemption", msg, from.id, action);
              const human = msg.includes("insufficient_credits")
                ? `${E("error", "⚠️")} <b>Not Enough Credits</b>\n${LINE}\nInvite friends to earn more credits.`
                : msg.includes("account_not_active")
                  ? `${E("error", "⚠️")} Complete all tasks first, then try again.`
                  : `${E("error", "⚠️")} This reward is not available yet. No credits were used.`;
              await render(human, [
                [{ text: `${E("invite", "👥")} Invite Friends`, callback_data: "invite" }],
                [{ text: `${E("rewards", "🎁")} Rewards`, callback_data: "rewards" }],
                backRow(),
              ]);
            }
            return Response.json({ ok: true });
          }

          await render(await homeBody(profile), buildHomeKeyboard());
          return Response.json({ ok: true });
        } catch (err) {
          await logBotError("callback", err instanceof Error ? err.message : "unhandled error", from.id, action);
          await render(`${E("error", "⚠️")} Something went wrong. Please try again shortly.`, [
            [{ text: "🏠 Home", callback_data: "menu" }],
          ]);
          return Response.json({ ok: true });
        } finally {
          await unlock();
        }
      },
    },
  },
});
