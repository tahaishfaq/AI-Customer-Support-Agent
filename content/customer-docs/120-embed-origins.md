---
title: Allowed origins
description: Lock which websites may load your embed.
slug: embed/origins
order: 120
---

# Allowed origins

Aide can restrict which website origins may load your embed. This reduces misuse of your public key.

## What to configure

- Add your production site origin (for example `https://www.example.com`)
- Add staging if you test there
- Do not leave origins wide open in production if your product supports locking

## Notes

- Localhost embeds may be limited by design
- After changing origins, hard-refresh the host page

## Related

- [Install the embed](/docs/embed/install)
