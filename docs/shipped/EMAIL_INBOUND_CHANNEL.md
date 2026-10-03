# Email inbound channel (Level 2 · P8)

Resend `email.received` → `POST /api/webhooks/email-inbound` → guest EMAIL conversation → AI (and desk) reply by email.

## Setup

1. Add MX for your receiving domain in Resend.
2. Set env: `RESEND_API_KEY`, `RESEND_INBOUND_SECRET` (webhook signing secret `whsec_…`), `EMAIL_FROM` for other product mail.
3. Create a Resend webhook for `email.received` pointing at `https://YOUR_APP/api/webhooks/email-inbound`.
4. In the app: **Agents → Edit → Email channel** (or `PUT /api/agents/:id/email-channel` with `{ "address": "support@help.example.com", "fromName": "Support", "enabled": true }`).

## Behaviour

- Signature verified (Svix headers). Bad signature → 401.
- Unknown recipient / disabled channel → 200 drop.
- Idempotent on Message-ID.
- Sender is unverified guest (`email:addr`); no private tools.
- Quota: EMAIL counts with EMBED.
- Attachments ignored; body capped at 25 KB.

## Tests

```bash
npm run test:email-inbound
```
