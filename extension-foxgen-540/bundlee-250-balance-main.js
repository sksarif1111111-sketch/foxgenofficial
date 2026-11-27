/* LOVABLE v40.5: present a recently server-verified 250, without touching original scripts.
 * Legacy page/core convert exactly 250 into 0; their backend enforcement remains intact. */
(() => {
  'use strict';
  if(window.__bundlee250main) return;
  window.__bundlee250main = true;
  let expires=0;
  const SOURCE='LOVABLE_VERIFIED_250_BALANCE';
  function apply() {
    if(Date.now()>expires)return;
    try {
      window.__127HUB_CREDITS__=250;
      window.localStorage.setItem('__127HUB_CREDITS__','250');
      window.sessionStorage.setItem('__127HUB_CREDITS__','250');
    } catch(_) {}
    // Original core listens for this post-deduction message and updates the
    // floating badge without its special 250-to-zero storage conversion.
    window.postMessage({type:'APP_DEDUCT_CREDITS_RESULT',result:{credits:250}},'*');
    if(typeof window.__127hubReplaceCreditsDOM==='function') {
      try {window.__127hubReplaceCreditsDOM(250);}catch(_){}
    }
  }
  window.addEventListener('message',event=>{
    if(event.source!==window || event.data?.type!==SOURCE)return;
    if(event.data.verified===true && event.data.credits===250){
      expires=Date.now()+12500;
      apply();
      setTimeout(apply,350);
      setTimeout(apply,1150);
    } else {expires=0;}
  },true);
  // A recent verification may be temporarily overridden by the original UI.
  // Re-render only while it remains valid; do not change actual credit storage.
  setInterval(apply,3000);
})();
