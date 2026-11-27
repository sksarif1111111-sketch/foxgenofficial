/* Lovable AI v40.5 — suppress optional extension update notifications only.
 * No changes to license, credits, GitHub, login, or backend endpoints.
 * Chrome's own browser-managed extension updates are unaffected.
 */
(() => {
  'use strict';

  // Ignore cached OTA update announcements. Never change other saved settings.
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const dismiss = () => {
      try {
        chrome.storage.local.get(['ql_ota_update'], data => {
          if (chrome.runtime?.lastError) return;
          if (data?.ql_ota_update?.available) {
            chrome.storage.local.set({
              ql_ota_update: { available: false, checked_at: Date.now() }
            });
          }
        });
      } catch (_) { /* UI notifications are optional. */ }
    };
    dismiss();
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.ql_ota_update?.newValue?.available) dismiss();
      });
    } catch (_) {}
  }

  // A narrow DOM fallback for dynamically rendered legacy update banners.
  // It does not touch notifications belonging to the Lovable website itself.
  const own = '#qlL-license-modal,#ql-floating,#ql-launcher,[id^="qlL-"],[id^="ql-"],[class*="qlLm-"],[class*="qlL-"],[class*="lovasiri-" i],[id^="lovasiri-"],[class*="powerkits" i],[id^="hub-"],[id^="127hub-"]';
  const title = /(?:^|\b)(?:extension\s+)?(?:new\s+)?update\s+available\b|\bnew\s+version\s+available\b/i;
  const banners = '[role="alert"],[role="dialog"],[class*="toast" i],[class*="modal" i],[class*="update" i],[class*="notification" i],[class*="banner" i]';
  const isElement = n => n?.nodeType === 1;

  function hide(element) {
    if (!isElement(element) || element.dataset.lovableUpdateHidden === '1') return;
    element.dataset.lovableUpdateHidden = '1';
    element.style.setProperty('display', 'none', 'important');
    element.setAttribute('aria-hidden', 'true');
  }
  function inspect(node) {
    if (!isElement(node)) return;
    const isOurs = node.matches?.(own) || node.closest?.(own);
    if (!isOurs || !node.matches?.(banners)) return;
    const value = String(node.textContent || '').replace(/\s+/g, ' ').trim();
    if (value.length > 1400 || !title.test(value)) return;
    hide(node);
  }
  function scan(root) {
    if (!root?.querySelectorAll) return;
    inspect(root);
    root.querySelectorAll(banners).forEach(inspect);
  }
  function start() {
    if (!document.documentElement) return;
    scan(document.documentElement);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        const node = record.target;
        if (record.type === 'characterData') {
          if (node.parentElement) {
            inspect(node.parentElement.closest?.(banners));
          }
        } else if (record.type === 'childList') {
          for (const added of record.addedNodes) {
            if (isElement(added)) scan(added);
            else if (added.nodeType === 3) inspect(added.parentElement?.closest?.(banners));
          }
          inspect(node.closest?.(banners));
        }
      }
    });
    observer.observe(document.documentElement, {subtree: true, childList: true, characterData: true});
  }
  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start, {once: true});
})();
