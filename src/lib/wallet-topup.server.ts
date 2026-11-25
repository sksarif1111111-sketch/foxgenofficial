import { db, tg } from "@/lib/hub.server";
import { storeTelegramProof } from "./payment-proof.server";
import { walletUsd } from "./wallet-rate";
import { topupAmount, topupReference, topupEvidence } from "./wallet-topup.contract";
import { styledKeyboard, type TelegramKeyboard } from './telegram-navigation';
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export async function walletFundingBot(profileId: string, chatId: number, action: string, text: string, photoId?: string, render?: (body: string, buttons: TelegramKeyboard, image?: string | null) => Promise<void>) {
  const send = async (body: string, buttons: TelegramKeyboard = [], image?: string | null) => {
    const keyboard = [...buttons, [{ text: "⬅️ Home", callback_data: "menu" }]];
    if (render) return render(body, keyboard, image);
    const result=await tg(image ? 'sendPhoto' : 'sendMessage', { chat_id: chatId, ...(image ? {photo:image,caption:body} : {text:body}), parse_mode: "HTML", reply_markup: { inline_keyboard: styledKeyboard(keyboard) } });
    if(!result.ok) throw new Error('Could not display funding screen');
  };
  if (action === "addfunds") {
    await db.from("wallet_topup_sessions").delete().eq("profile_id", profileId);
    const methods=await db.from('payment_methods').select('id,name,provider,recipient,currency').eq('channel','telegram').eq('enabled',true).order('display_order');
    if(methods.error) throw new Error('Could not load funding methods');
    const eligible=(methods.data??[]).filter(m=>['upi','binance_id','usdt_bep20'].includes(m.provider)&&m.recipient&&['INR','USDT'].includes(m.currency));
    await send("💰 <b>ADD FUNDS</b>\n━━━━━━━━━━━━━━\nChoose a payment method 👇\n₹100 = $1 USD / USDT wallet funds.\nAfter approval, spend your wallet balance in Shop. Referral credits remain separate.", [...eligible.map(m=>[{text:`${m.provider==='upi'?'🔵':'🟢'} ${m.name}`,callback_data:`fundmethod:${m.id}`}]),[{text:'💳 Visa / Mastercard · Coming Soon',callback_data:'soon'}],[{text:'🏦 International bank · Coming Soon',callback_data:'soon'}],[{text:'👛 Wallet',callback_data:'wallet'}]]);
    return true;
  }
  if(action==='fundcancel'){
    await db.from('wallet_topup_sessions').delete().eq('profile_id',profileId);
    await send('Funding entry cancelled. Previously submitted requests remain under review.',[[{text:'👛 Wallet',callback_data:'wallet'}]]);return true;
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
    const method = await db.from("payment_methods").select("*").eq("id",session.method_id).eq('channel','telegram').eq('enabled',true).maybeSingle();
    if(!method.data?.recipient){await send('Payment method unavailable. Start Add funds again.');return true;}
    const config=method.data.config as Record<string,unknown>|null;
    const qr=typeof config?.['qr_url']==='string' ? config['qr_url'] : null;
    const image=qr?.startsWith('/') ? new URL(qr,'https://foxgenofficial.lovable.app').href : qr?.startsWith('https://') ? qr : null;
    await send(`💳 <b>${esc(method.data.name)}</b>\n━━━━━━━━━━━━━━\n💰 Amount to pay: <b>${amount.data} ${esc(method.data.currency)}</b>\nRecipient: <code>${esc(method.data.recipient)}</code>\n${esc(String(config?.['account_name']||config?.['recipient_name']||''))}\n\nAfter approval: $${walletUsd(amount.data, method.data.currency).toFixed(2)} wallet funds.\nSend your transaction reference, then a payment screenshot.`,[[{text:'📋 Copy recipient',copy_text:{text:method.data.recipient}},{text:'📋 Copy amount',copy_text:{text:String(amount.data)}}],[{text:'✖ Cancel',callback_data:'fundcancel'}]],image); return true;
  }
  if (!session.reference) {
    const reference = topupReference.safeParse(text);
    if (!reference.success) { await send("Send a transaction reference between 3 and 200 characters."); return true; }
    await db.from("wallet_topup_sessions").update({ reference: reference.data, updated_at: new Date().toISOString() }).eq("profile_id", profileId);
    await send("📸 Send your payment screenshot as a photo. It will remain under review until approved.", [[{text:'✖ Cancel',callback_data:'fundcancel'}]]); return true;
  }
  const evidence = text ? topupEvidence.safeParse(text) : null;
  if(!photoId){await send('📸 A screenshot photo is required before submitting this funding request.');return true;}
  if (evidence && !evidence.success) { await send("Send a valid HTTPS screenshot URL or tap Submit for review."); return true; }
  const { data: method } = await db.from("payment_methods").select("*").eq("id", session.method_id).eq("enabled", true).maybeSingle();
  if (!method?.recipient || !["USDT", "INR"].includes(method.currency)) { await send("This method is no longer available. Start Add funds again."); return true; }
  const requestId = crypto.randomUUID();
  const evidenceValue = await storeTelegramProof("topups", requestId, photoId);
  const result = await db.from("wallet_topup_requests").insert({ id: requestId, profile_id: profileId, amount: session.amount, currency: method.currency, method: method.id, network: method.network, recipient_used: method.recipient, reference: session.reference, evidence_url: evidenceValue });
  if (result.error) { await send(result.error.code === "23505" ? "This transaction reference has already been submitted. No funds were added." : "Could not save your request. Please retry."); return true; }
  await db.from("wallet_topup_sessions").delete().eq("profile_id", profileId);
  await send(`⏳ <b>FUNDING UNDER REVIEW</b>\n━━━━━━━━━━━━━━\n${session.amount} ${esc(method.currency)}\nReference: ${esc(session.reference)}\nAfter approval: $${walletUsd(session.amount,method.currency).toFixed(2)} wallet funds.\nWe will notify you after your payment is checked.`,[[{text:'👛 Wallet history',callback_data:'walletlog'},{text:'🛍️ Shop',callback_data:'shop'}]]);
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