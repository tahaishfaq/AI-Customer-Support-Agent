export function GET(request) {
  const host = new URL(request.url).origin;
  const hostJson = JSON.stringify(host);
  const body = `(() => {
  if (window.__hapyEmbedLoaded) return;
  window.__hapyEmbedLoaded = true;

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function sizeFloatingFrame(iframe, data) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var width;
    var height;
    if (data && data.open) {
      width = Math.min(404, vw - 24);
      height = Math.min(640, vh - 24);
    } else if (data && data.proactive) {
      width = Math.min(300, vw - 24);
      height = Math.min(168, vh - 24);
    } else if (data && data.customLauncher) {
      width = Math.min(200, vw - 24);
      height = 72;
    } else {
      width = 88;
      height = 88;
    }
    iframe.style.width = width + "px";
    iframe.style.height = height + "px";
    iframe.style.maxWidth = "calc(100vw - 16px)";
    iframe.style.maxHeight = "calc(100dvh - 16px)";
  }

  function boot(publicKey, targetSelector) {
    if (!publicKey) return;
    var existing = document.querySelector('iframe[data-hapy-widget="' + publicKey + '"]');
    if (existing) return;

    var parentOrigin = encodeURIComponent(window.location.origin);
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

    var target = targetSelector ? document.querySelector(targetSelector) : null;
    if (target) {
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.minHeight = "480px";
      target.innerHTML = "";
      target.appendChild(iframe);
      return;
    }

    iframe.style.position = "fixed";
    iframe.style.right = "16px";
    iframe.style.bottom = "16px";
    iframe.style.left = "auto";
    sizeFloatingFrame(iframe, { open: false });
    document.body.appendChild(iframe);

    window.addEventListener("message", function (event) {
      if (event.origin !== ${hostJson}) return;
      if (!event.data || event.data.source !== "hapy-widget") return;
      if (event.data.type !== "frame") return;
      if (iframe.contentWindow !== event.source) return;
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
    var script = document.currentScript || document.querySelector("script[data-hapy-key]");
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
