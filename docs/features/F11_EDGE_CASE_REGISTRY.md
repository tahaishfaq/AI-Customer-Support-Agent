# F11 — Edge case registry (1000 minimum)

**Status:** 📋 Planning / test backlog  
**Parent:** [`F11_UNIVERSAL_AUTHZ_PLAN.md`](F11_UNIVERSAL_AUTHZ_PLAN.md)  
**Use:** QA matrix · policy tests · owner docs · `test:f11u` backlog  

> **Rule:** Every row must have a deterministic expected outcome. LLM text is never the security boundary.

## Summary

| Domain | IDs | Count |
|--------|-----|-------|
| D01 Identity & session | E01xxxx | 100 |
| D02 Authorization radius (self only) | E02xxxx | 100 |
| D03 Guest access & public lookups | E03xxxx | 100 |
| D04 Confirmation & consent | E04xxxx | 100 |
| D05 Owner configuration | E05xxxx | 100 |
| D06 HTTP execution & network | E06xxxx | 100 |
| D07 LLM & prompt injection | E07xxxx | 100 |
| D08 PII redaction & response safety | E08xxxx | 100 |
| D09 Multi-channel embed & host | E09xxxx | 100 |
| D10 Ops, audit & compliance | E10xxxx | 100 |
| **Total** | **E0001–E1000** | **1000** |

## How to use

1. **Owner onboarding** — start with D03 (guest) + D02 (logged-in self) + D05 (config).
2. **Automated tests** — map high-risk IDs to `test:f11u-*` scripts (prioritize E0001–E0200).
3. **Pen test** — D06, D07, D02 attack rows.
4. **Embed host** — D09 + F14 setUser contract.

## Registry

| ID | Domain | Actor | Scenario | Expected | Layer |
|----|--------|-------|----------|----------|-------|
| E0001 | D01 | guest | Guest opens embed | No END_USER_TOKEN tools; no subject stored | Aide+Owner |
| E0002 | D01 | owner | Guest opens embed (studio) | No END_USER_TOKEN tools; no subject stored | Aide+Owner |
| E0003 | D01 | embed | Guest opens embed (embed) | No END_USER_TOKEN tools; no subject stored | Aide+Owner |
| E0004 | D01 | system | Guest opens embed (retry) | No END_USER_TOKEN tools; no subject stored | Aide+Owner |
| E0005 | D01 | system | Guest opens embed (concurrent) | No END_USER_TOKEN tools; no subject stored | Aide+Owner |
| E0006 | D01 | guest | Guest provides email only | Treat as unverified; no private lookup | Aide+Owner |
| E0007 | D01 | owner | Guest provides email only (studio) | Treat as unverified; no private lookup | Aide+Owner |
| E0008 | D01 | embed | Guest provides email only (embed) | Treat as unverified; no private lookup | Aide+Owner |
| E0009 | D01 | system | Guest provides email only (retry) | Treat as unverified; no private lookup | Aide+Owner |
| E0010 | D01 | system | Guest provides email only (concurrent) | Treat as unverified; no private lookup | Aide+Owner |
| E0011 | D01 | guest | Guest provides order id | Public lookup only if action is GUEST_LOOKUP + owner API returns redacted | Aide+Owner |
| E0012 | D01 | owner | Guest provides order id (studio) | Public lookup only if action is GUEST_LOOKUP + owner API returns redacted | Aide+Owner |
| E0013 | D01 | embed | Guest provides order id (embed) | Public lookup only if action is GUEST_LOOKUP + owner API returns redacted | Aide+Owner |
| E0014 | D01 | system | Guest provides order id (retry) | Public lookup only if action is GUEST_LOOKUP + owner API returns redacted | Aide+Owner |
| E0015 | D01 | system | Guest provides order id (concurrent) | Public lookup only if action is GUEST_LOOKUP + owner API returns redacted | Aide+Owner |
| E0016 | D01 | logged-in | Logged-in setUser on load | Restore user-scoped chat; bind identity | Aide+Owner |
| E0017 | D01 | owner | Logged-in setUser on load (studio) | Restore user-scoped chat; bind identity | Aide+Owner |
| E0018 | D01 | embed | Logged-in setUser on load (embed) | Restore user-scoped chat; bind identity | Aide+Owner |
| E0019 | D01 | system | Logged-in setUser on load (retry) | Restore user-scoped chat; bind identity | Aide+Owner |
| E0020 | D01 | system | Logged-in setUser on load (concurrent) | Restore user-scoped chat; bind identity | Aide+Owner |
| E0021 | D01 | guest | setUser null on handshake | Do not wipe in-progress chat | Aide+Owner |
| E0022 | D01 | owner | setUser null on handshake (studio) | Do not wipe in-progress chat | Aide+Owner |
| E0023 | D01 | embed | setUser null on handshake (embed) | Do not wipe in-progress chat | Aide+Owner |
| E0024 | D01 | system | setUser null on handshake (retry) | Do not wipe in-progress chat | Aide+Owner |
| E0025 | D01 | system | setUser null on handshake (concurrent) | Do not wipe in-progress chat | Aide+Owner |
| E0026 | D01 | logged-in | setUser after mid-chat login | Migrate guest thread; bind tools to subject | Aide+Owner |
| E0027 | D01 | owner | setUser after mid-chat login (studio) | Migrate guest thread; bind tools to subject | Aide+Owner |
| E0028 | D01 | embed | setUser after mid-chat login (embed) | Migrate guest thread; bind tools to subject | Aide+Owner |
| E0029 | D01 | system | setUser after mid-chat login (retry) | Migrate guest thread; bind tools to subject | Aide+Owner |
| E0030 | D01 | system | setUser after mid-chat login (concurrent) | Migrate guest thread; bind tools to subject | Aide+Owner |
| E0031 | D01 | logged-in | Expired accessToken | IDENTITY_EXPIRED; host refresh hook | Aide+Owner |
| E0032 | D01 | owner | Expired accessToken (studio) | IDENTITY_EXPIRED; host refresh hook | Aide+Owner |
| E0033 | D01 | embed | Expired accessToken (embed) | IDENTITY_EXPIRED; host refresh hook | Aide+Owner |
| E0034 | D01 | system | Expired accessToken (retry) | IDENTITY_EXPIRED; host refresh hook | Aide+Owner |
| E0035 | D01 | system | Expired accessToken (concurrent) | IDENTITY_EXPIRED; host refresh hook | Aide+Owner |
| E0036 | D01 | logged-in | Missing accessToken END_USER_TOKEN | END_USER_TOKEN_REQUIRED | Aide+Owner |
| E0037 | D01 | owner | Missing accessToken END_USER_TOKEN (studio) | END_USER_TOKEN_REQUIRED | Aide+Owner |
| E0038 | D01 | embed | Missing accessToken END_USER_TOKEN (embed) | END_USER_TOKEN_REQUIRED | Aide+Owner |
| E0039 | D01 | system | Missing accessToken END_USER_TOKEN (retry) | END_USER_TOKEN_REQUIRED | Aide+Owner |
| E0040 | D01 | system | Missing accessToken END_USER_TOKEN (concurrent) | END_USER_TOKEN_REQUIRED | Aide+Owner |
| E0041 | D01 | logged-in | Subject without token | Block END_USER_TOKEN calls | Aide+Owner |
| E0042 | D01 | owner | Subject without token (studio) | Block END_USER_TOKEN calls | Aide+Owner |
| E0043 | D01 | embed | Subject without token (embed) | Block END_USER_TOKEN calls | Aide+Owner |
| E0044 | D01 | system | Subject without token (retry) | Block END_USER_TOKEN calls | Aide+Owner |
| E0045 | D01 | system | Subject without token (concurrent) | Block END_USER_TOKEN calls | Aide+Owner |
| E0046 | D01 | attack | Token from user A on user B session | Owner API must 403; Aide forwards token only | Owner |
| E0047 | D01 | owner | Token from user A on user B session (studio) | Owner API must 403; Aide forwards token only | Owner |
| E0048 | D01 | embed | Token from user A on user B session (embed) | Owner API must 403; Aide forwards token only | Owner |
| E0049 | D01 | system | Token from user A on user B session (retry) | Owner API must 403; Aide forwards token only | Owner |
| E0050 | D01 | system | Token from user A on user B session (concurrent) | Owner API must 403; Aide forwards token only | Owner |
| E0051 | D01 | attack | JWT aud mismatch | Reject at Aide identity resolve | Aide |
| E0052 | D01 | owner | JWT aud mismatch (studio) | Reject at Aide identity resolve | Aide |
| E0053 | D01 | embed | JWT aud mismatch (embed) | Reject at Aide identity resolve | Aide |
| E0054 | D01 | system | JWT aud mismatch (retry) | Reject at Aide identity resolve | Aide |
| E0055 | D01 | system | JWT aud mismatch (concurrent) | Reject at Aide identity resolve | Aide |
| E0056 | D01 | logged-in | JWT exp in past | IDENTITY_EXPIRED | Aide+Owner |
| E0057 | D01 | owner | JWT exp in past (studio) | IDENTITY_EXPIRED | Aide+Owner |
| E0058 | D01 | embed | JWT exp in past (embed) | IDENTITY_EXPIRED | Aide+Owner |
| E0059 | D01 | system | JWT exp in past (retry) | IDENTITY_EXPIRED | Aide+Owner |
| E0060 | D01 | system | JWT exp in past (concurrent) | IDENTITY_EXPIRED | Aide+Owner |
| E0061 | D01 | attack | JWT iss not allowlisted | Reject identity | Aide+Owner |
| E0062 | D01 | owner | JWT iss not allowlisted (studio) | Reject identity | Aide+Owner |
| E0063 | D01 | embed | JWT iss not allowlisted (embed) | Reject identity | Aide+Owner |
| E0064 | D01 | system | JWT iss not allowlisted (retry) | Reject identity | Aide+Owner |
| E0065 | D01 | system | JWT iss not allowlisted (concurrent) | Reject identity | Aide+Owner |
| E0066 | D01 | owner | Studio test without identity | Studio may use OWNER_KEY; never leak to embed | Aide+Owner |
| E0067 | D01 | owner | Studio test without identity (studio) | Studio may use OWNER_KEY; never leak to embed | Aide+Owner |
| E0068 | D01 | embed | Studio test without identity (embed) | Studio may use OWNER_KEY; never leak to embed | Aide+Owner |
| E0069 | D01 | system | Studio test without identity (retry) | Studio may use OWNER_KEY; never leak to embed | Aide+Owner |
| E0070 | D01 | system | Studio test without identity (concurrent) | Studio may use OWNER_KEY; never leak to embed | Aide+Owner |
| E0071 | D01 | logged-in | Identity TTL max cap | Force refresh after IDENTITY_SESSION_MAX_TTL_MS | Aide+Owner |
| E0072 | D01 | owner | Identity TTL max cap (studio) | Force refresh after IDENTITY_SESSION_MAX_TTL_MS | Aide+Owner |
| E0073 | D01 | embed | Identity TTL max cap (embed) | Force refresh after IDENTITY_SESSION_MAX_TTL_MS | Aide+Owner |
| E0074 | D01 | system | Identity TTL max cap (retry) | Force refresh after IDENTITY_SESSION_MAX_TTL_MS | Aide+Owner |
| E0075 | D01 | system | Identity TTL max cap (concurrent) | Force refresh after IDENTITY_SESSION_MAX_TTL_MS | Aide+Owner |
| E0076 | D01 | guest | clearUser while confirm pending | Expire pending confirmations | Aide+Owner |
| E0077 | D01 | owner | clearUser while confirm pending (studio) | Expire pending confirmations | Aide+Owner |
| E0078 | D01 | embed | clearUser while confirm pending (embed) | Expire pending confirmations | Aide+Owner |
| E0079 | D01 | system | clearUser while confirm pending (retry) | Expire pending confirmations | Aide+Owner |
| E0080 | D01 | system | clearUser while confirm pending (concurrent) | Expire pending confirmations | Aide+Owner |
| E0081 | D01 | logged-in | Multiple tabs same user | Same subject; separate conversations OK | Aide+Owner |
| E0082 | D01 | owner | Multiple tabs same user (studio) | Same subject; separate conversations OK | Aide+Owner |
| E0083 | D01 | embed | Multiple tabs same user (embed) | Same subject; separate conversations OK | Aide+Owner |
| E0084 | D01 | system | Multiple tabs same user (retry) | Same subject; separate conversations OK | Aide+Owner |
| E0085 | D01 | system | Multiple tabs same user (concurrent) | Same subject; separate conversations OK | Aide+Owner |
| E0086 | D01 | logged-in | Multiple tabs different users | Separate storage keys per subject | Aide+Owner |
| E0087 | D01 | owner | Multiple tabs different users (studio) | Separate storage keys per subject | Aide+Owner |
| E0088 | D01 | embed | Multiple tabs different users (embed) | Separate storage keys per subject | Aide+Owner |
| E0089 | D01 | system | Multiple tabs different users (retry) | Separate storage keys per subject | Aide+Owner |
| E0090 | D01 | system | Multiple tabs different users (concurrent) | Separate storage keys per subject | Aide+Owner |
| E0091 | D01 | logged-in | WebView embed | Same setUser contract | Aide+Owner |
| E0092 | D01 | owner | WebView embed (studio) | Same setUser contract | Aide+Owner |
| E0093 | D01 | embed | WebView embed (embed) | Same setUser contract | Aide+Owner |
| E0094 | D01 | system | WebView embed (retry) | Same setUser contract | Aide+Owner |
| E0095 | D01 | system | WebView embed (concurrent) | Same setUser contract | Aide+Owner |
| E0096 | D01 | logged-in | Native SDK future | Same Chat API + identity assertion | Aide+Owner |
| E0097 | D01 | owner | Native SDK future (studio) | Same Chat API + identity assertion | Aide+Owner |
| E0098 | D01 | embed | Native SDK future (embed) | Same Chat API + identity assertion | Aide+Owner |
| E0099 | D01 | system | Native SDK future (retry) | Same Chat API + identity assertion | Aide+Owner |
| E0100 | D01 | system | Native SDK future (concurrent) | Same Chat API + identity assertion | Aide+Owner |
| E0101 | D02 | logged-in | Logged-in asks my order | Allow if owner API ACL matches sub | Aide+Owner |
| E0102 | D02 | owner | Logged-in asks my order (studio) | Allow if owner API ACL matches sub | Aide+Owner |
| E0103 | D02 | embed | Logged-in asks my order (embed) | Allow if owner API ACL matches sub | Aide+Owner |
| E0104 | D02 | system | Logged-in asks my order (retry) | Allow if owner API ACL matches sub | Aide+Owner |
| E0105 | D02 | system | Logged-in asks my order (concurrent) | Allow if owner API ACL matches sub | Aide+Owner |
| E0106 | D02 | logged-in | Logged-in asks someone else's order | Refuse in LLM + owner API 403 | Aide+Owner |
| E0107 | D02 | owner | Logged-in asks someone else's order (studio) | Refuse in LLM + owner API 403 | Aide+Owner |
| E0108 | D02 | embed | Logged-in asks someone else's order (embed) | Refuse in LLM + owner API 403 | Aide+Owner |
| E0109 | D02 | system | Logged-in asks someone else's order (retry) | Refuse in LLM + owner API 403 | Aide+Owner |
| E0110 | D02 | system | Logged-in asks someone else's order (concurrent) | Refuse in LLM + owner API 403 | Aide+Owner |
| E0111 | D02 | attack | Logged-in guesses sequential ids | Owner API enforces ownership; Aide never trusts id alone | Owner |
| E0112 | D02 | owner | Logged-in guesses sequential ids (studio) | Owner API enforces ownership; Aide never trusts id alone | Owner |
| E0113 | D02 | embed | Logged-in guesses sequential ids (embed) | Owner API enforces ownership; Aide never trusts id alone | Owner |
| E0114 | D02 | system | Logged-in guesses sequential ids (retry) | Owner API enforces ownership; Aide never trusts id alone | Owner |
| E0115 | D02 | system | Logged-in guesses sequential ids (concurrent) | Owner API enforces ownership; Aide never trusts id alone | Owner |
| E0116 | D02 | logged-in | Admin asks all orders | Unless owner API grants admin scope, refuse | Aide+Owner |
| E0117 | D02 | owner | Admin asks all orders (studio) | Unless owner API grants admin scope, refuse | Aide+Owner |
| E0118 | D02 | embed | Admin asks all orders (embed) | Unless owner API grants admin scope, refuse | Aide+Owner |
| E0119 | D02 | system | Admin asks all orders (retry) | Unless owner API grants admin scope, refuse | Aide+Owner |
| E0120 | D02 | system | Admin asks all orders (concurrent) | Unless owner API grants admin scope, refuse | Aide+Owner |
| E0121 | D02 | attack | Support rep impersonation | Requires explicit support role in token claims | Aide+Owner |
| E0122 | D02 | owner | Support rep impersonation (studio) | Requires explicit support role in token claims | Aide+Owner |
| E0123 | D02 | embed | Support rep impersonation (embed) | Requires explicit support role in token claims | Aide+Owner |
| E0124 | D02 | system | Support rep impersonation (retry) | Requires explicit support role in token claims | Aide+Owner |
| E0125 | D02 | system | Support rep impersonation (concurrent) | Requires explicit support role in token claims | Aide+Owner |
| E0126 | D02 | logged-in | Shared household account | Owner defines sub scope; Aide forwards sub | Aide |
| E0127 | D02 | owner | Shared household account (studio) | Owner defines sub scope; Aide forwards sub | Aide |
| E0128 | D02 | embed | Shared household account (embed) | Owner defines sub scope; Aide forwards sub | Aide |
| E0129 | D02 | system | Shared household account (retry) | Owner defines sub scope; Aide forwards sub | Aide |
| E0130 | D02 | system | Shared household account (concurrent) | Owner defines sub scope; Aide forwards sub | Aide |
| E0131 | D02 | logged-in | Child account on parent sub | Owner API policy | Owner |
| E0132 | D02 | owner | Child account on parent sub (studio) | Owner API policy | Owner |
| E0133 | D02 | embed | Child account on parent sub (embed) | Owner API policy | Owner |
| E0134 | D02 | system | Child account on parent sub (retry) | Owner API policy | Owner |
| E0135 | D02 | system | Child account on parent sub (concurrent) | Owner API policy | Owner |
| E0136 | D02 | logged-in | MFA step-up for sensitive read | Owner API 403 → ask re-auth | Owner |
| E0137 | D02 | owner | MFA step-up for sensitive read (studio) | Owner API 403 → ask re-auth | Owner |
| E0138 | D02 | embed | MFA step-up for sensitive read (embed) | Owner API 403 → ask re-auth | Owner |
| E0139 | D02 | system | MFA step-up for sensitive read (retry) | Owner API 403 → ask re-auth | Owner |
| E0140 | D02 | system | MFA step-up for sensitive read (concurrent) | Owner API 403 → ask re-auth | Owner |
| E0141 | D02 | logged-in | Bearer token scope read-only | WRITE tools blocked at owner API | Aide+Owner |
| E0142 | D02 | owner | Bearer token scope read-only (studio) | WRITE tools blocked at owner API | Aide+Owner |
| E0143 | D02 | embed | Bearer token scope read-only (embed) | WRITE tools blocked at owner API | Aide+Owner |
| E0144 | D02 | system | Bearer token scope read-only (retry) | WRITE tools blocked at owner API | Aide+Owner |
| E0145 | D02 | system | Bearer token scope read-only (concurrent) | WRITE tools blocked at owner API | Aide+Owner |
| E0146 | D02 | logged-in | Bearer token missing scope | 403 → soft fail message | Aide+Owner |
| E0147 | D02 | owner | Bearer token missing scope (studio) | 403 → soft fail message | Aide+Owner |
| E0148 | D02 | embed | Bearer token missing scope (embed) | 403 → soft fail message | Aide+Owner |
| E0149 | D02 | system | Bearer token missing scope (retry) | 403 → soft fail message | Aide+Owner |
| E0150 | D02 | system | Bearer token missing scope (concurrent) | 403 → soft fail message | Aide+Owner |
| E0151 | D02 | attack | Cross-workspace agent action | Aide blocks agentId mismatch | Aide |
| E0152 | D02 | owner | Cross-workspace agent action (studio) | Aide blocks agentId mismatch | Aide |
| E0153 | D02 | embed | Cross-workspace agent action (embed) | Aide blocks agentId mismatch | Aide |
| E0154 | D02 | system | Cross-workspace agent action (retry) | Aide blocks agentId mismatch | Aide |
| E0155 | D02 | system | Cross-workspace agent action (concurrent) | Aide blocks agentId mismatch | Aide |
| E0156 | D02 | attack | Cross-agent publicKey | Origin + agent isolation | Aide+Owner |
| E0157 | D02 | owner | Cross-agent publicKey (studio) | Origin + agent isolation | Aide+Owner |
| E0158 | D02 | embed | Cross-agent publicKey (embed) | Origin + agent isolation | Aide+Owner |
| E0159 | D02 | system | Cross-agent publicKey (retry) | Origin + agent isolation | Aide+Owner |
| E0160 | D02 | system | Cross-agent publicKey (concurrent) | Origin + agent isolation | Aide+Owner |
| E0161 | D02 | logged-in | Resource id in URL template only | Still need ACL at owner API | Aide+Owner |
| E0162 | D02 | owner | Resource id in URL template only (studio) | Still need ACL at owner API | Aide+Owner |
| E0163 | D02 | embed | Resource id in URL template only (embed) | Still need ACL at owner API | Aide+Owner |
| E0164 | D02 | system | Resource id in URL template only (retry) | Still need ACL at owner API | Aide+Owner |
| E0165 | D02 | system | Resource id in URL template only (concurrent) | Still need ACL at owner API | Aide+Owner |
| E0166 | D02 | logged-in | Resource id in body POST | Schema validate + ACL | Aide+Owner |
| E0167 | D02 | owner | Resource id in body POST (studio) | Schema validate + ACL | Aide+Owner |
| E0168 | D02 | embed | Resource id in body POST (embed) | Schema validate + ACL | Aide+Owner |
| E0169 | D02 | system | Resource id in body POST (retry) | Schema validate + ACL | Aide+Owner |
| E0170 | D02 | system | Resource id in body POST (concurrent) | Schema validate + ACL | Aide+Owner |
| E0171 | D02 | attack | List endpoint returns others' rows | Owner must filter by sub; output schema cap | Aide+Owner |
| E0172 | D02 | owner | List endpoint returns others' rows (studio) | Owner must filter by sub; output schema cap | Aide+Owner |
| E0173 | D02 | embed | List endpoint returns others' rows (embed) | Owner must filter by sub; output schema cap | Aide+Owner |
| E0174 | D02 | system | List endpoint returns others' rows (retry) | Owner must filter by sub; output schema cap | Aide+Owner |
| E0175 | D02 | system | List endpoint returns others' rows (concurrent) | Owner must filter by sub; output schema cap | Aide+Owner |
| E0176 | D02 | attack | GraphQL over-fetch | Prefer fixed REST templates; cap response bytes | Aide+Owner |
| E0177 | D02 | owner | GraphQL over-fetch (studio) | Prefer fixed REST templates; cap response bytes | Aide+Owner |
| E0178 | D02 | embed | GraphQL over-fetch (embed) | Prefer fixed REST templates; cap response bytes | Aide+Owner |
| E0179 | D02 | system | GraphQL over-fetch (retry) | Prefer fixed REST templates; cap response bytes | Aide+Owner |
| E0180 | D02 | system | GraphQL over-fetch (concurrent) | Prefer fixed REST templates; cap response bytes | Aide+Owner |
| E0181 | D02 | attack | Batch id array in args | Schema max items; owner validates each | Aide+Owner |
| E0182 | D02 | owner | Batch id array in args (studio) | Schema max items; owner validates each | Aide+Owner |
| E0183 | D02 | embed | Batch id array in args (embed) | Schema max items; owner validates each | Aide+Owner |
| E0184 | D02 | system | Batch id array in args (retry) | Schema max items; owner validates each | Aide+Owner |
| E0185 | D02 | system | Batch id array in args (concurrent) | Schema max items; owner validates each | Aide+Owner |
| E0186 | D02 | logged-in | UUID vs guessable int id | Same ACL rules | Aide+Owner |
| E0187 | D02 | owner | UUID vs guessable int id (studio) | Same ACL rules | Aide+Owner |
| E0188 | D02 | embed | UUID vs guessable int id (embed) | Same ACL rules | Aide+Owner |
| E0189 | D02 | system | UUID vs guessable int id (retry) | Same ACL rules | Aide+Owner |
| E0190 | D02 | system | UUID vs guessable int id (concurrent) | Same ACL rules | Aide+Owner |
| E0191 | D02 | logged-in | Email parameter lookup | Must match token email claim or 403 | Aide+Owner |
| E0192 | D02 | owner | Email parameter lookup (studio) | Must match token email claim or 403 | Aide+Owner |
| E0193 | D02 | embed | Email parameter lookup (embed) | Must match token email claim or 403 | Aide+Owner |
| E0194 | D02 | system | Email parameter lookup (retry) | Must match token email claim or 403 | Aide+Owner |
| E0195 | D02 | system | Email parameter lookup (concurrent) | Must match token email claim or 403 | Aide+Owner |
| E0196 | D02 | logged-in | Phone parameter lookup | Must match verified phone claim | Aide+Owner |
| E0197 | D02 | owner | Phone parameter lookup (studio) | Must match verified phone claim | Aide+Owner |
| E0198 | D02 | embed | Phone parameter lookup (embed) | Must match verified phone claim | Aide+Owner |
| E0199 | D02 | system | Phone parameter lookup (retry) | Must match verified phone claim | Aide+Owner |
| E0200 | D02 | system | Phone parameter lookup (concurrent) | Must match verified phone claim | Aide+Owner |
| E0201 | D03 | guest | Guest track shipment with tracking # | GUEST_LOOKUP tool; redacted response | Aide+Owner |
| E0202 | D03 | owner | Guest track shipment with tracking # (studio) | GUEST_LOOKUP tool; redacted response | Aide+Owner |
| E0203 | D03 | embed | Guest track shipment with tracking # (embed) | GUEST_LOOKUP tool; redacted response | Aide+Owner |
| E0204 | D03 | system | Guest track shipment with tracking # (retry) | GUEST_LOOKUP tool; redacted response | Aide+Owner |
| E0205 | D03 | system | Guest track shipment with tracking # (concurrent) | GUEST_LOOKUP tool; redacted response | Aide+Owner |
| E0206 | D03 | guest | Guest track without tracking # | Ask for tracking + zip last4 | Aide+Owner |
| E0207 | D03 | owner | Guest track without tracking # (studio) | Ask for tracking + zip last4 | Aide+Owner |
| E0208 | D03 | embed | Guest track without tracking # (embed) | Ask for tracking + zip last4 | Aide+Owner |
| E0209 | D03 | system | Guest track without tracking # (retry) | Ask for tracking + zip last4 | Aide+Owner |
| E0210 | D03 | system | Guest track without tracking # (concurrent) | Ask for tracking + zip last4 | Aide+Owner |
| E0211 | D03 | guest | Guest asks account balance | Refuse; require login | Aide+Owner |
| E0212 | D03 | owner | Guest asks account balance (studio) | Refuse; require login | Aide+Owner |
| E0213 | D03 | embed | Guest asks account balance (embed) | Refuse; require login | Aide+Owner |
| E0214 | D03 | system | Guest asks account balance (retry) | Refuse; require login | Aide+Owner |
| E0215 | D03 | system | Guest asks account balance (concurrent) | Refuse; require login | Aide+Owner |
| E0216 | D03 | guest | Guest asks public FAQ | Knowledge only; no tool | Aide+Owner |
| E0217 | D03 | owner | Guest asks public FAQ (studio) | Knowledge only; no tool | Aide+Owner |
| E0218 | D03 | embed | Guest asks public FAQ (embed) | Knowledge only; no tool | Aide+Owner |
| E0219 | D03 | system | Guest asks public FAQ (retry) | Knowledge only; no tool | Aide+Owner |
| E0220 | D03 | system | Guest asks public FAQ (concurrent) | Knowledge only; no tool | Aide+Owner |
| E0221 | D03 | guest | Guest asks public product catalog | OWNER_KEY read public endpoint OK | Aide+Owner |
| E0222 | D03 | owner | Guest asks public product catalog (studio) | OWNER_KEY read public endpoint OK | Aide+Owner |
| E0223 | D03 | embed | Guest asks public product catalog (embed) | OWNER_KEY read public endpoint OK | Aide+Owner |
| E0224 | D03 | system | Guest asks public product catalog (retry) | OWNER_KEY read public endpoint OK | Aide+Owner |
| E0225 | D03 | system | Guest asks public product catalog (concurrent) | OWNER_KEY read public endpoint OK | Aide+Owner |
| E0226 | D03 | guest | Guest asks pricing page data | Knowledge or public API | Aide+Owner |
| E0227 | D03 | owner | Guest asks pricing page data (studio) | Knowledge or public API | Aide+Owner |
| E0228 | D03 | embed | Guest asks pricing page data (embed) | Knowledge or public API | Aide+Owner |
| E0229 | D03 | system | Guest asks pricing page data (retry) | Knowledge or public API | Aide+Owner |
| E0230 | D03 | system | Guest asks pricing page data (concurrent) | Knowledge or public API | Aide+Owner |
| E0231 | D03 | guest | Guest provides someone else's tracking | Owner returns minimal status only if designed | Aide+Owner |
| E0232 | D03 | owner | Guest provides someone else's tracking (studio) | Owner returns minimal status only if designed | Aide+Owner |
| E0233 | D03 | embed | Guest provides someone else's tracking (embed) | Owner returns minimal status only if designed | Aide+Owner |
| E0234 | D03 | system | Guest provides someone else's tracking (retry) | Owner returns minimal status only if designed | Aide+Owner |
| E0235 | D03 | system | Guest provides someone else's tracking (concurrent) | Owner returns minimal status only if designed | Aide+Owner |
| E0236 | D03 | guest | Guest tracking returns full address | Redact before LLM; owner should not send PII | Aide+Owner |
| E0237 | D03 | owner | Guest tracking returns full address (studio) | Redact before LLM; owner should not send PII | Aide+Owner |
| E0238 | D03 | embed | Guest tracking returns full address (embed) | Redact before LLM; owner should not send PII | Aide+Owner |
| E0239 | D03 | system | Guest tracking returns full address (retry) | Redact before LLM; owner should not send PII | Aide+Owner |
| E0240 | D03 | system | Guest tracking returns full address (concurrent) | Redact before LLM; owner should not send PII | Aide+Owner |
| E0241 | D03 | attack | Guest brute force tracking numbers | Rate limit per IP + owner throttling | Aide+Owner |
| E0242 | D03 | owner | Guest brute force tracking numbers (studio) | Rate limit per IP + owner throttling | Aide+Owner |
| E0243 | D03 | embed | Guest brute force tracking numbers (embed) | Rate limit per IP + owner throttling | Aide+Owner |
| E0244 | D03 | system | Guest brute force tracking numbers (retry) | Rate limit per IP + owner throttling | Aide+Owner |
| E0245 | D03 | system | Guest brute force tracking numbers (concurrent) | Rate limit per IP + owner throttling | Aide+Owner |
| E0246 | D03 | guest | Guest CAPTCHA needed | Owner/h host integration future | Aide+Owner |
| E0247 | D03 | owner | Guest CAPTCHA needed (studio) | Owner/h host integration future | Aide+Owner |
| E0248 | D03 | embed | Guest CAPTCHA needed (embed) | Owner/h host integration future | Aide+Owner |
| E0249 | D03 | system | Guest CAPTCHA needed (retry) | Owner/h host integration future | Aide+Owner |
| E0250 | D03 | system | Guest CAPTCHA needed (concurrent) | Owner/h host integration future | Aide+Owner |
| E0251 | D03 | guest | Guest order id + email match | Owner verifies pair; return redacted status | Aide+Owner |
| E0252 | D03 | owner | Guest order id + email match (studio) | Owner verifies pair; return redacted status | Aide+Owner |
| E0253 | D03 | embed | Guest order id + email match (embed) | Owner verifies pair; return redacted status | Aide+Owner |
| E0254 | D03 | system | Guest order id + email match (retry) | Owner verifies pair; return redacted status | Aide+Owner |
| E0255 | D03 | system | Guest order id + email match (concurrent) | Owner verifies pair; return redacted status | Aide+Owner |
| E0256 | D03 | guest | Guest order id wrong email | 404/403 generic message | Aide+Owner |
| E0257 | D03 | owner | Guest order id wrong email (studio) | 404/403 generic message | Aide+Owner |
| E0258 | D03 | embed | Guest order id wrong email (embed) | 404/403 generic message | Aide+Owner |
| E0259 | D03 | system | Guest order id wrong email (retry) | 404/403 generic message | Aide+Owner |
| E0260 | D03 | system | Guest order id wrong email (concurrent) | 404/403 generic message | Aide+Owner |
| E0261 | D03 | guest | Guest partial PII in chat | Do not echo full PII in reply | Aide+Owner |
| E0262 | D03 | owner | Guest partial PII in chat (studio) | Do not echo full PII in reply | Aide+Owner |
| E0263 | D03 | embed | Guest partial PII in chat (embed) | Do not echo full PII in reply | Aide+Owner |
| E0264 | D03 | system | Guest partial PII in chat (retry) | Do not echo full PII in reply | Aide+Owner |
| E0265 | D03 | system | Guest partial PII in chat (concurrent) | Do not echo full PII in reply | Aide+Owner |
| E0266 | D03 | guest | Guest asks delete account | Refuse WRITE; ask login | Aide+Owner |
| E0267 | D03 | owner | Guest asks delete account (studio) | Refuse WRITE; ask login | Aide+Owner |
| E0268 | D03 | embed | Guest asks delete account (embed) | Refuse WRITE; ask login | Aide+Owner |
| E0269 | D03 | system | Guest asks delete account (retry) | Refuse WRITE; ask login | Aide+Owner |
| E0270 | D03 | system | Guest asks delete account (concurrent) | Refuse WRITE; ask login | Aide+Owner |
| E0271 | D03 | guest | Guest create ticket | WRITE with email capture; confirm | Aide+Owner |
| E0272 | D03 | owner | Guest create ticket (studio) | WRITE with email capture; confirm | Aide+Owner |
| E0273 | D03 | embed | Guest create ticket (embed) | WRITE with email capture; confirm | Aide+Owner |
| E0274 | D03 | system | Guest create ticket (retry) | WRITE with email capture; confirm | Aide+Owner |
| E0275 | D03 | system | Guest create ticket (concurrent) | WRITE with email capture; confirm | Aide+Owner |
| E0276 | D03 | guest | Guest ticket with attachment | File upload rules | Aide+Owner |
| E0277 | D03 | owner | Guest ticket with attachment (studio) | File upload rules | Aide+Owner |
| E0278 | D03 | embed | Guest ticket with attachment (embed) | File upload rules | Aide+Owner |
| E0279 | D03 | system | Guest ticket with attachment (retry) | File upload rules | Aide+Owner |
| E0280 | D03 | system | Guest ticket with attachment (concurrent) | File upload rules | Aide+Owner |
| E0281 | D03 | both | Guest vs logged-in same tracking tool | Different response shapes from owner API | Aide+Owner |
| E0282 | D03 | owner | Guest vs logged-in same tracking tool (studio) | Different response shapes from owner API | Aide+Owner |
| E0283 | D03 | embed | Guest vs logged-in same tracking tool (embed) | Different response shapes from owner API | Aide+Owner |
| E0284 | D03 | system | Guest vs logged-in same tracking tool (retry) | Different response shapes from owner API | Aide+Owner |
| E0285 | D03 | system | Guest vs logged-in same tracking tool (concurrent) | Different response shapes from owner API | Aide+Owner |
| E0286 | D03 | guest | Demo order ORD-100 guest | Demo fixture OK | Aide+Owner |
| E0287 | D03 | owner | Demo order ORD-100 guest (studio) | Demo fixture OK | Aide+Owner |
| E0288 | D03 | embed | Demo order ORD-100 guest (embed) | Demo fixture OK | Aide+Owner |
| E0289 | D03 | system | Demo order ORD-100 guest (retry) | Demo fixture OK | Aide+Owner |
| E0290 | D03 | system | Demo order ORD-100 guest (concurrent) | Demo fixture OK | Aide+Owner |
| E0291 | D03 | owner | Live production guest lookup misconfigured | Returns 401 → fix credential mode | Aide+Owner |
| E0292 | D03 | owner | Live production guest lookup misconfigured (studio) | Returns 401 → fix credential mode | Aide+Owner |
| E0293 | D03 | embed | Live production guest lookup misconfigured (embed) | Returns 401 → fix credential mode | Aide+Owner |
| E0294 | D03 | system | Live production guest lookup misconfigured (retry) | Returns 401 → fix credential mode | Aide+Owner |
| E0295 | D03 | system | Live production guest lookup misconfigured (concurrent) | Returns 401 → fix credential mode | Aide+Owner |
| E0296 | D03 | logged-in | Guest session after login | Upgrade to private tools | Aide+Owner |
| E0297 | D03 | owner | Guest session after login (studio) | Upgrade to private tools | Aide+Owner |
| E0298 | D03 | embed | Guest session after login (embed) | Upgrade to private tools | Aide+Owner |
| E0299 | D03 | system | Guest session after login (retry) | Upgrade to private tools | Aide+Owner |
| E0300 | D03 | system | Guest session after login (concurrent) | Upgrade to private tools | Aide+Owner |
| E0301 | D04 | logged-in | WRITE without confirm | CONFIRMATION_REQUIRED card | Aide+Owner |
| E0302 | D04 | owner | WRITE without confirm (studio) | CONFIRMATION_REQUIRED card | Aide+Owner |
| E0303 | D04 | embed | WRITE without confirm (embed) | CONFIRMATION_REQUIRED card | Aide+Owner |
| E0304 | D04 | system | WRITE without confirm (retry) | CONFIRMATION_REQUIRED card | Aide+Owner |
| E0305 | D04 | system | WRITE without confirm (concurrent) | CONFIRMATION_REQUIRED card | Aide+Owner |
| E0306 | D04 | logged-in | READ with requiresConfirmation | Confirm before call | Aide+Owner |
| E0307 | D04 | owner | READ with requiresConfirmation (studio) | Confirm before call | Aide+Owner |
| E0308 | D04 | embed | READ with requiresConfirmation (embed) | Confirm before call | Aide+Owner |
| E0309 | D04 | system | READ with requiresConfirmation (retry) | Confirm before call | Aide+Owner |
| E0310 | D04 | system | READ with requiresConfirmation (concurrent) | Confirm before call | Aide+Owner |
| E0311 | D04 | logged-in | User approves confirm | Execute once; evidence stored | Aide+Owner |
| E0312 | D04 | owner | User approves confirm (studio) | Execute once; evidence stored | Aide+Owner |
| E0313 | D04 | embed | User approves confirm (embed) | Execute once; evidence stored | Aide+Owner |
| E0314 | D04 | system | User approves confirm (retry) | Execute once; evidence stored | Aide+Owner |
| E0315 | D04 | system | User approves confirm (concurrent) | Execute once; evidence stored | Aide+Owner |
| E0316 | D04 | logged-in | User denies confirm | No HTTP; polite refusal | Aide+Owner |
| E0317 | D04 | owner | User denies confirm (studio) | No HTTP; polite refusal | Aide+Owner |
| E0318 | D04 | embed | User denies confirm (embed) | No HTTP; polite refusal | Aide+Owner |
| E0319 | D04 | system | User denies confirm (retry) | No HTTP; polite refusal | Aide+Owner |
| E0320 | D04 | system | User denies confirm (concurrent) | No HTTP; polite refusal | Aide+Owner |
| E0321 | D04 | logged-in | Confirm expired | Refuse; ask again | Aide+Owner |
| E0322 | D04 | owner | Confirm expired (studio) | Refuse; ask again | Aide+Owner |
| E0323 | D04 | embed | Confirm expired (embed) | Refuse; ask again | Aide+Owner |
| E0324 | D04 | system | Confirm expired (retry) | Refuse; ask again | Aide+Owner |
| E0325 | D04 | system | Confirm expired (concurrent) | Refuse; ask again | Aide+Owner |
| E0326 | D04 | logged-in | Double-click approve | Idempotent single run | Aide+Owner |
| E0327 | D04 | owner | Double-click approve (studio) | Idempotent single run | Aide+Owner |
| E0328 | D04 | embed | Double-click approve (embed) | Idempotent single run | Aide+Owner |
| E0329 | D04 | system | Double-click approve (retry) | Idempotent single run | Aide+Owner |
| E0330 | D04 | system | Double-click approve (concurrent) | Idempotent single run | Aide+Owner |
| E0331 | D04 | logged-in | Approve then navigate away | Run completes or safe cancel | Aide+Owner |
| E0332 | D04 | owner | Approve then navigate away (studio) | Run completes or safe cancel | Aide+Owner |
| E0333 | D04 | embed | Approve then navigate away (embed) | Run completes or safe cancel | Aide+Owner |
| E0334 | D04 | system | Approve then navigate away (retry) | Run completes or safe cancel | Aide+Owner |
| E0335 | D04 | system | Approve then navigate away (concurrent) | Run completes or safe cancel | Aide+Owner |
| E0336 | D04 | attack | LLM says I already confirmed | Ignore; need APPROVED status | Aide+Owner |
| E0337 | D04 | owner | LLM says I already confirmed (studio) | Ignore; need APPROVED status | Aide+Owner |
| E0338 | D04 | embed | LLM says I already confirmed (embed) | Ignore; need APPROVED status | Aide+Owner |
| E0339 | D04 | system | LLM says I already confirmed (retry) | Ignore; need APPROVED status | Aide+Owner |
| E0340 | D04 | system | LLM says I already confirmed (concurrent) | Ignore; need APPROVED status | Aide+Owner |
| E0341 | D04 | logged-in | Confirm for wrong action | Bind confirmation to actionId+args hash | Aide+Owner |
| E0342 | D04 | owner | Confirm for wrong action (studio) | Bind confirmation to actionId+args hash | Aide+Owner |
| E0343 | D04 | embed | Confirm for wrong action (embed) | Bind confirmation to actionId+args hash | Aide+Owner |
| E0344 | D04 | system | Confirm for wrong action (retry) | Bind confirmation to actionId+args hash | Aide+Owner |
| E0345 | D04 | system | Confirm for wrong action (concurrent) | Bind confirmation to actionId+args hash | Aide+Owner |
| E0346 | D04 | attack | Confirm args changed after approve | Re-confirm required | Aide+Owner |
| E0347 | D04 | owner | Confirm args changed after approve (studio) | Re-confirm required | Aide+Owner |
| E0348 | D04 | embed | Confirm args changed after approve (embed) | Re-confirm required | Aide+Owner |
| E0349 | D04 | system | Confirm args changed after approve (retry) | Re-confirm required | Aide+Owner |
| E0350 | D04 | system | Confirm args changed after approve (concurrent) | Re-confirm required | Aide+Owner |
| E0351 | D04 | logged-in | DESTRUCTIVE refund | Confirm + strong copy | Aide+Owner |
| E0352 | D04 | owner | DESTRUCTIVE refund (studio) | Confirm + strong copy | Aide+Owner |
| E0353 | D04 | embed | DESTRUCTIVE refund (embed) | Confirm + strong copy | Aide+Owner |
| E0354 | D04 | system | DESTRUCTIVE refund (retry) | Confirm + strong copy | Aide+Owner |
| E0355 | D04 | system | DESTRUCTIVE refund (concurrent) | Confirm + strong copy | Aide+Owner |
| E0356 | D04 | logged-in | READ auto without confirm | Allow if policy allows | Aide+Owner |
| E0357 | D04 | owner | READ auto without confirm (studio) | Allow if policy allows | Aide+Owner |
| E0358 | D04 | embed | READ auto without confirm (embed) | Allow if policy allows | Aide+Owner |
| E0359 | D04 | system | READ auto without confirm (retry) | Allow if policy allows | Aide+Owner |
| E0360 | D04 | system | READ auto without confirm (concurrent) | Allow if policy allows | Aide+Owner |
| E0361 | D04 | owner | Owner sets requiresConfirmation false on WRITE | Policy override blocked — WRITE always confirms | Aide+Owner |
| E0362 | D04 | owner | Owner sets requiresConfirmation false on WRITE (studio) | Policy override blocked — WRITE always confirms | Aide+Owner |
| E0363 | D04 | embed | Owner sets requiresConfirmation false on WRITE (embed) | Policy override blocked — WRITE always confirms | Aide+Owner |
| E0364 | D04 | system | Owner sets requiresConfirmation false on WRITE (retry) | Policy override blocked — WRITE always confirms | Aide+Owner |
| E0365 | D04 | system | Owner sets requiresConfirmation false on WRITE (concurrent) | Policy override blocked — WRITE always confirms | Aide+Owner |
| E0366 | D04 | owner | Studio confirm flow | Same UX as embed | Aide+Owner |
| E0367 | D04 | owner | Studio confirm flow (studio) | Same UX as embed | Aide+Owner |
| E0368 | D04 | embed | Studio confirm flow (embed) | Same UX as embed | Aide+Owner |
| E0369 | D04 | system | Studio confirm flow (retry) | Same UX as embed | Aide+Owner |
| E0370 | D04 | system | Studio confirm flow (concurrent) | Same UX as embed | Aide+Owner |
| E0371 | D04 | logged-in | Public embed confirm | ActionConfirmCard | Aide+Owner |
| E0372 | D04 | owner | Public embed confirm (studio) | ActionConfirmCard | Aide+Owner |
| E0373 | D04 | embed | Public embed confirm (embed) | ActionConfirmCard | Aide+Owner |
| E0374 | D04 | system | Public embed confirm (retry) | ActionConfirmCard | Aide+Owner |
| E0375 | D04 | system | Public embed confirm (concurrent) | ActionConfirmCard | Aide+Owner |
| E0376 | D04 | attack | Rate limit approve spam | pubConfirm limit | Aide+Owner |
| E0377 | D04 | owner | Rate limit approve spam (studio) | pubConfirm limit | Aide+Owner |
| E0378 | D04 | embed | Rate limit approve spam (embed) | pubConfirm limit | Aide+Owner |
| E0379 | D04 | system | Rate limit approve spam (retry) | pubConfirm limit | Aide+Owner |
| E0380 | D04 | system | Rate limit approve spam (concurrent) | pubConfirm limit | Aide+Owner |
| E0381 | D04 | owner | Confirm evidence audit | subject + IP + timestamp | Aide+Owner |
| E0382 | D04 | owner | Confirm evidence audit (studio) | subject + IP + timestamp | Aide+Owner |
| E0383 | D04 | embed | Confirm evidence audit (embed) | subject + IP + timestamp | Aide+Owner |
| E0384 | D04 | system | Confirm evidence audit (retry) | subject + IP + timestamp | Aide+Owner |
| E0385 | D04 | system | Confirm evidence audit (concurrent) | subject + IP + timestamp | Aide+Owner |
| E0386 | D04 | owner | Deny evidence audit | Stored | Aide+Owner |
| E0387 | D04 | owner | Deny evidence audit (studio) | Stored | Aide+Owner |
| E0388 | D04 | embed | Deny evidence audit (embed) | Stored | Aide+Owner |
| E0389 | D04 | system | Deny evidence audit (retry) | Stored | Aide+Owner |
| E0390 | D04 | system | Deny evidence audit (concurrent) | Stored | Aide+Owner |
| E0391 | D04 | logged-in | Confirm in desk handoff | Still works | Aide+Owner |
| E0392 | D04 | owner | Confirm in desk handoff (studio) | Still works | Aide+Owner |
| E0393 | D04 | embed | Confirm in desk handoff (embed) | Still works | Aide+Owner |
| E0394 | D04 | system | Confirm in desk handoff (retry) | Still works | Aide+Owner |
| E0395 | D04 | system | Confirm in desk handoff (concurrent) | Still works | Aide+Owner |
| E0396 | D04 | logged-in | Batch tool calls two WRITEs | Two separate confirms | Aide+Owner |
| E0397 | D04 | owner | Batch tool calls two WRITEs (studio) | Two separate confirms | Aide+Owner |
| E0398 | D04 | embed | Batch tool calls two WRITEs (embed) | Two separate confirms | Aide+Owner |
| E0399 | D04 | system | Batch tool calls two WRITEs (retry) | Two separate confirms | Aide+Owner |
| E0400 | D04 | system | Batch tool calls two WRITEs (concurrent) | Two separate confirms | Aide+Owner |
| E0401 | D05 | owner | No credential on OWNER_KEY action | 401 at test; block in chat | Aide+Owner |
| E0402 | D05 | owner | No credential on OWNER_KEY action (studio) | 401 at test; block in chat | Aide+Owner |
| E0403 | D05 | embed | No credential on OWNER_KEY action (embed) | 401 at test; block in chat | Aide+Owner |
| E0404 | D05 | system | No credential on OWNER_KEY action (retry) | 401 at test; block in chat | Aide+Owner |
| E0405 | D05 | system | No credential on OWNER_KEY action (concurrent) | 401 at test; block in chat | Aide+Owner |
| E0406 | D05 | owner | Wrong API key | 401; owner fixes credential | Aide+Owner |
| E0407 | D05 | owner | Wrong API key (studio) | 401; owner fixes credential | Aide+Owner |
| E0408 | D05 | embed | Wrong API key (embed) | 401; owner fixes credential | Aide+Owner |
| E0409 | D05 | system | Wrong API key (retry) | 401; owner fixes credential | Aide+Owner |
| E0410 | D05 | system | Wrong API key (concurrent) | 401; owner fixes credential | Aide+Owner |
| E0411 | D05 | owner | identityMode NONE on private data | Misconfig — document GUEST vs private | Aide+Owner |
| E0412 | D05 | owner | identityMode NONE on private data (studio) | Misconfig — document GUEST vs private | Aide+Owner |
| E0413 | D05 | embed | identityMode NONE on private data (embed) | Misconfig — document GUEST vs private | Aide+Owner |
| E0414 | D05 | system | identityMode NONE on private data (retry) | Misconfig — document GUEST vs private | Aide+Owner |
| E0415 | D05 | system | identityMode NONE on private data (concurrent) | Misconfig — document GUEST vs private | Aide+Owner |
| E0416 | D05 | owner | identityMode END_USER_TOKEN without host setUser | END_USER_TOKEN_REQUIRED in chat | Aide+Owner |
| E0417 | D05 | owner | identityMode END_USER_TOKEN without host setUser (studio) | END_USER_TOKEN_REQUIRED in chat | Aide+Owner |
| E0418 | D05 | embed | identityMode END_USER_TOKEN without host setUser (embed) | END_USER_TOKEN_REQUIRED in chat | Aide+Owner |
| E0419 | D05 | system | identityMode END_USER_TOKEN without host setUser (retry) | END_USER_TOKEN_REQUIRED in chat | Aide+Owner |
| E0420 | D05 | system | identityMode END_USER_TOKEN without host setUser (concurrent) | END_USER_TOKEN_REQUIRED in chat | Aide+Owner |
| E0421 | D05 | owner | URL template typo | 404 on test | Aide+Owner |
| E0422 | D05 | owner | URL template typo (studio) | 404 on test | Aide+Owner |
| E0423 | D05 | embed | URL template typo (embed) | 404 on test | Aide+Owner |
| E0424 | D05 | system | URL template typo (retry) | 404 on test | Aide+Owner |
| E0425 | D05 | system | URL template typo (concurrent) | 404 on test | Aide+Owner |
| E0426 | D05 | owner | SSRF private IP URL | Blocked at save/test | Aide+Owner |
| E0427 | D05 | owner | SSRF private IP URL (studio) | Blocked at save/test | Aide+Owner |
| E0428 | D05 | embed | SSRF private IP URL (embed) | Blocked at save/test | Aide+Owner |
| E0429 | D05 | system | SSRF private IP URL (retry) | Blocked at save/test | Aide+Owner |
| E0430 | D05 | system | SSRF private IP URL (concurrent) | Blocked at save/test | Aide+Owner |
| E0431 | D05 | owner | Disabled action | Tool not offered to LLM | Aide+Owner |
| E0432 | D05 | owner | Disabled action (studio) | Tool not offered to LLM | Aide+Owner |
| E0433 | D05 | embed | Disabled action (embed) | Tool not offered to LLM | Aide+Owner |
| E0434 | D05 | system | Disabled action (retry) | Tool not offered to LLM | Aide+Owner |
| E0435 | D05 | system | Disabled action (concurrent) | Tool not offered to LLM | Aide+Owner |
| E0436 | D05 | owner | actionsEnabled kill switch | No tools entire agent | Aide+Owner |
| E0437 | D05 | owner | actionsEnabled kill switch (studio) | No tools entire agent | Aide+Owner |
| E0438 | D05 | embed | actionsEnabled kill switch (embed) | No tools entire agent | Aide+Owner |
| E0439 | D05 | system | actionsEnabled kill switch (retry) | No tools entire agent | Aide+Owner |
| E0440 | D05 | system | actionsEnabled kill switch (concurrent) | No tools entire agent | Aide+Owner |
| E0441 | D05 | owner | DELETE action mid-chat | Fail closed ACTION_STALE | Aide+Owner |
| E0442 | D05 | owner | DELETE action mid-chat (studio) | Fail closed ACTION_STALE | Aide+Owner |
| E0443 | D05 | embed | DELETE action mid-chat (embed) | Fail closed ACTION_STALE | Aide+Owner |
| E0444 | D05 | system | DELETE action mid-chat (retry) | Fail closed ACTION_STALE | Aide+Owner |
| E0445 | D05 | system | DELETE action mid-chat (concurrent) | Fail closed ACTION_STALE | Aide+Owner |
| E0446 | D05 | owner | Rotate credential | Old revoked; new works | Aide+Owner |
| E0447 | D05 | owner | Rotate credential (studio) | Old revoked; new works | Aide+Owner |
| E0448 | D05 | embed | Rotate credential (embed) | Old revoked; new works | Aide+Owner |
| E0449 | D05 | system | Rotate credential (retry) | Old revoked; new works | Aide+Owner |
| E0450 | D05 | system | Rotate credential (concurrent) | Old revoked; new works | Aide+Owner |
| E0451 | D05 | owner | Two actions same name | Validation error | Aide+Owner |
| E0452 | D05 | owner | Two actions same name (studio) | Validation error | Aide+Owner |
| E0453 | D05 | embed | Two actions same name (embed) | Validation error | Aide+Owner |
| E0454 | D05 | system | Two actions same name (retry) | Validation error | Aide+Owner |
| E0455 | D05 | system | Two actions same name (concurrent) | Validation error | Aide+Owner |
| E0456 | D05 | owner | inputSchema too loose | Add constraints | Aide+Owner |
| E0457 | D05 | owner | inputSchema too loose (studio) | Add constraints | Aide+Owner |
| E0458 | D05 | embed | inputSchema too loose (embed) | Add constraints | Aide+Owner |
| E0459 | D05 | system | inputSchema too loose (retry) | Add constraints | Aide+Owner |
| E0460 | D05 | system | inputSchema too loose (concurrent) | Add constraints | Aide+Owner |
| E0461 | D05 | owner | outputSchema not enforced | Enable output validation R3 | Aide+Owner |
| E0462 | D05 | owner | outputSchema not enforced (studio) | Enable output validation R3 | Aide+Owner |
| E0463 | D05 | embed | outputSchema not enforced (embed) | Enable output validation R3 | Aide+Owner |
| E0464 | D05 | system | outputSchema not enforced (retry) | Enable output validation R3 | Aide+Owner |
| E0465 | D05 | system | outputSchema not enforced (concurrent) | Enable output validation R3 | Aide+Owner |
| E0466 | D05 | owner | Timeout too high | Clamp 15s | Aide+Owner |
| E0467 | D05 | owner | Timeout too high (studio) | Clamp 15s | Aide+Owner |
| E0468 | D05 | embed | Timeout too high (embed) | Clamp 15s | Aide+Owner |
| E0469 | D05 | system | Timeout too high (retry) | Clamp 15s | Aide+Owner |
| E0470 | D05 | system | Timeout too high (concurrent) | Clamp 15s | Aide+Owner |
| E0471 | D05 | owner | POST without idempotency | No retry on 5xx | Aide+Owner |
| E0472 | D05 | owner | POST without idempotency (studio) | No retry on 5xx | Aide+Owner |
| E0473 | D05 | embed | POST without idempotency (embed) | No retry on 5xx | Aide+Owner |
| E0474 | D05 | system | POST without idempotency (retry) | No retry on 5xx | Aide+Owner |
| E0475 | D05 | system | POST without idempotency (concurrent) | No retry on 5xx | Aide+Owner |
| E0476 | D05 | owner | GET cache on personalized | Disable cache per action | Aide+Owner |
| E0477 | D05 | owner | GET cache on personalized (studio) | Disable cache per action | Aide+Owner |
| E0478 | D05 | embed | GET cache on personalized (embed) | Disable cache per action | Aide+Owner |
| E0479 | D05 | system | GET cache on personalized (retry) | Disable cache per action | Aide+Owner |
| E0480 | D05 | system | GET cache on personalized (concurrent) | Disable cache per action | Aide+Owner |
| E0481 | D05 | owner | Pack install duplicate | Skip existing names | Aide+Owner |
| E0482 | D05 | owner | Pack install duplicate (studio) | Skip existing names | Aide+Owner |
| E0483 | D05 | embed | Pack install duplicate (embed) | Skip existing names | Aide+Owner |
| E0484 | D05 | system | Pack install duplicate (retry) | Skip existing names | Aide+Owner |
| E0485 | D05 | system | Pack install duplicate (concurrent) | Skip existing names | Aide+Owner |
| E0486 | D05 | owner | Brandly pack without key | test:brandly-http documents fix | Aide+Owner |
| E0487 | D05 | owner | Brandly pack without key (studio) | test:brandly-http documents fix | Aide+Owner |
| E0488 | D05 | embed | Brandly pack without key (embed) | test:brandly-http documents fix | Aide+Owner |
| E0489 | D05 | system | Brandly pack without key (retry) | test:brandly-http documents fix | Aide+Owner |
| E0490 | D05 | system | Brandly pack without key (concurrent) | test:brandly-http documents fix | Aide+Owner |
| E0491 | D05 | owner | MCP + HTTP same agent | Both via tool loop policy | Aide+Owner |
| E0492 | D05 | owner | MCP + HTTP same agent (studio) | Both via tool loop policy | Aide+Owner |
| E0493 | D05 | embed | MCP + HTTP same agent (embed) | Both via tool loop policy | Aide+Owner |
| E0494 | D05 | system | MCP + HTTP same agent (retry) | Both via tool loop policy | Aide+Owner |
| E0495 | D05 | system | MCP + HTTP same agent (concurrent) | Both via tool loop policy | Aide+Owner |
| E0496 | D05 | owner | Vertical template wrong host | Test button catches | Aide+Owner |
| E0497 | D05 | owner | Vertical template wrong host (studio) | Test button catches | Aide+Owner |
| E0498 | D05 | embed | Vertical template wrong host (embed) | Test button catches | Aide+Owner |
| E0499 | D05 | system | Vertical template wrong host (retry) | Test button catches | Aide+Owner |
| E0500 | D05 | system | Vertical template wrong host (concurrent) | Test button catches | Aide+Owner |
| E0501 | D06 | system | Timeout 8s | One retry READ | Aide+Owner |
| E0502 | D06 | owner | Timeout 8s (studio) | One retry READ | Aide+Owner |
| E0503 | D06 | embed | Timeout 8s (embed) | One retry READ | Aide+Owner |
| E0504 | D06 | system | Timeout 8s (retry) | One retry READ | Aide+Owner |
| E0505 | D06 | system | Timeout 8s (concurrent) | One retry READ | Aide+Owner |
| E0506 | D06 | system | Timeout on WRITE | No retry | Aide+Owner |
| E0507 | D06 | owner | Timeout on WRITE (studio) | No retry | Aide+Owner |
| E0508 | D06 | embed | Timeout on WRITE (embed) | No retry | Aide+Owner |
| E0509 | D06 | system | Timeout on WRITE (retry) | No retry | Aide+Owner |
| E0510 | D06 | system | Timeout on WRITE (concurrent) | No retry | Aide+Owner |
| E0511 | D06 | system | 502 upstream | Retry READ once | Aide+Owner |
| E0512 | D06 | owner | 502 upstream (studio) | Retry READ once | Aide+Owner |
| E0513 | D06 | embed | 502 upstream (embed) | Retry READ once | Aide+Owner |
| E0514 | D06 | system | 502 upstream (retry) | Retry READ once | Aide+Owner |
| E0515 | D06 | system | 502 upstream (concurrent) | Retry READ once | Aide+Owner |
| E0516 | D06 | system | 503 maintenance | Soft fail message | Aide+Owner |
| E0517 | D06 | owner | 503 maintenance (studio) | Soft fail message | Aide+Owner |
| E0518 | D06 | embed | 503 maintenance (embed) | Soft fail message | Aide+Owner |
| E0519 | D06 | system | 503 maintenance (retry) | Soft fail message | Aide+Owner |
| E0520 | D06 | system | 503 maintenance (concurrent) | Soft fail message | Aide+Owner |
| E0521 | D06 | system | 429 rate limit | Honor Retry-After | Aide+Owner |
| E0522 | D06 | owner | 429 rate limit (studio) | Honor Retry-After | Aide+Owner |
| E0523 | D06 | embed | 429 rate limit (embed) | Honor Retry-After | Aide+Owner |
| E0524 | D06 | system | 429 rate limit (retry) | Honor Retry-After | Aide+Owner |
| E0525 | D06 | system | 429 rate limit (concurrent) | Honor Retry-After | Aide+Owner |
| E0526 | D06 | logged-in | 404 not found | Clarify id | Aide+Owner |
| E0527 | D06 | owner | 404 not found (studio) | Clarify id | Aide+Owner |
| E0528 | D06 | embed | 404 not found (embed) | Clarify id | Aide+Owner |
| E0529 | D06 | system | 404 not found (retry) | Clarify id | Aide+Owner |
| E0530 | D06 | system | 404 not found (concurrent) | Clarify id | Aide+Owner |
| E0531 | D06 | system | 401 owner API | Credential health | Aide+Owner |
| E0532 | D06 | owner | 401 owner API (studio) | Credential health | Aide+Owner |
| E0533 | D06 | embed | 401 owner API (embed) | Credential health | Aide+Owner |
| E0534 | D06 | system | 401 owner API (retry) | Credential health | Aide+Owner |
| E0535 | D06 | system | 401 owner API (concurrent) | Credential health | Aide+Owner |
| E0536 | D06 | logged-in | 403 owner ACL | Not authorized message | Aide+Owner |
| E0537 | D06 | owner | 403 owner ACL (studio) | Not authorized message | Aide+Owner |
| E0538 | D06 | embed | 403 owner ACL (embed) | Not authorized message | Aide+Owner |
| E0539 | D06 | system | 403 owner ACL (retry) | Not authorized message | Aide+Owner |
| E0540 | D06 | system | 403 owner ACL (concurrent) | Not authorized message | Aide+Owner |
| E0541 | D06 | system | 400 validation | Ask user fix args | Aide+Owner |
| E0542 | D06 | owner | 400 validation (studio) | Ask user fix args | Aide+Owner |
| E0543 | D06 | embed | 400 validation (embed) | Ask user fix args | Aide+Owner |
| E0544 | D06 | system | 400 validation (retry) | Ask user fix args | Aide+Owner |
| E0545 | D06 | system | 400 validation (concurrent) | Ask user fix args | Aide+Owner |
| E0546 | D06 | system | Huge JSON 5MB | Byte cap truncate | Aide+Owner |
| E0547 | D06 | owner | Huge JSON 5MB (studio) | Byte cap truncate | Aide+Owner |
| E0548 | D06 | embed | Huge JSON 5MB (embed) | Byte cap truncate | Aide+Owner |
| E0549 | D06 | system | Huge JSON 5MB (retry) | Byte cap truncate | Aide+Owner |
| E0550 | D06 | system | Huge JSON 5MB (concurrent) | Byte cap truncate | Aide+Owner |
| E0551 | D06 | system | HTML error page | Do not pass to LLM | Aide+Owner |
| E0552 | D06 | owner | HTML error page (studio) | Do not pass to LLM | Aide+Owner |
| E0553 | D06 | embed | HTML error page (embed) | Do not pass to LLM | Aide+Owner |
| E0554 | D06 | system | HTML error page (retry) | Do not pass to LLM | Aide+Owner |
| E0555 | D06 | system | HTML error page (concurrent) | Do not pass to LLM | Aide+Owner |
| E0556 | D06 | attack | DNS rebinding attempt | DNS pin block | Aide+Owner |
| E0557 | D06 | owner | DNS rebinding attempt (studio) | DNS pin block | Aide+Owner |
| E0558 | D06 | embed | DNS rebinding attempt (embed) | DNS pin block | Aide+Owner |
| E0559 | D06 | system | DNS rebinding attempt (retry) | DNS pin block | Aide+Owner |
| E0560 | D06 | system | DNS rebinding attempt (concurrent) | DNS pin block | Aide+Owner |
| E0561 | D06 | attack | Redirect to metadata | redirect manual block | Aide+Owner |
| E0562 | D06 | owner | Redirect to metadata (studio) | redirect manual block | Aide+Owner |
| E0563 | D06 | embed | Redirect to metadata (embed) | redirect manual block | Aide+Owner |
| E0564 | D06 | system | Redirect to metadata (retry) | redirect manual block | Aide+Owner |
| E0565 | D06 | system | Redirect to metadata (concurrent) | redirect manual block | Aide+Owner |
| E0566 | D06 | attack | IPv6 localhost | SSRF block | Aide+Owner |
| E0567 | D06 | owner | IPv6 localhost (studio) | SSRF block | Aide+Owner |
| E0568 | D06 | embed | IPv6 localhost (embed) | SSRF block | Aide+Owner |
| E0569 | D06 | system | IPv6 localhost (retry) | SSRF block | Aide+Owner |
| E0570 | D06 | system | IPv6 localhost (concurrent) | SSRF block | Aide+Owner |
| E0571 | D06 | system | Concurrent 3 calls | Semaphore 2 | Aide+Owner |
| E0572 | D06 | owner | Concurrent 3 calls (studio) | Semaphore 2 | Aide+Owner |
| E0573 | D06 | embed | Concurrent 3 calls (embed) | Semaphore 2 | Aide+Owner |
| E0574 | D06 | system | Concurrent 3 calls (retry) | Semaphore 2 | Aide+Owner |
| E0575 | D06 | system | Concurrent 3 calls (concurrent) | Semaphore 2 | Aide+Owner |
| E0576 | D06 | system | Daily workspace cap | RATE_LIMIT daily | Aide+Owner |
| E0577 | D06 | owner | Daily workspace cap (studio) | RATE_LIMIT daily | Aide+Owner |
| E0578 | D06 | embed | Daily workspace cap (embed) | RATE_LIMIT daily | Aide+Owner |
| E0579 | D06 | system | Daily workspace cap (retry) | RATE_LIMIT daily | Aide+Owner |
| E0580 | D06 | system | Daily workspace cap (concurrent) | RATE_LIMIT daily | Aide+Owner |
| E0581 | D06 | system | GET cache hit | CACHE_HIT audit | Aide+Owner |
| E0582 | D06 | owner | GET cache hit (studio) | CACHE_HIT audit | Aide+Owner |
| E0583 | D06 | embed | GET cache hit (embed) | CACHE_HIT audit | Aide+Owner |
| E0584 | D06 | system | GET cache hit (retry) | CACHE_HIT audit | Aide+Owner |
| E0585 | D06 | system | GET cache hit (concurrent) | CACHE_HIT audit | Aide+Owner |
| E0586 | D06 | system | GET cache stale | TTL refresh | Aide+Owner |
| E0587 | D06 | owner | GET cache stale (studio) | TTL refresh | Aide+Owner |
| E0588 | D06 | embed | GET cache stale (embed) | TTL refresh | Aide+Owner |
| E0589 | D06 | system | GET cache stale (retry) | TTL refresh | Aide+Owner |
| E0590 | D06 | system | GET cache stale (concurrent) | TTL refresh | Aide+Owner |
| E0591 | D06 | attack | Frozen host changed DNS | Re-resolve pin | Aide+Owner |
| E0592 | D06 | owner | Frozen host changed DNS (studio) | Re-resolve pin | Aide+Owner |
| E0593 | D06 | embed | Frozen host changed DNS (embed) | Re-resolve pin | Aide+Owner |
| E0594 | D06 | system | Frozen host changed DNS (retry) | Re-resolve pin | Aide+Owner |
| E0595 | D06 | system | Frozen host changed DNS (concurrent) | Re-resolve pin | Aide+Owner |
| E0596 | D06 | system | TLS cert invalid | Fail closed | Aide+Owner |
| E0597 | D06 | owner | TLS cert invalid (studio) | Fail closed | Aide+Owner |
| E0598 | D06 | embed | TLS cert invalid (embed) | Fail closed | Aide+Owner |
| E0599 | D06 | system | TLS cert invalid (retry) | Fail closed | Aide+Owner |
| E0600 | D06 | system | TLS cert invalid (concurrent) | Fail closed | Aide+Owner |
| E0601 | D07 | attack | Ignore policies cancel all | Policy engine blocks | Aide+Owner |
| E0602 | D07 | owner | Ignore policies cancel all (studio) | Policy engine blocks | Aide+Owner |
| E0603 | D07 | embed | Ignore policies cancel all (embed) | Policy engine blocks | Aide+Owner |
| E0604 | D07 | system | Ignore policies cancel all (retry) | Policy engine blocks | Aide+Owner |
| E0605 | D07 | system | Ignore policies cancel all (concurrent) | Policy engine blocks | Aide+Owner |
| E0606 | D07 | attack | Paste fake tool result | Server-only tool results | Aide+Owner |
| E0607 | D07 | owner | Paste fake tool result (studio) | Server-only tool results | Aide+Owner |
| E0608 | D07 | embed | Paste fake tool result (embed) | Server-only tool results | Aide+Owner |
| E0609 | D07 | system | Paste fake tool result (retry) | Server-only tool results | Aide+Owner |
| E0610 | D07 | system | Paste fake tool result (concurrent) | Server-only tool results | Aide+Owner |
| E0611 | D07 | attack | Ask for env secrets | Refuse; never in prompt | Aide+Owner |
| E0612 | D07 | owner | Ask for env secrets (studio) | Refuse; never in prompt | Aide+Owner |
| E0613 | D07 | embed | Ask for env secrets (embed) | Refuse; never in prompt | Aide+Owner |
| E0614 | D07 | system | Ask for env secrets (retry) | Refuse; never in prompt | Aide+Owner |
| E0615 | D07 | system | Ask for env secrets (concurrent) | Refuse; never in prompt | Aide+Owner |
| E0616 | D07 | attack | Ask for other user data | Refuse | Aide+Owner |
| E0617 | D07 | owner | Ask for other user data (studio) | Refuse | Aide+Owner |
| E0618 | D07 | embed | Ask for other user data (embed) | Refuse | Aide+Owner |
| E0619 | D07 | system | Ask for other user data (retry) | Refuse | Aide+Owner |
| E0620 | D07 | system | Ask for other user data (concurrent) | Refuse | Aide+Owner |
| E0621 | D07 | attack | Jailbreak as developer | No bypass | Aide+Owner |
| E0622 | D07 | owner | Jailbreak as developer (studio) | No bypass | Aide+Owner |
| E0623 | D07 | embed | Jailbreak as developer (embed) | No bypass | Aide+Owner |
| E0624 | D07 | system | Jailbreak as developer (retry) | No bypass | Aide+Owner |
| E0625 | D07 | system | Jailbreak as developer (concurrent) | No bypass | Aide+Owner |
| E0626 | D07 | attack | Unicode homoglyph order id | Schema validate | Aide+Owner |
| E0627 | D07 | owner | Unicode homoglyph order id (studio) | Schema validate | Aide+Owner |
| E0628 | D07 | embed | Unicode homoglyph order id (embed) | Schema validate | Aide+Owner |
| E0629 | D07 | system | Unicode homoglyph order id (retry) | Schema validate | Aide+Owner |
| E0630 | D07 | system | Unicode homoglyph order id (concurrent) | Schema validate | Aide+Owner |
| E0631 | D07 | attack | Multi-language injection | Same policy | Aide+Owner |
| E0632 | D07 | owner | Multi-language injection (studio) | Same policy | Aide+Owner |
| E0633 | D07 | embed | Multi-language injection (embed) | Same policy | Aide+Owner |
| E0634 | D07 | system | Multi-language injection (retry) | Same policy | Aide+Owner |
| E0635 | D07 | system | Multi-language injection (concurrent) | Same policy | Aide+Owner |
| E0636 | D07 | attack | Tool call with extra args | Schema strip/reject | Aide+Owner |
| E0637 | D07 | owner | Tool call with extra args (studio) | Schema strip/reject | Aide+Owner |
| E0638 | D07 | embed | Tool call with extra args (embed) | Schema strip/reject | Aide+Owner |
| E0639 | D07 | system | Tool call with extra args (retry) | Schema strip/reject | Aide+Owner |
| E0640 | D07 | system | Tool call with extra args (concurrent) | Schema strip/reject | Aide+Owner |
| E0641 | D07 | attack | Tool call wrong name | Unknown tool | Aide+Owner |
| E0642 | D07 | owner | Tool call wrong name (studio) | Unknown tool | Aide+Owner |
| E0643 | D07 | embed | Tool call wrong name (embed) | Unknown tool | Aide+Owner |
| E0644 | D07 | system | Tool call wrong name (retry) | Unknown tool | Aide+Owner |
| E0645 | D07 | system | Tool call wrong name (concurrent) | Unknown tool | Aide+Owner |
| E0646 | D07 | system | Max steps exceeded | Stop loop | Aide+Owner |
| E0647 | D07 | owner | Max steps exceeded (studio) | Stop loop | Aide+Owner |
| E0648 | D07 | embed | Max steps exceeded (embed) | Stop loop | Aide+Owner |
| E0649 | D07 | system | Max steps exceeded (retry) | Stop loop | Aide+Owner |
| E0650 | D07 | system | Max steps exceeded (concurrent) | Stop loop | Aide+Owner |
| E0651 | D07 | system | Tool loop 25s deadline | Stop | Aide+Owner |
| E0652 | D07 | owner | Tool loop 25s deadline (studio) | Stop | Aide+Owner |
| E0653 | D07 | embed | Tool loop 25s deadline (embed) | Stop | Aide+Owner |
| E0654 | D07 | system | Tool loop 25s deadline (retry) | Stop | Aide+Owner |
| E0655 | D07 | system | Tool loop 25s deadline (concurrent) | Stop | Aide+Owner |
| E0656 | D07 | system | Classify path no tools | classify.js tool-free | Aide+Owner |
| E0657 | D07 | owner | Classify path no tools (studio) | classify.js tool-free | Aide+Owner |
| E0658 | D07 | embed | Classify path no tools (embed) | classify.js tool-free | Aide+Owner |
| E0659 | D07 | system | Classify path no tools (retry) | classify.js tool-free | Aide+Owner |
| E0660 | D07 | system | Classify path no tools (concurrent) | classify.js tool-free | Aide+Owner |
| E0661 | D07 | logged-in | KB + tool same turn | Both allowed | Aide+Owner |
| E0662 | D07 | owner | KB + tool same turn (studio) | Both allowed | Aide+Owner |
| E0663 | D07 | embed | KB + tool same turn (embed) | Both allowed | Aide+Owner |
| E0664 | D07 | system | KB + tool same turn (retry) | Both allowed | Aide+Owner |
| E0665 | D07 | system | KB + tool same turn (concurrent) | Both allowed | Aide+Owner |
| E0666 | D07 | system | Invent data when tool fails | tool-errors guidance | Aide+Owner |
| E0667 | D07 | owner | Invent data when tool fails (studio) | tool-errors guidance | Aide+Owner |
| E0668 | D07 | embed | Invent data when tool fails (embed) | tool-errors guidance | Aide+Owner |
| E0669 | D07 | system | Invent data when tool fails (retry) | tool-errors guidance | Aide+Owner |
| E0670 | D07 | system | Invent data when tool fails (concurrent) | tool-errors guidance | Aide+Owner |
| E0671 | D07 | attack | User: run delete_user | No tool → refuse | Aide+Owner |
| E0672 | D07 | owner | User: run delete_user (studio) | No tool → refuse | Aide+Owner |
| E0673 | D07 | embed | User: run delete_user (embed) | No tool → refuse | Aide+Owner |
| E0674 | D07 | system | User: run delete_user (retry) | No tool → refuse | Aide+Owner |
| E0675 | D07 | system | User: run delete_user (concurrent) | No tool → refuse | Aide+Owner |
| E0676 | D07 | attack | Indirect injection in KB | KB not executable | Aide+Owner |
| E0677 | D07 | owner | Indirect injection in KB (studio) | KB not executable | Aide+Owner |
| E0678 | D07 | embed | Indirect injection in KB (embed) | KB not executable | Aide+Owner |
| E0679 | D07 | system | Indirect injection in KB (retry) | KB not executable | Aide+Owner |
| E0680 | D07 | system | Indirect injection in KB (concurrent) | KB not executable | Aide+Owner |
| E0681 | D07 | attack | Indirect injection in API body | Output cap + schema | Aide+Owner |
| E0682 | D07 | owner | Indirect injection in API body (studio) | Output cap + schema | Aide+Owner |
| E0683 | D07 | embed | Indirect injection in API body (embed) | Output cap + schema | Aide+Owner |
| E0684 | D07 | system | Indirect injection in API body (retry) | Output cap + schema | Aide+Owner |
| E0685 | D07 | system | Indirect injection in API body (concurrent) | Output cap + schema | Aide+Owner |
| E0686 | D07 | attack | Social engineering confirm | User must click confirm | Aide+Owner |
| E0687 | D07 | owner | Social engineering confirm (studio) | User must click confirm | Aide+Owner |
| E0688 | D07 | embed | Social engineering confirm (embed) | User must click confirm | Aide+Owner |
| E0689 | D07 | system | Social engineering confirm (retry) | User must click confirm | Aide+Owner |
| E0690 | D07 | system | Social engineering confirm (concurrent) | User must click confirm | Aide+Owner |
| E0691 | D07 | attack | Fake confirmation id | Server validates | Aide+Owner |
| E0692 | D07 | owner | Fake confirmation id (studio) | Server validates | Aide+Owner |
| E0693 | D07 | embed | Fake confirmation id (embed) | Server validates | Aide+Owner |
| E0694 | D07 | system | Fake confirmation id (retry) | Server validates | Aide+Owner |
| E0695 | D07 | system | Fake confirmation id (concurrent) | Server validates | Aide+Owner |
| E0696 | D07 | attack | Replay old tool result | Not accepted | Aide+Owner |
| E0697 | D07 | owner | Replay old tool result (studio) | Not accepted | Aide+Owner |
| E0698 | D07 | embed | Replay old tool result (embed) | Not accepted | Aide+Owner |
| E0699 | D07 | system | Replay old tool result (retry) | Not accepted | Aide+Owner |
| E0700 | D07 | system | Replay old tool result (concurrent) | Not accepted | Aide+Owner |
| E0701 | D08 | system | API returns full SSN | Redact field map before LLM | Aide+Owner |
| E0702 | D08 | owner | API returns full SSN (studio) | Redact field map before LLM | Aide+Owner |
| E0703 | D08 | embed | API returns full SSN (embed) | Redact field map before LLM | Aide+Owner |
| E0704 | D08 | system | API returns full SSN (retry) | Redact field map before LLM | Aide+Owner |
| E0705 | D08 | system | API returns full SSN (concurrent) | Redact field map before LLM | Aide+Owner |
| E0706 | D08 | guest | API returns email | Redact or block | Aide+Owner |
| E0707 | D08 | owner | API returns email (studio) | Redact or block | Aide+Owner |
| E0708 | D08 | embed | API returns email (embed) | Redact or block | Aide+Owner |
| E0709 | D08 | system | API returns email (retry) | Redact or block | Aide+Owner |
| E0710 | D08 | system | API returns email (concurrent) | Redact or block | Aide+Owner |
| E0711 | D08 | logged-in-self | API returns email | OK if owner intends | Aide+Owner |
| E0712 | D08 | owner | API returns email (studio) | OK if owner intends | Aide+Owner |
| E0713 | D08 | embed | API returns email (embed) | OK if owner intends | Aide+Owner |
| E0714 | D08 | system | API returns email (retry) | OK if owner intends | Aide+Owner |
| E0715 | D08 | system | API returns email (concurrent) | OK if owner intends | Aide+Owner |
| E0716 | D08 | guest | API returns phone | Redact | Aide+Owner |
| E0717 | D08 | owner | API returns phone (studio) | Redact | Aide+Owner |
| E0718 | D08 | embed | API returns phone (embed) | Redact | Aide+Owner |
| E0719 | D08 | system | API returns phone (retry) | Redact | Aide+Owner |
| E0720 | D08 | system | API returns phone (concurrent) | Redact | Aide+Owner |
| E0721 | D08 | guest | API returns shipping address | City+state only | Aide+Owner |
| E0722 | D08 | owner | API returns shipping address (studio) | City+state only | Aide+Owner |
| E0723 | D08 | embed | API returns shipping address (embed) | City+state only | Aide+Owner |
| E0724 | D08 | system | API returns shipping address (retry) | City+state only | Aide+Owner |
| E0725 | D08 | system | API returns shipping address (concurrent) | City+state only | Aide+Owner |
| E0726 | D08 | system | API returns payment card | Never to LLM | Aide+Owner |
| E0727 | D08 | owner | API returns payment card (studio) | Never to LLM | Aide+Owner |
| E0728 | D08 | embed | API returns payment card (embed) | Never to LLM | Aide+Owner |
| E0729 | D08 | system | API returns payment card (retry) | Never to LLM | Aide+Owner |
| E0730 | D08 | system | API returns payment card (concurrent) | Never to LLM | Aide+Owner |
| E0731 | D08 | guest | API returns internal user id | Strip | Aide+Owner |
| E0732 | D08 | owner | API returns internal user id (studio) | Strip | Aide+Owner |
| E0733 | D08 | embed | API returns internal user id (embed) | Strip | Aide+Owner |
| E0734 | D08 | system | API returns internal user id (retry) | Strip | Aide+Owner |
| E0735 | D08 | system | API returns internal user id (concurrent) | Strip | Aide+Owner |
| E0736 | D08 | system | LLM echoes PII in markdown | Prompt: minimize PII | Aide+Owner |
| E0737 | D08 | owner | LLM echoes PII in markdown (studio) | Prompt: minimize PII | Aide+Owner |
| E0738 | D08 | embed | LLM echoes PII in markdown (embed) | Prompt: minimize PII | Aide+Owner |
| E0739 | D08 | system | LLM echoes PII in markdown (retry) | Prompt: minimize PII | Aide+Owner |
| E0740 | D08 | system | LLM echoes PII in markdown (concurrent) | Prompt: minimize PII | Aide+Owner |
| E0741 | D08 | system | Logs ToolRun body | Never full body | Aide+Owner |
| E0742 | D08 | owner | Logs ToolRun body (studio) | Never full body | Aide+Owner |
| E0743 | D08 | embed | Logs ToolRun body (embed) | Never full body | Aide+Owner |
| E0744 | D08 | system | Logs ToolRun body (retry) | Never full body | Aide+Owner |
| E0745 | D08 | system | Logs ToolRun body (concurrent) | Never full body | Aide+Owner |
| E0746 | D08 | owner | Export run includes PII | Warn owner | Aide+Owner |
| E0747 | D08 | owner | Export run includes PII (studio) | Warn owner | Aide+Owner |
| E0748 | D08 | embed | Export run includes PII (embed) | Warn owner | Aide+Owner |
| E0749 | D08 | system | Export run includes PII (retry) | Warn owner | Aide+Owner |
| E0750 | D08 | system | Export run includes PII (concurrent) | Warn owner | Aide+Owner |
| E0751 | D08 | owner | Desk human sees full | Desk separate policy | Aide+Owner |
| E0752 | D08 | owner | Desk human sees full (studio) | Desk separate policy | Aide+Owner |
| E0753 | D08 | embed | Desk human sees full (embed) | Desk separate policy | Aide+Owner |
| E0754 | D08 | system | Desk human sees full (retry) | Desk separate policy | Aide+Owner |
| E0755 | D08 | system | Desk human sees full (concurrent) | Desk separate policy | Aide+Owner |
| E0756 | D08 | logged-in | Confirmation card shows args | Mask sensitive fields | Aide+Owner |
| E0757 | D08 | owner | Confirmation card shows args (studio) | Mask sensitive fields | Aide+Owner |
| E0758 | D08 | embed | Confirmation card shows args (embed) | Mask sensitive fields | Aide+Owner |
| E0759 | D08 | system | Confirmation card shows args (retry) | Mask sensitive fields | Aide+Owner |
| E0760 | D08 | system | Confirmation card shows args (concurrent) | Mask sensitive fields | Aide+Owner |
| E0761 | D08 | guest | tracking status only | Designed redaction | Aide+Owner |
| E0762 | D08 | owner | tracking status only (studio) | Designed redaction | Aide+Owner |
| E0763 | D08 | embed | tracking status only (embed) | Designed redaction | Aide+Owner |
| E0764 | D08 | system | tracking status only (retry) | Designed redaction | Aide+Owner |
| E0765 | D08 | system | tracking status only (concurrent) | Designed redaction | Aide+Owner |
| E0766 | D08 | logged-in | Medical results | HIPAA owner responsibility | Aide+Owner |
| E0767 | D08 | owner | Medical results (studio) | HIPAA owner responsibility | Aide+Owner |
| E0768 | D08 | embed | Medical results (embed) | HIPAA owner responsibility | Aide+Owner |
| E0769 | D08 | system | Medical results (retry) | HIPAA owner responsibility | Aide+Owner |
| E0770 | D08 | system | Medical results (concurrent) | HIPAA owner responsibility | Aide+Owner |
| E0771 | D08 | logged-in | Financial balance | Confirm before display? | Aide+Owner |
| E0772 | D08 | owner | Financial balance (studio) | Confirm before display? | Aide+Owner |
| E0773 | D08 | embed | Financial balance (embed) | Confirm before display? | Aide+Owner |
| E0774 | D08 | system | Financial balance (retry) | Confirm before display? | Aide+Owner |
| E0775 | D08 | system | Financial balance (concurrent) | Confirm before display? | Aide+Owner |
| E0776 | D08 | guest | Children data COPPA | Refuse collection | Aide+Owner |
| E0777 | D08 | owner | Children data COPPA (studio) | Refuse collection | Aide+Owner |
| E0778 | D08 | embed | Children data COPPA (embed) | Refuse collection | Aide+Owner |
| E0779 | D08 | system | Children data COPPA (retry) | Refuse collection | Aide+Owner |
| E0780 | D08 | system | Children data COPPA (concurrent) | Refuse collection | Aide+Owner |
| E0781 | D08 | logged-in | GDPR erasure request | WRITE confirm + owner API | Aide+Owner |
| E0782 | D08 | owner | GDPR erasure request (studio) | WRITE confirm + owner API | Aide+Owner |
| E0783 | D08 | embed | GDPR erasure request (embed) | WRITE confirm + owner API | Aide+Owner |
| E0784 | D08 | system | GDPR erasure request (retry) | WRITE confirm + owner API | Aide+Owner |
| E0785 | D08 | system | GDPR erasure request (concurrent) | WRITE confirm + owner API | Aide+Owner |
| E0786 | D08 | owner | Data residency EU | Owner API region | Owner |
| E0787 | D08 | owner | Data residency EU (studio) | Owner API region | Owner |
| E0788 | D08 | embed | Data residency EU (embed) | Owner API region | Owner |
| E0789 | D08 | system | Data residency EU (retry) | Owner API region | Owner |
| E0790 | D08 | system | Data residency EU (concurrent) | Owner API region | Owner |
| E0791 | D08 | attack | Token in chat message | Never ask user paste JWT | Aide+Owner |
| E0792 | D08 | owner | Token in chat message (studio) | Never ask user paste JWT | Aide+Owner |
| E0793 | D08 | embed | Token in chat message (embed) | Never ask user paste JWT | Aide+Owner |
| E0794 | D08 | system | Token in chat message (retry) | Never ask user paste JWT | Aide+Owner |
| E0795 | D08 | system | Token in chat message (concurrent) | Never ask user paste JWT | Aide+Owner |
| E0796 | D08 | logged-in | Screenshot sensitive card | UI mask | Aide+Owner |
| E0797 | D08 | owner | Screenshot sensitive card (studio) | UI mask | Aide+Owner |
| E0798 | D08 | embed | Screenshot sensitive card (embed) | UI mask | Aide+Owner |
| E0799 | D08 | system | Screenshot sensitive card (retry) | UI mask | Aide+Owner |
| E0800 | D08 | system | Screenshot sensitive card (concurrent) | UI mask | Aide+Owner |
| E0801 | D09 | guest | Floating embed | Bubble mode | Aide+Owner |
| E0802 | D09 | owner | Floating embed (studio) | Bubble mode | Aide+Owner |
| E0803 | D09 | embed | Floating embed (embed) | Bubble mode | Aide+Owner |
| E0804 | D09 | system | Floating embed (retry) | Bubble mode | Aide+Owner |
| E0805 | D09 | system | Floating embed (concurrent) | Bubble mode | Aide+Owner |
| E0806 | D09 | logged-in | Full page embed | Container mode | Aide+Owner |
| E0807 | D09 | owner | Full page embed (studio) | Container mode | Aide+Owner |
| E0808 | D09 | embed | Full page embed (embed) | Container mode | Aide+Owner |
| E0809 | D09 | system | Full page embed (retry) | Container mode | Aide+Owner |
| E0810 | D09 | system | Full page embed (concurrent) | Container mode | Aide+Owner |
| E0811 | D09 | logged-in | SPA navigation | setUser on route change | Aide+Owner |
| E0812 | D09 | owner | SPA navigation (studio) | setUser on route change | Aide+Owner |
| E0813 | D09 | embed | SPA navigation (embed) | setUser on route change | Aide+Owner |
| E0814 | D09 | system | SPA navigation (retry) | setUser on route change | Aide+Owner |
| E0815 | D09 | system | SPA navigation (concurrent) | setUser on route change | Aide+Owner |
| E0816 | D09 | logged-in | SSR page load | setUser in layout | Aide+Owner |
| E0817 | D09 | owner | SSR page load (studio) | setUser in layout | Aide+Owner |
| E0818 | D09 | embed | SSR page load (embed) | setUser in layout | Aide+Owner |
| E0819 | D09 | system | SSR page load (retry) | setUser in layout | Aide+Owner |
| E0820 | D09 | system | SSR page load (concurrent) | setUser in layout | Aide+Owner |
| E0821 | D09 | guest | Logout clearUser | Guest tools only | Aide+Owner |
| E0822 | D09 | owner | Logout clearUser (studio) | Guest tools only | Aide+Owner |
| E0823 | D09 | embed | Logout clearUser (embed) | Guest tools only | Aide+Owner |
| E0824 | D09 | system | Logout clearUser (retry) | Guest tools only | Aide+Owner |
| E0825 | D09 | system | Logout clearUser (concurrent) | Guest tools only | Aide+Owner |
| E0826 | D09 | system | iframe third party cookies | localStorage history | Aide+Owner |
| E0827 | D09 | owner | iframe third party cookies (studio) | localStorage history | Aide+Owner |
| E0828 | D09 | embed | iframe third party cookies (embed) | localStorage history | Aide+Owner |
| E0829 | D09 | system | iframe third party cookies (retry) | localStorage history | Aide+Owner |
| E0830 | D09 | system | iframe third party cookies (concurrent) | localStorage history | Aide+Owner |
| E0831 | D09 | attack | Origin lock mismatch | 403 ping | Aide+Owner |
| E0832 | D09 | owner | Origin lock mismatch (studio) | 403 ping | Aide+Owner |
| E0833 | D09 | embed | Origin lock mismatch (embed) | 403 ping | Aide+Owner |
| E0834 | D09 | system | Origin lock mismatch (retry) | 403 ping | Aide+Owner |
| E0835 | D09 | system | Origin lock mismatch (concurrent) | 403 ping | Aide+Owner |
| E0836 | D09 | owner | Embed killed admin | Widget unavailable | Aide+Owner |
| E0837 | D09 | owner | Embed killed admin (studio) | Widget unavailable | Aide+Owner |
| E0838 | D09 | embed | Embed killed admin (embed) | Widget unavailable | Aide+Owner |
| E0839 | D09 | system | Embed killed admin (retry) | Widget unavailable | Aide+Owner |
| E0840 | D09 | system | Embed killed admin (concurrent) | Widget unavailable | Aide+Owner |
| E0841 | D09 | owner | Multiple agents one page | Separate iframes | Aide+Owner |
| E0842 | D09 | owner | Multiple agents one page (studio) | Separate iframes | Aide+Owner |
| E0843 | D09 | embed | Multiple agents one page (embed) | Separate iframes | Aide+Owner |
| E0844 | D09 | system | Multiple agents one page (retry) | Separate iframes | Aide+Owner |
| E0845 | D09 | system | Multiple agents one page (concurrent) | Separate iframes | Aide+Owner |
| E0846 | D09 | owner | CSP blocks iframe | Host docs | Aide+Owner |
| E0847 | D09 | owner | CSP blocks iframe (studio) | Host docs | Aide+Owner |
| E0848 | D09 | embed | CSP blocks iframe (embed) | Host docs | Aide+Owner |
| E0849 | D09 | system | CSP blocks iframe (retry) | Host docs | Aide+Owner |
| E0850 | D09 | system | CSP blocks iframe (concurrent) | Host docs | Aide+Owner |
| E0851 | D09 | ui | Mobile keyboard resize | postFrame | Aide+Owner |
| E0852 | D09 | owner | Mobile keyboard resize (studio) | postFrame | Aide+Owner |
| E0853 | D09 | embed | Mobile keyboard resize (embed) | postFrame | Aide+Owner |
| E0854 | D09 | system | Mobile keyboard resize (retry) | postFrame | Aide+Owner |
| E0855 | D09 | system | Mobile keyboard resize (concurrent) | postFrame | Aide+Owner |
| E0856 | D09 | guest | Proactive message | No auto tool | Aide+Owner |
| E0857 | D09 | owner | Proactive message (studio) | No auto tool | Aide+Owner |
| E0858 | D09 | embed | Proactive message (embed) | No auto tool | Aide+Owner |
| E0859 | D09 | system | Proactive message (retry) | No auto tool | Aide+Owner |
| E0860 | D09 | system | Proactive message (concurrent) | No auto tool | Aide+Owner |
| E0861 | D09 | logged-in | File upload embed | Cloudinary path | Aide+Owner |
| E0862 | D09 | owner | File upload embed (studio) | Cloudinary path | Aide+Owner |
| E0863 | D09 | embed | File upload embed (embed) | Cloudinary path | Aide+Owner |
| E0864 | D09 | system | File upload embed (retry) | Cloudinary path | Aide+Owner |
| E0865 | D09 | system | File upload embed (concurrent) | Cloudinary path | Aide+Owner |
| E0866 | D09 | logged-in | Handoff during tool | Pause AI | Aide+Owner |
| E0867 | D09 | owner | Handoff during tool (studio) | Pause AI | Aide+Owner |
| E0868 | D09 | embed | Handoff during tool (embed) | Pause AI | Aide+Owner |
| E0869 | D09 | system | Handoff during tool (retry) | Pause AI | Aide+Owner |
| E0870 | D09 | system | Handoff during tool (concurrent) | Pause AI | Aide+Owner |
| E0871 | D09 | logged-in | authRefreshRequired | Host hook | Aide+Owner |
| E0872 | D09 | owner | authRefreshRequired (studio) | Host hook | Aide+Owner |
| E0873 | D09 | embed | authRefreshRequired (embed) | Host hook | Aide+Owner |
| E0874 | D09 | system | authRefreshRequired (retry) | Host hook | Aide+Owner |
| E0875 | D09 | system | authRefreshRequired (concurrent) | Host hook | Aide+Owner |
| E0876 | D09 | attack | Host forges setUser | Owner must sign JWT | Aide+Owner |
| E0877 | D09 | owner | Host forges setUser (studio) | Owner must sign JWT | Aide+Owner |
| E0878 | D09 | embed | Host forges setUser (embed) | Owner must sign JWT | Aide+Owner |
| E0879 | D09 | system | Host forges setUser (retry) | Owner must sign JWT | Aide+Owner |
| E0880 | D09 | system | Host forges setUser (concurrent) | Owner must sign JWT | Aide+Owner |
| E0881 | D09 | logged-in | Widget on checkout page | PCI: no card tools in chat | Aide+Owner |
| E0882 | D09 | owner | Widget on checkout page (studio) | PCI: no card tools in chat | Aide+Owner |
| E0883 | D09 | embed | Widget on checkout page (embed) | PCI: no card tools in chat | Aide+Owner |
| E0884 | D09 | system | Widget on checkout page (retry) | PCI: no card tools in chat | Aide+Owner |
| E0885 | D09 | system | Widget on checkout page (concurrent) | PCI: no card tools in chat | Aide+Owner |
| E0886 | D09 | owner | Partner white-label | Same policy | Aide+Owner |
| E0887 | D09 | owner | Partner white-label (studio) | Same policy | Aide+Owner |
| E0888 | D09 | embed | Partner white-label (embed) | Same policy | Aide+Owner |
| E0889 | D09 | system | Partner white-label (retry) | Same policy | Aide+Owner |
| E0890 | D09 | system | Partner white-label (concurrent) | Same policy | Aide+Owner |
| E0891 | D09 | attack | Rate limit per publicKey | Existing limits | Aide+Owner |
| E0892 | D09 | owner | Rate limit per publicKey (studio) | Existing limits | Aide+Owner |
| E0893 | D09 | embed | Rate limit per publicKey (embed) | Existing limits | Aide+Owner |
| E0894 | D09 | system | Rate limit per publicKey (retry) | Existing limits | Aide+Owner |
| E0895 | D09 | system | Rate limit per publicKey (concurrent) | Existing limits | Aide+Owner |
| E0896 | D09 | owner | CDN stale embed.js | v= query bump | Aide+Owner |
| E0897 | D09 | owner | CDN stale embed.js (studio) | v= query bump | Aide+Owner |
| E0898 | D09 | embed | CDN stale embed.js (embed) | v= query bump | Aide+Owner |
| E0899 | D09 | system | CDN stale embed.js (retry) | v= query bump | Aide+Owner |
| E0900 | D09 | system | CDN stale embed.js (concurrent) | v= query bump | Aide+Owner |
| E0901 | D10 | owner | ToolRun requestId | Support correlation | Aide+Owner |
| E0902 | D10 | owner | ToolRun requestId (studio) | Support correlation | Aide+Owner |
| E0903 | D10 | embed | ToolRun requestId (embed) | Support correlation | Aide+Owner |
| E0904 | D10 | system | ToolRun requestId (retry) | Support correlation | Aide+Owner |
| E0905 | D10 | system | ToolRun requestId (concurrent) | Support correlation | Aide+Owner |
| E0906 | D10 | owner | Admin inspect ToolRun | No execute | Aide+Owner |
| E0907 | D10 | owner | Admin inspect ToolRun (studio) | No execute | Aide+Owner |
| E0908 | D10 | embed | Admin inspect ToolRun (embed) | No execute | Aide+Owner |
| E0909 | D10 | system | Admin inspect ToolRun (retry) | No execute | Aide+Owner |
| E0910 | D10 | system | Admin inspect ToolRun (concurrent) | No execute | Aide+Owner |
| E0911 | D10 | owner | Workspace suspend | All agents blocked | Aide+Owner |
| E0912 | D10 | owner | Workspace suspend (studio) | All agents blocked | Aide+Owner |
| E0913 | D10 | embed | Workspace suspend (embed) | All agents blocked | Aide+Owner |
| E0914 | D10 | system | Workspace suspend (retry) | All agents blocked | Aide+Owner |
| E0915 | D10 | system | Workspace suspend (concurrent) | All agents blocked | Aide+Owner |
| E0916 | D10 | owner | Agent disable | Chat 403 | Aide+Owner |
| E0917 | D10 | owner | Agent disable (studio) | Chat 403 | Aide+Owner |
| E0918 | D10 | embed | Agent disable (embed) | Chat 403 | Aide+Owner |
| E0919 | D10 | system | Agent disable (retry) | Chat 403 | Aide+Owner |
| E0920 | D10 | system | Agent disable (concurrent) | Chat 403 | Aide+Owner |
| E0921 | D10 | owner | Credential leak suspicion | Rotate revoke | Aide+Owner |
| E0922 | D10 | owner | Credential leak suspicion (studio) | Rotate revoke | Aide+Owner |
| E0923 | D10 | embed | Credential leak suspicion (embed) | Rotate revoke | Aide+Owner |
| E0924 | D10 | system | Credential leak suspicion (retry) | Rotate revoke | Aide+Owner |
| E0925 | D10 | system | Credential leak suspicion (concurrent) | Rotate revoke | Aide+Owner |
| E0926 | D10 | owner | SOC2 audit trail | Export evidence | Aide+Owner |
| E0927 | D10 | owner | SOC2 audit trail (studio) | Export evidence | Aide+Owner |
| E0928 | D10 | embed | SOC2 audit trail (embed) | Export evidence | Aide+Owner |
| E0929 | D10 | system | SOC2 audit trail (retry) | Export evidence | Aide+Owner |
| E0930 | D10 | system | SOC2 audit trail (concurrent) | Export evidence | Aide+Owner |
| E0931 | D10 | attack | Pen test SSRF | Document pass | Aide+Owner |
| E0932 | D10 | owner | Pen test SSRF (studio) | Document pass | Aide+Owner |
| E0933 | D10 | embed | Pen test SSRF (embed) | Document pass | Aide+Owner |
| E0934 | D10 | system | Pen test SSRF (retry) | Document pass | Aide+Owner |
| E0935 | D10 | system | Pen test SSRF (concurrent) | Document pass | Aide+Owner |
| E0936 | D10 | attack | Pen test IDOR | Owner API must pass | Owner |
| E0937 | D10 | owner | Pen test IDOR (studio) | Owner API must pass | Owner |
| E0938 | D10 | embed | Pen test IDOR (embed) | Owner API must pass | Owner |
| E0939 | D10 | system | Pen test IDOR (retry) | Owner API must pass | Owner |
| E0940 | D10 | system | Pen test IDOR (concurrent) | Owner API must pass | Owner |
| E0941 | D10 | owner | DR backup secrets | KMS later | Aide+Owner |
| E0942 | D10 | owner | DR backup secrets (studio) | KMS later | Aide+Owner |
| E0943 | D10 | embed | DR backup secrets (embed) | KMS later | Aide+Owner |
| E0944 | D10 | system | DR backup secrets (retry) | KMS later | Aide+Owner |
| E0945 | D10 | system | DR backup secrets (concurrent) | KMS later | Aide+Owner |
| E0946 | D10 | owner | GDPR DPA | Customer agreement | Aide+Owner |
| E0947 | D10 | owner | GDPR DPA (studio) | Customer agreement | Aide+Owner |
| E0948 | D10 | embed | GDPR DPA (embed) | Customer agreement | Aide+Owner |
| E0949 | D10 | system | GDPR DPA (retry) | Customer agreement | Aide+Owner |
| E0950 | D10 | system | GDPR DPA (concurrent) | Customer agreement | Aide+Owner |
| E0951 | D10 | owner | Incident response playbook | Kill switch | Aide+Owner |
| E0952 | D10 | owner | Incident response playbook (studio) | Kill switch | Aide+Owner |
| E0953 | D10 | embed | Incident response playbook (embed) | Kill switch | Aide+Owner |
| E0954 | D10 | system | Incident response playbook (retry) | Kill switch | Aide+Owner |
| E0955 | D10 | system | Incident response playbook (concurrent) | Kill switch | Aide+Owner |
| E0956 | D10 | owner | Synthetic monitor action | Scheduled test endpoint | Aide+Owner |
| E0957 | D10 | owner | Synthetic monitor action (studio) | Scheduled test endpoint | Aide+Owner |
| E0958 | D10 | embed | Synthetic monitor action (embed) | Scheduled test endpoint | Aide+Owner |
| E0959 | D10 | system | Synthetic monitor action (retry) | Scheduled test endpoint | Aide+Owner |
| E0960 | D10 | system | Synthetic monitor action (concurrent) | Scheduled test endpoint | Aide+Owner |
| E0961 | D10 | owner | Alert on 401 spike | Credential health | Aide+Owner |
| E0962 | D10 | owner | Alert on 401 spike (studio) | Credential health | Aide+Owner |
| E0963 | D10 | embed | Alert on 401 spike (embed) | Credential health | Aide+Owner |
| E0964 | D10 | system | Alert on 401 spike (retry) | Credential health | Aide+Owner |
| E0965 | D10 | system | Alert on 401 spike (concurrent) | Credential health | Aide+Owner |
| E0966 | D10 | owner | Alert on 403 spike | Possible attack | Aide+Owner |
| E0967 | D10 | owner | Alert on 403 spike (studio) | Possible attack | Aide+Owner |
| E0968 | D10 | embed | Alert on 403 spike (embed) | Possible attack | Aide+Owner |
| E0969 | D10 | system | Alert on 403 spike (retry) | Possible attack | Aide+Owner |
| E0970 | D10 | system | Alert on 403 spike (concurrent) | Possible attack | Aide+Owner |
| E0971 | D10 | attack | Per-sub abuse | Soft cap | Aide+Owner |
| E0972 | D10 | owner | Per-sub abuse (studio) | Soft cap | Aide+Owner |
| E0973 | D10 | embed | Per-sub abuse (embed) | Soft cap | Aide+Owner |
| E0974 | D10 | system | Per-sub abuse (retry) | Soft cap | Aide+Owner |
| E0975 | D10 | system | Per-sub abuse (concurrent) | Soft cap | Aide+Owner |
| E0976 | D10 | attack | Per-IP abuse guest | IP rate limit | Aide+Owner |
| E0977 | D10 | owner | Per-IP abuse guest (studio) | IP rate limit | Aide+Owner |
| E0978 | D10 | embed | Per-IP abuse guest (embed) | IP rate limit | Aide+Owner |
| E0979 | D10 | system | Per-IP abuse guest (retry) | IP rate limit | Aide+Owner |
| E0980 | D10 | system | Per-IP abuse guest (concurrent) | IP rate limit | Aide+Owner |
| E0981 | D10 | owner | Data retention ToolRun | TTL policy | Aide+Owner |
| E0982 | D10 | owner | Data retention ToolRun (studio) | TTL policy | Aide+Owner |
| E0983 | D10 | embed | Data retention ToolRun (embed) | TTL policy | Aide+Owner |
| E0984 | D10 | system | Data retention ToolRun (retry) | TTL policy | Aide+Owner |
| E0985 | D10 | system | Data retention ToolRun (concurrent) | TTL policy | Aide+Owner |
| E0986 | D10 | owner | Message retention | Conversation policy | Aide+Owner |
| E0987 | D10 | owner | Message retention (studio) | Conversation policy | Aide+Owner |
| E0988 | D10 | embed | Message retention (embed) | Conversation policy | Aide+Owner |
| E0989 | D10 | system | Message retention (retry) | Conversation policy | Aide+Owner |
| E0990 | D10 | system | Message retention (concurrent) | Conversation policy | Aide+Owner |
| E0991 | D10 | logged-in | Right to access export | Owner API | Owner |
| E0992 | D10 | owner | Right to access export (studio) | Owner API | Owner |
| E0993 | D10 | embed | Right to access export (embed) | Owner API | Owner |
| E0994 | D10 | system | Right to access export (retry) | Owner API | Owner |
| E0995 | D10 | system | Right to access export (concurrent) | Owner API | Owner |
| E0996 | D10 | logged-in | Right to delete | Owner API + confirm | Owner |
| E0997 | D10 | owner | Right to delete (studio) | Owner API + confirm | Owner |
| E0998 | D10 | embed | Right to delete (embed) | Owner API + confirm | Owner |
| E0999 | D10 | system | Right to delete (retry) | Owner API + confirm | Owner |
| E1000 | D10 | system | Right to delete (concurrent) | Owner API + confirm | Owner |
