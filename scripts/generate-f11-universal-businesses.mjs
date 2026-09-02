#!/usr/bin/env node
/**
 * Generates:
 *  - docs/features/F11_UNIVERSAL_BUSINESSES.md (50 businesses)
 *  - docs/features/F11_BUSINESS_EDGE_CASES.md (100 × 50 = 5000)
 *
 * Run: node scripts/generate-f11-universal-businesses.mjs
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS = join(__dirname, "../docs/features");

/** @type {Array<{id:string,name:string,vertical:string,embed:string,guestTools:string[],accountTools:string[],supportUseCases:string[]}>} */
const BUSINESSES = [
  {
    id: "B01",
    name: "D2C apparel store",
    vertical: "E-commerce",
    embed: "Product pages + checkout",
    guestTools: ["guest_track_order", "public_product_info", "create_lead"],
    accountTools: ["get_my_order", "start_return", "update_address"],
    supportUseCases: ["Where is my order?", "Size guide", "Start a return"],
  },
  {
    id: "B02",
    name: "Marketplace (multi-vendor)",
    vertical: "E-commerce",
    embed: "Listing + buyer dashboard",
    guestTools: ["public_listing_status", "guest_order_lookup"],
    accountTools: ["get_my_purchases", "message_seller", "open_dispute"],
    supportUseCases: ["Buyer protection", "Seller reply time", "Dispute status"],
  },
  {
    id: "B03",
    name: "Grocery / quick commerce",
    vertical: "E-commerce",
    embed: "App WebView + website",
    guestTools: ["public_store_hours", "guest_delivery_eta"],
    accountTools: ["get_my_delivery", "replace_item", "cancel_order"],
    supportUseCases: ["Late delivery", "Missing item", "Refund to wallet"],
  },
  {
    id: "B04",
    name: "Electronics retailer",
    vertical: "E-commerce",
    embed: "PDP + support hub",
    guestTools: ["warranty_lookup", "public_specs"],
    accountTools: ["get_my_warranty", "book_repair", "claim_warranty"],
    supportUseCases: ["Warranty check", "Repair booking", "Serial not found"],
  },
  {
    id: "B05",
    name: "Subscription box",
    vertical: "E-commerce",
    embed: "Account portal",
    guestTools: ["public_plan_compare"],
    accountTools: ["get_my_subscription", "skip_month", "change_plan"],
    supportUseCases: ["Skip next box", "Change plan", "Billing date"],
  },
  {
    id: "B06",
    name: "SaaS B2B product",
    vertical: "SaaS",
    embed: "In-app help widget",
    guestTools: ["public_status_page", "docs_search"],
    accountTools: ["get_my_usage", "get_my_plan", "create_support_ticket"],
    supportUseCases: ["Quota exceeded", "Invite teammate", "Billing invoice"],
  },
  {
    id: "B07",
    name: "Developer API platform",
    vertical: "SaaS",
    embed: "Docs + dashboard",
    guestTools: ["public_api_status", "docs_search"],
    accountTools: ["list_my_keys_meta", "get_my_quota", "rotate_key_request"],
    supportUseCases: ["401 from API", "Rate limit", "Key rotation"],
  },
  {
    id: "B08",
    name: "HR / payroll SaaS",
    vertical: "SaaS",
    embed: "Employee portal",
    guestTools: ["public_careers_faq"],
    accountTools: ["get_my_payslip", "request_leave", "update_bank_mask"],
    supportUseCases: ["Payslip missing", "Leave balance", "Tax form"],
  },
  {
    id: "B09",
    name: "CRM / sales SaaS",
    vertical: "SaaS",
    embed: "App sidebar",
    guestTools: ["public_pricing"],
    accountTools: ["get_my_workspace", "invite_user", "export_request"],
    supportUseCases: ["Seat limit", "Export CSV", "SSO setup"],
  },
  {
    id: "B10",
    name: "Analytics SaaS",
    vertical: "SaaS",
    embed: "Dashboard help",
    guestTools: ["public_docs"],
    accountTools: ["get_my_billing", "list_my_projects", "create_ticket"],
    supportUseCases: ["Data delay", "Billing", "Project access"],
  },
  {
    id: "B11",
    name: "Clinic / appointments",
    vertical: "Healthcare",
    embed: "Booking site",
    guestTools: ["public_services", "public_location_hours"],
    accountTools: ["get_my_appointment", "reschedule", "cancel_appointment"],
    supportUseCases: ["Next appointment", "Reschedule", "Insurance FAQ"],
  },
  {
    id: "B12",
    name: "Dental practice",
    vertical: "Healthcare",
    embed: "Patient portal",
    guestTools: ["public_services", "new_patient_lead"],
    accountTools: ["get_my_visit", "request_records"],
    supportUseCases: ["Cleaning due", "Records request", "Payment plan"],
  },
  {
    id: "B13",
    name: "Telehealth",
    vertical: "Healthcare",
    embed: "Patient app WebView",
    guestTools: ["public_how_it_works"],
    accountTools: ["get_my_visit_link", "upload_intake", "cancel_visit"],
    supportUseCases: ["Join link", "Doctor late", "Prescription status"],
  },
  {
    id: "B14",
    name: "Pharmacy delivery",
    vertical: "Healthcare",
    embed: "Order tracking page",
    guestTools: ["guest_rx_pickup_status"],
    accountTools: ["get_my_prescription", "refill_request"],
    supportUseCases: ["Ready for pickup", "Refill", "Insurance reject"],
  },
  {
    id: "B15",
    name: "Mental health platform",
    vertical: "Healthcare",
    embed: "Member portal",
    guestTools: ["public_crisis_resources"],
    accountTools: ["get_my_session", "reschedule_therapist"],
    supportUseCases: ["Session time", "Therapist change", "Billing"],
  },
  {
    id: "B16",
    name: "Banking / fintech app",
    vertical: "Fintech",
    embed: "Secure WebView help",
    guestTools: ["public_branch_atm", "public_fees"],
    accountTools: ["get_my_balance_summary", "list_my_transactions", "freeze_card"],
    supportUseCases: ["Card lost", "Failed transfer", "Statement"],
  },
  {
    id: "B17",
    name: "Neobank / wallet",
    vertical: "Fintech",
    embed: "In-app chat",
    guestTools: ["public_kyc_faq"],
    accountTools: ["get_my_limits", "dispute_txn", "close_account_request"],
    supportUseCases: ["KYC pending", "Dispute charge", "Limit raise"],
  },
  {
    id: "B18",
    name: "Insurance (P&C)",
    vertical: "Fintech",
    embed: "Claims portal",
    guestTools: ["public_coverage_faq", "guest_claim_status"],
    accountTools: ["get_my_policy", "file_claim", "upload_docs"],
    supportUseCases: ["Claim status", "Coverage question", "Premium due"],
  },
  {
    id: "B19",
    name: "Lending / BNPL",
    vertical: "Fintech",
    embed: "Checkout + account",
    guestTools: ["public_eligibility_faq"],
    accountTools: ["get_my_loan", "make_payment", "defer_request"],
    supportUseCases: ["Next payment", "Late fee", "Payoff quote"],
  },
  {
    id: "B20",
    name: "Crypto exchange (careful)",
    vertical: "Fintech",
    embed: "Logged-in support only for private",
    guestTools: ["public_status", "public_fees"],
    accountTools: ["get_my_withdraw_status", "get_my_kyc_status"],
    supportUseCases: ["Withdrawal pending", "2FA reset process", "Deposit not showing"],
  },
  {
    id: "B21",
    name: "Hotel / hospitality",
    vertical: "Travel",
    embed: "Booking site + stay app",
    guestTools: ["public_amenities", "guest_reservation_lookup"],
    accountTools: ["get_my_reservation", "modify_stay", "late_checkout_request"],
    supportUseCases: ["Check-in time", "Room type", "Cancel policy"],
  },
  {
    id: "B22",
    name: "Airline",
    vertical: "Travel",
    embed: "Manage booking",
    guestTools: ["public_flight_status", "guest_pnr_lookup"],
    accountTools: ["get_my_booking", "request_seat", "baggage_claim"],
    supportUseCases: ["Flight delayed", "Seat change", "Baggage"],
  },
  {
    id: "B23",
    name: "Car rental",
    vertical: "Travel",
    embed: "Reservation portal",
    guestTools: ["public_locations", "guest_reservation_lookup"],
    accountTools: ["get_my_rental", "extend_rental", "damage_report"],
    supportUseCases: ["Pickup location", "Extend trip", "Fuel policy"],
  },
  {
    id: "B24",
    name: "Tour operator",
    vertical: "Travel",
    embed: "Trip page",
    guestTools: ["public_itinerary", "guest_booking_lookup"],
    accountTools: ["get_my_tour", "add_traveler"],
    supportUseCases: ["Meeting point", "Weather cancel", "Visa FAQ"],
  },
  {
    id: "B25",
    name: "Ride-hailing",
    vertical: "Travel",
    embed: "Rider app help",
    guestTools: ["public_safety_faq"],
    accountTools: ["get_my_trip", "report_issue", "lost_item"],
    supportUseCases: ["Fare dispute", "Driver feedback", "Lost phone"],
  },
  {
    id: "B26",
    name: "Parcel / courier",
    vertical: "Logistics",
    embed: "Track page",
    guestTools: ["guest_track_parcel", "public_service_points"],
    accountTools: ["get_my_shipment", "schedule_redelivery", "claim_damage"],
    supportUseCases: ["Out for delivery", "Wrong address", "Damaged box"],
  },
  {
    id: "B27",
    name: "Freight / B2B shipping",
    vertical: "Logistics",
    embed: "Shipper portal",
    guestTools: ["public_transit_times"],
    accountTools: ["get_my_bol", "book_pickup", "dispute_invoice"],
    supportUseCases: ["BOL status", "Detention fees", "Pickup window"],
  },
  {
    id: "B28",
    name: "Last-mile courier",
    vertical: "Logistics",
    embed: "Merchant dashboard",
    guestTools: ["guest_track_by_code"],
    accountTools: ["list_my_deliveries", "reroute_stop"],
    supportUseCases: ["Failed attempt", "COD issue", "Reroute"],
  },
  {
    id: "B29",
    name: "Warehouse / 3PL",
    vertical: "Logistics",
    embed: "Client portal",
    guestTools: ["public_sla_faq"],
    accountTools: ["get_my_inventory", "create_outbound", "get_asn_status"],
    supportUseCases: ["SKU stock", "ASN delay", "Outbound cut-off"],
  },
  {
    id: "B30",
    name: "Moving company",
    vertical: "Logistics",
    embed: "Quote + booking",
    guestTools: ["public_quote_faq", "guest_job_status"],
    accountTools: ["get_my_move", "reschedule_move"],
    supportUseCases: ["Crew ETA", "Extra boxes", "Damage claim"],
  },
  {
    id: "B31",
    name: "Online university",
    vertical: "EdTech",
    embed: "LMS help",
    guestTools: ["public_programs", "admissions_faq"],
    accountTools: ["get_my_enrollment", "get_my_grades_summary", "request_transcript"],
    supportUseCases: ["Enrollment", "Deadline", "Transcript"],
  },
  {
    id: "B32",
    name: "K-12 school portal",
    vertical: "EdTech",
    embed: "Parent portal",
    guestTools: ["public_calendar"],
    accountTools: ["get_my_child_attendance", "pay_fees", "message_teacher_ticket"],
    supportUseCases: ["Attendance", "Fee due", "Bus route"],
  },
  {
    id: "B33",
    name: "Coding bootcamp",
    vertical: "EdTech",
    embed: "Student dashboard",
    guestTools: ["public_syllabus"],
    accountTools: ["get_my_progress", "book_mentor", "defer_cohort"],
    supportUseCases: ["Mentor slot", "Project feedback", "Defer"],
  },
  {
    id: "B34",
    name: "Language learning app",
    vertical: "EdTech",
    embed: "In-app",
    guestTools: ["public_pricing"],
    accountTools: ["get_my_streak", "manage_subscription", "reset_progress_request"],
    supportUseCases: ["Billing", "Streak lost", "Family plan"],
  },
  {
    id: "B35",
    name: "Corporate L&D",
    vertical: "EdTech",
    embed: "Employee LMS",
    guestTools: ["public_catalog"],
    accountTools: ["get_my_required_courses", "get_certificate"],
    supportUseCases: ["Compliance due", "Certificate", "Manager assign"],
  },
  {
    id: "B36",
    name: "Restaurant / QSR",
    vertical: "Food",
    embed: "Order site",
    guestTools: ["public_menu", "guest_order_status"],
    accountTools: ["get_my_order", "reorder", "loyalty_balance"],
    supportUseCases: ["Wrong item", "Delivery late", "Loyalty points"],
  },
  {
    id: "B37",
    name: "Cloud kitchen / delivery",
    vertical: "Food",
    embed: "Order tracking",
    guestTools: ["guest_order_status"],
    accountTools: ["get_my_order", "report_missing_item"],
    supportUseCases: ["ETA", "Missing item", "Promo code"],
  },
  {
    id: "B38",
    name: "Grocery wholesale B2B",
    vertical: "Food",
    embed: "Buyer portal",
    guestTools: ["public_catalog"],
    accountTools: ["get_my_po", "place_order", "invoice_status"],
    supportUseCases: ["PO status", "Credit limit", "Invoice"],
  },
  {
    id: "B39",
    name: "Meal kit",
    vertical: "Food",
    embed: "Account",
    guestTools: ["public_menu_week"],
    accountTools: ["get_my_box", "skip_week", "update_allergens"],
    supportUseCases: ["Skip week", "Allergy", "Delivery day"],
  },
  {
    id: "B40",
    name: "Coffee subscription",
    vertical: "Food",
    embed: "Shop + account",
    guestTools: ["public_roasts", "guest_track"],
    accountTools: ["get_my_sub", "pause", "change_grind"],
    supportUseCases: ["Pause", "Grind type", "Gift"],
  },
  {
    id: "B41",
    name: "ISP / telecom",
    vertical: "Utilities",
    embed: "Self-serve portal",
    guestTools: ["public_outage_map", "guest_ticket_status"],
    accountTools: ["get_my_service", "report_outage", "upgrade_plan"],
    supportUseCases: ["Outage", "Bill dispute", "Speed test tips"],
  },
  {
    id: "B42",
    name: "Electric utility",
    vertical: "Utilities",
    embed: "Account portal",
    guestTools: ["public_outage"],
    accountTools: ["get_my_bill", "report_outage", "payment_arrangement"],
    supportUseCases: ["High bill", "Outage", "Payment plan"],
  },
  {
    id: "B43",
    name: "Mobile carrier",
    vertical: "Utilities",
    embed: "App help",
    guestTools: ["public_coverage", "guest_sim_activation_faq"],
    accountTools: ["get_my_plan", "add_data", "sim_swap_request"],
    supportUseCases: ["Roaming", "SIM swap", "Bill shock"],
  },
  {
    id: "B44",
    name: "Smart home / IoT",
    vertical: "Utilities",
    embed: "Device app",
    guestTools: ["public_setup_guides"],
    accountTools: ["get_my_device_status", "reboot_device", "warranty_claim"],
    supportUseCases: ["Offline device", "Firmware", "Warranty"],
  },
  {
    id: "B45",
    name: "Property management",
    vertical: "Real estate",
    embed: "Resident portal",
    guestTools: ["public_apply", "touring_faq"],
    accountTools: ["get_my_lease", "create_maintenance", "pay_rent_status"],
    supportUseCases: ["Maintenance ticket", "Rent receipt", "Move-out"],
  },
  {
    id: "B46",
    name: "Real estate brokerage",
    vertical: "Real estate",
    embed: "Listing site",
    guestTools: ["public_listings", "schedule_showing_lead"],
    accountTools: ["get_my_offers", "get_my_docs"],
    supportUseCases: ["Showing time", "Offer status", "Closing docs"],
  },
  {
    id: "B47",
    name: "Coworking space",
    vertical: "Real estate",
    embed: "Member app",
    guestTools: ["public_tour", "day_pass_faq"],
    accountTools: ["get_my_membership", "book_room", "guest_pass"],
    supportUseCases: ["Book meeting room", "Access card", "Invoice"],
  },
  {
    id: "B48",
    name: "Event ticketing",
    vertical: "Entertainment",
    embed: "Event page",
    guestTools: ["public_event_info", "guest_ticket_lookup"],
    accountTools: ["get_my_tickets", "transfer_ticket", "refund_request"],
    supportUseCases: ["QR not scanning", "Transfer", "Rain policy"],
  },
  {
    id: "B49",
    name: "Streaming / media",
    vertical: "Entertainment",
    embed: "Account help",
    guestTools: ["public_catalog", "public_outage"],
    accountTools: ["get_my_subscription", "reset_devices", "cancel_plan"],
    supportUseCases: ["Too many devices", "Billing", "Content missing"],
  },
  {
    id: "B50",
    name: "Fitness / gym chain",
    vertical: "Entertainment",
    embed: "Member portal + class booking",
    guestTools: ["public_class_schedule", "guest_membership_faq"],
    accountTools: ["get_my_membership", "book_class", "freeze_membership"],
    supportUseCases: ["Book class", "Freeze", "Guest pass"],
  },
];

const EDGE_TEMPLATES = [
  ["Guest asks FAQ only", "guest", "Knowledge only; no live tool"],
  ["Guest asks account-private data", "guest", "IDENTITY_REQUIRED; ask to sign in"],
  ["Guest provides valid lookup fields", "guest", "Confirm then GUEST_LOOKUP; redacted reply"],
  ["Guest provides invalid lookup fields", "guest", "404/generic; no PII leak"],
  ["Guest brute-forces lookup ids", "attack", "Rate limit + generic errors"],
  ["Guest asks for another person's data", "guest", "Refuse CROSS_USER / no private tool"],
  ["Guest creates lead / ticket", "guest", "Confirm WRITE; no account access"],
  ["Guest after login mid-chat", "logged-in", "Upgrade to ACCOUNT tools; migrate thread"],
  ["Logged-in asks my resource", "logged-in", "Confirm → END_USER_TOKEN → owner ACL"],
  ["Logged-in asks someone else's resource", "logged-in", "CROSS_USER_DENIED; no HTTP"],
  ["Logged-in sequential id guessing", "attack", "Owner API 403/404; Aide no invent"],
  ["Logged-in expired token", "logged-in", "IDENTITY_EXPIRED; host refresh"],
  ["Logged-in missing setUser", "logged-in", "END_USER_TOKEN_REQUIRED"],
  ["Logged-in WRITE without confirm", "logged-in", "CONFIRMATION_REQUIRED card"],
  ["Logged-in approves confirm", "logged-in", "Single execute + evidence"],
  ["Logged-in denies confirm", "logged-in", "No HTTP; polite cancel"],
  ["Logged-in confirm expired", "logged-in", "Refuse; ask again"],
  ["Logged-in double-click approve", "logged-in", "Idempotent once"],
  ["Logged-in DESTRUCTIVE action", "logged-in", "Strong confirm copy + ACL"],
  ["Prompt injection ignore rules", "attack", "Policy engine blocks"],
  ["Prompt injection fake admin", "attack", "Refuse elevation"],
  ["Tool returns full PII to guest path", "system", "Sanitize before LLM"],
  ["Tool returns 403", "logged-in", "Soft fail; do not invent"],
  ["Tool returns 401", "owner", "Credential/identity health"],
  ["Tool timeout", "system", "READ retry once; WRITE no retry"],
  ["SSRF URL in template", "owner", "Blocked at save/test"],
  ["Disabled action mid-chat", "owner", "ACTION_STALE / unavailable"],
  ["Kill switch actionsEnabled=false", "owner", "No tools"],
  ["Studio test bypass confirm", "owner", "Studio may auto-run; embed never"],
  ["Embed refresh restores session", "logged-in", "Same conversation; not new chat"],
  ["Embed clearUser logout", "guest", "Drop END_USER_TOKEN tools"],
  ["Handoff to human during tool", "logged-in", "Pause AI; keep evidence"],
  ["Multi-language customer", "logged-in", "Same policy; answer in knowledge language"],
  ["Partial args missing", "logged-in", "Ask clarifying question; no tool"],
  ["Huge JSON response", "system", "Byte cap before LLM"],
  ["HTML error page from API", "system", "Do not pass to LLM"],
  ["Concurrent tool spam", "attack", "Semaphore + rate limits"],
  ["Owner misconfig OWNER_KEY on private", "owner", "Docs warn; ACL must still hold"],
  ["Owner misconfig END_USER without host", "owner", "Chat asks sign-in"],
  ["Output schema violation", "system", "Fail closed / sanitize"],
  ["Idempotent WRITE retry", "system", "Same Idempotency-Key"],
  ["Non-idempotent WRITE 5xx", "system", "Fail closed; no auto retry"],
  ["Desk agent views ToolRun", "owner", "No secrets in body"],
  ["Export run for compliance", "owner", "Evidence ids only"],
  ["Child / COPPA-sensitive ask", "guest", "Refuse collecting child PII"],
  ["Payment card in chat", "logged-in", "Never store; redirect to secure flow"],
  ["Webhook vs sync status", "system", "Prefer sync GET in MVP"],
  ["Mobile WebView setUser", "logged-in", "Same contract as web"],
  ["SPA route change loses setUser", "logged-in", "Host must re-setUser"],
  ["Cross-agent action invoke", "attack", "Blocked by agentId isolation"],
  ["Workspace daily outbound cap", "system", "Soft fail message"],
  ["MCP tool same confirm rules", "logged-in", "Confirm + identity modes"],
  ["Knowledge contradicts live status", "logged-in", "Prefer live tool result this turn"],
  ["User pastes JWT in chat", "attack", "Never ask; never log"],
  ["Social engineering confirm", "attack", "User must click Confirm"],
  ["Args changed after approve", "attack", "Re-confirm required"],
  ["List endpoint over-fetch", "attack", "Owner filters by sub; Aide caps bytes"],
  ["Email-parameter IDOR", "attack", "Must match token claims"],
  ["Phone-parameter IDOR", "attack", "Must match verified claim"],
  ["Guest tracking returns address", "guest", "Redact address before LLM"],
  ["Logged-in shares screen with friend", "logged-in", "Still ACL on token; education"],
  ["Support impersonation request", "attack", "Requires owner support role claim"],
  ["Batch cancel all", "attack", "No bulk destructive without confirm each"],
  ["Unicode homoglyph resource id", "attack", "Schema validate"],
  ["Null bytes in args", "attack", "Reject schema"],
  ["Very long message + tool", "system", "Truncate context safely"],
  ["Offline owner API", "system", "Apology; FAQ fallback"],
  ["Partial outage region", "system", "Honest status from public status tool"],
  ["GDPR deletion request", "logged-in", "WRITE confirm + owner API"],
  ["Right to access export", "logged-in", "Owner API scoped to sub"],
  ["Marketing opt-out", "logged-in", "Confirm preference update"],
  ["Accessibility: confirm keyboard", "ui", "Confirm card focusable"],
  ["Dark mode confirm readable", "ui", "Contrast OK"],
  ["Proactive message no auto tool", "guest", "No silent live call"],
  ["File upload + tool", "logged-in", "Upload then confirm action"],
  ["Feedback thumbs after tool", "logged-in", "Independent of ToolRun"],
  ["Rate limit guest IP", "attack", "429 guidance"],
  ["Rate limit per subject", "attack", "Soft cap"],
  ["Clock skew token exp", "logged-in", "Treat as expired"],
  ["Multiple tabs approve", "logged-in", "First wins; second noop"],
  ["Conversation handoff then tool", "logged-in", "Human desk owns; AI paused"],
  ["Owner rotates API key", "owner", "Revoke old; new credential"],
  ["Owner deletes tool mid-confirm", "owner", "Confirm fails closed"],
  ["Demo fixture vs live URL", "owner", "Test button distinguishes"],
  ["Brandly-style dual auth", "owner", "Public OWNER_KEY; private END_USER"],
  ["Invoice PDF link", "logged-in", "Signed URL short TTL; self only"],
  ["Statement PDF for other user", "attack", "403"],
  ["Appointment PHI in reply", "logged-in", "Minimize; owner schema"],
  ["Guest asks PHI", "guest", "Refuse; sign in"],
  ["Loan payoff for friend", "attack", "CROSS_USER_DENIED"],
  ["Freeze card social engineer", "logged-in", "Confirm + self only"],
  ["SIM swap social engineer", "attack", "Step-up / refuse in chat"],
  ["Class booking for other member", "attack", "ACL deny"],
  ["Ticket transfer phishing", "logged-in", "Confirm shows recipient"],
  ["Refund to different account", "attack", "Owner ACL deny"],
  ["Inventory for other warehouse client", "attack", "403"],
  ["Payslip for coworker", "attack", "CROSS_USER_DENIED"],
  ["Child grades for wrong parent", "attack", "Owner ACL"],
  ["Lease docs for other unit", "attack", "403"],
  ["Stream device reset for other account", "attack", "END_USER + ACL"],
];

function assertCounts() {
  if (BUSINESSES.length !== 50) {
    throw new Error(`Expected 50 businesses, got ${BUSINESSES.length}`);
  }
  if (EDGE_TEMPLATES.length !== 100) {
    throw new Error(`Expected 100 edge templates, got ${EDGE_TEMPLATES.length}`);
  }
}

assertCounts();

// --- Businesses markdown ---
let bizMd = `# F11-U — 50 businesses (universal embed catalog)

**Status:** 📋 Catalog for owners + QA  
**Parent:** [\`F11_UNIVERSAL_AUTHZ_PLAN.md\`](F11_UNIVERSAL_AUTHZ_PLAN.md)  
**Edge cases:** [\`F11_BUSINESS_EDGE_CASES.md\`](F11_BUSINESS_EDGE_CASES.md) — **100 per business (5000)**  

> Use this list when pitching or configuring Actions for any vertical. Every business embeds the same Aide spine; only **tools + owner APIs** change.

## How to read a row

| Column | Meaning |
|--------|---------|
| Embed | Where the widget typically sits |
| Guest tools | Live tools safe for anonymous (redacted / public) |
| Account tools | Require \`aideChat.setUser\` + Confirm + owner ACL |
| Support use cases | Top customer phrases |

## Catalog (50)

| ID | Business | Vertical | Embed | Guest tools | Account tools | Support use cases |
|----|----------|----------|-------|-------------|---------------|-------------------|
`;

for (const b of BUSINESSES) {
  bizMd += `| ${b.id} | ${b.name} | ${b.vertical} | ${b.embed} | ${b.guestTools.join(", ")} | ${b.accountTools.join(", ")} | ${b.supportUseCases.join("; ")} |\n`;
}

bizMd += `
## Owner setup pattern (same for all 50)

1. **Guest tools** → \`OWNER_KEY\` / public endpoints + Confirm + redacted \`outputSchema\`
2. **Account tools** → \`END_USER_TOKEN\` + Confirm + owner API \`resource.owner == sub\`
3. **Knowledge** → FAQs that never invent live status
4. **Embed** → \`setUser\` on every authenticated page load
5. **Refuse** → any request for another customer's data

## Vertical packs to prefer

| Vertical | Suggested starter pack |
|----------|------------------------|
| E-commerce | site_demo / order + tracking |
| SaaS | ticket + subscription |
| Healthcare | booking |
| Fintech | invoice / transaction (strict ACL) |
| Travel | reservation lookup |
| Logistics | guest_track |
| EdTech | enrollment |
| Food | order status |
| Utilities | outage + bill |
| Real estate | maintenance ticket |
| Entertainment | tickets / membership |

*Generated by \`scripts/generate-f11-universal-businesses.mjs\`*
`;

writeFileSync(join(DOCS, "F11_UNIVERSAL_BUSINESSES.md"), bizMd);

// --- Edge cases markdown ---
let edgeMd = `# F11-U — Business edge cases (100 × 50 = 5000)

**Status:** 📋 QA / policy backlog  
**Parent:** [\`F11_UNIVERSAL_AUTHZ_PLAN.md\`](F11_UNIVERSAL_AUTHZ_PLAN.md)  
**Businesses:** [\`F11_UNIVERSAL_BUSINESSES.md\`](F11_UNIVERSAL_BUSINESSES.md)  
**Global registry:** [\`F11_EDGE_CASE_REGISTRY.md\`](F11_EDGE_CASE_REGISTRY.md) (E0001–E1000 platform cases)

> Each business gets the **same 100 support-agent scenarios**, specialized with that business's tools and names. Expected outcomes stay **deterministic** (policy / owner ACL / confirm) — never "LLM decides".

## Summary

| Metric | Count |
|--------|------:|
| Businesses | 50 |
| Cases per business | 100 |
| **Total** | **5000** |

## Registry

| ID | Biz | Business | Actor | Scenario | Expected |
|----|-----|----------|-------|----------|----------|
`;

let n = 1;
for (const b of BUSINESSES) {
  for (let i = 0; i < EDGE_TEMPLATES.length; i++) {
    const [scenario, actor, expected] = EDGE_TEMPLATES[i];
    const id = `BE${String(n).padStart(4, "0")}`;
    const specialized = `${scenario} [${b.name} / ${b.guestTools[0] || "guest"} / ${b.accountTools[0] || "account"}]`;
    edgeMd += `| ${id} | ${b.id} | ${b.name} | ${actor} | ${specialized.replace(/\|/g, "/")} | ${expected.replace(/\|/g, "/")} |\n`;
    n++;
  }
}

edgeMd += `
## Priority automation (first 500)

Automate \`BE0001\`–\`BE0500\` (B01–B05 × 100) in \`test:f11u\` first — covers e-commerce + marketplace + grocery patterns that map to most packs.

*Generated by \`scripts/generate-f11-universal-businesses.mjs\`*
`;

writeFileSync(join(DOCS, "F11_BUSINESS_EDGE_CASES.md"), edgeMd);

console.log(
  `Wrote 50 businesses + ${n - 1} edge cases to docs/features/`
);
