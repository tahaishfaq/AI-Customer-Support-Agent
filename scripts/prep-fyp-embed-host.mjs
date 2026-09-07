import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const prisma = (await import("../lib/prisma.js")).default;

const agent = await prisma.agent.findFirst({
  where: { enabled: true, NOT: { publicKey: null } },
  orderBy: { updatedAt: "desc" },
  select: {
    id: true,
    name: true,
    publicKey: true,
    actionsEnabled: true,
    webSearchEnabled: true,
  },
});

if (!agent?.publicKey) {
  console.error("NO_ENABLED_AGENT_WITH_PUBLIC_KEY");
  process.exit(1);
}

const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const out = {
  agentId: agent.id,
  name: agent.name,
  publicKey: agent.publicKey,
  actionsEnabled: Boolean(agent.actionsEnabled),
  webSearchEnabled: Boolean(agent.webSearchEnabled),
  origin,
  widgetUrl: `${origin}/w/${agent.publicKey}`,
};

fs.mkdirSync(path.join(root, ".tmp"), { recursive: true });
fs.writeFileSync(
  path.join(root, ".tmp/local-embed-target.json"),
  JSON.stringify(out, null, 2)
);

// FYP local host page (Brandly marketing style shell + AIDE embed)
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Brandly FYP — AIDE Embed Test (local)</title>
  <style>
    :root { --ink:#0f172a; --muted:#64748b; --bg:#f8fafc; --brand:#0ea5e9; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: ui-sans-serif, system-ui, sans-serif; color:var(--ink); background:var(--bg); }
    header { padding:1.25rem 1.5rem; background:#fff; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; }
    .logo { font-weight:800; letter-spacing:-0.02em; }
    .logo span { color:var(--brand); }
    main { max-width: 920px; margin: 0 auto; padding: 2.5rem 1.5rem 8rem; }
    h1 { font-size: clamp(1.8rem, 4vw, 2.6rem); line-height:1.1; margin:0 0 .75rem; }
    p { color:var(--muted); font-size:1.05rem; line-height:1.55; }
    .card { margin-top:2rem; padding:1.25rem; background:#fff; border:1px solid #e2e8f0; border-radius:12px; }
    .badge { display:inline-block; font-size:.75rem; font-weight:600; color:#0369a1; background:#e0f2fe; padding:.2rem .5rem; border-radius:999px; }
    code { font-size:.85rem; background:#f1f5f9; padding:.15rem .35rem; border-radius:4px; }
  </style>
</head>
<body>
  <header>
    <div class="logo">Brand<span>ly</span> <small style="font-weight:500;color:var(--muted)">FYP + AIDE embed</small></div>
    <div class="badge">LOCAL TEST HOST</div>
  </header>
  <main>
    <h1>AI brand–influencer support, on your site.</h1>
    <p>
      This page simulates your FYP (Brandly) site with the AIDE agent widget embedded.
      Use the chat bubble for Stage 3–6 manual checks. Agent: <strong>${agent.name.replace(/[<>&]/g, "")}</strong>
    </p>
    <div class="card">
      <p style="margin:0"><strong>How to test:</strong> open the widget → ask the golden script questions
      (see <code>.tmp/GOLDEN_DIFF_TEST.md</code>). Same script on live after deploy.</p>
    </div>
  </main>
  <!-- AIDE webchat -->
  <script
    src="${origin}/embed.js?v=11"
    data-aide-key="${agent.publicKey}"
    defer
  ></script>
</body>
</html>
`;

const fypDir = "/Users/samiafzal/Desktop/FYP";
const hostPath = path.join(fypDir, "aide-embed-local-host.html");
fs.writeFileSync(hostPath, html);
console.log("OK agent=" + agent.name);
console.log("HOST=" + hostPath);
console.log("WIDGET_PATH=/w/(key-in-tmp)");
console.log("actionsEnabled=" + out.actionsEnabled);
console.log("webSearchEnabled=" + out.webSearchEnabled);
await prisma.$disconnect();
