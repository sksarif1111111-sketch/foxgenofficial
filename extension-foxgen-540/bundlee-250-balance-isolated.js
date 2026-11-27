/* LOVABLE v40.5: read-only, server-verified correction for the legacy UI's EXACT 250 display bug.
 * No storage writes, no credit grants, no authentication bypass, no other backend calls. */
(() => {
  'use strict';
  if (globalThis.__bundlee250isolated || !chrome?.storage?.local || !chrome?.runtime?.id) return;
  globalThis.__bundlee250isolated = true;
  const URL = 'https://bundlee.store/api/credits/balance';
  let scheduled = false, pending = false, lastChecked = 0, trackedKey = null, lastVerified = false;
  function announce(is250) {
    window.postMessage({type:'LOVABLE_VERIFIED_250_BALANCE', verified:is250===true, credits:is250===true?250:null}, '*');
  }
  async function verify(force=false) {
    if (pending || (!force && Date.now() - lastChecked < 2700)) return;
    pending=true;
    lastChecked=Date.now();
    try {
      const saved = await chrome.storage.local.get(['ql_license_key','ql_license_valid','ql_credits']);
      const key=typeof saved.ql_license_key==='string'?saved.ql_license_key.trim():'';
      if (!key || saved.ql_license_valid===false) { trackedKey=null; lastVerified=false; announce(false); return; }
      if (key!==trackedKey) { trackedKey=key; lastVerified=false; announce(false); }
      // Only query when the exact-250 defect could apply. Other balances are untouched.
      if (saved.ql_credits!==0 && saved.ql_credits!==250 && !lastVerified) return;
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),6500);
      let response;
      try {
        response=await fetch(URL,{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
          body:JSON.stringify({license_key:key}),
          credentials:'omit',cache:'no-store',signal:controller.signal
        });
      } finally { clearTimeout(timeout); }
      if(!response.ok) { lastVerified=false;announce(false);return; }
      const body=await response.json();
      const active=body?.ok===true && body?.status==='active' && body.credits===250;
      const current=await chrome.storage.local.get(['ql_license_key','ql_credits']);
      if(current.ql_license_key!==key || (typeof current.ql_credits==='number' && current.ql_credits!==0 && current.ql_credits!==250)) {
        lastVerified=false;announce(false);return;
      }
      lastVerified=active;announce(active);
    } catch (_) {
      // A failed request is never treated as proof of positive credits.
      lastVerified=false;announce(false);
    } finally { pending=false; }
  }
  function schedule(delay=120) {
    if(scheduled)return;
    scheduled=true;
    setTimeout(()=>{scheduled=false;void verify();},delay);
  }
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area!=='local')return;
    if(changes.ql_license_key || (changes.ql_license_valid && changes.ql_license_valid.newValue===false)){
      lastVerified=false;trackedKey=null;announce(false);schedule();return;
    }
    if(changes.ql_credits){
      const v=changes.ql_credits.newValue;
      if(typeof v==='number' && v!==0 && v!==250){
        lastVerified=false;announce(false);return;
      }
      schedule();
    }
  });
  void chrome.storage.local.get(['ql_credits']).then(d=>{
    if(d.ql_credits===0 || d.ql_credits===250)schedule(300);
  }).catch(()=>{});
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden) schedule();
  });
  // Refresh the temporary verification only while the exact-250 condition persists.
  setInterval(()=>{if(lastVerified)void verify(true);},12000);
})();
