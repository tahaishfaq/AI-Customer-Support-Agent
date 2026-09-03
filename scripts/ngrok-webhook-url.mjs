/**
 * Print the current ngrok HTTPS URL + SafePay webhook path.
 * Run while `ngrok http 3000` is active. No .env edits needed when the tunnel URL changes.
 *
 * Usage: npm run ngrok:webhook-url
 */
const NGROK_API = "http://127.0.0.1:4040/api/tunnels";

async function main() {
  let res;
  try {
    res = await fetch(NGROK_API);
  } catch {
    console.error("Could not reach ngrok (http://127.0.0.1:4040).");
    console.error("Start a tunnel first:  ngrok http 3000");
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`ngrok API returned ${res.status}`);
    process.exit(1);
  }

  const data = await res.json();
  const tunnels = data.tunnels || [];
  const https =
    tunnels.find((t) => t.public_url?.startsWith("https://")) ||
    tunnels.find((t) => t.proto === "https");

  const base = https?.public_url?.replace(/\/$/, "");
  if (!base) {
    console.error("No HTTPS ngrok tunnel found. Is ngrok running?");
    process.exit(1);
  }

  console.log("");
  console.log("Paste this into SafePay → Webhooks (sandbox):");
  console.log(`${base}/api/webhooks/safepay`);
  console.log("");
  console.log("Open the app in your browser at:");
  console.log(base);
  console.log("");
  console.log("AUTH_URL in .env can stay http://localhost:3000 — checkout redirects use the ngrok host automatically.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
