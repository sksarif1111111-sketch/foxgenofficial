import { db, tg, type Profile } from './hub.server';
import { createOrder, maxUnits, shopProductById, shapeProduct, cancelOrder, submitPayment, type ShopProduct } from './shop.server';
import { orderStatus, paymentExpired } from './store-order.policy';
import { quantityChoices, orderTime } from './telegram-marketplace.policy';
import { memberLabel } from './member-number';
import { dualPrice } from './wallet-rate';
import { paymentMenu } from './telegram-payment-menu';
import { styledKeyboard, type TelegramButton } from './telegram-navigation';
import { categoryOf, categoryLabel } from './store-categories';
import { storeTelegramProof } from './payment-proof.server';
import type { Json } from '@/integrations/supabase/types';
type Button = TelegramButton;
type Keyboard = Button[][];
const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const home: Keyboard = [[{ text: '⬅️ Home', callback_data: 'menu' }]];
export async function walletBalance(profileId: string) {
  const balance = await db.from('wallets').select('balance_usd').eq('profile_id',profileId).maybeSingle();
  return Number(balance.data?.balance_usd ?? 0);
}
/** Order totals from one SQL aggregate, with the wallet read in parallel. */
export async function buyerStats(profile: Pick<Profile, 'id'>) {
  const [agg, balance] = await Promise.all([db.rpc('bot_buyer_stats', { _profile_id: profile.id }), walletBalance(profile.id)]);
  if (agg.error) throw new Error('Could not read orders');
  const s = agg.data as { placed: number; completed: number; pending: number; totals: Array<{ currency: string; total: number }> };
  return { placed: Number(s.placed ?? Number(s.completed) + Number(s.pending)), completed: Number(s.completed), pending: Number(s.pending), balance, spent: (s.totals ?? []).map(t => `${Number(t.total).toFixed(2)} ${t.currency === 'XTR' ? '⭐' : t.currency}`).join(' · ') || '0.00 USD' };
}
const LIST_COLUMNS = 'id,name,emoji,price_usdt,price_inr,price_stars,stock_mode,stock_quantity,availability,max_per_order,shop_order,created_at';
/** Live publication and stock are read on each visit; one bounded catalogue query. */
export async function cachedProductList(): Promise<ShopProduct[]> {
  const { data, error } = await db.from('products').select(LIST_COLUMNS).eq('shop_published', true).eq('supplier_removed', false).neq('status', 'archived').order('shop_order').order('id').limit(1000);
  if (error) throw new Error('Could not load products');
  return (data ?? []).map(r => shapeProduct(r as Record<string, unknown>, 'website'));
}
type ProductRow = Record<string, unknown> & { id: string; min_per_order: number | null; warranty_label: string | null; product_type: string; telegram_image_file_id: string | null; telegram_image_source: string | null };
/** One product read: returns the raw row (extra fields) plus the shaped product, or null if not for sale. */
async function productOnce(id: string) {
  const { data } = await db.from('products').select('*').eq('id', id).maybeSingle();
  if (!data || !data.shop_published || data.status === 'archived' || data.supplier_removed) return null;
  return { row: data as unknown as ProductRow, p: shapeProduct(data as Record<string, unknown>, 'website') };
}
export async function marketplaceBot(input: { profile: Profile; chatId: number; action: string; text: string; settings: Record<string,string>; callbackId?: string; photoId?: string; render?: (body: string, keys: Keyboard, image?: string | null) => Promise<string | undefined | void> }) {
  const { profile, chatId, action, text, settings } = input;
  const send = async (body: string, keys: Keyboard = home, image?: string | null, cached?: { fileId: string | null; source: string | null; productId: string }) => {
    if (image?.startsWith('/')) image = new URL(image, settings['shop_url'] || 'https://foxgenofficial.lovable.app').href;
    if (input.render) {
      const url = image && /^https:\/\//.test(image) && body.length <= 1024 ? image : undefined;
      // Reuse Telegram's stored copy of this exact product image instead of the remote URL.
      const reuse = url && cached?.fileId && cached.source === url ? cached.fileId : undefined;
      const fileId = await input.render(body, keys, reuse ?? url);
      if (url && cached && !reuse && typeof fileId === 'string') void db.from('products').update({ telegram_image_file_id: fileId, telegram_image_source: url }).eq('id', cached.productId).then(() => undefined, () => undefined);
      return;
    }
    if (image && /^https:\/\//.test(image) && body.length <= 1024) {
      const r = await tg('sendPhoto',{ chat_id:chatId,photo:image,caption:body,parse_mode:'HTML',reply_markup:{inline_keyboard:styledKeyboard(keys)} });
      if (r.ok) return;
    }
    const result = await tg('sendMessage',{chat_id:chatId,text:body,parse_mode:'HTML',disable_web_page_preview:true,reply_markup:{inline_keyboard:styledKeyboard(keys)}});
    if (!result.ok) throw new Error('Telegram message failed');
  };
  const support: Button = { text:'💬 Help', url:settings['support_url'] || 'https://t.me/FoXGENSPORT' };
  // Sessions only matter for typed text or photos; button taps never read them.
  const session = (text || input.photoId) ? await db.from('shop_bot_sessions').select('*').eq('profile_id',profile.id).maybeSingle() : { data: null };
  const state = session.data && Date.now()-Date.parse(session.data.updated_at)<1800000 ? session.data : null;
  const saveState = async (name:string,data:Record<string,Json>) => { await db.from('shop_bot_sessions').upsert({profile_id:profile.id,state:name,data,updated_at:new Date().toISOString()}); };
  const clear = async () => { await db.from('shop_bot_sessions').delete().eq('profile_id',profile.id); };
  const ordersHome: Keyboard = [[{text:'🏠 Home',callback_data:'menu'}]];
  const expireOwnOrders = async () => {
    const result = await db.rpc('shop_expire_unpaid', { _profile: profile.id });
    if (result.error) throw new Error('Could not refresh order expiry');
  };
  const detail = async (id:string) => {
    await expireOwnOrders();
    const o = await db.from('shop_orders').select('*').eq('id',id).eq('profile_id',profile.id).maybeSingle();
    if (o.error) throw new Error('Could not read order');
    if (!o.data) { await send('Order unavailable.',[...ordersHome,[{text:'⬅️ Back to My Orders',callback_data:'myorders'}],...home]); return; }
    const items = await db.from('shop_order_items').select('product_name,quantity,product_id').eq('order_id',id);
    if (items.error) throw new Error('Could not read order items');
    const clock = orderTime(o.data.confirmed_at,o.data.delivered_at,Number(settings['shop_delivery_sla_minutes'] || 30));
    const keys:Keyboard = [...ordersHome,[{text:'📦 Track Order',callback_data:`order:${id}`},support]];
    if (o.data.status==='awaiting_payment' && !paymentExpired(o.data)) keys.push([{text:'Submit transaction ID',callback_data:`proof:${id}`},{text:'Cancel',callback_data:`cancelshop:${id}`}]);
    if (['expired','cancelled','rejected'].includes(o.data.status)) keys.push([{text:'🛍️ Retry in Shop',callback_data:'shop'}]);
    keys.push([{text:'⬅️ Back to My Orders',callback_data:'myorders'}],...home);
    const expiry = o.data.status === 'awaiting_payment' && o.data.expires_at ? Math.max(0,Math.ceil((Date.parse(o.data.expires_at)-Date.now())/60000)) : null;
    await send(`<b>${esc(o.data.order_number)}</b>\n${(items.data??[]).map(i=>`${esc(i.product_name)} ×${i.quantity}`).join('\n')}\nStatus: ${o.data.status==='delivered'?'✅ ':''}${esc(orderStatus(o.data))}\nTotal: ${o.data.currency==='XTR' ? `${o.data.stars_total} ⭐` : `${o.data.total} ${esc(o.data.currency)}`}\nMethod: ${esc(o.data.payment_method_name || '—')}\nOrdered: ${esc(o.data.created_at.slice(0,16).replace('T',' '))} UTC\n${o.data.delivered_at ? `Delivered: ${esc(o.data.delivered_at.slice(0,16).replace('T',' '))} UTC\n` : ''}${expiry === null ? '' : `Payment time left: ${expiry} min\n`}${clock ? `Delivery target: ${esc(settings['shop_delivery_sla_minutes'] || 30)} min\n${clock}\n` : ''}${o.data.info_request ? `More information needed: ${esc(o.data.info_request)}` : ''}`,keys);
  };
  if (action==='menu') { if (session.data) await clear(); return false; }
  if (action==='virtual' || action==='reseller') { await send('This option has been removed.',[[support],...home]); return true; }
  if (action==='wallet' || action==='storeprofile') {
    const s=await buyerStats(profile);
    await send(`<b>${action==='wallet'?'WALLET':esc(profile.first_name || 'Customer')}</b>\nUsername: ${profile.telegram_username ? '@'+esc(profile.telegram_username) : 'Not set'}\nCustomer ID: ${memberLabel(profile.member_number)}\nTelegram ID: <code>${profile.telegram_user_id}</code>\nWallet: $${s.balance.toFixed(2)} USD / USDT\nReferral credits: ${profile.credits_available}\nCompleted orders: ${s.completed}\nPending orders: ${s.pending}\nTotal spent: ${esc(s.spent)}\nJoined: ${esc(profile.created_at.slice(0,10))}`,[...(action==='wallet' ? [[{text:'💰 Add funds',callback_data:'addfunds'},{text:'Wallet history',callback_data:'walletlog'}]] : [[{text:'Credits & earnings',callback_data:'me'}, ...(profile.status==='active' ? [{text:'👥 Invite & Earn',callback_data:'invite'}] : [{text:'🔒 Complete tasks',callback_data:'tasks'}])],[{text:'🎁 Free Rewards',callback_data:'rewards'}],[{text:'📋 Copy Member ID',copy_text:{text:memberLabel(profile.member_number)}}]]),[{text:'📦 My Orders',callback_data:'myorders'}],...home]); return true;
  }
  if(action==='walletlog') {
    const [ledger,deposits]=await Promise.all([db.from('wallet_transactions').select('amount_usd,kind,created_at').eq('profile_id',profile.id).order('created_at',{ascending:false}).limit(20),db.from('wallet_topup_requests').select('amount,currency,status,created_at').eq('profile_id',profile.id).order('created_at',{ascending:false}).limit(20)]);
    await send(`<b>WALLET HISTORY · Latest 20</b>\n${(ledger.data??[]).map(r=>`${esc(r.kind)}: ${r.amount_usd} USD · ${r.created_at.slice(0,10)}`).join('\n')||'No transactions'}\n\n<b>DEPOSITS</b>\n${(deposits.data??[]).map(r=>`${r.amount} ${esc(r.currency)} · ${esc(r.status)}`).join('\n')||'No deposits'}`,[[{text:'👛 Wallet',callback_data:'wallet'}],...home]);return true;
  }
  if(action==='search'){await saveState('search',{});await send('🔍 Send a product name to search.');return true;}
  if(action==='categories') {
    const products=await cachedProductList();
    const categories=[...new Set(products.map(p=>categoryOf(p.name)))];
    await send('<b>PRODUCT CATEGORIES</b>',[...categories.map(id=>[{text:categoryLabel(id),callback_data:`category:${id}`}]),[{text:'All products',callback_data:'shop'}],...home]);return true;
  }
  if(action==='shop'||action.startsWith('shop:')||action.startsWith('category:')||(state?.state==='search'&&text&&!text.startsWith('/'))) {
    const all=await cachedProductList(); let filtered=all; let page=Number(action.split(':')[1])||1;
    if(action.startsWith('category:')) { filtered=all.filter(p=>categoryOf(p.name)===action.slice(9));page=1; }
    if(state?.state==='search'&&text&&!text.startsWith('/')) { const q=text.trim().slice(0,120).toLowerCase();filtered=all.filter(p=>p.name.toLowerCase().includes(q));await clear();page=1; }
    const pages=Math.max(1,Math.ceil(filtered.length/8));page=Math.min(pages,Math.max(1,page));
    const rows=filtered.slice((page-1)*8,page*8);
    await send(`<b>${esc(settings['store_name']||'FOXGEN AI STORE')} · PRODUCTS</b>\nPage ${page}/${pages} · ${filtered.length} products\n${rows.map(p=>`${esc(p.name)} · ${esc(dualPrice(p))} · ${esc(p.stock_label)}`).join('\n')||(all.length ? 'No products found.' : 'No products available right now. Check back soon.')}`,[...rows.map(p=>[{text:`${p.emoji||'🛍️'} ${p.name}`.slice(0,60),callback_data:`prod:${p.id}`}]),...(action.startsWith('category:')||state?.state==='search'?[]:[[{text:'◀ Previous',callback_data:`shop:${Math.max(1,page-1)}`},{text:'Next ▶',callback_data:`shop:${Math.min(pages,page+1)}`}]]),[{text:'🔄 Refresh',callback_data:'shop'},{text:'🔍 Search',callback_data:'search'},{text:'Categories',callback_data:'categories'}],...(all.length?[]:[[support]]),...home]);return true;
  }
  if(action.startsWith('prod:')) {
    const found=await productOnce(action.slice(5));
    if(!found){await send('Product unavailable.');return true;}
    const {p}=found;const row={data:found.row};
    const body=`<b>${esc(p.name)}</b>\nPrice: ${esc(dualPrice(p))}\n${esc(p.stock_label)}\n${row.data.warranty_label?`Warranty: ${esc(row.data.warranty_label)}\n`:''}Product type: ${esc(row.data.product_type)}\nDelivery: ${p.requires_buyer_email?'Email required':'Telegram chat'}\n\n${esc(p.description||p.short_description||'')}\n${p.installation_instructions?`\n<b>How to use</b>\n${esc(p.installation_instructions)}`:''}\n${esc(p.terms||'')}`;
    await send(body.slice(0,3900),[...(p.purchasable?[[{text:'🛒 Buy · choose quantity',callback_data:`qty:${p.id}`}]]:[]),[support,{text:'⬅ Shop',callback_data:'shop'}]],p.image_url,{fileId:found.row.telegram_image_file_id,source:found.row.telegram_image_source,productId:p.id});return true;
  }
  const confirm=async(id:string,qty:number)=>{
    const [found,methods,balance]=await Promise.all([productOnce(id),db.from('payment_methods').select('*').eq('channel','telegram').eq('enabled',true).order('display_order'),walletBalance(profile.id)]);
    const p=found?.p;if(!p||!p.purchasable||!Number.isInteger(qty)||qty<(found.row.min_per_order??1)||qty>maxUnits(p)){await send('Quantity unavailable. Open the product again.');return;}
    if(methods.error) throw new Error('Could not load payment methods');
    const s={balance};
    await send(`🧾 <b>ORDER SUMMARY</b>\n━━━━━━━━━━━━━━\n🛍️ Product: ${esc(p.name)}\n🔢 Quantity: ${qty}\n💵 Unit price: ${esc(dualPrice(p))}\n━━━━━━━━━━━━━━\n💰 Total: ${esc(dualPrice({price_usdt:p.price_usdt===null?null:p.price_usdt*qty,price_inr:p.price_inr===null?null:p.price_inr*qty}))}\n👛 Your balance: $${s.balance.toFixed(2)} USD / USDT\n\nChoose a payment method 👇\nWallet purchases deduct dollars, not referral credits. UPI / Binance payments require review.`,[...paymentMenu(p.id,qty,methods.data??[],p,s.balance),...(p.price_stars?[[{text:`⭐ Telegram Stars · ${p.price_stars*qty}`,callback_data:`buystars:${p.id}:${qty}`}]]:[]),[{text:'💳 Visa / Mastercard · Coming Soon',callback_data:'soon'}],[{text:'🏦 International bank · Coming Soon',callback_data:'soon'}],[{text:'💰 Add funds',callback_data:'addfunds'}],[{text:'⬅ Change quantity',callback_data:`qty:${p.id}`}],...home]);
  };
  if(action==='soon'){await send('Coming Soon — this payment method is not supported yet.');return true;}
  if(action.startsWith('qty:')) {
    const found=await productOnce(action.slice(4));if(!found){await send('Product unavailable.');return true;}
    const p=found.p;const limits={data:found.row};const limit=maxUnits(p);await send(`<b>${esc(p.name)}</b>\nUnit: ${esc(dualPrice(p))}\nAvailable purchase quantity: ${limit}`,[quantityChoices(limit,limits.data?.min_per_order??1).map(n=>({text:n===limit&&n>5?`All (${n})`:String(n),callback_data:`buy:${p.id}:${n}`})),[{text:'Custom quantity',callback_data:`customqty:${p.id}`}],...home]);return true;
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
  if(state?.state==='photo_reference'&&text&&!text.startsWith('/')){if(text.length<6||text.length>200){await send('Enter the exact transaction ID (6–200 characters).');return true;}const data=state.data as Record<string,unknown>;const id=String(data['orderId']);const owned=await db.from('shop_orders').select('id').eq('id',id).eq('profile_id',profile.id).eq('channel','telegram').maybeSingle();if(!owned.data)throw new Error('Order unavailable');await submitPayment(id,text,await storeTelegramProof('orders',id,String(data['photoId'])));await clear();await send('⏳ <b>PAYMENT UNDER REVIEW</b>\nScreenshot and transaction ID received. Payment is not confirmed until approved.',[[{text:'📦 Track order',callback_data:`order:${id}`}],...home]);return true;}
  if(state?.state==='reference'&&text&&!text.startsWith('/')){if(text.length<6||text.length>200){await send('Enter the exact transaction ID (6–200 characters).');return true;}await saveState('evidence',{...(state.data as Record<string,Json>),reference:text});await send('Send the payment screenshot as a photo.');return true;}
  if(state?.state==='evidence'&&input.photoId){const data=state.data as Record<string,unknown>;const id=String(data['orderId']);const o=await db.from('shop_orders').select('id').eq('id',id).eq('profile_id',profile.id).eq('channel','telegram').maybeSingle();if(!o.data)throw new Error('Order unavailable');await submitPayment(id,String(data['reference']),await storeTelegramProof('orders',id,input.photoId));await clear();await send('⏳ Proof submitted. Your payment is under review; no payment has been confirmed yet.',[[{text:'📦 Track order',callback_data:`order:${id}`}],...home]);return true;}
  if(action==='myorders'||action.startsWith('myorders:')) {
    await expireOwnOrders();
    const page=Math.min(10000,Math.max(1,Math.floor(Number(action.split(':')[1])||1)));
    const result=await db.from('shop_orders').select('id,order_number,status,currency,total,stars_total,payment_method_name,created_at,delivered_at,expires_at,shop_order_items(product_name,quantity)').eq('profile_id',profile.id).order('created_at',{ascending:false}).order('id').range((page-1)*8,page*8);
    if(result.error)throw new Error('Could not load orders');
    const orders=(result.data??[]).slice(0,8);
    const amount=(o:typeof orders[number])=>o.currency==='XTR'?`${o.stars_total} ⭐`:`${o.total} ${o.currency}`;
    const content=orders.map(o=>`${esc(o.order_number)} · ${esc(orderStatus(o))}\n${o.shop_order_items.map(i=>`${esc(i.product_name)} ×${i.quantity}`).join(', ')}\n${esc(amount(o))} · ${esc(o.payment_method_name||'—')} · ${o.created_at.slice(0,10)}${o.delivered_at?`\n✅ Delivered: ${o.delivered_at.slice(0,16).replace('T',' ')} UTC`:''}`).join('\n\n');
    await send(`<b>MY ORDERS</b> · Page ${page}\n\n${content|| (page===1?'📭 You have not placed any orders yet.':'No orders on this page.')}`.slice(0,3900),[...ordersHome,...orders.map(o=>[{text:`${o.order_number} · ${o.shop_order_items.map(i=>`${i.product_name} ×${i.quantity}`).join(', ')} · ${amount(o)} · ${o.payment_method_name||'—'} · ${orderStatus(o)} · ${o.created_at.slice(5,10)}`.slice(0,60),callback_data:`order:${o.id}`}]),...(orders.length||page>1?[[...(page>1?[{text:'◀ Previous',callback_data:`myorders:${page-1}`}]:[]),...(result.data?.length===9?[{text:'Next ▶',callback_data:`myorders:${page+1}`}]:[])]]:[]),[{text:'🛍️ Browse Shop',callback_data:'shop'}],...home]);
    return true;
  }
  if(action.startsWith('order:')){await detail(action.slice(6));return true;}
  if(action.startsWith('cancelshop:')){const id=action.slice(11);const o=await db.from('shop_orders').select('id').eq('id',id).eq('profile_id',profile.id).eq('channel','telegram').maybeSingle();if(!o.data)throw new Error('Order unavailable');await cancelOrder(id,'customer','Customer cancelled');await detail(id);return true;}
  return false;
}