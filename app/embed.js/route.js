export function GET(request) {
  const host = new URL(request.url).origin;
  const hostJson = JSON.stringify(host);
  const body = `(() => {
  window.__hapyEmbedKeys = window.__hapyEmbedKeys || {};
  var thisScript = document.currentScript;

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function clampFrame(n, min, max) {
    return Math.min(Math.max(n || 0, min), max);
  }

  function sizeFloatingFrame(iframe, data) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var maxW = vw - 24;
    var maxH = vh - 24;
    var width = 72;
    var height = 72;
    // Open chat uses fixed panel size; closed states use measured iframe content.
    if (data && data.open) {
      width = Math.min(400, maxW);
      height = Math.min(640, maxH);
    } else if (data && data.proactive) {
      width = clampFrame(data.width, 220, Math.min(320, maxW));
      height = clampFrame(data.height, 130, Math.min(260, maxH));
    } else if (data && data.customLauncher) {
      width = clampFrame(data.width, 160, Math.min(220, maxW));
      height = clampFrame(data.height, 72, Math.min(96, maxH));
    } else if (data && data.width && data.height) {
      width = clampFrame(data.width, 72, maxW);
      height = clampFrame(data.height, 72, maxH);
    }
    iframe.style.width = width + "px";
    iframe.style.height = height + "px";
    iframe.style.maxWidth = "calc(100vw - 16px)";
    iframe.style.maxHeight = "calc(100dvh - 16px)";
    iframe.style.pointerEvents = "auto";
  }

  function boot(publicKey, targetSelector) {
    if (!publicKey) return;
    document.querySelectorAll("iframe[data-hapy-widget]").forEach(function (node) {
      if (node.getAttribute("data-hapy-widget") !== publicKey) node.remove();
    });
    var existing = document.querySelector('iframe[data-hapy-widget="' + publicKey + '"]');
    if (existing) return;

    var parentOrigin = encodeURIComponent(window.location.origin);
    // Claim from the parent page so Origin/Referer are the customer site
    // (iframe pings would only show the Hapy app origin).
    fetch(${hostJson} + "/api/public/agents/" + encodeURIComponent(publicKey) + "/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: window.location.origin }),
      mode: "cors",
      credentials: "omit",
    }).catch(function () {});
    var iframe = document.createElement("iframe");
    iframe.src = ${hostJson} + "/w/" + encodeURIComponent(publicKey) + "?parentOrigin=" + parentOrigin;
    iframe.setAttribute("data-hapy-widget", publicKey);
    iframe.setAttribute("title", "Chat");
    iframe.setAttribute("allow", "clipboard-write");
    iframe.setAttribute("allowtransparency", "true");
    iframe.style.border = "0";
    iframe.style.zIndex = "2147483646";
    iframe.style.background = "transparent";
    iframe.style.colorScheme = "light";
    iframe.style.overflow = "hidden";
    window.__hapyEmbedKeys[publicKey] = true;

    var target = targetSelector ? document.querySelector(targetSelector) : null;
    if (target) {
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.minHeight = "480px";
      target.innerHTML = "";
      target.appendChild(iframe);
    } else {
      iframe.style.position = "fixed";
      iframe.style.right = "16px";
      iframe.style.bottom = "16px";
      iframe.style.left = "auto";
      sizeFloatingFrame(iframe, { open: false });
      document.body.appendChild(iframe);
    }

    window.addEventListener("message", function (event) {
      if (event.origin !== ${hostJson}) return;
      if (!event.data || event.data.source !== "hapy-widget") return;
      if (iframe.contentWindow !== event.source) return;
      if (event.data.type === "unavailable") {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        return;
      }
      if (event.data.type !== "frame") return;
      if (iframe.style.position !== "fixed") return;
      sizeFloatingFrame(iframe, event.data);
    });
  }

  window.hapyChat = {
    init: function (opts) {
      opts = opts || {};
      boot(opts.publicKey, opts.target);
    }
  };

  ready(function () {
    var script = thisScript || document.querySelector("script[data-hapy-key]");
    var key = script && script.getAttribute("data-hapy-key");
    var target = script && script.getAttribute("data-hapy-target");
    if (key) boot(key, target || undefined);
  });
})();
`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
