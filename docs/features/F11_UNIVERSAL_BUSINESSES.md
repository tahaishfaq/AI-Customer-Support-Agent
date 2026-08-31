# F11-U — 50 businesses (universal embed catalog)

**Status:** 📋 Catalog for owners + QA  
**Parent:** [`F11_UNIVERSAL_AUTHZ_PLAN.md`](F11_UNIVERSAL_AUTHZ_PLAN.md)  
**Edge cases:** [`F11_BUSINESS_EDGE_CASES.md`](F11_BUSINESS_EDGE_CASES.md) — **100 per business (5000)**  

> Use this list when pitching or configuring Actions for any vertical. Every business embeds the same Aide spine; only **tools + owner APIs** change.

## How to read a row

| Column | Meaning |
|--------|---------|
| Embed | Where the widget typically sits |
| Guest tools | Live tools safe for anonymous (redacted / public) |
| Account tools | Require `aideChat.setUser` + Confirm + owner ACL |
| Support use cases | Top customer phrases |

## Catalog (50)

| ID | Business | Vertical | Embed | Guest tools | Account tools | Support use cases |
|----|----------|----------|-------|-------------|---------------|-------------------|
| B01 | D2C apparel store | E-commerce | Product pages + checkout | guest_track_order, public_product_info, create_lead | get_my_order, start_return, update_address | Where is my order?; Size guide; Start a return |
| B02 | Marketplace (multi-vendor) | E-commerce | Listing + buyer dashboard | public_listing_status, guest_order_lookup | get_my_purchases, message_seller, open_dispute | Buyer protection; Seller reply time; Dispute status |
| B03 | Grocery / quick commerce | E-commerce | App WebView + website | public_store_hours, guest_delivery_eta | get_my_delivery, replace_item, cancel_order | Late delivery; Missing item; Refund to wallet |
| B04 | Electronics retailer | E-commerce | PDP + support hub | warranty_lookup, public_specs | get_my_warranty, book_repair, claim_warranty | Warranty check; Repair booking; Serial not found |
| B05 | Subscription box | E-commerce | Account portal | public_plan_compare | get_my_subscription, skip_month, change_plan | Skip next box; Change plan; Billing date |
| B06 | SaaS B2B product | SaaS | In-app help widget | public_status_page, docs_search | get_my_usage, get_my_plan, create_support_ticket | Quota exceeded; Invite teammate; Billing invoice |
| B07 | Developer API platform | SaaS | Docs + dashboard | public_api_status, docs_search | list_my_keys_meta, get_my_quota, rotate_key_request | 401 from API; Rate limit; Key rotation |
| B08 | HR / payroll SaaS | SaaS | Employee portal | public_careers_faq | get_my_payslip, request_leave, update_bank_mask | Payslip missing; Leave balance; Tax form |
| B09 | CRM / sales SaaS | SaaS | App sidebar | public_pricing | get_my_workspace, invite_user, export_request | Seat limit; Export CSV; SSO setup |
| B10 | Analytics SaaS | SaaS | Dashboard help | public_docs | get_my_billing, list_my_projects, create_ticket | Data delay; Billing; Project access |
| B11 | Clinic / appointments | Healthcare | Booking site | public_services, public_location_hours | get_my_appointment, reschedule, cancel_appointment | Next appointment; Reschedule; Insurance FAQ |
| B12 | Dental practice | Healthcare | Patient portal | public_services, new_patient_lead | get_my_visit, request_records | Cleaning due; Records request; Payment plan |
| B13 | Telehealth | Healthcare | Patient app WebView | public_how_it_works | get_my_visit_link, upload_intake, cancel_visit | Join link; Doctor late; Prescription status |
| B14 | Pharmacy delivery | Healthcare | Order tracking page | guest_rx_pickup_status | get_my_prescription, refill_request | Ready for pickup; Refill; Insurance reject |
| B15 | Mental health platform | Healthcare | Member portal | public_crisis_resources | get_my_session, reschedule_therapist | Session time; Therapist change; Billing |
| B16 | Banking / fintech app | Fintech | Secure WebView help | public_branch_atm, public_fees | get_my_balance_summary, list_my_transactions, freeze_card | Card lost; Failed transfer; Statement |
| B17 | Neobank / wallet | Fintech | In-app chat | public_kyc_faq | get_my_limits, dispute_txn, close_account_request | KYC pending; Dispute charge; Limit raise |
| B18 | Insurance (P&C) | Fintech | Claims portal | public_coverage_faq, guest_claim_status | get_my_policy, file_claim, upload_docs | Claim status; Coverage question; Premium due |
| B19 | Lending / BNPL | Fintech | Checkout + account | public_eligibility_faq | get_my_loan, make_payment, defer_request | Next payment; Late fee; Payoff quote |
| B20 | Crypto exchange (careful) | Fintech | Logged-in support only for private | public_status, public_fees | get_my_withdraw_status, get_my_kyc_status | Withdrawal pending; 2FA reset process; Deposit not showing |
| B21 | Hotel / hospitality | Travel | Booking site + stay app | public_amenities, guest_reservation_lookup | get_my_reservation, modify_stay, late_checkout_request | Check-in time; Room type; Cancel policy |
| B22 | Airline | Travel | Manage booking | public_flight_status, guest_pnr_lookup | get_my_booking, request_seat, baggage_claim | Flight delayed; Seat change; Baggage |
| B23 | Car rental | Travel | Reservation portal | public_locations, guest_reservation_lookup | get_my_rental, extend_rental, damage_report | Pickup location; Extend trip; Fuel policy |
| B24 | Tour operator | Travel | Trip page | public_itinerary, guest_booking_lookup | get_my_tour, add_traveler | Meeting point; Weather cancel; Visa FAQ |
| B25 | Ride-hailing | Travel | Rider app help | public_safety_faq | get_my_trip, report_issue, lost_item | Fare dispute; Driver feedback; Lost phone |
| B26 | Parcel / courier | Logistics | Track page | guest_track_parcel, public_service_points | get_my_shipment, schedule_redelivery, claim_damage | Out for delivery; Wrong address; Damaged box |
| B27 | Freight / B2B shipping | Logistics | Shipper portal | public_transit_times | get_my_bol, book_pickup, dispute_invoice | BOL status; Detention fees; Pickup window |
| B28 | Last-mile courier | Logistics | Merchant dashboard | guest_track_by_code | list_my_deliveries, reroute_stop | Failed attempt; COD issue; Reroute |
| B29 | Warehouse / 3PL | Logistics | Client portal | public_sla_faq | get_my_inventory, create_outbound, get_asn_status | SKU stock; ASN delay; Outbound cut-off |
| B30 | Moving company | Logistics | Quote + booking | public_quote_faq, guest_job_status | get_my_move, reschedule_move | Crew ETA; Extra boxes; Damage claim |
| B31 | Online university | EdTech | LMS help | public_programs, admissions_faq | get_my_enrollment, get_my_grades_summary, request_transcript | Enrollment; Deadline; Transcript |
| B32 | K-12 school portal | EdTech | Parent portal | public_calendar | get_my_child_attendance, pay_fees, message_teacher_ticket | Attendance; Fee due; Bus route |
| B33 | Coding bootcamp | EdTech | Student dashboard | public_syllabus | get_my_progress, book_mentor, defer_cohort | Mentor slot; Project feedback; Defer |
| B34 | Language learning app | EdTech | In-app | public_pricing | get_my_streak, manage_subscription, reset_progress_request | Billing; Streak lost; Family plan |
| B35 | Corporate L&D | EdTech | Employee LMS | public_catalog | get_my_required_courses, get_certificate | Compliance due; Certificate; Manager assign |
| B36 | Restaurant / QSR | Food | Order site | public_menu, guest_order_status | get_my_order, reorder, loyalty_balance | Wrong item; Delivery late; Loyalty points |
| B37 | Cloud kitchen / delivery | Food | Order tracking | guest_order_status | get_my_order, report_missing_item | ETA; Missing item; Promo code |
| B38 | Grocery wholesale B2B | Food | Buyer portal | public_catalog | get_my_po, place_order, invoice_status | PO status; Credit limit; Invoice |
| B39 | Meal kit | Food | Account | public_menu_week | get_my_box, skip_week, update_allergens | Skip week; Allergy; Delivery day |
| B40 | Coffee subscription | Food | Shop + account | public_roasts, guest_track | get_my_sub, pause, change_grind | Pause; Grind type; Gift |
| B41 | ISP / telecom | Utilities | Self-serve portal | public_outage_map, guest_ticket_status | get_my_service, report_outage, upgrade_plan | Outage; Bill dispute; Speed test tips |
| B42 | Electric utility | Utilities | Account portal | public_outage | get_my_bill, report_outage, payment_arrangement | High bill; Outage; Payment plan |
| B43 | Mobile carrier | Utilities | App help | public_coverage, guest_sim_activation_faq | get_my_plan, add_data, sim_swap_request | Roaming; SIM swap; Bill shock |
| B44 | Smart home / IoT | Utilities | Device app | public_setup_guides | get_my_device_status, reboot_device, warranty_claim | Offline device; Firmware; Warranty |
| B45 | Property management | Real estate | Resident portal | public_apply, touring_faq | get_my_lease, create_maintenance, pay_rent_status | Maintenance ticket; Rent receipt; Move-out |
| B46 | Real estate brokerage | Real estate | Listing site | public_listings, schedule_showing_lead | get_my_offers, get_my_docs | Showing time; Offer status; Closing docs |
| B47 | Coworking space | Real estate | Member app | public_tour, day_pass_faq | get_my_membership, book_room, guest_pass | Book meeting room; Access card; Invoice |
| B48 | Event ticketing | Entertainment | Event page | public_event_info, guest_ticket_lookup | get_my_tickets, transfer_ticket, refund_request | QR not scanning; Transfer; Rain policy |
| B49 | Streaming / media | Entertainment | Account help | public_catalog, public_outage | get_my_subscription, reset_devices, cancel_plan | Too many devices; Billing; Content missing |
| B50 | Fitness / gym chain | Entertainment | Member portal + class booking | public_class_schedule, guest_membership_faq | get_my_membership, book_class, freeze_membership | Book class; Freeze; Guest pass |

## Owner setup pattern (same for all 50)

1. **Guest tools** → `OWNER_KEY` / public endpoints + Confirm + redacted `outputSchema`
2. **Account tools** → `END_USER_TOKEN` + Confirm + owner API `resource.owner == sub`
3. **Knowledge** → FAQs that never invent live status
4. **Embed** → `setUser` on every authenticated page load
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

*Generated by `scripts/generate-f11-universal-businesses.mjs`*
