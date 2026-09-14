import "dotenv/config";
import { createServer } from "node:http";
import { attachRealtimeGateway } from "./attach.js";

const port = Number(process.env.PORT || 4100);
const httpServer = createServer((request, response) => {
  if (request.url === "/healthz") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true, service: "aide-realtime-test" }));
    return;
  }
  if (request.url === "/readyz") {
    const ready = Boolean(gateway?.isReady());
    response.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
    response.end(JSON.stringify({ ready }));
    return;
  }
  if (request.url === "/metrics") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(gateway?.getMetrics?.() || { ready: false }));
    return;
  }
  response.writeHead(404);
  response.end();
});

const gateway = await attachRealtimeGateway(httpServer);
httpServer.listen(port, "127.0.0.1");

async function shutdown() {
  await gateway.stop();
  await new Promise((resolve) => httpServer.close(resolve));
}

process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());
