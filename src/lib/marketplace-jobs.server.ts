import {db,tg,getSettings,acquireLock,releaseLock} from './hub.server';
export async function runMarketplaceJobs(){
  if(!await acquireLock('marketplace:jobs',120000))return {ok:true,busy:true};
  try{
    const delayed=await db.rpc('shop_mark_delayed');if(delayed.error)throw new Error('Delay check failed');
    const settings=await getSettings();
    if(Number(delayed.data)>0&&/^\d+$/.test(settings['shop_admin_chat_id']||''))await tg('sendMessage',{chat_id:settings['shop_admin_chat_id'],text:`${delayed.data} orders exceeded the delivery target. Open Buying to prioritise them.`});
    let sent=0,failed=0;
    const jobs=await db.from('shop_delivery_jobs').select('*').eq('channel','telegram').in('status',['pending','failed']).lt('attempts',5).order('created_at').limit(25);
    for(const j of jobs.data??[]){
      const p=j.payload as Record<string,unknown>;
      // Fulfillment has separate send-once guard rails; an uncertain send needs human review, never automatic credential replay.
      if(p['fulfillment']===true)continue;
      const r=await tg('sendMessage',{chat_id:j.target,text:String(p['text']||''),parse_mode:'HTML'}).catch(()=>({ok:false}));
      await db.from('shop_delivery_jobs').update({attempts:j.attempts+1,status:r.ok?'sent':'failed',sent_at:r.ok?new Date().toISOString():null,last_error:r.ok?null:'Telegram notification unavailable'}).eq('id',j.id);
      if(r.ok)sent++;else failed++;
    }
    const expired=await db.from('shop_orders').select('id').eq('status','awaiting_payment').lt('expires_at',new Date().toISOString()).limit(50);
    for(const o of expired.data??[])await db.rpc('shop_cancel_atomic',{_id:o.id,_status:'expired',_reason:'Unpaid order expired',_actor:'system'});
    return {ok:true,delayed:delayed.data,sent,failed};
  }finally{await releaseLock('marketplace:jobs');}
}