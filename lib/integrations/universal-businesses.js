/**
 * F11-U Sprint A — client-safe catalog of verticals + 50 business templates.
 * Runtime is always the same 5 slots; businesses only suggest names/copy.
 */
import { applyAccessClass } from "../actions/access-class.js";

export const UNIVERSAL_VERTICALS = Object.freeze([
  { id: "all", label: "All" },
  { id: "E-commerce", label: "E-commerce" },
  { id: "SaaS", label: "SaaS" },
  { id: "Healthcare", label: "Healthcare" },
  { id: "Fintech", label: "Fintech" },
  { id: "Travel", label: "Travel" },
  { id: "Logistics", label: "Logistics" },
  { id: "EdTech", label: "EdTech" },
  { id: "Food", label: "Food" },
  { id: "Utilities", label: "Utilities" },
  { id: "Real estate", label: "Real estate" },
  { id: "Entertainment", label: "Entertainment" },
]);

/** @typedef {{ id: string, name: string, vertical: string, embed: string, guestTools: string[], accountTools: string[], supportUseCases: string[] }} UniversalBusiness */

/** @type {UniversalBusiness[]} */
export const UNIVERSAL_BUSINESSES = Object.freeze([
  { id: "B01", name: "D2C apparel store", vertical: "E-commerce", embed: "Product pages + checkout", guestTools: ["guest_track_order", "public_product_info", "create_lead"], accountTools: ["get_my_order", "start_return", "update_address"], supportUseCases: ["Where is my order?", "Size guide", "Start a return"] },
  { id: "B02", name: "Marketplace (multi-vendor)", vertical: "E-commerce", embed: "Listing + buyer dashboard", guestTools: ["public_listing_status", "guest_order_lookup"], accountTools: ["get_my_purchases", "message_seller", "open_dispute"], supportUseCases: ["Buyer protection", "Seller reply time", "Dispute status"] },
  { id: "B03", name: "Grocery / quick commerce", vertical: "E-commerce", embed: "App WebView + website", guestTools: ["public_store_hours", "guest_delivery_eta"], accountTools: ["get_my_delivery", "replace_item", "cancel_order"], supportUseCases: ["Late delivery", "Missing item", "Refund to wallet"] },
  { id: "B04", name: "Electronics retailer", vertical: "E-commerce", embed: "PDP + support hub", guestTools: ["warranty_lookup", "public_specs"], accountTools: ["get_my_warranty", "book_repair", "claim_warranty"], supportUseCases: ["Warranty check", "Repair booking", "Serial not found"] },
  { id: "B05", name: "Subscription box", vertical: "E-commerce", embed: "Account portal", guestTools: ["public_plan_compare"], accountTools: ["get_my_subscription", "skip_month", "change_plan"], supportUseCases: ["Skip next box", "Change plan", "Billing date"] },
  { id: "B06", name: "SaaS B2B product", vertical: "SaaS", embed: "In-app help widget", guestTools: ["public_status_page", "docs_search"], accountTools: ["get_my_usage", "get_my_plan", "create_support_ticket"], supportUseCases: ["Quota exceeded", "Invite teammate", "Billing invoice"] },
  { id: "B07", name: "Developer API platform", vertical: "SaaS", embed: "Docs + dashboard", guestTools: ["public_api_status", "docs_search"], accountTools: ["list_my_keys_meta", "get_my_quota", "rotate_key_request"], supportUseCases: ["401 from API", "Rate limit", "Key rotation"] },
  { id: "B08", name: "HR / payroll SaaS", vertical: "SaaS", embed: "Employee portal", guestTools: ["public_careers_faq"], accountTools: ["get_my_payslip", "request_leave", "update_bank_mask"], supportUseCases: ["Payslip missing", "Leave balance", "Tax form"] },
  { id: "B09", name: "CRM / sales SaaS", vertical: "SaaS", embed: "App sidebar", guestTools: ["public_pricing"], accountTools: ["get_my_workspace", "invite_user", "export_request"], supportUseCases: ["Seat limit", "Export CSV", "SSO setup"] },
  { id: "B10", name: "Analytics SaaS", vertical: "SaaS", embed: "Dashboard help", guestTools: ["public_docs"], accountTools: ["get_my_billing", "list_my_projects", "create_ticket"], supportUseCases: ["Data delay", "Billing", "Project access"] },
  { id: "B11", name: "Clinic / appointments", vertical: "Healthcare", embed: "Booking site", guestTools: ["public_services", "public_location_hours"], accountTools: ["get_my_appointment", "reschedule", "cancel_appointment"], supportUseCases: ["Next appointment", "Reschedule", "Insurance FAQ"] },
  { id: "B12", name: "Dental practice", vertical: "Healthcare", embed: "Patient portal", guestTools: ["public_services", "new_patient_lead"], accountTools: ["get_my_visit", "request_records"], supportUseCases: ["Cleaning due", "Records request", "Payment plan"] },
  { id: "B13", name: "Telehealth", vertical: "Healthcare", embed: "Patient app WebView", guestTools: ["public_how_it_works"], accountTools: ["get_my_visit_link", "upload_intake", "cancel_visit"], supportUseCases: ["Join link", "Doctor late", "Prescription status"] },
  { id: "B14", name: "Pharmacy delivery", vertical: "Healthcare", embed: "Order tracking page", guestTools: ["guest_rx_pickup_status"], accountTools: ["get_my_prescription", "refill_request"], supportUseCases: ["Ready for pickup", "Refill", "Insurance reject"] },
  { id: "B15", name: "Mental health platform", vertical: "Healthcare", embed: "Member portal", guestTools: ["public_crisis_resources"], accountTools: ["get_my_session", "reschedule_therapist"], supportUseCases: ["Session time", "Therapist change", "Billing"] },
  { id: "B16", name: "Banking / fintech app", vertical: "Fintech", embed: "Secure WebView help", guestTools: ["public_branch_atm", "public_fees"], accountTools: ["get_my_balance_summary", "list_my_transactions", "freeze_card"], supportUseCases: ["Card lost", "Failed transfer", "Statement"] },
  { id: "B17", name: "Neobank / wallet", vertical: "Fintech", embed: "In-app chat", guestTools: ["public_kyc_faq"], accountTools: ["get_my_limits", "dispute_txn", "close_account_request"], supportUseCases: ["KYC pending", "Dispute charge", "Limit raise"] },
  { id: "B18", name: "Insurance (P&C)", vertical: "Fintech", embed: "Claims portal", guestTools: ["public_coverage_faq", "guest_claim_status"], accountTools: ["get_my_policy", "file_claim", "upload_docs"], supportUseCases: ["Claim status", "Coverage question", "Premium due"] },
  { id: "B19", name: "Lending / BNPL", vertical: "Fintech", embed: "Checkout + account", guestTools: ["public_eligibility_faq"], accountTools: ["get_my_loan", "make_payment", "defer_request"], supportUseCases: ["Next payment", "Late fee", "Payoff quote"] },
  { id: "B20", name: "Crypto exchange (careful)", vertical: "Fintech", embed: "Logged-in support only for private", guestTools: ["public_status", "public_fees"], accountTools: ["get_my_withdraw_status", "get_my_kyc_status"], supportUseCases: ["Withdrawal pending", "2FA reset process", "Deposit not showing"] },
  { id: "B21", name: "Hotel / hospitality", vertical: "Travel", embed: "Booking site + stay app", guestTools: ["public_amenities", "guest_reservation_lookup"], accountTools: ["get_my_reservation", "modify_stay", "late_checkout_request"], supportUseCases: ["Check-in time", "Room type", "Cancel policy"] },
  { id: "B22", name: "Airline", vertical: "Travel", embed: "Manage booking", guestTools: ["public_flight_status", "guest_pnr_lookup"], accountTools: ["get_my_booking", "request_seat", "baggage_claim"], supportUseCases: ["Flight delayed", "Seat change", "Baggage"] },
  { id: "B23", name: "Car rental", vertical: "Travel", embed: "Reservation portal", guestTools: ["public_locations", "guest_reservation_lookup"], accountTools: ["get_my_rental", "extend_rental", "damage_report"], supportUseCases: ["Pickup location", "Extend trip", "Fuel policy"] },
  { id: "B24", name: "Tour operator", vertical: "Travel", embed: "Trip page", guestTools: ["public_itinerary", "guest_booking_lookup"], accountTools: ["get_my_tour", "add_traveler"], supportUseCases: ["Meeting point", "Weather cancel", "Visa FAQ"] },
  { id: "B25", name: "Ride-hailing", vertical: "Travel", embed: "Rider app help", guestTools: ["public_safety_faq"], accountTools: ["get_my_trip", "report_issue", "lost_item"], supportUseCases: ["Fare dispute", "Driver feedback", "Lost phone"] },
  { id: "B26", name: "Parcel / courier", vertical: "Logistics", embed: "Track page", guestTools: ["guest_track_parcel", "public_service_points"], accountTools: ["get_my_shipment", "schedule_redelivery", "claim_damage"], supportUseCases: ["Out for delivery", "Wrong address", "Damaged box"] },
  { id: "B27", name: "Freight / B2B shipping", vertical: "Logistics", embed: "Shipper portal", guestTools: ["public_transit_times"], accountTools: ["get_my_bol", "book_pickup", "dispute_invoice"], supportUseCases: ["BOL status", "Detention fees", "Pickup window"] },
  { id: "B28", name: "Last-mile courier", vertical: "Logistics", embed: "Merchant dashboard", guestTools: ["guest_track_by_code"], accountTools: ["list_my_deliveries", "reroute_stop"], supportUseCases: ["Failed attempt", "COD issue", "Reroute"] },
  { id: "B29", name: "Warehouse / 3PL", vertical: "Logistics", embed: "Client portal", guestTools: ["public_sla_faq"], accountTools: ["get_my_inventory", "create_outbound", "get_asn_status"], supportUseCases: ["SKU stock", "ASN delay", "Outbound cut-off"] },
  { id: "B30", name: "Moving company", vertical: "Logistics", embed: "Quote + booking", guestTools: ["public_quote_faq", "guest_job_status"], accountTools: ["get_my_move", "reschedule_move"], supportUseCases: ["Crew ETA", "Extra boxes", "Damage claim"] },
  { id: "B31", name: "Online university", vertical: "EdTech", embed: "LMS help", guestTools: ["public_programs", "admissions_faq"], accountTools: ["get_my_enrollment", "get_my_grades_summary", "request_transcript"], supportUseCases: ["Enrollment", "Deadline", "Transcript"] },
  { id: "B32", name: "K-12 school portal", vertical: "EdTech", embed: "Parent portal", guestTools: ["public_calendar"], accountTools: ["get_my_child_attendance", "pay_fees", "message_teacher_ticket"], supportUseCases: ["Attendance", "Fee due", "Bus route"] },
  { id: "B33", name: "Coding bootcamp", vertical: "EdTech", embed: "Student dashboard", guestTools: ["public_syllabus"], accountTools: ["get_my_progress", "book_mentor", "defer_cohort"], supportUseCases: ["Mentor slot", "Project feedback", "Defer"] },
  { id: "B34", name: "Language learning app", vertical: "EdTech", embed: "In-app", guestTools: ["public_pricing"], accountTools: ["get_my_streak", "manage_subscription", "reset_progress_request"], supportUseCases: ["Billing", "Streak lost", "Family plan"] },
  { id: "B35", name: "Corporate L&D", vertical: "EdTech", embed: "Employee LMS", guestTools: ["public_catalog"], accountTools: ["get_my_required_courses", "get_certificate"], supportUseCases: ["Compliance due", "Certificate", "Manager assign"] },
  { id: "B36", name: "Restaurant / QSR", vertical: "Food", embed: "Order site", guestTools: ["public_menu", "guest_order_status"], accountTools: ["get_my_order", "reorder", "loyalty_balance"], supportUseCases: ["Wrong item", "Delivery late", "Loyalty points"] },
  { id: "B37", name: "Cloud kitchen / delivery", vertical: "Food", embed: "Order tracking", guestTools: ["guest_order_status"], accountTools: ["get_my_order", "report_missing_item"], supportUseCases: ["ETA", "Missing item", "Promo code"] },
  { id: "B38", name: "Grocery wholesale B2B", vertical: "Food", embed: "Buyer portal", guestTools: ["public_catalog"], accountTools: ["get_my_po", "place_order", "invoice_status"], supportUseCases: ["PO status", "Credit limit", "Invoice"] },
  { id: "B39", name: "Meal kit", vertical: "Food", embed: "Account", guestTools: ["public_menu_week"], accountTools: ["get_my_box", "skip_week", "update_allergens"], supportUseCases: ["Skip week", "Allergy", "Delivery day"] },
  { id: "B40", name: "Coffee subscription", vertical: "Food", embed: "Shop + account", guestTools: ["public_roasts", "guest_track"], accountTools: ["get_my_sub", "pause", "change_grind"], supportUseCases: ["Pause", "Grind type", "Gift"] },
  { id: "B41", name: "ISP / telecom", vertical: "Utilities", embed: "Self-serve portal", guestTools: ["public_outage_map", "guest_ticket_status"], accountTools: ["get_my_service", "report_outage", "upgrade_plan"], supportUseCases: ["Outage", "Bill dispute", "Speed test tips"] },
  { id: "B42", name: "Electric utility", vertical: "Utilities", embed: "Account portal", guestTools: ["public_outage"], accountTools: ["get_my_bill", "report_outage", "payment_arrangement"], supportUseCases: ["High bill", "Outage", "Payment plan"] },
  { id: "B43", name: "Mobile carrier", vertical: "Utilities", embed: "App help", guestTools: ["public_coverage", "guest_sim_activation_faq"], accountTools: ["get_my_plan", "add_data", "sim_swap_request"], supportUseCases: ["Roaming", "SIM swap", "Bill shock"] },
  { id: "B44", name: "Smart home / IoT", vertical: "Utilities", embed: "Device app", guestTools: ["public_setup_guides"], accountTools: ["get_my_device_status", "reboot_device", "warranty_claim"], supportUseCases: ["Offline device", "Firmware", "Warranty"] },
  { id: "B45", name: "Property management", vertical: "Real estate", embed: "Resident portal", guestTools: ["public_apply", "touring_faq"], accountTools: ["get_my_lease", "create_maintenance", "pay_rent_status"], supportUseCases: ["Maintenance ticket", "Rent receipt", "Move-out"] },
  { id: "B46", name: "Real estate brokerage", vertical: "Real estate", embed: "Listing site", guestTools: ["public_listings", "schedule_showing_lead"], accountTools: ["get_my_offers", "get_my_docs"], supportUseCases: ["Showing time", "Offer status", "Closing docs"] },
  { id: "B47", name: "Coworking space", vertical: "Real estate", embed: "Member app", guestTools: ["public_tour", "day_pass_faq"], accountTools: ["get_my_membership", "book_room", "guest_pass"], supportUseCases: ["Book meeting room", "Access card", "Invoice"] },
  { id: "B48", name: "Event ticketing", vertical: "Entertainment", embed: "Event page", guestTools: ["public_event_info", "guest_ticket_lookup"], accountTools: ["get_my_tickets", "transfer_ticket", "refund_request"], supportUseCases: ["QR not scanning", "Transfer", "Rain policy"] },
  { id: "B49", name: "Streaming / media", vertical: "Entertainment", embed: "Account help", guestTools: ["public_catalog", "public_outage"], accountTools: ["get_my_subscription", "reset_devices", "cancel_plan"], supportUseCases: ["Too many devices", "Billing", "Content missing"] },
  { id: "B50", name: "Fitness / gym chain", vertical: "Entertainment", embed: "Member portal + class booking", guestTools: ["public_class_schedule", "guest_membership_faq"], accountTools: ["get_my_membership", "book_class", "freeze_membership"], supportUseCases: ["Book class", "Freeze", "Guest pass"] },
]);

export function getUniversalBusiness(id) {
  return UNIVERSAL_BUSINESSES.find((b) => b.id === id) || null;
}

export function filterUniversalBusinesses(verticalId) {
  if (!verticalId || verticalId === "all") return [...UNIVERSAL_BUSINESSES];
  return UNIVERSAL_BUSINESSES.filter((b) => b.vertical === verticalId);
}

export function universalPackId(businessId) {
  return `universal:${String(businessId || "").toUpperCase()}`;
}

export function parseUniversalPackId(packId) {
  const m = String(packId || "").match(/^universal:(B\d{2})$/i);
  return m ? m[1].toUpperCase() : null;
}

function safeToolName(raw, fallback) {
  const cleaned = String(raw || fallback || "tool")
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return (cleaned || fallback || "tool").slice(0, 48);
}

/**
 * Build 4 installable demo-backed slot templates for a business.
 * Owner replaces URLs with live APIs later.
 */
export function buildUniversalSlotTemplates(business) {
  if (!business) return [];
  const guestName = safeToolName(business.guestTools?.[0], "guest_lookup");
  const publicName = safeToolName(
    business.guestTools?.find((t) => /public|docs|faq|menu|status/i.test(t)) ||
      "public_info",
    "public_info"
  );
  const accountName = safeToolName(business.accountTools?.[0], "get_my_resource");
  const writeName = safeToolName(
    business.accountTools?.find((t) =>
      /create|cancel|update|request|report|book|file|start|open/i.test(t)
    ) || "create_support_request",
    "create_support_request"
  );

  const publicAccess = applyAccessClass("PUBLIC_READ");
  const guestAccess = applyAccessClass("GUEST_LOOKUP");
  const accountAccess = applyAccessClass("ACCOUNT_READ");
  const writeAccess = applyAccessClass("ACCOUNT_WRITE");

  return [
    {
      slot: "PUBLIC_READ",
      name: publicName === guestName ? `${publicName}_public` : publicName,
      description: `Public info for ${business.name} (demo help search — point URL at your API).`,
      method: "GET",
      urlTemplate: "http://127.0.0.1:3000/api/demo/help?q={{query}}",
      headersJson: { Accept: "application/json" },
      inputSchemaJson: { query: "string" },
      ...publicAccess,
      testArgs: { query: "shipping" },
    },
    {
      slot: "GUEST_LOOKUP",
      name: guestName,
      description: `Guest lookup for ${business.name} (demo order status — replace with redacted tracking API).`,
      method: "GET",
      urlTemplate: "http://127.0.0.1:3000/api/demo/orders/{{orderId}}",
      headersJson: { Accept: "application/json" },
      inputSchemaJson: { orderId: "string" },
      ...guestAccess,
      testArgs: {
        orderId:
          business.vertical === "Logistics" ? "PCL-100" : "ORD-100",
      },
    },
    {
      slot: "ACCOUNT_READ",
      name: accountName,
      description: `Signed-in read for ${business.name} (needs setUser + your ACL). Demo URL for studio smoke.`,
      method: "GET",
      urlTemplate: "http://127.0.0.1:3000/api/demo/orders/{{orderId}}",
      headersJson: { Accept: "application/json" },
      inputSchemaJson: { orderId: "string" },
      ...accountAccess,
      testArgs: {
        orderId:
          business.vertical === "Logistics" ? "PCL-100" : "ORD-100",
      },
    },
    {
      slot: "ACCOUNT_WRITE",
      name: writeName === accountName ? `${writeName}_write` : writeName,
      description: `Signed-in change for ${business.name} (Confirm required). Demo ticket create.`,
      method: "POST",
      urlTemplate: "http://127.0.0.1:3000/api/demo/tickets",
      headersJson: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      inputSchemaJson: { subject: "string", body: "string" },
      ...writeAccess,
      idempotent: true,
      testArgs: { subject: "Help request", body: "Need assistance" },
    },
  ];
}

/** Blank 5-slot starters for custom (non-catalog) businesses. */
export const CUSTOM_SLOT_STARTERS = Object.freeze([
  {
    id: "slot_public",
    label: "Anyone (public info)",
    accessClass: "PUBLIC_READ",
    name: "public_info",
    description: "Public catalog / hours / status — no personal data.",
    method: "GET",
    urlTemplate: "http://127.0.0.1:3000/api/demo/help?q={{query}}",
    inputSchemaJson: { query: "string" },
    testArgs: { query: "shipping" },
  },
  {
    id: "slot_guest",
    label: "Guests with lookup code",
    accessClass: "GUEST_LOOKUP",
    name: "guest_lookup",
    description: "Tracking / PNR / ticket code — redacted reply only.",
    method: "GET",
    urlTemplate: "http://127.0.0.1:3000/api/demo/orders/{{orderId}}",
    inputSchemaJson: { orderId: "string" },
    testArgs: { orderId: "ORD-100" },
  },
  {
    id: "slot_account_read",
    label: "Signed-in (read)",
    accessClass: "ACCOUNT_READ",
    name: "get_my_resource",
    description: "My order / plan / appointment — setUser + ACL.",
    method: "GET",
    urlTemplate: "http://127.0.0.1:3000/api/demo/orders/{{orderId}}",
    inputSchemaJson: { orderId: "string" },
    testArgs: { orderId: "ORD-100" },
  },
  {
    id: "slot_account_write",
    label: "Signed-in (change)",
    accessClass: "ACCOUNT_WRITE",
    name: "create_support_request",
    description: "Create ticket / update preference — Confirm first.",
    method: "POST",
    urlTemplate: "http://127.0.0.1:3000/api/demo/tickets",
    inputSchemaJson: { subject: "string", body: "string" },
    testArgs: { subject: "Help", body: "Need help" },
  },
  {
    id: "slot_destructive",
    label: "Signed-in (cancel / delete)",
    accessClass: "DESTRUCTIVE",
    name: "cancel_my_resource",
    description: "Cancel / refund / freeze — strong Confirm + ACL.",
    method: "POST",
    urlTemplate: "http://127.0.0.1:3000/api/demo/tickets",
    inputSchemaJson: { reason: "string" },
    testArgs: { reason: "User requested cancel" },
  },
]);
