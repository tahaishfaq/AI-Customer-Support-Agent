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
        ${hostJson}
      );
    } catch (e) {}
  }

  function pushUserToAll(handshake) {
    document.querySelectorAll("iframe[data-hapy-widget]").forEach(function (iframe) {
      pushUserToFrame(iframe, handshake);
    });
  }

  function clampFrame(n, min, max) {
    return Math.min(Math.max(n, Math.min(min, max)), max);
  }

  function setStyle(iframe, name, value) {
    if (iframe.style[name] !== value) iframe.style[name] = value;
  }

  function validFrame(data) {
    return typeof data.open === "boolean" &&
      typeof data.width === "number" && Number.isFinite(data.width) && data.width > 0 && data.width <= 4096 &&
      typeof data.height === "number" && Number.isFinite(data.height) && data.height > 0 && data.height <= 4096 &&
      (data.proactive === undefined || typeof data.proactive === "boolean") &&
      (data.customLauncher === undefined || typeof data.customLauncher === "boolean");
  }

  function viewportBounds(iframe) {
    var view = window.visualViewport;
    var css = getComputedStyle(iframe);
    function safe(side) { return Math.max(0, parseFloat(css.getPropertyValue("--aide-safe-" + side)) || 0); }
    var left = 16 + safe("left");
    var right = 16 + safe("right");
    var top = 16 + safe("top");
    var bottom = 16 + safe("bottom");
    return {
      left: left + (view ? view.offsetLeft : 0),
      right: right + (view ? Math.max(0, window.innerWidth - view.offsetLeft - view.width) : 0),
      bottom: bottom + (view ? Math.max(0, window.innerHeight - view.offsetTop - view.height) : 0),
      width: Math.max(1, (view ? view.width : window.innerWidth) - left - right),
      height: Math.max(1, (view ? view.height : window.innerHeight) - top - bottom)
    };
  }

  function applyWidgetAnchor(iframe, positionId, offsetPx, version) {
    var offset = offsetPx == null ? 16 : offsetPx;
    var bounds = version === 2 ? viewportBounds(iframe) : null;
    setStyle(iframe, "position", "fixed");
    setStyle(iframe, "left", positionId === "bottom-left" ? (bounds ? bounds.left : offset) + "px" : "auto");
    setStyle(iframe, "right", positionId === "bottom-left" ? "auto" : (bounds ? bounds.right : offset) + "px");
    setStyle(iframe, "top", "auto");
    setStyle(iframe, "bottom", (bounds ? bounds.bottom : offset) + "px");
    setStyle(iframe, "transform", "");
  }

  function sizeFloatingFrame(iframe, data) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    // Both viewport edges need the same inset. Keep the existing child's 4px
    // gutter in the initial size until the coordinated layout protocol replaces it.
    var maxW = Math.max(1, vw - 32);
    var maxH = Math.max(1, vh - 32);
    if (data.version === 2) {
      var bounds = viewportBounds(iframe);
      maxW = bounds.width;
      maxH = bounds.height;
    }
    var width = 60;
    var height = 60;
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
    setStyle(iframe, "width", clampFrame(width, 56, maxW) + "px");
    setStyle(iframe, "height", clampFrame(height, 56, maxH) + "px");
    setStyle(iframe, "maxWidth", "calc(100vw - 32px)");
    setStyle(iframe, "maxHeight", "calc(100dvh - 32px)");
  }

  function boot(publicKey, targetSelector) {
    if (typeof publicKey !== "string" || !publicKey || publicKey.length > 256) return;
    document.querySelectorAll("iframe[data-hapy-widget]").forEach(function (node) {
      if (node.getAttribute("data-hapy-widget") !== publicKey) {
        if (node.__aideEmbedCleanup) node.__aideEmbedCleanup();
        node.remove();
      }
    });
    var existing = Array.from(document.querySelectorAll("iframe[data-hapy-widget]")).find(function (node) {
      return node.getAttribute("data-hapy-widget") === publicKey;
    });
    if (existing) return;

    var savedAnchor = "bottom-right";
    var anchorSettled = false;
    var frameSeen = false;
    var disposed = false;
    var resizeTick = 0;
    var ackTick = 0;
    var lastGeneration = 0;
    var lastFrame = { open: false, width: 60, height: 60 };
    var revealTimer;

    function reveal() {
      if (disposed || !iframe.isConnected || iframe.style.position !== "fixed") return;
      applyWidgetAnchor(iframe, savedAnchor, null, lastFrame.version);
      setStyle(iframe, "visibility", "visible");
    }

    function settleAnchor(position) {
      // A delayed ping must not relocate a launcher that is already visible.
      if (disposed || anchorSettled) return;
      savedAnchor = position === "bottom-left" ? "bottom-left" : "bottom-right";
      anchorSettled = true;
      if (frameSeen) {
        clearTimeout(revealTimer);
        reveal();
      }
    }

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
        settleAnchor(data && data.widgetPosition);
      })
      .catch(function () { settleAnchor(); });
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
    ["left", "right", "top", "bottom"].forEach(function (side) {
      iframe.style.setProperty("--aide-safe-" + side, "env(safe-area-inset-" + side + ", 0px)");
    });
    window.__hapyEmbedKeys[publicKey] = true;

    if (target) {
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.minHeight = "480px";
      target.innerHTML = "";
      target.appendChild(iframe);
    } else {
      iframe.style.position = "fixed";
      iframe.style.visibility = "hidden";
      applyWidgetAnchor(iframe, savedAnchor);
      sizeFloatingFrame(iframe, lastFrame);
      document.body.appendChild(iframe);
      revealTimer = setTimeout(function () {
        settleAnchor();
        reveal();
      }, 2000);
    }

    function cleanup() {
      disposed = true;
      clearTimeout(revealTimer);
      cancelAnimationFrame(resizeTick);
      cancelAnimationFrame(ackTick);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("resize", onResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", onResize);
        window.visualViewport.removeEventListener("scroll", onResize);
      }
      iframe.removeEventListener("load", onLoad);
      delete window.__hapyEmbedKeys[publicKey];
    }
    iframe.__aideEmbedCleanup = cleanup;

    function acknowledge() {
      if (lastFrame.version !== 2) return;
      cancelAnimationFrame(ackTick);
      ackTick = requestAnimationFrame(function () {
        ackTick = 0;
        if (disposed || !iframe.isConnected || lastFrame.version !== 2) return;
        iframe.contentWindow.postMessage({
          source: "hapy-host", type: "frame-applied", version: 2,
          generation: lastFrame.generation, open: lastFrame.open,
          position: savedAnchor, width: iframe.clientWidth, height: iframe.clientHeight
        }, ${hostJson});
      });
    }

    function onLoad() {
      lastGeneration = 0;
      cancelAnimationFrame(ackTick);
    }

    function onResize() {
      if (!iframe.isConnected) { cleanup(); return; }
      if (disposed || resizeTick || iframe.style.position !== "fixed") return;
      resizeTick = requestAnimationFrame(function () {
        resizeTick = 0;
        sizeFloatingFrame(iframe, lastFrame);
        applyWidgetAnchor(iframe, savedAnchor, null, lastFrame.version);
        acknowledge();
      });
    }

    function onMessage(event) {
      if (disposed || !iframe.isConnected) { cleanup(); return; }
      if (event.origin !== ${hostJson}) return;
      if (!event.data || event.data.source !== "hapy-widget") return;
      if (iframe.contentWindow !== event.source) return;
      if (event.data.type === "unavailable") {
        cleanup();
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
      if (!validFrame(event.data)) return;
      var data = event.data;
      if (data.version !== undefined && data.version !== 2) return;
      if (data.version === 2) {
        if (!Number.isSafeInteger(data.generation) || data.generation < 1 || data.generation > 1000000000 ||
            (data.position !== "bottom-left" && data.position !== "bottom-right") || data.generation < lastGeneration) return;
        if (data.generation === lastGeneration && (data.open !== lastFrame.open || data.width !== lastFrame.width || data.height !== lastFrame.height)) return;
        lastGeneration = data.generation;
        // The authorized child already knows its configured corner. Do not wait
        // for a second ping to move it; after reveal the host owns the anchor.
        if (iframe.style.visibility === "hidden") {
          savedAnchor = data.position;
          anchorSettled = true;
        }
      } else if (lastFrame.version === 2) return;
      lastFrame = {
        version: data.version, generation: data.generation,
        open: event.data.open, width: event.data.width, height: event.data.height,
        proactive: event.data.proactive === true,
        customLauncher: event.data.customLauncher === true
      };
      frameSeen = true;
      sizeFloatingFrame(iframe, lastFrame);
      applyWidgetAnchor(iframe, savedAnchor, null, lastFrame.version);
      if (anchorSettled) {
        clearTimeout(revealTimer);
        reveal();
      }
      acknowledge();
    }
    window.addEventListener("message", onMessage);
    window.addEventListener("resize", onResize);
    iframe.addEventListener("load", onLoad);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", onResize);
      window.visualViewport.addEventListener("scroll", onResize);
    }
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
