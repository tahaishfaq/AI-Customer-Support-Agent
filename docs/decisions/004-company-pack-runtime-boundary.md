# ADR 004 — Company-pack runtime boundary

Status: Accepted  
Date: 2026-09-17  
Scope: `lib/integrations/company-pack.js` vs chat orchestrator / tool gateway.

## Context

Company packs include a `procedure` outline (`clarify` → … → `explain_or_handoff`) and a pure helper `canAdvanceProcedure`. Pack install returns this metadata on universal business installs. Nothing in `lib/orchestrator`, `chat.service`, or `lib/actions` advances those steps.

Wiring procedure checkpoints into the chat loop would create a second authority path beside the frozen trust path (identity mode, accessClass, confirmation, write idempotency).

## Decision

**Demote company-pack procedures to control-plane metadata.** Do not wire checkpoints into the chat runtime.

Single chat runtime story:

```text
USER → AUTH → TRUSTED CONTEXT → ORCHESTRATOR → SOURCE ROUTER
 → POLICY PEP → TOOL GATEWAY → RESULT FENCE → ANSWER
```

- Packs may describe vertical defaults (slots, confirmation hints, procedure outline) for installers, catalogs, and evaluation fixtures.
- Packs never authorize turns or tool calls (`runtimeAuthority: false`).
- `canAdvanceProcedure` remains a catalog/order helper for tests and future bounded task adapters — not imported by orchestrator or chat assembly.
- Live identity and confirmation stay in `lib/actions/*` and `confirmation.service`.

## Consequences

- No dual procedure engine in chat.
- Install responses serialize packs with `runtimeRole: "control_plane_metadata"`.
- Future task/workflow engines may reuse the outline without changing chat authority.

## Verification

`npm run test:company-pack-runtime`
