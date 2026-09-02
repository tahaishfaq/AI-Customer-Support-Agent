export function GET(request) {
  const host = new URL(request.url).origin;
  const hostJson = JSON.stringify(host);
  const body = `(() => {
  window.__hapyEmbedKeys = window.__hapyEmbedKeys || {};
  window.__hapyUser = window.__hapyUser || null;
  var thisScript = document.currentScript;

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function normalizeUser(user) {
    if (!user) return null;
    var subject = user.subject || user.sub || null;
    var accessToken = user.accessToken || user.token || null;
    var displayName = user.displayName || user.name || null;
    if (!subject && !accessToken) return null;
    return {
      subject: subject || null,
      accessToken: accessToken || null,
      displayName: displayName || null
    };
  }

  function pushUserToFrame(iframe, handshake) {
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(
        {
          source: "hapy-host",
          type: "setUser",
          user: window.__hapyUser,
          handshake: Boolean(handshake)
        },
        "*"
      );
    } catch (e) {}
  }

  function pushUserToAll(handshake) {
    document.querySelectorAll("iframe[data-hapy-widget]").forEach(function (iframe) {
      pushUserToFrame(iframe, handshake);
    });
  }

  function clampFrame(n, min, max) {
    return Math.min(Math.max(n || 0, min), max);
  }

  var savedAnchor = "bottom-right";

  function applyWidgetAnchor(iframe, positionId, offsetPx) {
    var offset = offsetPx == null ? 16 : offsetPx;
    var parts = String(positionId || "bottom-right").split("-");
    var vertical = parts[0] || "bottom";
    var horizontal = parts[1] || "right";
    iframe.style.position = "fixed";
    iframe.style.left = "auto";
    iframe.style.right = "auto";
    iframe.style.top = "auto";
    iframe.style.bottom = "auto";
    iframe.style.transform = "";
    if (horizontal === "left") iframe.style.left = offset + "px";
    else iframe.style.right = offset + "px";
    if (vertical === "top") iframe.style.top = offset + "px";
    else if (vertical === "center") {
      iframe.style.top = "50%";
      iframe.style.transform = "translateY(-50%)";
    } else iframe.style.bottom = offset + "px";
  }

  function sizeFloatingFrame(iframe, data) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var maxW = vw - 24;
    var maxH = vh - 24;
    var width = 56;
    var height = 56;
    if (data && data.width && data.height) {
      width = clampFrame(data.width, 56, maxW);
      height = clampFrame(data.height, 56, maxH);
    }
    if (data && data.proactive && !data.open) {
      width = Math.max(width, 220);
      height = Math.max(height, 120);
    }
    if (data && data.open) {
      width = clampFrame(data.width, 280, Math.min(400, maxW));
      height = clampFrame(data.height, 160, Math.min(640, maxH));
    }
    iframe.style.width = width + "px";
    iframe.style.height = height + "px";
    iframe.style.maxWidth = "calc(100vw - 16px)";
    iframe.style.maxHeight = "calc(100dvh - 16px)";
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
    // (iframe pings would only show the Aide app origin).
    fetch(${hostJson} + "/api/public/agents/" + encodeURIComponent(publicKey) + "/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: window.location.origin }),
      mode: "cors",
      credentials: "omit",
    })
      .then(function (res) {
        return res.json().catch(function () {
          return null;
        });
      })
      .then(function (data) {
        if (data && data.widgetPosition) {
          savedAnchor = data.widgetPosition;
          if (iframe.style.position === "fixed") {
            applyWidgetAnchor(iframe, savedAnchor);
          }
        }
      })
      .catch(function () {});
    var iframe = document.createElement("iframe");
    var target = targetSelector ? document.querySelector(targetSelector) : null;
    var embedMode = target ? "container" : "float";
    iframe.src =
      ${hostJson} +
      "/w/" +
      encodeURIComponent(publicKey) +
      "?parentOrigin=" +
      parentOrigin +
      "&embed=" +
      embedMode;
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

    if (target) {
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.minHeight = "480px";
      target.innerHTML = "";
      target.appendChild(iframe);
    } else {
      iframe.style.position = "fixed";
      applyWidgetAnchor(iframe, savedAnchor);
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
      if (event.data.type === "ready") {
        pushUserToFrame(iframe, true);
        return;
      }
      if (event.data.type === "authRefreshRequired") {
        if (typeof window.aideChat.onAuthRefreshNeeded === "function") {
          try {
            window.aideChat.onAuthRefreshNeeded({
              code: event.data.code || "IDENTITY_EXPIRED",
              publicKey: iframe.getAttribute("data-hapy-widget") || null
            });
          } catch (e) {}
        }
        return;
      }
      if (event.data.type !== "frame") return;
      if (iframe.style.position !== "fixed") return;
      sizeFloatingFrame(iframe, event.data);
      applyWidgetAnchor(iframe, savedAnchor);
    });
  }

  window.aideChat = {
    init: function (opts) {
      opts = opts || {};
      boot(opts.publicKey, opts.target);
      if (opts.user) {
        window.aideChat.setUser(opts.user);
      }
    },
    /** F14-C — host site: aideChat.setUser({ accessToken, subject, displayName }) */
    setUser: function (user) {
      window.__hapyUser = normalizeUser(user);
      pushUserToAll(false);
      return window.__hapyUser;
    },
    clearUser: function () {
      return window.aideChat.setUser(null);
    },
    /** F14-E — host assigns: aideChat.onAuthRefreshNeeded = function (payload) { … setUser } */
    onAuthRefreshNeeded: null
  };
  window.hapyChat = window.aideChat;
  window.hapy = window.aideChat;
  window.aide = window.aideChat;

  ready(function () {
    var script = thisScript || document.querySelector("script[data-aide-key], script[data-hapy-key]");
    var key = script && (script.getAttribute("data-aide-key") || script.getAttribute("data-hapy-key"));
    var target = script && (script.getAttribute("data-aide-target") || script.getAttribute("data-hapy-target"));
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
