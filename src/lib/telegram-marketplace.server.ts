import { db, tg, type Profile } from './hub.server';
import { createOrder, maxUnits, shopProductById, shopProductRows, cancelOrder, submitPayment } from './shop.server';
import { quantityChoices, orderTime } from './telegram-marketplace.policy';
import { memberLabel } from './member-number';
import { dualPrice } from './wallet-rate';
import { paymentMenu } from './telegram-payment-menu';
import { styledKeyboard, type TelegramButton } from './telegram-navigation';
import { categoryOf, categoryLabel } from './store-categories';
import type { Json } from '@/integrations/supabase/types';
type Button = TelegramButton;
type Keyboard = Button[][];
const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const home: Keyboard = [[{ text: '⬅️ Home', callback_data: 'menu' }]];
export async function buyerStats(profile: Profile) {
  const totals = new Map<string, number>(); let completed = 0; let pending = 0;
  for (let offset = 0; ; offset += 1000) {
    const res = await db.from('shop_orders').select('status,currency,total,stars_total').eq('profile_id', profile.id).eq('channel', 'telegram').order('id').range(offset, offset + 999);
    if (res.error) throw new Error('Could not read orders');
    for (const o of res.data ?? []) {
      if (o.status === 'delivered') completed++;
      if (!['delivered','cancelled','rejected','expired','refunded'].includes(o.status)) pending++;
      if (o.status === 'delivered' || ['payment_confirmed','awaiting_email','awaiting_fulfillment'].includes(o.status)) totals.set(o.currency, (totals.get(o.currency) ?? 0) + Number(o.currency === 'XTR' ? o.stars_total : o.total));
    }
    if ((res.data?.length ?? 0) < 1000) break;
  }
  const balance = await db.from('wallets').select('balance_usd').eq('profile_id',profile.id).maybeSingle();
  return { completed, pending, balance: Number(balance.data?.balance_usd ?? 0), spent: [...totals].map(([c,n]) => `${n.toFixed(2)} ${c === 'XTR' ? '⭐' : c}`).join(' · ') || '0.00 USD' };
}
export async function marketplaceBot(input: { profile: Profile; chatId: number; action: string; text: string; settings: Record<string,string>; callbackId?: string; photoId?: string; render?: (body: string, keys: Keyboard, image?: string | null) => Promise<void> }) {
  const { profile, chatId, action, text, settings } = input;
  const send = async (body: string, keys: Keyboard = home, image?: string | null) => {
    if (image?.startsWith('/')) image = new URL(image, settings['shop_url'] || 'https://foxgenofficial.lovable.app').href;
    if (input.render) return input.render(body, keys, image && /^https:\/\//.test(image) && body.length <= 1024 ? image : undefined);
    if (image && /^https:\/\//.test(image) && body.length <= 1024) {
      const r = await tg('sendPhoto',{ chat_id:chatId,photo:image,caption:body,parse_mode:'HTML',reply_markup:{inline_keyboard:styledKeyboard(keys)} });
      if (r.ok) return;
    }
    const result = await tg('sendMessage',{chat_id:chatId,text:body,parse_mode:'HTML',disable_web_page_preview:true,reply_markup:{inline_keyboard:styledKeyboard(keys)}});
    if (!result.ok) throw new Error('Telegram message failed');
  };
  const support: Button = { text:'💬 Help', url:settings['support_url'] || 'https://t.me/FoXGENSPORT' };
  const session = await db.from('shop_bot_sessions').select('*').eq('profile_id',profile.id).maybeSingle();
  const state = session.data && Date.now()-Date.parse(session.data.updated_at)<1800000 ? session.data : null;
  const saveState = async (name:string,data:Record<string,Json>) => { await db.from('shop_bot_sessions').upsert({profile_id:profile.id,state:name,data,updated_at:new Date().toISOString()}); };
  const clear = async () => { await db.from('shop_bot_sessions').delete().eq('profile_id',profile.id); };
  const detail = async (id:string) => {
    const o = await db.from('shop_orders').select('*').eq('id',id).eq('profile_id',profile.id).eq('channel','telegram').maybeSingle();
    if (!o.data) { await send('Order unavailable.'); return; }
    const items = await db.from('shop_order_items').select('product_name,quantity').eq('order_id',id);
    const clock = orderTime(o.data.confirmed_at,o.data.delivered_at,Number(settings['shop_delivery_sla_minutes'] || 30));
    const keys:Keyboard = [[{text:'🔄 Refresh',callback_data:`order:${id}`},support]];
    if (o.data.status==='awaiting_payment') keys.push([{text:'Submit transaction ID',callback_data:`proof:${id}`},{text:'Cancel',callback_data:`cancelshop:${id}`}]);
    keys.push([{text:'📦 My Orders',callback_data:'myorders'}],...home);
    await send(`<b>${esc(o.data.order_number)}</b>\n${(items.data??[]).map(i=>`${esc(i.product_name)} ×${i.quantity}`).join('\n')}\nStatus: ${esc(o.data.status.replace(/_/g,' '))}\nTotal: ${o.data.currency==='XTR' ? `${o.data.stars_total} ⭐` : `${o.data.total} ${esc(o.data.currency)}`}\n${clock ? `Delivery target: ${esc(settings['shop_delivery_sla_minutes'] || 30)} min\n${clock}` : ''}\n${o.data.info_request ? `More information needed: ${esc(o.data.info_request)}` : ''}`,keys);
  };
  if (action==='menu') { await clear(); return false; }
  if (action==='virtual' || action==='reseller') { await send('This option has been removed.',[[support],...home]); return true; }
  if (action==='wallet' || action==='storeprofile') {
    const s=await buyerStats(profile);
    await send(`<b>${action==='wallet'?'WALLET':esc(profile.first_name || 'Customer')}</b>\nUsername: ${profile.telegram_username ? '@'+esc(profile.telegram_username) : 'Not set'}\nCustomer ID: ${memberLabel(profile.member_number)}\nTelegram ID: <code>${profile.telegram_user_id}</code>\nWallet: $${s.balance.toFixed(2)} USD / USDT\nReferral credits: ${profile.credits_available}\nCompleted orders: ${s.completed}\nPending orders: ${s.pending}\nTotal spent: ${esc(s.spent)}\nJoined: ${esc(profile.created_at.slice(0,10))}`,[...(action==='wallet' ? [[{text:'💰 Add funds',callback_data:'addfunds'},{text:'Wallet history',callback_data:'walletlog'}]] : [[{text:'Credits & earnings',callback_data:'me'}, ...(profile.status==='active' ? [{text:'👥 Invite & Earn',callback_data:'invite'}] : [{text:'🔒 Complete tasks',callback_data:'tasks'}])],[{text:'🎁 Free Rewards',callback_data:'rewards'}]]),[{text:'📦 My Orders',callback_data:'myorders'}],...home]); return true;
  }
  if(action==='walletlog') {
    const [ledger,deposits]=await Promise.all([db.from('wallet_transactions').select('amount_usd,kind,created_at').eq('profile_id',profile.id).order('created_at',{ascending:false}).limit(20),db.from('wallet_topup_requests').select('amount,currency,status,created_at').eq('profile_id',profile.id).order('created_at',{ascending:false}).limit(20)]);
    await send(`<b>WALLET HISTORY · Latest 20</b>\n${(ledger.data??[]).map(r=>`${esc(r.kind)}: ${r.amount_usd} USD · ${r.created_at.slice(0,10)}`).join('\n')||'No transactions'}\n\n<b>DEPOSITS</b>\n${(deposits.data??[]).map(r=>`${r.amount} ${esc(r.currency)} · ${esc(r.status)}`).join('\n')||'No deposits'}`,[[{text:'👛 Wallet',callback_data:'wallet'}],...home]);return true;
  }
  if(action==='search'){await saveState('search',{});await send('🔍 Send a product name to search.');return true;}
  if(action==='categories') {
    const products=await shopProductRows('website');
    const categories=[...new Set(products.map(p=>categoryOf(p.name)))];
    await send('<b>PRODUCT CATEGORIES</b>',[...categories.map(id=>[{text:categoryLabel(id),callback_data:`category:${id}`}]),[{text:'All products',callback_data:'shop'}],...home]);return true;
  }
  if(action==='shop'||action.startsWith('shop:')||action.startsWith('category:')||(state?.state==='search'&&text&&!text.startsWith('/'))) {
    const all=await shopProductRows('website'); let filtered=all; let page=Number(action.split(':')[1])||1;
    if(action.startsWith('category:')) { filtered=all.filter(p=>categoryOf(p.name)===action.slice(9));page=1; }
    if(state?.state==='search'&&text&&!text.startsWith('/')) { const q=text.trim().slice(0,120).toLowerCase();filtered=all.filter(p=>p.name.toLowerCase().includes(q));await clear();page=1; }
    const pages=Math.max(1,Math.ceil(filtered.length/8));page=Math.min(pages,Math.max(1,page));
    const rows=filtered.slice((page-1)*8,page*8);
    await send(`<b>${esc(settings['store_name']||'FOXGEN AI STORE')} · PRODUCTS</b>\nPage ${page}/${pages} · ${filtered.length} products\n${rows.map(p=>`${esc(p.name)} · ${esc(dualPrice(p))} · ${esc(p.stock_label)}`).join('\n')||'No products found.'}`,[...rows.map(p=>[{text:`${p.emoji||'🛍️'} ${p.name}`.slice(0,60),callback_data:`prod:${p.id}`}]),...(action.startsWith('category:')||state?.state==='search'?[]:[[{text:'◀ Previous',callback_data:`shop:${Math.max(1,page-1)}`},{text:'Next ▶',callback_data:`shop:${Math.min(pages,page+1)}`}]]),[{text:'🔄 Refresh',callback_data:'shop'},{text:'🔍 Search',callback_data:'search'},{text:'Categories',callback_data:'categories'}],...home]);return true;
  }
  if(action.startsWith('prod:')) {
    const p=await shopProductById(action.slice(5),'website');const row=await db.from('products').select('warranty_label,product_type,shop_published').eq('id',action.slice(5)).maybeSingle();
    if(!p||!row.data?.shop_published){await send('Product unavailable.');return true;}
    const body=`<b>${esc(p.name)}</b>\nPrice: ${esc(dualPrice(p))}\n${esc(p.stock_label)}\n${row.data.warranty_label?`Warranty: ${esc(row.data.warranty_label)}\n`:''}Product type: ${esc(row.data.product_type)}\nDelivery: ${p.requires_buyer_email?'Email required':'Telegram chat'}\n\n${esc(p.description||p.short_description||'')}\n${p.installation_instructions?`\n<b>How to use</b>\n${esc(p.installation_instructions)}`:''}\n${esc(p.terms||'')}`;
    await send(body.slice(0,3900),[...(p.purchasable?[[{text:'🛒 Buy · choose quantity',callback_data:`qty:${p.id}`}]]:[]),[support,{text:'⬅ Shop',callback_data:'shop'}]],p.image_url);return true;
  }
  const confirm=async(id:string,qty:number)=>{
    const p=await shopProductById(id,'website');const limits=await db.from('products').select('min_per_order').eq('id',id).maybeSingle();if(!p||!p.purchasable||!Number.isInteger(qty)||qty<(limits.data?.min_per_order??1)||qty>maxUnits(p)){await send('Quantity unavailable. Open the product again.');return;}
    const methods=await db.from('payment_methods').select('*').eq('channel','telegram').eq('enabled',true).order('display_order');
    if(methods.error) throw new Error('Could not load payment methods');
    const s=await buyerStats(profile);
    await send(`🧾 <b>ORDER SUMMARY</b>\n━━━━━━━━━━━━━━\n🛍️ Product: ${esc(p.name)}\n🔢 Quantity: ${qty}\n💵 Unit price: ${esc(dualPrice(p))}\n━━━━━━━━━━━━━━\n💰 Total: ${esc(dualPrice({price_usdt:p.price_usdt===null?null:p.price_usdt*qty,price_inr:p.price_inr===null?null:p.price_inr*qty}))}\n👛 Your balance: $${s.balance.toFixed(2)} USD / USDT\n\nChoose a payment method 👇\nWallet purchases deduct dollars, not referral credits. UPI / Binance payments require review.`,[...paymentMenu(p.id,qty,methods.data??[],p,s.balance),...(p.price_stars?[[{text:`⭐ Telegram Stars · ${p.price_stars*qty}`,callback_data:`buystars:${p.id}:${qty}`}]]:[]),[{text:'💳 Visa / Mastercard · Coming Soon',callback_data:'soon'}],[{text:'🏦 International bank · Coming Soon',callback_data:'soon'}],[{text:'💰 Add funds',callback_data:'addfunds'}],[{text:'⬅ Change quantity',callback_data:`qty:${p.id}`}],...home]);
  };
  if(action==='soon'){await send('Coming Soon — this payment method is not supported yet.');return true;}
  if(action.startsWith('qty:')) {
    const p=await shopProductById(action.slice(4),'website');if(!p){await send('Product unavailable.');return true;}
    const limits=await db.from('products').select('min_per_order').eq('id',p.id).maybeSingle();const limit=maxUnits(p);await send(`<b>${esc(p.name)}</b>\nUnit: ${esc(dualPrice(p))}\nAvailable purchase quantity: ${limit}`,[quantityChoices(limit,limits.data?.min_per_order??1).map(n=>({text:n===limit&&n>5?`All (${n})`:String(n),callback_data:`buy:${p.id}:${n}`})),[{text:'Custom quantity',callback_data:`customqty:${p.id}`}],...home]);return true;
  }
  if(action.startsWith('customqty:')){await saveState('quantity',{productId:action.slice(10)});await send('Send a whole number of units.');return true;}
  if(state?.state==='quantity'&&text&&!text.startsWith('/')){const data=state.data as Record<string,unknown>;await clear();await confirm(String(data['productId']),Number(text));return true;}
  if(action.startsWith('buy:')){const [,id,q]=action.split(':');await confirm(id??'',Number(q));return true;}
  if(action.startsWith('pay:')||action.startsWith('buystars:')) {
    const [,id,q,method]=action.split(':');
    let methodId=method;
    if(action.startsWith('pay:') && ['wallet','upi','binance_id','usdt_bep20'].includes(method??'')) {
      const selected=await db.from('payment_methods').select('id').eq('channel','telegram').eq('enabled',true).eq('provider',method??'').order('display_order').limit(1).maybeSingle();
      if(selected.error||!selected.data){await send('Payment method unavailable. Please reopen the order summary.');return true;}
      methodId=selected.data.id;
    }
    const o=await createOrder({channel:'telegram',profileId:profile.id,telegramUserId:profile.telegram_user_id,customerName:[profile.first_name,profile.last_name].filter(Boolean).join(' '),productId:id??'',quantity:Number(q),paymentMethodId:methodId,checkoutKey:input.callbackId?`telegram:${input.callbackId}`:undefined});
    if(o.currency==='XTR') { const p=await shopProductById(id??'','telegram');await tg('sendInvoice',{chat_id:chatId,title:(p?.name||'Order').slice(0,32),description:`Order ${o.order_number}`,payload:o.id,currency:'XTR',prices:[{label:'Order total',amount:o.stars_total}]}); }
    else if(o.payment_reference?.startsWith('WALLET-')) {await detail(o.id);return true;}
    else {
      const m=await db.from('payment_methods').select('*').eq('id',o.payment_method_id??'').maybeSingle();const config=m.data?.config as Record<string,unknown>|undefined;
      await send(`💳 <b>${esc(o.payment_method_name)}</b>\n━━━━━━━━━━━━━━\n🧾 Order: ${esc(o.order_number)}\n💰 Amount: <b>${o.total} ${esc(o.currency)}</b>\nRecipient: <code>${esc(o.payment_recipient)}</code>\n${esc(config?.['account_name']||config?.['recipient_name']||'')}\n${esc(m.data?.instructions||'Send the exact amount, then submit the transaction ID and payment screenshot.')}\n\n⏳ Payment remains under review until approved.`,[[{text:'📋 Copy recipient',copy_text:{text:o.payment_recipient||''}},{text:'📋 Copy amount',copy_text:{text:String(o.total)}}],[{text:'🧾 Send transaction ID',callback_data:`proof:${o.id}`}],[{text:'📸 Send payment screenshot',callback_data:`proof:${o.id}`}],[{text:'✖ Cancel order',callback_data:`cancelshop:${o.id}`}],[{text:'📦 Order details',callback_data:`order:${o.id}`}],...home],typeof config?.['qr_url']==='string'?config['qr_url']:null);
    }return true;
  }
  if(action.startsWith('proof:')){const o=await db.from('shop_orders').select('id,status').eq('id',action.slice(6)).eq('profile_id',profile.id).eq('channel','telegram').maybeSingle();if(o.data?.status!=='awaiting_payment'){await send('This order is not awaiting payment.');return true;}await saveState('reference',{orderId:o.data.id});await send('📸 Send your payment screenshot or transaction ID / UTR first. Both are needed for payment review.');return true;}
  if(state?.state==='reference'&&input.photoId){await saveState('photo_reference',{...(state.data as Record<string,Json>),photoId:input.photoId});await send('🧾 Screenshot received. Now send your transaction ID / UTR (6–200 characters).');return true;}
  if(state?.state==='photo_reference'&&text&&!text.startsWith('/')){if(text.length<6||text.length>200){await send('Enter the exact transaction ID (6–200 characters).');return true;}const data=state.data as Record<string,unknown>;const id=String(data['orderId']);const owned=await db.from('shop_orders').select('id').eq('id',id).eq('profile_id',profile.id).eq('channel','telegram').maybeSingle();if(!owned.data)throw new Error('Order unavailable');await submitPayment(id,text,`telegram-file:${String(data['photoId'])}`);await clear();await send('⏳ <b>PAYMENT UNDER REVIEW</b>\nScreenshot and transaction ID received. Payment is not confirmed until approved.',[[{text:'📦 Track order',callback_data:`order:${id}`}],...home]);return true;}
  if(state?.state==='reference'&&text&&!text.startsWith('/')){if(text.length<6||text.length>200){await send('Enter the exact transaction ID (6–200 characters).');return true;}await saveState('evidence',{...(state.data as Record<string,Json>),reference:text});await send('Send the payment screenshot as a photo.');return true;}
  if(state?.state==='evidence'&&input.photoId){const data=state.data as Record<string,unknown>;const id=String(data['orderId']);const o=await db.from('shop_orders').select('id').eq('id',id).eq('profile_id',profile.id).eq('channel','telegram').maybeSingle();if(!o.data)throw new Error('Order unavailable');await submitPayment(id,String(data['reference']),`telegram-file:${input.photoId}`);await clear();await send('⏳ Proof submitted. Your payment is under review; no payment has been confirmed yet.',[[{text:'📦 Track order',callback_data:`order:${id}`}],...home]);return true;}
  if(action==='myorders'||action.startsWith('myorders:')) {const page=Math.max(1,Number(action.split(':')[1])||1);const orders=await db.from('shop_orders').select('id,order_number,status').eq('profile_id',profile.id).eq('channel','telegram').order('created_at',{ascending:false}).range((page-1)*8,page*8);await send(`<b>MY ORDERS</b> · Page ${page}\nSelect an order.`,[...(orders.data??[]).slice(0,8).map(o=>[{text:`${o.order_number} · ${o.status.replace(/_/g,' ')}`,callback_data:`order:${o.id}`}]),[{text:'◀ Previous',callback_data:`myorders:${Math.max(1,page-1)}`},...(orders.data?.length===9?[{text:'Next ▶',callback_data:`myorders:${page+1}`}]:[])],...home]);return true;}
  if(action.startsWith('order:')){await detail(action.slice(6));return true;}
  if(action.startsWith('cancelshop:')){const id=action.slice(11);const o=await db.from('shop_orders').select('id').eq('id',id).eq('profile_id',profile.id).eq('channel','telegram').maybeSingle();if(!o.data)throw new Error('Order unavailable');await cancelOrder(id,'customer','Customer cancelled');await detail(id);return true;}
  return false;
}