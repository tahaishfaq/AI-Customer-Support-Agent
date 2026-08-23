/**
 * F04-E — deferred charts + Cloudinary avatar sizing.
 * Run: npm run test:f04e
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sizedCloudinaryUrl } from "../lib/utils/cloudinary-url.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
import { featureDoc } from "./lib/shipped-doc.mjs";


function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function main() {
  const f04 = featureDoc(root, "F04");
  assert(/Phase E — Production bottlenecks ✅/.test(f04), "F04-E marked done");

  assert(exists("components/analytics/lazy-charts.jsx"), "lazy-charts");
  const lazy = read("components/analytics/lazy-charts.jsx");
  assert(/next\/dynamic/.test(lazy) && /ssr:\s*false/.test(lazy), "dynamic ssr:false");

  const workspace = read("components/analytics/WorkspaceAnalytics.jsx");
  assert(/lazy-charts/.test(workspace), "workspace uses lazy charts");
  const board = read("components/analytics/AnalyticsBoard.jsx");
  assert(/lazy-charts/.test(board), "board uses lazy charts");
  const admin = read("components/admin/AdminPlatformAnalytics.jsx");
  assert(
    /lazy-charts/.test(admin) && /requestIdleCallback/.test(admin),
    "admin idle defer + lazy charts"
  );

  assert(exists("lib/utils/cloudinary-url.js"), "cloudinary-url");
  assert(exists("components/ui/avatar-image.jsx"), "AvatarImage");

  const sample =
    "https://res.cloudinary.com/demo/image/upload/v1/folder/avatar.png";
  const sized = sizedCloudinaryUrl(sample, { width: 64, height: 64 });
  assert(
    /f_auto,q_auto,w_64,h_64,c_fill/.test(sized),
    `sized URL transform missing: ${sized}`
  );
  assert(sizedCloudinaryUrl(null) == null, "null passthrough");

  const identity = read("components/customization/IdentityForm.jsx");
  assert(/AVATAR_MAX_BYTES|2MB/.test(identity), "client 2MB guard");
  assert(/AvatarImage/.test(identity), "IdentityForm AvatarImage");

  const upload = read("lib/utils/cloudinary-image.js");
  assert(/width:\s*256/.test(upload) && /fetch_format|quality/.test(upload), "upload constraints");

  console.log("ok  F04-E lazy charts + avatar CDN");
  console.log("\nF04-E smoke passed");
}

main();
