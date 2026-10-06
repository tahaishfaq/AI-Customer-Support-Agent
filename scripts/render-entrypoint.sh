#!/bin/sh
set -eu
# Render Docker services share one image; role selects process.
# SERVICE_ROLE=web (default) | jobs
role="${SERVICE_ROLE:-web}"
case "$role" in
  jobs|worker)
    exec npm run worker:jobs:prod
    ;;
  web|*)
    exec npm run start
    ;;
esac
