/**
 * Resend domain helper — create / list / verify / show DNS.
 *
 * Docs: https://resend.com/docs/api-reference/domains
 *
 * Usage:
 *   npm run resend:domain -- list
 *   npm run resend:domain -- add yourdomain.com
 *   npm run resend:domain -- verify <domainId>
 *   npm run resend:domain -- get <domainId>
 *
 * Notes:
 * - A Vercel app URL (*.vercel.app) is NOT an email sending domain.
 * - After `add`, copy DNS records into your DNS provider, then `verify`.
 * - Testing without a domain: EMAIL_FROM="Aide <beth.t@resend.dev>"
 */
import "dotenv/config";
import { Resend } from "resend";

function usage() {
  console.log(`Usage:
  npm run resend:domain -- list
  npm run resend:domain -- add <domain>
  npm run resend:domain -- get <domainId>
  npm run resend:domain -- verify <domainId>

Examples:
  npm run resend:domain -- add aide.app
  npm run resend:domain -- list
`);
}

function assertNotAppHost(name) {
  const n = String(name || "").toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
  if (!n || !n.includes(".")) {
    throw new Error("Pass a real domain like aide.app (not a full URL path).");
  }
  if (
    n.endsWith(".vercel.app") ||
    n === "localhost" ||
    n.endsWith(".local") ||
    n === "example.com" ||
    n.endsWith(".example.com")
  ) {
    throw new Error(
      `"${n}" cannot be used as a Resend sending domain. Use a domain you own (DNS access required), e.g. aide.app. For local testing use EMAIL_FROM="Aide <beth.t@resend.dev>".`
    );
  }
  return n;
}

function printDns(records) {
  if (!Array.isArray(records) || records.length === 0) {
    console.log("(no DNS records returned yet)");
    return;
  }
  console.log("\nAdd these DNS records at your registrar, then run verify:\n");
  for (const row of records) {
    console.log(
      JSON.stringify(
        {
          type: row.record || row.type,
          name: row.name,
          value: row.value,
          ttl: row.ttl,
          status: row.status,
        },
        null,
        2
      )
    );
  }
}

async function main() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new Error("RESEND_API_KEY is not set in .env");

  const [cmd, arg] = process.argv.slice(2);
  if (!cmd) {
    usage();
    process.exit(1);
  }

  const resend = new Resend(key);

  if (cmd === "list") {
    const result = await resend.domains.list();
    if (result.error) throw new Error(result.error.message);
    console.log(JSON.stringify(result.data, null, 2));
    return;
  }

  if (cmd === "add") {
    const name = assertNotAppHost(arg);
    const result = await resend.domains.create({ name });
    if (result.error) throw new Error(result.error.message);
    console.log(JSON.stringify(result.data, null, 2));
    printDns(result.data?.records);
    console.log(
      `\nNext:\n  1) Add DNS records above\n  2) npm run resend:domain -- verify ${result.data?.id}\n  3) Set EMAIL_FROM="Aide <noreply@${name}>"\n`
    );
    return;
  }

  if (cmd === "get") {
    if (!arg) throw new Error("domain id required");
    const result = await resend.domains.get(arg);
    if (result.error) throw new Error(result.error.message);
    console.log(JSON.stringify(result.data, null, 2));
    printDns(result.data?.records);
    return;
  }

  if (cmd === "verify") {
    if (!arg) throw new Error("domain id required");
    const result = await resend.domains.verify(arg);
    if (result.error) throw new Error(result.error.message);
    console.log(JSON.stringify(result.data || { ok: true, id: arg }, null, 2));
    console.log("\nIf status is still pending, wait for DNS propagation and verify again.");
    return;
  }

  usage();
  process.exit(1);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
