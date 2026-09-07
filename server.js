require("dotenv/config");
const { createServer } = require("node:http");
const next = require("next");

(async () => {
  const { attachRealtimeGateway } = await import("./realtime-gateway/attach.js");
  const dev = process.env.NODE_ENV !== "production";
  const hostname = process.env.HOST || "0.0.0.0";
  const port = Number(process.env.PORT || 3000);
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  let realtime;
  const httpServer = createServer(async (request, response) => {
    const pathname = new URL(
      request.url || "/",
      `http://${request.headers.host || "localhost"}`
    ).pathname;
    if (pathname === "/healthz") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, service: "aide" }));
      return;
    }
    if (pathname === "/readyz") {
      const ready = Boolean(realtime?.isReady());
      response.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
      response.end(JSON.stringify({ ready, service: "aide" }));
      return;
    }
    if (pathname === "/metrics") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(realtime?.getMetrics?.() || { ready: false }));
      return;
    }
    await handle(request, response);
  });

  realtime = await attachRealtimeGateway(httpServer);
  httpServer.listen(port, hostname, () => {
    console.log(`[aide] listening on http://${hostname}:${port}`);
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    await realtime.stop();
    await new Promise((resolve) => httpServer.close(resolve));
    console.log(`[aide] stopped after ${signal}`);
  }

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
})().catch((error) => {
  console.error("[aide] server fatal", error);
  process.exitCode = 1;
});
