/* Isolated-world bridge for GitHub Mode.
 * Patched to accept both legacy Bundlee message names and Lovable AI branding names.
 */
(() => {
  'use strict';
  if (globalThis.__bundleeGitBridgeInstalled || globalThis.__lovableGitBridgeInstalled) return;
  globalThis.__bundleeGitBridgeInstalled = true;
  globalThis.__lovableGitBridgeInstalled = true;

  const INBOUND = new Set(['BUNDLEE_GIT_PAGE_PAYLOAD', 'LOVABLE_GIT_PAGE_PAYLOAD']);
  const OUT = 'LOVABLE_GIT_EXTENSION_BRIDGE';
  const LEGACY_OUT = 'BUNDLEE_GIT_EXTENSION_BRIDGE';
  const MODE_SOURCES = new Set(['BUNDLEE_GIT_MODE_SELECTION', 'LOVABLE_GIT_MODE_SELECTION']);
  const MODE_STATE = 'LOVABLE_GIT_MODE_STATE';
  const LEGACY_MODE_STATE = 'BUNDLEE_GIT_MODE_STATE';
  const ALLOWED_KEY = /^(__127hub_git_config|__lovasiri_recovery_job_v31|__lovasiri_recovery_jobs_v32)$/;

  const postDual = payload => {
    window.postMessage({...payload, source: OUT}, '*');
    window.postMessage({...payload, source: LEGACY_OUT}, '*');
  };
  const postModeDual = mode => {
    window.postMessage({source: MODE_STATE, mode}, '*');
    window.postMessage({source: LEGACY_MODE_STATE, mode}, '*');
  };
  const reply = (id, result, err = null) => {
    postDual({id, ok: !err, result, ...(err ? {error: String(err)} : {})});
  };

  window.addEventListener('message', e => {
    if (e.source !== window || !e.data || !INBOUND.has(e.data.source)) return;
    const {id, type} = e.data;
    if (typeof id !== 'string' || id.length > 128 || !/^(hub_bg_|git_cfg_|git_cfg_init_|git_cfg_migrate_|job_)/.test(id)) return;
    (async () => {
      if (type === 'runtime.sendMessage') {
        const msg = e.data.message;
        if (!msg || typeof msg.action !== 'string' || !msg.action.startsWith('bundlee_git_')) throw new Error('Not a GitHub Mode action');
        const res = await chrome.runtime.sendMessage(msg);
        reply(id, res);
      } else if (type === 'storage.get') {
        const keys = e.data.keys;
        if (!Array.isArray(keys) || !keys.length || !keys.every(k => typeof k === 'string' && ALLOWED_KEY.test(k))) throw new Error('Unsupported GitHub storage key');
        reply(id, await chrome.storage.local.get(keys));
      } else if (type === 'storage.set') {
        const items = e.data.items;
        if (!items || typeof items !== 'object' || !Object.keys(items).length || !Object.keys(items).every(k => ALLOWED_KEY.test(k))) throw new Error('Unsupported GitHub storage key');
        await chrome.storage.local.set(items);
        reply(id, {ok: true});
      } else if (type === 'storage.remove') {
        const keys = e.data.keys;
        if (!Array.isArray(keys) || !keys.every(k => ALLOWED_KEY.test(k))) throw new Error('Unsupported GitHub storage key');
        await chrome.storage.local.remove(keys);
        reply(id, {ok: true});
      }
    })().catch(err => reply(id, null, err.message || String(err)));
  }, false);

  const validMode = mode => mode === 'git_mode' || mode === 'fix_error';
  window.addEventListener('message', e => {
    if (e.source !== window || !MODE_SOURCES.has(e.data?.source) || !validMode(e.data.mode)) return;
    chrome.storage.local.set({ql_send_method:e.data.mode}).catch(err => console.warn('[LOVABLE AI] Method persistence:', err));
  });

  chrome.storage.local.get(['ql_send_method']).then(store => {
    const mode = validMode(store.ql_send_method) ? store.ql_send_method : 'fix_error';
    postModeDual(mode);
  }).catch(() => {});

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.ql_send_method && validMode(changes.ql_send_method.newValue)) {
      postModeDual(changes.ql_send_method.newValue);
    }
    if (area === 'local' && changes.__127hub_git_config) {
      postDual({event:'storage.changed', changes:{__127hub_git_config:changes.__127hub_git_config}});
    }
  });
})();
