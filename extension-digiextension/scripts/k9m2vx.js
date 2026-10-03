/**
 * Trivis service worker bridge
 * - License validate against trivis.lovable.app
 * - Heartbeat recheck (expire / ban / revoke → local kill)
 * - Inject freeze scripts ONLY when licensed
 * - Load original background logic via importScripts
 * Freeze script paths unchanged.
 */

const TRIVIS_API = "https://foxgenofficial.lovable.app/api/public/license/verify";
const KEY_RE = /^[A-Z0-9]{3,16}(?:-[A-Z0-9]{2,16}){1,5}$/i;
const TOKEN_KEY = "trivis_license_key";
const OK_KEY = "trivis_lic_ok";
const SESSION_KEY = "trivis_lic_session";
const NAME_KEY = "trivis_user_name";
const EXP_KEY = "trivis_lic_expires";
const DEVICE_KEY = "trivis_device_id";
const LAST_CHECK_KEY = "trivis_last_recheck";

const HEARTBEAT_ALARM = "trivis_license_heartbeat";
const HEARTBEAT_MINUTES = 1;

const FREEZE_SCRIPTS_MAIN = ["scripts/content/z3hfc0.js"];
const FREEZE_SCRIPTS_ISOLATED = [
  "scripts/shared/a2m9kx.js",
  "scripts/shared/p5v0lc.js",
  "scripts/shared/j6y4bn.js",
  "scripts/content/r7wq1a.js"
];

function deviceId() {
  return new Promise((resolve) => {
    chrome.storage.local.get([DEVICE_KEY], (r) => {
      if (r[DEVICE_KEY]) return resolve(r[DEVICE_KEY]);
      let id = "tv_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      try {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        id =
          "tv_" +
          Array.from(arr)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
            .slice(0, 24);
      } catch (_) {}
      chrome.storage.local.set({ [DEVICE_KEY]: id }, () => resolve(id));
    });
  });
}

async function isLicensed() {
  const r = await chrome.storage.local.get([OK_KEY, TOKEN_KEY, EXP_KEY]);
  if (!(r[OK_KEY] === true || r[OK_KEY] === "1") || !r[TOKEN_KEY]) return false;
  if (r[EXP_KEY]) {
    const t = Date.parse(r[EXP_KEY]);
    if (t && Date.now() > t) {
      await clearLicense();
      return false;
    }
  }
  return true;
}

async function clearLicense() {
  await chrome.storage.local.remove([
    TOKEN_KEY,
    OK_KEY,
    SESSION_KEY,
    NAME_KEY,
    EXP_KEY,
    LAST_CHECK_KEY
  ]);
}

/**
 * Server recheck using stored key + device.
 * Persistent login stays until server says invalid OR local expiry.
 * Network fail → keep current session (no false logout offline).
 */
async function revalidateFromServer() {
  const r = await chrome.storage.local.get([TOKEN_KEY, NAME_KEY, OK_KEY, EXP_KEY]);
  if (!(r[OK_KEY] === true || r[OK_KEY] === "1") || !r[TOKEN_KEY]) {
    return { ok: false, reason: "no_session" };
  }

  // Local expiry first
  if (r[EXP_KEY]) {
    const t = Date.parse(r[EXP_KEY]);
    if (t && Date.now() > t) {
      await clearLicense();
      return { ok: false, reason: "expired" };
    }
  }

  const key = String(r[TOKEN_KEY]).trim().toUpperCase();
  if (!KEY_RE.test(key)) {
    await clearLicense();
    return { ok: false, reason: "bad_key" };
  }

  try {
    const dev = await deviceId();
    const name = String(r[NAME_KEY] || "DG Extension User").slice(0, 64);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    let resp;
    try {
      resp = await fetch(TRIVIS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: key, key, deviceId: dev, device_id: dev, name, recheck: true }),
        signal: ctrl.signal
      });
    } finally {
      clearTimeout(timer);
    }

    const data = await resp.json().catch(() => null);

    // Explicit invalid from server → kill session (ban / revoke / device limit)
    if (data && (data.ok === false || data.valid === false)) {
      await clearLicense();
      return {
        ok: false,
        reason: "revoked",
        error: data.error || data.message || "License revoked"
      };
    }

    // HTTP hard fail that clearly means banned (401/403)
    if (resp.status === 401 || resp.status === 403) {
      await clearLicense();
      return { ok: false, reason: "revoked", error: "License revoked" };
    }

    // Network / 5xx / parse fail → keep session (offline safe)
    if (!resp.ok || !data) {
      await chrome.storage.local.set({ [LAST_CHECK_KEY]: Date.now() });
      return { ok: true, reason: "network_keep" };
    }

    // Server OK — refresh expiry / name if provided
    const patch = { [LAST_CHECK_KEY]: Date.now(), [OK_KEY]: true };
    if (data.expires_at) patch[EXP_KEY] = data.expires_at;
    if (data.user_name) patch[NAME_KEY] = data.user_name;
    if (data.session || data.session_id || data.token) patch[SESSION_KEY] = data.session || data.session_id || data.token;
    await chrome.storage.local.set(patch);

    return {
      ok: true,
      reason: "revalidated",
      expires_at: data.expires_at || r[EXP_KEY] || null,
      name: data.user_name || r[NAME_KEY] || null
    };
  } catch (_) {
    // Offline / abort → keep session
    return { ok: true, reason: "network_keep" };
  }
}

function isLovableProjectUrl(url) {
  try {
    // Only project workspace — never dashboard/home (freeze breaks project list + slows SPA)
    return /https:\/\/([a-z0-9-]+\.)?lovable\.dev\/projects\/[a-zA-Z0-9_-]+/i.test(String(url || ""));
  } catch (_) {
    return false;
  }
}

async function injectFreezeIntoTab(tabId, tabUrl) {
  try {
    if (tabUrl && !isLovableProjectUrl(tabUrl)) return;
    if (!tabUrl) {
      try {
        const t = await chrome.tabs.get(tabId);
        if (!t || !isLovableProjectUrl(t.url || "")) return;
      } catch (_) {
        return;
      }
    }
  } catch (_) {
    return;
  }

  // Delay so project shell/APIs can load first
  await new Promise((r) => setTimeout(r, 2500));

  try {
    for (const file of FREEZE_SCRIPTS_MAIN) {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: false },
        files: [file],
        world: "MAIN"
      });
    }
  } catch (_) {}
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: FREEZE_SCRIPTS_ISOLATED,
      world: "ISOLATED"
    });
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      files: ["scripts/content/zokys-label-main.js"],
      world: "MAIN"
    });
  } catch (_) {}
  } catch (_) {}
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: false },
      world: "MAIN",
      func: function () {
        try {
          window.__TRIVIS_LICENSED__ = true;
          window.__ZOKYS_LICENSED__ = true;
        } catch (e) {}
      }
    });
  } catch (_) {}
}

async function injectFreezeAllLovableTabs() {
  const ok = await isLicensed();
  if (!ok) return;
  try {
    const tabs = await chrome.tabs.query({
      url: ["https://lovable.dev/projects/*", "https://*.lovable.dev/projects/*"]
    });
    for (const tab of tabs) {
      if (tab.id && isLovableProjectUrl(tab.url || "")) {
        await injectFreezeIntoTab(tab.id, tab.url);
      }
    }
  } catch (_) {}
}

function scheduleHeartbeat() {
  try {
    chrome.alarms.create(HEARTBEAT_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: HEARTBEAT_MINUTES
    });
  } catch (_) {}
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return false;

  if (msg.type === "TRIVIS_VALIDATE") {
    (async () => {
      try {
        const key = String(msg.key || "").trim().toUpperCase();
        const name = String(msg.name || "").trim().slice(0, 64);
        const dev = await deviceId();
        if (!KEY_RE.test(key)) {
          sendResponse({ ok: false, error: "Invalid license key format" });
          return;
        }
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        let resp;
        try {
          resp = await fetch(TRIVIS_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ licenseKey: key, key, deviceId: dev, device_id: dev, name }),
            signal: ctrl.signal
          });
        } finally {
          clearTimeout(t);
        }
        const data = await resp.json().catch(() => null);
        if (!data || !(data.ok || data.valid)) {
          sendResponse({
            ok: false,
            error: (data && (data.error || data.message)) || "HTTP " + resp.status
          });
          return;
        }
        const patch = {
          [TOKEN_KEY]: key,
          [OK_KEY]: true,
          [SESSION_KEY]: data.session || data.session_id || data.token || "sess_" + Date.now(),
          [NAME_KEY]: data.user_name || name || "DG Extension User",
          [LAST_CHECK_KEY]: Date.now()
        };
        if (data.expires_at) patch[EXP_KEY] = data.expires_at;
        await chrome.storage.local.set(patch);
        await injectFreezeAllLovableTabs();
        scheduleHeartbeat();
        sendResponse({
          ok: true,
          session: patch[SESSION_KEY],
          expires_at: data.expires_at || null,
          user_name: patch[NAME_KEY],
          name: patch[NAME_KEY],
          key
        });
      } catch (e) {
        sendResponse({
          ok: false,
          error: e && e.name === "AbortError" ? "Timeout" : "Network error"
        });
      }
    })();
    return true;
  }

  // Fast local status — persistent login, no key prompt
  if (msg.type === "TRIVIS_STATUS") {
    (async () => {
      // Optional force server recheck
      if (msg.recheck) {
        await revalidateFromServer();
      }
      const ok = await isLicensed();
      const r = await chrome.storage.local.get([TOKEN_KEY, NAME_KEY, EXP_KEY]);
      sendResponse({
        ok,
        key: r[TOKEN_KEY] || null,
        name: r[NAME_KEY] || null,
        expires_at: r[EXP_KEY] || null
      });
    })();
    return true;
  }

  // Explicit server recheck (UI / manual)
  if (msg.type === "TRIVIS_RECHECK") {
    (async () => {
      const result = await revalidateFromServer();
      const r = await chrome.storage.local.get([TOKEN_KEY, NAME_KEY, EXP_KEY]);
      sendResponse({
        ok: result.ok && (await isLicensed()),
        reason: result.reason || null,
        error: result.error || null,
        key: r[TOKEN_KEY] || null,
        name: r[NAME_KEY] || null,
        expires_at: r[EXP_KEY] || null
      });
    })();
    return true;
  }

  if (msg.type === "TRIVIS_LOGOUT") {
    clearLicense().then(() => sendResponse({ ok: true }));
    return true;
  }

  return false;
});

// Heartbeat alarm — only kills on expire / ban / revoke
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== HEARTBEAT_ALARM) return;
  revalidateFromServer().then((res) => {
    if (res && res.ok === false && (res.reason === "revoked" || res.reason === "expired")) {
      // session cleared; next UI poll will show gate
    }
  });
});

// When user opens / navigates Lovable, inject freeze if licensed
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete" || !tab.url) return;
  // Dashboard: no freeze inject (blank projects / lag)
  if (!isLovableProjectUrl(tab.url)) return;
  isLicensed().then((ok) => {
    if (ok) injectFreezeIntoTab(tabId, tab.url);
  });
});

function boot() {
  scheduleHeartbeat();
  isLicensed().then((ok) => {
    if (ok) {
      injectFreezeAllLovableTabs();
      // soft recheck soon after boot (ban catch without waiting full period)
      setTimeout(() => {
        revalidateFromServer();
      }, 3000);
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  boot();
});
chrome.runtime.onStartup.addListener(() => {
  boot();
});

// SW wake — schedule + soft check
boot();

// Load original background (obfuscated) — freeze / panel support logic
try {
  importScripts("xoqoebay2.js");
} catch (e) {
  console.warn("[DG Extension] original background import failed", e);
}
