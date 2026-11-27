/* LOVABLE AI – Increase Limit invite navigator (v4).
 * Records ONLY the project invitation URL when the customer clicks Login With
 * My Account. The existing login handler is left completely untouched.
 * Navigation is managed in a NEW tab by the extension worker after a delay;
 * it never redirects or closes the original Lovable/login tab.
 */
(() => {
  'use strict';
  if (window.top !== window || window.__bundleeInviteNavigatorV4) return;
  window.__bundleeInviteNavigatorV4 = true;

  function invitation(raw) {
    try {
      const u = new URL(String(raw || '').trim());
      return u.protocol === 'https:' &&
        (u.hostname === 'lovable.dev' || u.hostname === 'www.lovable.dev') &&
        /^\/projects\/[^/?#\s]+/.test(u.pathname) ? u.href : null;
    } catch { return null; }
  }
  function loginClick(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
    const button = path.find(el => el && el.nodeType === 1 &&
      el.matches?.('button,[role="button"],input[type="submit"],input[type="button"]'));
    const label = String(button?.textContent || button?.value || '').replace(/\s+/g, ' ').trim();
    return /\blog\s*in\s*with\s*my\s*account\b/i.test(label) ? path : null;
  }
  function projectInvite(path) {
    for (const root of path) {
      if (!root?.querySelectorAll || root.nodeType !== 1) continue;
      const text = String(root.textContent || '').slice(0, 20000);
      if (!/project\s+invite\s+link/i.test(text) ||
          !/increase\s+limit|custom\s+account\s+switcher|lovable\s+account/i.test(text)) continue;
      for (const input of root.querySelectorAll('input[type="text"],input[type="url"],input:not([type]),textarea')) {
        const url = invitation(input.value);
        if (url) return url;
      }
    }
    return null;
  }
  // A passive capture listener, before the original handler. No navigation,
  // storage of credentials, mutations, preventDefault or propagation changes.
  window.addEventListener('click', event => {
    const path = loginClick(event);
    if (!path) return;
    const url = projectInvite(path);
    if (!url) return;
    try {
      const p = chrome.runtime.sendMessage({ type: 'LOVABLE_INVITE_V4_ARM', url });
      if (p?.catch) p.catch(() => {});
    } catch (_) { /* Never block the native login flow. */ }
  }, {capture: true, passive: true});
})();
