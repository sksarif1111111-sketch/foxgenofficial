/**
 * Real feature runners — Auto Approval + prompt inject actions.
 * Lightweight; no full-DOM walks every frame.
 */
(function () {
  "use strict";
  if (window.__zokysFeaturesReal__) return;
  window.__zokysFeaturesReal__ = true;

  var autoOn = false;
  try {
    chrome.storage.local.get(["trivis_auto_approve"], function (s) {
      autoOn = !!(s && s.trivis_auto_approve);
    });
    chrome.storage.onChanged.addListener(function (ch) {
      if (ch.trivis_auto_approve) autoOn = !!(ch.trivis_auto_approve.newValue);
    });
  } catch (_) {}

  function clickApproveButtons() {
    if (!autoOn) return;
    try {
      var btns = document.querySelectorAll("button, [role='button']");
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (b.closest && b.closest("#trivis-vx-root")) continue;
        var t = ((b.getAttribute("aria-label") || "") + " " + (b.textContent || "")).trim().toLowerCase();
        if (!t || t.length > 48) continue;
        if (
          /^(approve|allow|accept|confirm|continue|yes|apply|run|execute)$/i.test(t) ||
          /approve|allow changes|accept changes|confirm/i.test(t)
        ) {
          try {
            b.click();
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // Slow poll only on project pages
  if (/\/projects\//i.test(location.pathname)) {
    setInterval(clickApproveButtons, 1800);
  }

  window.__zokysInjectPrompt = function (text) {
    try {
      var list = document.querySelectorAll("textarea");
      var node = null;
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        if (el.closest && el.closest("#trivis-vx-root")) continue;
        var r = el.getBoundingClientRect();
        if (r.width > 100 && r.bottom > innerHeight * 0.4) {
          node = el;
          break;
        }
      }
      if (!node) return false;
      node.focus();
      var desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
      if (desc && desc.set) desc.set.call(node, text);
      else node.value = text;
      node.dispatchEvent(new Event("input", { bubbles: true }));
      node.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    } catch (_) {
      return false;
    }
  };
})();
