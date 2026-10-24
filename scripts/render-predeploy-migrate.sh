#!/bin/sh
# Pre-deploy on Render: run migrate over Neon DIRECT_URL (non-pooler).
# Advisory locks fail on PgBouncer pooler hosts (P1002).
set -eu
if [ -n "${DIRECT_URL:-}" ]; then
  export DATABASE_URL="$DIRECT_URL"
fi
exec npx prisma migrate deploy
