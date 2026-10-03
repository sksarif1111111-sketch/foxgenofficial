/**
 * Light UsagiAutoX → Made by Krishna Gupta (MAIN). No credit logic.
 * Runs only on project pages, throttled.
 */
(function () {
  if (window.__zokysLabelMain__) return;
  window.__zokysLabelMain__ = true;
  if (!/\/projects\//i.test(location.pathname)) return;

  var LABEL = "Made by Krishna Gupta";
  var busy = false;
  function scrub() {
    if (busy) return;
    busy = true;
    try {
      var nodes = document.querySelectorAll("p, span, div, button");
      for (var i = 0; i < Math.min(nodes.length, 400); i++) {
        var el = nodes[i];
        if (!el || el.children.length > 2) continue;
        var t = el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 ? el.textContent : "";
        if (t && /UsagiAutoX/i.test(t) && t.length < 40) {
          el.textContent = t.replace(/UsagiAutoX/gi, LABEL);
        }
      }
    } catch (e) {}
    busy = false;
  }
  // Slow: once after load, then every 2s only
  setTimeout(scrub, 1500);
  setInterval(scrub, 2000);
})();
