/* FoxGEN Pro — mandatory WhatsApp Channel + Community join gate, plus official links */
(function () {
  "use strict";
  if (window.__foxgenJoinGate) return;
  window.__foxgenJoinGate = true;

  var KEY = "foxgen_join_v1";
  var REQUIRED = [
    { id: "wa_channel", label: "📱 Follow WhatsApp Channel", url: "https://whatsapp.com/channel/0029VbDK6SHKLaHn5vxOQa0v" },
    { id: "wa_community", label: "👥 Join WhatsApp Community", url: "https://chat.whatsapp.com/KvOy0Fw8IWL0NGwc5zVTxf" }
  ];
  var LINKS = [
    ["📢 Telegram Channel", "https://t.me/foxgenofficial"],
    ["💬 Telegram Group", "https://t.me/lovableunlimitedfoxgen"],
    ["📘 Facebook", "https://www.facebook.com/share/18PfyFqPJ3/"],
    ["▶️ YouTube", "https://youtube.com/@mirza-p7x6s"],
    ["🌐 Official Website", "https://nextgen.lovableunlimitedc.workers.dev"],
    ["💬 WhatsApp Support", "https://wa.me/917699355860"]
  ];

  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text) e.textContent = text;
    return e;
  }

  function linkBtn(label, url, css) {
    var a = el("a", css, label);
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    return a;
  }

  var BTN = "display:block;padding:12px 14px;border-radius:12px;text-decoration:none;font-weight:700;font-size:14px;text-align:left;margin:8px 0;transition:.2s;";

  function showGate(state) {
    if (document.getElementById("foxgen-join-gate")) return;
    var ov = el("div", "position:fixed;inset:0;z-index:2147483647;background:rgba(4,10,24,.88);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;");
    ov.id = "foxgen-join-gate";
    var card = el("div", "width:min(440px,92vw);max-height:90vh;overflow:auto;background:linear-gradient(160deg,#0b1730,#07101f);border:1px solid rgba(34,211,238,.35);border-radius:20px;padding:24px;color:#e2f3ff;box-shadow:0 0 60px -10px rgba(34,211,238,.5);");
    card.appendChild(el("div", "font-size:22px;font-weight:900;color:#22d3ee;margin-bottom:6px;", "🦊⚡ FoxGEN PRO"));
    card.appendChild(el("div", "font-size:13px;color:#9fb6cc;margin-bottom:14px;line-height:1.5;", "To start the extension, you must follow our WhatsApp Channel and join our WhatsApp Community."));

    var cont = el("button", "width:100%;margin-top:14px;padding:13px;border:0;border-radius:12px;font-weight:900;font-size:14px;letter-spacing:.05em;cursor:not-allowed;background:#1e293b;color:#64748b;", "START EXTENSION");
    function refresh() {
      var ok = REQUIRED.every(function (r) { return state[r.id]; });
      cont.disabled = !ok;
      cont.style.cursor = ok ? "pointer" : "not-allowed";
      cont.style.background = ok ? "linear-gradient(90deg,#06b6d4,#3b82f6)" : "#1e293b";
      cont.style.color = ok ? "#fff" : "#64748b";
    }

    REQUIRED.forEach(function (r) {
      var a = linkBtn("", r.url, BTN + "border:1px solid rgba(34,211,238,.4);background:rgba(34,211,238,.08);color:#e2f3ff;");
      function paint() { a.textContent = (state[r.id] ? "✅ " : "") + r.label + (state[r.id] ? "" : "  (required)"); }
      paint();
      a.addEventListener("click", function () {
        state[r.id] = true;
        chrome.storage.local.set((function (o) { o[KEY] = state; return o; })({}));
        paint(); refresh();
      });
      card.appendChild(a);
    });

    card.appendChild(el("div", "font-size:12px;font-weight:800;color:#22d3ee;margin:16px 0 4px;letter-spacing:.1em;", "OFFICIAL LINKS"));
    LINKS.forEach(function (l) {
      card.appendChild(linkBtn(l[0], l[1], BTN + "padding:9px 12px;font-size:13px;margin:6px 0;border:1px solid rgba(148,163,184,.2);background:rgba(255,255,255,.03);color:#cbd5e1;"));
    });

    cont.addEventListener("click", function () {
      if (cont.disabled) return;
      state.done = true;
      chrome.storage.local.set((function (o) { o[KEY] = state; return o; })({}), function () { location.reload(); });
    });
    card.appendChild(cont);
    refresh();
    ov.appendChild(card);
    (document.body || document.documentElement).appendChild(ov);
  }

  chrome.storage.local.get(KEY, function (r) {
    var state = (r && r[KEY]) || {};
    if (!state.done) {
      if (document.body) showGate(state);
      else document.addEventListener("DOMContentLoaded", function () { showGate(state); });
    }
  });
})();
