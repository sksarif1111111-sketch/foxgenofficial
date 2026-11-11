import { db, tg } from "@/lib/hub.server";
import { walletUsd } from "./wallet-rate";
import { topupAmount, topupReference, topupEvidence } from "./wallet-topup.contract";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export async function walletFundingBot(profileId: string, chatId: number, action: string, text: string, photoId?: string, render?: (body: string, buttons: Array<Array<{ text: string; callback_data: string }>>) => Promise<void>) {
  const send = async (body: string, buttons: Array<Array<{ text: string; callback_data: string }>> = []) => {
    const keyboard = [...buttons, [{ text: "⬅️ Home", callback_data: "menu" }]];
    if (render) return render(body, keyboard);
    await tg("sendMessage", { chat_id: chatId, text: body, parse_mode: "HTML", reply_markup: { inline_keyboard: keyboard } });
  };
  if (action === "addfunds") {
    await db.from("wallet_topup_sessions").delete().eq("profile_id", profileId);
    await send("💰 <b>ADD FUNDS</b>\n━━━━━━━━━━━━━━\nChoose your transfer currency. Funds are added only after payment review.", [[{ text: "USDT", callback_data: "fundcurrency:USDT" }, { text: "UPI", callback_data: "fundcurrency:INR" }]]);
    return true;
  }
  if (action.startsWith("fundcurrency:")) {
    const currency = action.split(":")[1];
    if (!["USDT", "INR"].includes(currency ?? "")) return true;
    const { data: methods } = await db.from("payment_methods").select("id,name,provider,recipient,config").eq("channel", "telegram").eq("enabled", true).eq("currency", currency ?? "").order("display_order");
    const eligible = (methods ?? []).filter(m => m.provider !== "wallet" && m.provider !== "stars" && Boolean(m.recipient));
    if (!eligible.length) await send("This funding method is not configured yet. Please contact Support.");
    else await send("💰 <b>CHOOSE TRANSFER METHOD</b>\n━━━━━━━━━━━━━━", eligible.map(m => [{ text: m.name, callback_data: `fundmethod:${m.id}` }]));
    return true;
  }
  if (action.startsWith("fundmethod:")) {
    const id = action.slice(11);
    const { data: method } = await db.from("payment_methods").select("*").eq("id", id).eq("channel", "telegram").eq("enabled", true).maybeSingle();
    if (!method?.recipient || !["USDT", "INR"].includes(method.currency) || ["wallet", "stars"].includes(method.provider)) { await send("This method is unavailable."); return true; }
    const result = await db.from("wallet_topup_sessions").upsert({ profile_id: profileId, method_id: method.id, amount: null, reference: null, updated_at: new Date().toISOString() });
    if (result.error) throw new Error("Could not start funding request");
    await send(`💰 <b>${esc(method.name)}</b>\n━━━━━━━━━━━━━━\nRecipient: <code>${esc(method.recipient)}</code>\nNetwork: ${esc(method.network ?? "UPI")}\n${esc(method.instructions ?? "")}\n\nEnter the amount in ${esc(method.currency)}. ₹100 = $1 USD / USDT wallet funds. Funds are added only after payment verification; referral credits remain separate.`);
    return true;
  }
  const { data: session } = await db.from("wallet_topup_sessions").select("*").eq("profile_id", profileId).maybeSingle();
  if (!session) return false;
  if (Date.now() - Date.parse(session.updated_at) > 30 * 60000 || action === "menu" || text.startsWith("/")) {
    await db.from("wallet_topup_sessions").delete().eq("profile_id", profileId); return false;
  }
  if (action && !action.startsWith("fund")) return false;
  if (!text && !photoId && action !== "fundsubmit") return false;
  if (session.amount === null) {
    const amount = topupAmount.safeParse(text);
    if (!amount.success) { await send("Enter a positive amount, at most 100000, with up to two decimals."); return true; }
    await db.from("wallet_topup_sessions").update({ amount: amount.data, updated_at: new Date().toISOString() }).eq("profile_id", profileId);
    const method = await db.from("payment_methods").select("currency").eq("id",session.method_id).maybeSingle();
    await send(`After verification: $${walletUsd(amount.data, method.data?.currency ?? "USDT").toFixed(2)} wallet funds. Send the transaction reference after completing your transfer.`); return true;
  }
  if (!session.reference) {
    const reference = topupReference.safeParse(text);
    if (!reference.success) { await send("Send a transaction reference between 3 and 200 characters."); return true; }
    await db.from("wallet_topup_sessions").update({ reference: reference.data, updated_at: new Date().toISOString() }).eq("profile_id", profileId);
    await send("Send a screenshot photo or an HTTPS screenshot URL, or submit without evidence.", [[{ text: "Submit for review", callback_data: "fundsubmit" }]]); return true;
  }
  const evidence = text ? topupEvidence.safeParse(text) : null;
  if (evidence && !evidence.success) { await send("Send a valid HTTPS screenshot URL or tap Submit for review."); return true; }
  const { data: method } = await db.from("payment_methods").select("*").eq("id", session.method_id).eq("enabled", true).maybeSingle();
  if (!method?.recipient || !["USDT", "INR"].includes(method.currency)) { await send("This method is no longer available. Start Add funds again."); return true; }
  const result = await db.from("wallet_topup_requests").insert({ profile_id: profileId, amount: session.amount, currency: method.currency, method: method.id, network: method.network, recipient_used: method.recipient, reference: session.reference, evidence_url: photoId ? `telegram-file:${photoId}` : evidence?.success ? evidence.data : null });
  if (result.error) { await send(result.error.code === "23505" ? "This transaction reference has already been submitted. No funds were added." : "Could not save your request. Please retry."); return true; }
  await db.from("wallet_topup_sessions").delete().eq("profile_id", profileId);
  await send(`⏳ <b>FUNDING UNDER REVIEW</b>\n━━━━━━━━━━━━━━\n${session.amount} ${esc(method.currency)}\nReference: ${esc(session.reference)}\nWe will notify you after your payment is checked.`);
  return true;
}
export async function notifyWalletReview(profileId: string, text: string) {
  const { data: profile } = await db.from("profiles").select("telegram_user_id").eq("id", profileId).maybeSingle();
  if (profile) {
    const result = await tg("sendMessage", { chat_id: profile.telegram_user_id, text });
    if (!result.ok) return false;
  }
  return true;
}