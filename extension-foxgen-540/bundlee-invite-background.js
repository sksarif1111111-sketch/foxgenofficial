/* LOVABLE AI Increase Limit invite opener (v4).
 * Never updates/reloads/closes the source tab. Never reads or stores password,
 * email, session cookie values, or any browser account state. It only opens
 * a user-provided Lovable project invite URL in a separate tab, after a session
 * cookie signal or conservative timeout. Acceptance is always manual.
 */
(() => {
  'use strict';
  const P = '__bundlee_invite_v4_';
  const ALARM = 'bundlee_invite_v4_';
  const TTL = 5 * 60 * 1000;
  const FAST_SETTLE = 15000;
  const FALLBACK = 38000;
  const startedTimers = new Map();
  const invite = raw => {
    try {
      const u = new URL(String(raw || '').trim());
      return u.protocol === 'https:' &&
        ['lovable.dev', 'www.lovable.dev'].includes(u.hostname.toLowerCase()) &&
        /^\/projects\/[^/?#\s]+/.test(u.pathname) ? u.href : null;
    } catch { return null; }
  };
  const validTab = url => /^https:\/\/(?:[a-z0-9-]+\.)*lovable\.dev(?:[/?#]|$)/i.test(String(url || ''));
  const key = id => P + id;
  const alarmName = id => ALARM + id;
  async function read(id) {
    const row = await chrome.storage.session.get(key(id));
    const item = row[key(id)];
    if (!item) return null;
    if (!invite(item.url) || typeof item.time !== 'number' ||
        Date.now() - item.time > TTL || item.time > Date.now() + 30000) {
      await chrome.storage.session.remove(key(id));
      return null;
    }
    return item;
  }
  async function clear(id) {
    if (startedTimers.has(id)) { clearTimeout(startedTimers.get(id)); startedTimers.delete(id); }
    await chrome.storage.session.remove(key(id));
    try { await chrome.alarms.clear(alarmName(id)); } catch (_) {}
  }
  async function openInvite(id) {
    const item = await read(id);
    if (!item || item.opening) return;
    const elapsed = Date.now() - item.time;
    if (elapsed < FAST_SETTLE) return;
    let tab;
    try { tab = await chrome.tabs.get(id); } catch { await clear(id); return; }
    // Respect user's decision to leave Lovable before navigation.
    if (!validTab(tab.url || tab.pendingUrl)) { await clear(id); return; }
    await chrome.storage.session.set({[key(id)]: {...item, opening: true}});
    try {
      // CRITICAL: no chrome.tabs.update() or location.assign() to the login tab.
      await chrome.tabs.create({url: item.url, active: true, openerTabId: id});
      await clear(id);
    } catch (_) {
      await clear(id); // Never retry repeatedly and flood tabs.
    }
  }
  function scheduleOnce(id, delay) {
    if (startedTimers.has(id)) clearTimeout(startedTimers.get(id));
    startedTimers.set(id, setTimeout(() => {
      startedTimers.delete(id);
      openInvite(id).catch(() => {});
    }, delay));
  }
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (msg?.type !== 'LOVABLE_INVITE_V4_ARM') return false;
    const id = sender?.tab?.id;
    const url = invite(msg.url);
    if (!Number.isInteger(id) || !validTab(sender.url) || !url) {
      reply({ok: false}); return false;
    }
    (async () => {
      await chrome.storage.session.set({[key(id)]: {url, time: Date.now(), opening: false}});
      // Chrome alarms survive service-worker sleep (unlike a bare timer).
      await chrome.alarms.create(alarmName(id), {when: Date.now() + FALLBACK});
    })().then(() => reply({ok: true})).catch(() => reply({ok: false}));
    return true;
  });
  chrome.cookies.onChanged.addListener(change => {
    if (change.removed ||
        !/^(lovable-session-id-v2(?:\.\d+)?|__session|sb-[a-z0-9-]+-auth-token)$/i.test(change.cookie?.name || '') ||
        !/(?:^|\.)lovable\.dev$/i.test(String(change.cookie?.domain || '').replace(/^\./, ''))) return;
    (async () => {
      const data = await chrome.storage.session.get(null);
      for (const [k,item] of Object.entries(data)) {
        if (!k.startsWith(P) || !item || item.opening) continue;
        const id = Number(k.slice(P.length));
        if (!Number.isInteger(id) || !invite(item.url) || Date.now()-item.time > TTL) continue;
        // This is an advisory signal, NOT permission to redirect the login tab.
        // Allow both the new session and original login code time to settle.
        const wait = Math.max(FAST_SETTLE, item.time + FAST_SETTLE - Date.now());
        scheduleOnce(id, wait);
      }
    })().catch(() => {});
  });
  chrome.alarms.onAlarm.addListener(alarm => {
    if (!alarm?.name?.startsWith(ALARM)) return;
    const id = Number(alarm.name.slice(ALARM.length));
    if (Number.isInteger(id)) openInvite(id).catch(() => {});
  });
  chrome.tabs.onRemoved.addListener(id => {
    if (startedTimers.has(id)) {clearTimeout(startedTimers.get(id));startedTimers.delete(id);}
    chrome.storage.session.remove(key(id)).catch(() => {});
    chrome.alarms.clear(alarmName(id)).catch(() => {});
  });
})();
