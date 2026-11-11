import { mock } from 'bun:test';
import { createClient } from '@supabase/supabase-js';
// Opt-in isolated database test; never sends Telegram messages or real payments.
if(process.env['RUN_PAYMENT_DB_TEST']!=='1') process.exit(0);
const db=createClient(process.env['SUPABASE_URL'] ?? '',process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '',{auth:{persistSession:false}});
const checked=async(q:any)=>{const r=await q;if(r.error)throw new Error(r.error.message);return r.data;};
const calls:any[]=[];
mock.module('../hub.server',()=>({db,tg:async(method:string,body:any)=>{calls.push({method,body});return {ok:true}},getSettings:async()=>({})}));
const {marketplaceBot}=await import('../telegram-marketplace.server');
const {walletFundingBot}=await import('../wallet-topup.server');
const {telegramRenderer}=await import('../telegram-navigation');
const assert=(x:any,msg:string)=>{if(!x)throw new Error(msg)};
let profile:any,product:any;const orders:string[]=[];let requestId:string|undefined;
try{
 profile=(await checked(db.from('profiles').insert({telegram_user_id:-Date.now(),first_name:'Payment flow QA',referral_code:'QA'+Date.now(),credits_available:7}).select()))[0];
 product=(await checked(db.from('products').insert({name:'Private payment flow QA',price_usdt:1,price_inr:100,shop_published:true,requires_buyer_email:false,delivery_method:'telegram_manual',stock_mode:'tracked',stock_quantity:4,max_per_order:2,is_free:false}).select()))[0];
 const methods=await checked(db.from('payment_methods').select('*').eq('channel','telegram').eq('enabled',true));
 const render=telegramRenderer(async(method,body)=>{calls.push({method,body});return {ok:true}},profile.telegram_user_id,10);
 const run=async(action:string,text='',photoId?:string)=>{calls.length=0;await marketplaceBot({profile,chatId:profile.telegram_user_id,action,text,photoId,settings:{},callbackId:'qa-'+crypto.randomUUID(),render});for(const call of calls)for(const row of call.body.reply_markup?.inline_keyboard??[])for(const b of row)if(b.callback_data)assert(new TextEncoder().encode(b.callback_data).length<=64,'callback too long');return calls.at(-1)?.body};
 await run('prod:'+product.id); const summary=await run('buy:'+product.id+':1');
 const keys=summary.reply_markup.inline_keyboard.flat();assert(keys.some((b:any)=>b.callback_data.endsWith(':upi'))&&keys.some((b:any)=>b.callback_data.endsWith(':binance_id'))&&keys.some((b:any)=>b.callback_data.endsWith(':wallet')),'three payment methods');
 console.log('Product → quantity → summary: UPI, Binance, wallet; all callbacks <=64 bytes, styled');
 await run('pay:'+product.id+':1:upi');
 let order=(await checked(db.from('shop_orders').select('*').eq('profile_id',profile.id)))[0];orders.push(order.id);assert(order.currency==='INR'&&Number(order.total)===100,'UPI total');
 await run('proof:'+order.id);await run('','', 'qa-private-photo');await run('','QA-UTR-'+Date.now());
 order=await checked(db.from('shop_orders').select('*').eq('id',order.id).single());assert(order.status==='under_review'&&!order.confirmed_at&&order.payment_evidence_url==='telegram-file:qa-private-photo','proof pending');
 console.log('UPI screenshot-first + UTR → private evidence stored, under_review, not paid');
 const fund=async(action:string,text='',photo?:string)=>{calls.length=0;await walletFundingBot(profile.id,profile.telegram_user_id,action,text,photo,render);return calls.at(-1)?.body};
 await fund('addfunds');await fund('fundmethod:'+methods.find((m:any)=>m.provider==='upi').id);await fund('','100');await fund('','QA-FUND-'+Date.now());await fund('fundsubmit');
 assert((await checked(db.from('wallet_topup_requests').select('id').eq('profile_id',profile.id))).length===0,'screenshot required');
 await fund('','','qa-topup-photo');
 const request=(await checked(db.from('wallet_topup_requests').select('*').eq('profile_id',profile.id)))[0];requestId=request.id;assert(request.status==='pending'&&request.evidence_url==='telegram-file:qa-topup-photo','topup pending');
 await checked(db.rpc('shop_review_wallet_topup',{_id:request.id,_approve:true,_note:'Isolated QA; no real transfer',_credit_usd:100}));
 let wallet=await checked(db.from('wallets').select('*').eq('profile_id',profile.id).single());assert(Number(wallet.balance_usd)===1,'100 INR adds 1 dollar');
 console.log('Add funds → reference → required photo → pending → isolated approval: ₹100 = $1');
 await run('pay:'+product.id+':1:wallet');
 const allOrders=await checked(db.from('shop_orders').select('*').eq('profile_id',profile.id));const paid=allOrders.find((o:any)=>o.id!==order.id);orders.push(paid.id);
 wallet=await checked(db.from('wallets').select('*').eq('profile_id',profile.id).single());const fresh=await checked(db.from('profiles').select('credits_available').eq('id',profile.id).single());assert(Number(wallet.balance_usd)===0&&fresh.credits_available===7&&paid.confirmed_at,'wallet dollars not credits');
 console.log('Wallet checkout → automatic dollar debit → balance $0, referral credits unchanged at 7');
 await run('wallet');await run('order:'+paid.id);console.log('Wallet and order readback screens verified');
}finally{
 if(profile){
 const all=await db.from('shop_orders').select('id').eq('profile_id',profile.id);const ids=(all.data??[]).map((o:any)=>o.id);
 if(ids.length){
 const crm=await db.from('crm_orders').select('id,customer_id').in('external_order_id',ids.map(id=>'shop:'+id));
 const crmIds=(crm.data??[]).map(r=>r.id);const customers=(crm.data??[]).map(r=>r.customer_id).filter(Boolean);
 if(crmIds.length){await db.from('crm_payments').delete().in('order_id',crmIds);await db.from('crm_order_items').delete().in('order_id',crmIds);await db.from('crm_orders').delete().in('id',crmIds);}
 if(customers.length)await db.from('crm_customers').delete().in('id',customers);
 await db.from('wallet_transactions').delete().eq('profile_id',profile.id);await db.from('shop_orders').delete().in('id',ids);}
 await db.from('wallet_topup_requests').delete().eq('profile_id',profile.id);await db.from('wallet_topup_sessions').delete().eq('profile_id',profile.id);await db.from('shop_bot_sessions').delete().eq('profile_id',profile.id);await db.from('wallets').delete().eq('profile_id',profile.id);await db.from('profiles').delete().eq('id',profile.id);
 }
 if(product)await db.from('products').delete().eq('id',product.id);
 console.log('Temporary test rows cleaned; no Telegram messages or real transfers sent');
}
