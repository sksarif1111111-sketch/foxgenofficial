/* FoxGEN Pro branding adapter for the legacy v40.5 extension.
 * Presentation-only patch: replaces Bundlee branding with FoxGEN Pro,
 * removes support/contact/recharge buttons and suppresses WhatsApp/Telegram redirects.
 * Core backend logic and product features are left unchanged where possible.
 */
(() => {
  'use strict';
  if (window.__lovableBrandAdapter405) return;
  window.__lovableBrandAdapter405 = true;

  const LOGO = chrome.runtime.getURL('icons/bundlee-symbol.png');
  const OWN_UI = '#qlL-license-modal,#ql-floating,#ql-launcher,[id^="qlL-"],[id^="ql-"],[class*="qlLm-"],[class*="qlL-"],[class*="lovasiri-" i],[id^="lovasiri-"],[class*="powerkits" i],[id^="hub-"],[id^="127hub-"],[class*="127hub-" i]';
  const EXCLUDE = 'script,style,noscript,textarea,pre,code,[contenteditable="true"],[contenteditable=""],[role="textbox"],[data-testid*="chat-message"]';
  const BRAND_RE = /(?:BUNDLEE\s*AI|Bundlee\s*AI|BUNDLEE|Bundlee)/i;
  const LEGACY_RE = /Lovable\s+AI|127\s*HUB|127HUBAI|White\s+Lab(?:l)?e\s+of\s+127|PowerKits|Lovable\s+Evolution|LAST\s+ZONE|BUNDLEE\s*AI|Bundlee\s*AI|Manage\s+by\s+BUNDLEE\s*AI|Managed\s+by\s+BUNDLEE\s*AI|WhatsApp\s+Admin|WhatsApp\s+Support|CONTACT\s+ADMIN|TELEGRAM|MAIN\s+CHANNEL|JOIN\s+CHANNEL|Recharge\s+Key/i;
  const REPLACEMENTS = [
    [/Lovable\s+AI/gi,'FoxGEN Pro'],
    [/White\s+Lab(?:l)?e\s+of\s+127\s*HUB\s*AI/gi,'FoxGEN Pro'],
    [/127\s*HUB\s*AI/gi,'FoxGEN Pro'],
    [/127HUBAI/gi,'FoxGEN Pro'],
    [/127\s*HUB/gi,'FoxGEN Pro'],
    [/Lovable\s+PowerKits/gi,'FoxGEN Pro'],
    [/PowerKits/gi,'FoxGEN Pro'],
    [/Lovable\s+Evolution/gi,'FoxGEN Pro'],
    [/Last\s+Zone/gi,'FoxGEN Pro'],
    [/Manage\s+by\s+BUNDLEE\s*AI\s*[·•]?\s*BUNDLEE\s*AI/gi,'Managed by FoxGEN Pro'],
    [/Managed\s+by\s+BUNDLEE\s*AI\s*[·•]?\s*BUNDLEE\s*AI/gi,'Managed by FoxGEN Pro'],
    [/Manage\s+by\s+BUNDLEE\s*AI/gi,'Managed by FoxGEN Pro'],
    [/Managed\s+by\s+BUNDLEE\s*AI/gi,'Managed by FoxGEN Pro'],
    [/BUNDLEE\s*AI/gi,'FoxGEN Pro'],
    [/Bundlee\s*AI/gi,'FoxGEN Pro'],
    [/Switch\s+karne\s+se\s+pool\s+se\s+fresh\s+credentials\s+fetch\s+ho\s+kar\s+automatic\s+login\s+ho\s+jayega\.?/gi,
      'Switching fetches fresh credentials from the pool and signs you in automatically.'],
    [/Kripya\s+thodi\s+der\s+baad\s+try\s+karein\s+ya\s+admin\s+se\s+contact\s+karein\.?/gi,
      'Please try again later.'],
    [/Account\s+pool\s+me\s+filhal\s+koi\s+account\s+free\s+nahi\s+hai\.?\s*Kripya\s+thodi\s+der\s+baad\s+try\s+karein\s+ya\s+admin\s+se\s+contact\s+karein\.?/gi,
      'No account is currently available in the pool. Please try again later.'],
    [/CONTACT\s+ADMIN\s*\(ADMIN\)/gi,''],
    [/CONTACT\s+ADMIN/gi,''],
    [/WHATSAPP\s+ADMIN/gi,''],
    [/WHATSAPP\s+SUPPORT/gi,''],
    [/MAIN\s+CHANNEL/gi,''],
    [/JOIN\s+CHANNEL/gi,''],
    [/TELEGRAM/gi,''],
    [/Recharge\s+Key/gi,'']
  ];

  const isElement = n => n && n.nodeType === 1;
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  const isOwnUI = el => !!(isElement(el) && (el.matches?.(OWN_UI) || el.closest?.(OWN_UI)));
  const isExcluded = el => !!(isElement(el) && el.closest?.(EXCLUDE));
  const buttonLabelRE = /^(?:contact\s+admin(?:\s*\(admin\))?|whatsapp\s+(?:admin|support)|contact\s+support|main\s+channel|join\s+channel|telegram|recharge\s+(?:key|your\s+key|credits?))$/i;
  const footerRE = /manage(?:d)?\s+by\s+bundlee\s*ai/i;
  // Exact sender badge patch. This badge is often rendered outside extension UI roots.
  const senderRE = /\bSEND\s+BY\s+127\s*HUB\s*AI\b/gi;
  const externalSupportRE = /^(?:https?:\/\/)?(?:www\.)?(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me|telegram\.org)(?:[\/:?#]|$)/i;

  function replaceText(value) {
    let out = String(value || '');
    for (const [pattern, to] of REPLACEMENTS) out = out.replace(pattern, to);
    return out;
  }

  function hideControl(el) {
    if (!isElement(el)) return;
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.setAttribute('aria-hidden', 'true');
    if ('disabled' in el) {
      try { el.disabled = true; } catch (_) {}
    }
    if (el.matches?.('a[href]')) {
      el.removeAttribute('href');
      el.removeAttribute('target');
      el.removeAttribute('rel');
    }
    el.dataset.lovableHidden = '1';
  }

  function neutralizeLink(el) {
    if (!el?.matches?.('a[href]')) return;
    el.removeAttribute('href');
    el.removeAttribute('target');
    el.removeAttribute('rel');
    el.style.setProperty('cursor', 'default', 'important');
    el.addEventListener('click', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
    }, true);
  }

  function patchTextNode(node) {
    const parent = node?.parentElement;
    if (!parent) return;
    const before = node.nodeValue;
    if (!before) return;
    // Fix only the exact noneditable sender badge, including truncated previews.
    // Do not alter saved messages, text inputs, code, or arbitrary 127HUB references.
    if (!parent.closest?.('script,style,noscript,textarea,pre,code,[contenteditable],[role="textbox"]') && senderRE.test(before)) {
      const label = before.replace(senderRE, 'SEND BY FOXGEN PRO');
      if (label !== before) node.nodeValue = label;
      return;
    }
    if (isExcluded(parent) || !LEGACY_RE.test(before)) return;
    if (!isOwnUI(parent) && !footerRE.test(before) && !BRAND_RE.test(before)) return;
    const after = replaceText(before).replace(/\bv?(?:40\.5|45\.5)\b/g, '5.40');
    if (after !== before) node.nodeValue = after;
  }

  function patchElement(el) {
    if (!isElement(el)) return;

    const text = clean(el.textContent || el.getAttribute?.('aria-label') || el.getAttribute?.('title'));
    const own = isOwnUI(el);

    if (el.matches?.('.qlLm-logo,#qlL-license-modal .qlLm-logo,[class*="logo" i]') && own) {
      if (!el.querySelector('img[data-lovable-logo="1"]')) {
        const img = document.createElement('img');
        img.dataset.lovableLogo = '1';
        img.src = LOGO;
        img.alt = 'FoxGEN Pro';
        img.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain';
        el.replaceChildren(img);
      }
    }

    for (const attr of ['title','alt','aria-label','data-tooltip','data-title','data-original-title','placeholder']) {
      if (el.hasAttribute?.(attr)) {
        const before = el.getAttribute(attr) || '';
        // The exact sender badge also occurs in title/aria-label attributes.
        if (attr !== 'placeholder' && senderRE.test(before)) {
          const corrected = before.replace(senderRE, 'SEND BY FOXGEN PRO');
          if (corrected !== before) el.setAttribute(attr, corrected);
        } else if (LEGACY_RE.test(before) || BRAND_RE.test(before) || footerRE.test(before)) {
          const after = replaceText(before).trim();
          if (after && after !== before) el.setAttribute(attr, after);
        }
      }
    }

    if (!own) return;

    // Hide unwanted external support/channel anchors before users can click them.
    // Do not touch normal editor, GitHub, API, or other functional links.
    if (el.matches?.('a[href]')) {
      const href = (el.getAttribute('href') || '').trim();
      if (externalSupportRE.test(href)) { hideControl(el); return; }
    }

    if (buttonLabelRE.test(text)) {
      const target = el.closest?.('a,button,[role="button"],div,span') || el;
      hideControl(target);
      return;
    }

    if (footerRE.test(text)) {
      const after = replaceText(text).trim() || 'Managed by FoxGEN Pro';
      if (el.childNodes.length === 1 && el.firstChild?.nodeType === 3) el.textContent = after;
      neutralizeLink(el.closest?.('a[href]') || (el.matches?.('a[href]') ? el : null));
    }

    if (BRAND_RE.test(text)) {
      const after = replaceText(text).trim();
      if (after && el.childNodes.length === 1 && el.firstChild?.nodeType === 3) el.textContent = after;
    }
  }

  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) { patchTextNode(root); return; }
    if (isElement(root)) patchElement(root);
    if (!root.querySelectorAll) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) patchTextNode(walker.currentNode);

    root.querySelectorAll('a[href],button,[role="button"],span,strong,b,div,[title],[alt],[aria-label],[data-tooltip],[data-title],[data-original-title],input[placeholder],textarea[placeholder],.qlLm-logo,[class*="logo" i]').forEach(patchElement);
  }

  function onClick(event) {
    const path = event.composedPath?.() || [event.target];
    const target = path.find(el => isElement(el) && el.matches?.('a,button,[role="button"]'));
    if (!target) return;
    const label = clean(target.textContent || target.getAttribute?.('aria-label') || target.getAttribute?.('title'));
    if (buttonLabelRE.test(label)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      hideControl(target.closest?.('a,button,[role="button"],div,span') || target);
      return;
    }
    const link = target.closest?.('a[href]');
    if (link && /wa\.me|api\.whatsapp\.com|t\.me|telegram\./i.test(link.href)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      hideControl(link);
    }
  }

  function start() {
    if (!document.documentElement) return;
    scan(document.documentElement);
    const obs = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') patchTextNode(record.target);
        else if (record.type === 'attributes') patchElement(record.target);
        else for (const node of record.addedNodes) scan(node);
      }
    });
    obs.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['href','title','alt','aria-label','data-tooltip','data-title','data-original-title','placeholder']
    });
    setInterval(() => scan(document.documentElement), 1500);
  }

  window.addEventListener('click', onClick, true);
  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
