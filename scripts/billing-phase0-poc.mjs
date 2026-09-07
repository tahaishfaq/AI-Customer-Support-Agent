/**
 * Phase 0 Safepay sandbox probes — customer + payment session.
 * Does NOT touch live checkout or Subscription rows.
 *
 * Usage: npm run billing:phase0
 */
import "dotenv/config";
import axios from "axios";
import { Safepay } from "@sfpy/node-sdk";

function hostFor(env) {
  if (env === "production") return "https://api.getsafepay.com";
  if (env === "development") return "https://dev.api.getsafepay.com";
  return "https://sandbox.api.getsafepay.com";
}

function headers(secret) {
  return {
    "Content-Type": "application/json",
    "X-SFPY-MERCHANT-SECRET": secret,
    Authorization: `Bearer ${secret}`,
  };
}

function ok(label, detail) {
  console.log(`✅ ${label}`, detail ?? "");
}

function fail(label, detail) {
  console.error(`❌ ${label}`, detail ?? "");
}

async function main() {
  const env = process.env.SAFEPAY_ENVIRONMENT?.trim() || "sandbox";
  const secret = process.env.SAFEPAY_V1_SECRET?.trim();
  const apiKey = process.env.SAFEPAY_API_KEY?.trim();
  const webhookSecret = process.env.SAFEPAY_WEBHOOK_SECRET?.trim();

  if (!secret || !apiKey || !webhookSecret) {
    fail("Missing SAFEPAY_V1_SECRET / SAFEPAY_API_KEY / SAFEPAY_WEBHOOK_SECRET");
    process.exit(1);
  }

  const host = hostFor(env);
  console.log(`\nPhase 0 POC — env=${env} host=${host}\n`);

  const h = headers(secret);

  // —— 0.2 Customer ——
  const custRes = await axios.post(
    `${host}/user/customers/v1/`,
    {
      first_name: "Phase",
      last_name: "Zero",
      email: `phase0-poc+${Date.now()}@example.com`,
      phone_number: "+923001234567",
      country: "PK",
      is_guest: true,
    },
    { headers: h, validateStatus: () => true, timeout: 20000 }
  );

  if (custRes.status >= 400 || !custRes.data?.data?.token) {
    fail("Customer create", JSON.stringify(custRes.data)?.slice(0, 400));
    process.exit(1);
  }
  const customer = custRes.data.data.token;
  ok("Customer create", customer);

  // —— 0.3 Payment session ——
  // Safepay amount = lowest denomination (paisa). Rs 3500 → 350000.
  const sessionRes = await axios.post(
    `${host}/order/payments/v3/`,
    { amount: 350000, currency: "PKR", customer },
    { headers: h, validateStatus: () => true, timeout: 20000 }
  );

  const tracker = sessionRes.data?.data?.tracker;
  if (sessionRes.status >= 400 || !tracker?.token) {
    fail("Payment session", JSON.stringify(sessionRes.data)?.slice(0, 500));
    process.exit(1);
  }
  ok("Payment session tracker", tracker.token);
  console.log("   mode=", tracker.mode, "entry_mode=", tracker.entry_mode);
  console.log("   amount=", tracker.purchase_totals?.quote_amount);

  // —— Auth token for Atoms ——
  const safepay = new Safepay({
    environment: env,
    apiKey,
    webhookSecret,
    v1Secret: secret,
  });
  const authToken = await safepay.authorization.create();
  ok("Authorization token for Atoms", `${String(authToken).slice(0, 12)}…`);

  // —— Wallet (empty until COF) ——
  const walletRes = await axios.get(
    `${host}/user/customers/v1/${encodeURIComponent(customer)}/wallet/`,
    { headers: h, validateStatus: () => true, timeout: 20000 }
  );
  ok(
    "Customer wallet list",
    `status=${walletRes.status} count=${walletRes.data?.data?.count ?? "?"}`
  );

  // —— Probe unscheduled_cof (expect fail until documented) ——
  const cofRes = await axios.post(
    `${host}/order/payments/v3/`,
    { amount: 10000, currency: "PKR", mode: "unscheduled_cof", customer },
    { headers: h, validateStatus: () => true, timeout: 20000 }
  );
  if (cofRes.status < 400 && cofRes.data?.data?.tracker?.token) {
    ok("unscheduled_cof session", cofRes.data.data.tracker.token);
  } else {
    fail(
      "unscheduled_cof session (BLOCKER for Phase 7 until proven)",
      JSON.stringify(cofRes.data?.status || cofRes.data)?.slice(0, 300)
    );
  }

  console.log(`
Browser Atoms checklist (manual):
  tracker   = ${tracker.token}
  authToken = (from authorization.create — do not commit)
  env       = ${env}
  Open /test/safepay-atoms after installing @sfpy/atoms and starting npm run dev.
`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        customer,
        tracker: tracker.token,
        mode: tracker.mode,
        unscheduledCofBlocked: cofRes.status >= 400,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
