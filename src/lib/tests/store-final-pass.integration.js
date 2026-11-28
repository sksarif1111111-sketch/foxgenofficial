// Opt-in real database tests. Transport is mocked: no real payment, email or Telegram send.
import { mock } from 'bun:test';
import { createClient } from '@supabase/supabase-js';
if (process.env['RUN_STORE_DB_TEST'] !== '1') process.exit(0);
const db=createClient(process.env['SUPABASE_URL']??'',process.env['SUPABASE_SERVICE_ROLE_KEY']??'',{auth:{persistSession:false}});
const checked=async q=>{const r=await q;if(r.error)throw new Error(r.error.message);return r.data;};
const assert=(value,message)=>{if(!value)throw new Error(message);};
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=','base64'));
let telegramWorks=true,telegramThrows=false,emailWorks=true,emailSends=0,telegramSends=0;
const fetchOriginal=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
  const url=String(input instanceof Request?input.url:input);
  if(url.startsWith('https://api.telegram.org/file/botQA/'))return new Response(png,{headers:{'Content-Type':'image/png'}});
  if(url==='https://api.resend.com/emails'){emailSends++;assert(new Headers(init.headers).has('Idempotency-Key'),'email retry must have provider deduplication');return Response.json(emailWorks?{id:'qa-message'}:{message:'qa failure'},{status:emailWorks?200:503});}
  return fetchOriginal(input,init);
};
const acquireLock=async(key,ttl=15000)=>{
  await db.from('bot_action_locks').delete().eq('lock_key',key).lt('created_at',new Date(Date.now()-ttl).toISOString());
  return !(await db.from('bot_action_locks').insert({lock_key:key})).error;
};
const screens=[];
mock.module('../hub.server',()=>({db,acquireLock,releaseLock:async key=>{await db.from('bot_action_locks').delete().eq('lock_key',key);},botToken:()=> 'QA',logActivity:async()=>{},getSettings:async()=>({shop_email_from:'qa@example.com'}),tg:async method=>{
  if(method==='getFile')return {ok:true,result:{file_path:'photos/qa.png',file_size:png.length}};
  if(method==='sendMessage'){telegramSends++;if(telegramThrows)throw new Error('QA simulated lost response');}
  return {ok:telegramWorks};
}}));
mock.module('../shop-crm.server',()=>({kickCrmSync:()=>{}}));
const {marketplaceBot}=await import('../telegram-marketplace.server');
const {walletFundingBot}=await import('../wallet-topup.server');
const {createOrder,setOrderEmails,submitPayment,sendFulfillmentEmail,sendTelegramDelivery}=await import('../shop.server');
const {shopApproveOrder}=await import('../shop-actions.server');
const {storeUploadedProof}=await import('../payment-proof.server');
let profile,product,websiteOrder;
let caseCount=0;
const pass=message=>{caseCount++;console.log('PASS:',message);};
const run=async(action,text='',photoId)=>marketplaceBot({profile,chatId:profile.telegram_user_id,action,text,photoId,settings:{},callbackId:crypto.randomUUID(),render:async(body,keyboard)=>{screens.push({body,keyboard});}});
try{
  profile=(await checked(db.from('profiles').insert({telegram_user_id:-Date.now(),first_name:'Temporary Store QA',referral_code:'QA'+crypto.randomUUID().slice(0,8),credits_available:7}).select()))[0];
  product=(await checked(db.from('products').insert({name:'Temporary Store QA item',price_usdt:1,price_inr:100,price:1,shop_published:true,requires_buyer_email:false,stock_mode:'tracked',stock_quantity:20,min_per_order:1,max_per_order:2,is_free:false}).select()))[0];
  await run('myorders');
  assert(screens.at(-1).keyboard[0][0].callback_data==='menu' && screens.at(-1).keyboard.flat().some(b=>b.callback_data==='shop'),'empty order navigation');
  pass('Empty My Orders has Home first and Browse Shop navigation');
  await Promise.all([run(`pay:${product.id}:1:upi`),run(`pay:${product.id}:1:upi`)]);
  let orders=await checked(db.from('shop_orders').select('*').eq('profile_id',profile.id));
  assert(orders.length===1,'double tap created two orders');
  const pending=orders[0];
  pass('Two simultaneous bot payment taps create exactly one order');
  await run(`proof:${pending.id}`);await run('','','QA_photo_file_12345');await run('','QA-UTR-'+Date.now());
  const proof=await checked(db.from('shop_orders').select('*').eq('id',pending.id).single());
  assert(proof.status==='under_review' && proof.payment_evidence_url.startsWith('storage:') && !proof.confirmed_at,'bot proof save');
  pass('Bot screenshot saved to private storage, payment remains under review');
  await run('myorders');const screen=screens.at(-1);
  assert(screen.keyboard[0][0].callback_data==='menu' && screen.keyboard.flat().some(b=>b.callback_data===`order:${pending.id}`),'list navigation');
  await run(`order:${pending.id}`);
  assert(screens.at(-1).keyboard.flat().some(b=>b.callback_data==='myorders'),'order details back navigation');
  pass('My Orders → order detail → Back to My Orders navigation uses real order');
  const methods=await checked(db.from('payment_methods').select('*').eq('channel','telegram').eq('enabled',true));
  const upi=methods.find(m=>m.provider==='upi');assert(upi,'UPI required for fixture');
  const fund=async(action,text='',photo)=>walletFundingBot(profile.id,profile.telegram_user_id,action,text,photo,async(body,keyboard)=>screens.push({body,keyboard}));
  await fund('fundmethod:'+upi.id);await fund('','100');await fund('','QA-FUND-'+Date.now());await fund('','','QA_topup_file_12345');
  const request=(await checked(db.from('wallet_topup_requests').select('*').eq('profile_id',profile.id)))[0];
  assert(request.evidence_url.startsWith('storage:')&&request.status==='pending','private topup proof');
  await checked(db.rpc('shop_review_wallet_topup',{_id:request.id,_approve:true,_note:'Temporary QA, no real funds',_credit_usd:100}));
  const balance=await checked(db.from('wallets').select('balance_usd').eq('profile_id',profile.id).single());
  assert(Number(balance.balance_usd)===1,'100 INR must add exactly 1 USD');
  const again=await db.rpc('shop_review_wallet_topup',{_id:request.id,_approve:true,_note:'Duplicate QA',_credit_usd:100});
  assert(again.error,'duplicate topup approval must fail');
  pass('UPI top-up: ₹100 adds exactly $1; duplicate approval cannot credit twice');
  await fund('fundmethod:'+upi.id);
  await checked(db.from('wallet_topup_sessions').update({updated_at:new Date(Date.now()-30*60000).toISOString()}).eq('profile_id',profile.id));
  await fund('','100');
  assert(!(await checked(db.from('wallet_topup_sessions').select('profile_id').eq('profile_id',profile.id))).length,'stale session reused');
  pass('Funding session expires at thirty minutes and cannot reuse the next message');
  await run(`pay:${product.id}:1:wallet`);
  orders=await checked(db.from('shop_orders').select('*').eq('profile_id',profile.id));
  const paid=orders.find(o=>o.id!==pending.id);assert(paid.confirmed_at && paid.status==='awaiting_fulfillment','wallet checkout');
  const wallet=await checked(db.from('wallets').select('balance_usd').eq('profile_id',profile.id).single());
  const credits=await checked(db.from('profiles').select('credits_available').eq('id',profile.id).single());
  assert(Number(wallet.balance_usd)===0 && credits.credits_available===7,'wallet not referral credits');
  pass('Bot wallet purchase deducts exactly $1 with referral credits unchanged');
  await checked(db.from('shop_fulfillments').insert({order_id:paid.id,kind:'instructions',content:'Temporary QA access instructions'}));
  telegramWorks=false;assert(!(await sendTelegramDelivery(paid.id)).ok,'Telegram failure reported');
  assert((await checked(db.from('shop_orders').select('status').eq('id',paid.id).single())).status==='awaiting_fulfillment','failed delivery marked delivered');
  telegramThrows=true;assert(!(await sendTelegramDelivery(paid.id)).ok,'lost response is not success');
  telegramThrows=false;const uncertainCount=telegramSends;
  assert((await sendTelegramDelivery(paid.id)).reason==='delivery_uncertain' && telegramSends===uncertainCount,'uncertain delivery replayed');
  pass('An uncertain Telegram response is blocked from blind replay');
  // Test-only resolution: the fixture recipient confirms nothing arrived.
  await checked(db.from('shop_delivery_jobs').update({status:'failed'}).eq('order_id',paid.id).eq('status','blocked'));
  telegramWorks=true;assert((await sendTelegramDelivery(paid.id)).ok,'Telegram success');
  const sends=telegramSends;assert((await sendTelegramDelivery(paid.id)).ok && telegramSends===sends,'Telegram resend duplicate');
  pass('Telegram failure keeps waiting; success delivers once; retry sends no second copy');
  websiteOrder=await createOrder({channel:'website',profileId:null,telegramUserId:null,customerUserId:process.env['QA_WEBSITE_USER_ID'],customerName:'Temporary QA buyer',productId:product.id,quantity:1,paymentMethodId:(await checked(db.from('payment_methods').select('id').eq('channel','website').eq('provider','upi').eq('enabled',true)))[0].id,checkoutKey:'qa-'+crypto.randomUUID()});
  const evidence=await storeUploadedProof(websiteOrder.id,Buffer.from(png).toString('base64'));
  await submitPayment(websiteOrder.id,'QA-WEB-'+Date.now(),evidence);await setOrderEmails(websiteOrder.id,'qa@example.com');await shopApproveOrder({id:websiteOrder.id});
  await checked(db.from('shop_fulfillments').insert({order_id:websiteOrder.id,kind:'instructions',content:'Temporary QA email delivery instructions'}));
  process.env['RESEND_API_KEY']='QA_MOCK_ONLY';
  emailWorks=false;assert(!(await sendFulfillmentEmail(websiteOrder.id)).ok,'email failure must report failure');
  assert((await checked(db.from('shop_orders').select('status').eq('id',websiteOrder.id).single())).status==='awaiting_fulfillment','email failure incorrectly delivered');
  emailWorks=true;const before=emailSends;const results=await Promise.all([sendFulfillmentEmail(websiteOrder.id),sendFulfillmentEmail(websiteOrder.id)]);
  assert(results.some(r=>r.ok) && emailSends-before===1,'concurrent email duplicate');
  const beforeRetry=emailSends;assert((await sendFulfillmentEmail(websiteOrder.id)).ok&&emailSends===beforeRetry,'sent email repeated');
  pass('Website proof, approval, failed email retry and concurrent send-once verified');
  const expired=await createOrder({channel:'telegram',profileId:profile.id,telegramUserId:profile.telegram_user_id,customerName:'Temporary QA',productId:product.id,quantity:1,paymentMethodId:upi.id,checkoutKey:'expiry-'+crypto.randomUUID()});
  await checked(db.from('shop_orders').update({expires_at:new Date(Date.now()-1000).toISOString()}).in('id',[expired.id,pending.id]));
  const count=await checked(db.rpc('shop_expire_unpaid',{_profile:profile.id}));
  assert(count===1 && (await checked(db.from('shop_orders').select('status').eq('id',expired.id).single())).status==='expired','expiry');
  assert((await checked(db.from('shop_orders').select('status').eq('id',pending.id).single())).status==='under_review','reviewed order expired');
  pass('Only unpaid timed-out orders expire; reviewed payments remain unchanged');
  const summaries=await checked(db.rpc('shop_member_summaries',{_ids:[profile.id]}));
  assert(summaries[0].orders===3 && Number(summaries[0].balance)===0,'member aggregate must reflect real history');
  pass('Member summary reads all three orders and current wallet balance');
  console.log(`${caseCount} real-database scenarios passed; external transports mocked.`);
} finally {
  globalThis.fetch=fetchOriginal;
  const ids=profile?(await checked(db.from('shop_orders').select('id').eq('profile_id',profile.id))).map(o=>o.id):[];
  if(websiteOrder)ids.push(websiteOrder.id);
  if(ids.length){
    const crm=await checked(db.from('crm_orders').select('id,customer_id').in('external_order_id',ids.map(id=>'shop:'+id)));
    const crmIds=crm.map(o=>o.id),customers=crm.map(o=>o.customer_id).filter(Boolean);
    if(crmIds.length){await checked(db.from('crm_payments').delete().in('order_id',crmIds));await checked(db.from('crm_order_items').delete().in('order_id',crmIds));await checked(db.from('crm_orders').delete().in('id',crmIds));}
    if(customers.length)await checked(db.from('crm_customers').delete().in('id',customers));
    const proofs=await checked(db.from('shop_orders').select('payment_evidence_url').in('id',ids));
    const paths=proofs.map(o=>o.payment_evidence_url).filter(v=>v?.startsWith('storage:')).map(v=>v.slice(8));
    if(paths.length)await db.storage.from('payment-proofs').remove(paths);
    await checked(db.from('shop_crm_outbox').delete().in('order_id',ids));
    await checked(db.from('shop_crm_entity_outbox').delete().in('external_id',ids));
    await checked(db.from('wallet_transactions').delete().in('order_id',ids));
    await checked(db.from('shop_orders').delete().in('id',ids));
  }
  if(profile){
    const requests=await checked(db.from('wallet_topup_requests').select('id,evidence_url').eq('profile_id',profile.id));
    const paths=requests.map(r=>r.evidence_url).filter(v=>v?.startsWith('storage:')).map(v=>v.slice(8));
    if(paths.length)await db.storage.from('payment-proofs').remove(paths);
    await checked(db.from('shop_crm_entity_outbox').delete().in('external_id',[profile.id,...requests.map(r=>r.id)]));
    for(const table of ['wallet_transactions','wallet_topup_requests','wallet_topup_sessions','shop_bot_sessions','wallets'])await checked(db.from(table).delete().eq('profile_id',profile.id));
    await checked(db.from('bot_action_locks').delete().like('lock_key',`checkout:${profile.id}:%`));
    await checked(db.from('profiles').delete().eq('id',profile.id));
  }
  if(product)await checked(db.from('products').delete().eq('id',product.id));
  console.log('Temporary fixtures and proof files cleaned.');
}