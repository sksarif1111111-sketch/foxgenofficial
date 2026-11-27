/* Lovable AI v40.5 method selector: exactly one active send method.
   GitHub Mode uses the added GitHub engine; Fix Error keeps the native v40.5 path.
   No original v40.5 scripts are modified. */
(() => {
  'use strict';
  if (window.__bundleeGitLauncherInstalled || window.top !== window) return;
  window.__bundleeGitLauncherInstalled = true;

  const GIT = 'git_mode';
  const FIX = 'fix_error';
  const STATE = 'bundleeGitModeActive';
  const SOURCE = 'LOVABLE_GIT_MODE_SELECTION';
  const REPLY = 'LOVABLE_GIT_MODE_STATE';
  let mode = FIX;
  try { if (sessionStorage.getItem(STATE) === '1') mode = GIT; } catch (_) {}
  let busy = false;

  function gitApiReady() {
    const api = window.__127hubGitMode;
    return !!(api && typeof api.openSettings === 'function' && typeof api.previewAndConfirm === 'function');
  }
  function openGitSettings() {
    if (gitApiReady()) window.__127hubGitMode.openSettings();
    else console.warn('[LOVABLE AI] GitHub Mode is loading; refresh the Lovable editor if it does not open.');
  }
  function applyRouting() {
    const git = mode === GIT;
    // Keep the existing Fix Error interception available, but OFF while GitHub is selected.
    window.__lovasiri_native_intercept = !git;
    window.__lovasiri_native_method = git ? GIT : FIX;
    window.__lovasiri_native_intent = git ? GIT : FIX;
    document.documentElement?.setAttribute('data-lovasiri-method', mode);
    window.postMessage({ type: 'lovasiriNativeIntercept', enabled: !git, method: mode, intent: mode }, '*');
  }
  function entryFor(area) { return area.querySelector('[data-bundlee-github-entry="1"]'); }

  // The native v40.5 panel sometimes redraws its red checked badge after a mode
  // change. Scope visual states to the shared selection on the method container,
  // including when the native panel lives inside an open shadow root.
  const EXCLUSIVE_CSS = `
    .qlL-cfg-methods[data-bundlee-active="git_mode"] .qlL-cfg-method:not([data-bundlee-github-entry]),
    .qlL-cfg-methods[data-bundlee-active="fix_error"] .qlL-cfg-method[data-bundlee-github-entry] {
      border-color:rgba(255,255,255,.12)!important;
      background:linear-gradient(135deg,rgba(255,255,255,.025),rgba(255,255,255,.005))!important;
      box-shadow:none!important;
    }
    .qlL-cfg-methods[data-bundlee-active="git_mode"] .qlL-cfg-method:not([data-bundlee-github-entry])::before,
    .qlL-cfg-methods[data-bundlee-active="fix_error"] .qlL-cfg-method[data-bundlee-github-entry]::before {
      opacity:0!important;
    }
    .qlL-cfg-methods[data-bundlee-active="git_mode"] .qlL-cfg-method:not([data-bundlee-github-entry]) .qlL-cfg-method-check,
    .qlL-cfg-methods[data-bundlee-active="fix_error"] .qlL-cfg-method[data-bundlee-github-entry] .qlL-cfg-method-check {
      background:transparent!important;
      color:transparent!important;
      border:1.5px solid rgba(255,255,255,.22)!important;
      box-shadow:none!important;
      transform:scale(.85)!important;
    }
    .qlL-cfg-methods[data-bundlee-active="git_mode"] .qlL-cfg-method:not([data-bundlee-github-entry]) .qlL-cfg-method-num {
      background:rgba(255,255,255,.06)!important;
      border-color:rgba(255,255,255,.12)!important;
      color:rgba(255,255,255,.72)!important;
      box-shadow:none!important;
    }
    .qlL-cfg-methods[data-bundlee-active="fix_error"] .qlL-cfg-method[data-bundlee-github-entry] .qlL-cfg-method-num {
      background:#124757!important;
      border-color:rgba(255,255,255,.12)!important;
      color:#69dcfb!important;
      box-shadow:none!important;
    }
  `;
  function installStyles(root) {
    if (root.querySelector?.('style[data-bundlee-exclusive-methods]')) return;
    const style = document.createElement('style');
    style.dataset.bundleeExclusiveMethods = '1';
    style.textContent = EXCLUSIVE_CSS;
    if (root.nodeType === 9) (root.head || root.documentElement).appendChild(style);
    else root.appendChild(style);
  }
  function paint(root) {
    for (const area of root?.querySelectorAll?.('.qlL-cfg-methods') || []) {
      if (area.dataset.bundleeActive !== mode) area.dataset.bundleeActive = mode;
      for (const label of area.querySelectorAll('.qlL-cfg-method')) {
        const git = label.matches('[data-bundlee-github-entry="1"]');
        const checked = git ? mode === GIT : mode === FIX;
        const radio = label.querySelector('input[name="qlSendMethod"]');
        if (radio && radio.checked !== checked) radio.checked = checked;
        label.classList.toggle('is-checked', checked);
        if (label.getAttribute('aria-checked') !== String(checked)) label.setAttribute('aria-checked', String(checked));
      }
      const git = entryFor(area);
      if (git) {
        const selected = mode === GIT;
        const borderColor = selected ? '#25d1b1' : '#267d97';
        const shadow = selected ? '0 0 0 1px rgba(37,209,177,.18)' : 'none';
        if (git.style.borderColor !== borderColor) git.style.borderColor = borderColor;
        if (git.style.boxShadow !== shadow) git.style.boxShadow = shadow;
        const status = git.querySelector('[data-bundlee-git-status]');
        const text = selected ? 'Selected — GitHub Mode active' : 'Click to select GitHub Mode';
        if (status && status.textContent !== text) status.textContent = text;
      }
    }
  }
  const roots = new Set();
  function refreshAll() { for (const root of roots) paint(root); }

  function select(next, persist = true) {
    if (next !== GIT && next !== FIX) return;
    mode = next;
    try {
      if (next === GIT) sessionStorage.setItem(STATE, '1');
      else sessionStorage.removeItem(STATE);
    } catch (_) {}
    applyRouting();
    refreshAll();
    if (persist) window.postMessage({ source: SOURCE, mode }, '*');
  }

  function insertGitEntry(root) {
    for (const area of root?.querySelectorAll?.('.qlL-cfg-methods') || []) {
      if (entryFor(area)) continue;
      const option = document.createElement('label');
      option.className = 'qlL-cfg-method bundlee-github-method';
      option.dataset.bundleeGithubEntry = '1';
      option.dataset.method = GIT;
      option.setAttribute('role', 'radio');
      option.setAttribute('aria-label', 'GitHub Mode (BYOK)');
      option.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;padding:13px 14px;margin-top:10px;border:1px solid #267d97;border-radius:12px;background:linear-gradient(100deg,#0d202d,#101527);color:#f7fafc;text-align:left;font:600 13px system-ui,sans-serif;cursor:pointer;box-sizing:border-box;position:relative';
      option.innerHTML = '<input type="radio" name="qlSendMethod" value="git_mode" style="position:absolute;opacity:0;pointer-events:none" aria-label="GitHub Mode">'
        + '<span class="qlL-cfg-method-num" style="display:flex;align-items:center;justify-content:center;width:33px;height:33px;flex:none;border-radius:10px;background:#124757;color:#69dcfb;font-weight:700">02</span>'
        + '<span class="qlL-cfg-method-info" style="flex:1"><b style="display:block;font-size:14px">GitHub Mode (BYOK)</b><span data-bundlee-git-status style="display:block;color:#9ba9b7;margin-top:3px;font-size:11px">Click to select GitHub Mode</span></span>'
        + '<span class="qlL-cfg-method-check" style="display:flex;align-items:center;justify-content:center;width:25px;height:25px;border-radius:50%;font-weight:800">✓</span>';
      // Prevent v40 native method listeners treating this added option as Fix Error.
      option.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        select(GIT);
        openGitSettings();
      }, true);
      area.appendChild(option);
    }
    paint(root);
  }

  // An actual click on the native Fix Error option switches back to Fix Error.
  document.addEventListener('click', event => {
    const path = event.composedPath?.() || [event.target];
    const native = path.find(el => el?.matches?.('.qlL-cfg-method:not([data-bundlee-github-entry])'));
    if (native && (native.dataset.method === FIX || !native.dataset.method)) select(FIX);
  }, true);
  // Also handle radio activation by keyboard or a native change event.
  document.addEventListener('change', event => {
    const el = event.target;
    if (el?.matches?.('input[name="qlSendMethod"]') && el.value === FIX) select(FIX);
  }, true);

  function composer(target) {
    return target?.closest?.('form#chat-input,form[data-testid*="chat-input" i],form:has([data-testid*="chat-input" i])');
  }
  function promptFor(form) {
    const input = form?.querySelector('textarea,[contenteditable="true"],[role="textbox"],input[type="text"]');
    return String(input?.value || input?.innerText || '').trim();
  }
  async function submitGit(form) {
    if (mode !== GIT || busy) return;
    if (!gitApiReady()) { openGitSettings(); return; }
    const prompt = promptFor(form);
    if (!prompt) return;
    busy = true;
    try { await window.__127hubGitMode.previewAndConfirm(prompt, []); }
    catch (error) { console.error('[LOVABLE AI GitHub Mode]', error); }
    finally { busy = false; }
  }
  function maybeGitSubmit(event, form) {
    if (mode !== GIT || !form || !promptFor(form)) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    submitGit(form);
    return true;
  }
  document.addEventListener('submit', event => {
    if (mode !== GIT) return;
    const form = composer(event.target) || event.target;
    if (form?.matches?.('form')) maybeGitSubmit(event, form);
  }, true);
  document.addEventListener('keydown', event => {
    if (mode !== GIT || event.isComposing || event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    maybeGitSubmit(event, composer(event.target));
  }, true);
  document.addEventListener('click', event => {
    if (mode !== GIT) return;
    const button = event.target?.closest?.('button[type="submit"],input[type="submit"]');
    if (button) maybeGitSubmit(event, composer(button));
  }, true);

  // Keep the selected method in extension storage so the native and added UI agree.
  window.addEventListener('message', event => {
    if (event.source !== window || event.data?.source !== REPLY) return;
    if (event.data.mode === GIT || event.data.mode === FIX) select(event.data.mode, false);
  });
  // If native code tries to turn Fix Error on after GitHub was selected, leave it off.
  window.addEventListener('message', event => {
    if (event.source !== window || event.data?.type !== 'lovasiriNativeIntercept') return;
    if (mode === GIT && event.data.enabled === true) queueMicrotask(applyRouting);
  });

  const observed = new WeakSet();
  function scan(root) {
    if (!root || observed.has(root)) return;
    observed.add(root); roots.add(root);
    installStyles(root);
    let scheduled = false;
    const schedulePaint = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        insertGitEntry(root);
      });
    };
    const watcher = new MutationObserver(records => {
      let needsPaint = false;
      for (const record of records) {
        if (record.type === 'attributes') {
          if (record.target.closest?.('.qlL-cfg-methods')) needsPaint = true;
          continue;
        }
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.('.qlL-cfg-methods') || node.closest?.('.qlL-cfg-methods') || node.querySelector?.('.qlL-cfg-methods')) needsPaint = true;
          if (node.shadowRoot) scan(node.shadowRoot);
          node.querySelectorAll?.('*').forEach(el => { if (el.shadowRoot) scan(el.shadowRoot); });
        }
      }
      if (needsPaint) schedulePaint();
    });
    watcher.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'checked', 'aria-checked'] });
    insertGitEntry(root);
    root.querySelectorAll?.('*').forEach(el => { if (el.shadowRoot) scan(el.shadowRoot); });
  }
  function start() { scan(document); applyRouting(); }
  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
