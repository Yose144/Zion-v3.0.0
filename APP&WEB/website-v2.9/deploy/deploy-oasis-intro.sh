#!/usr/bin/env bash
# ZION OASIS intro landing deploy
#
# DEPRECATED: This script now forwards to APP&WEB/IntroPage/deploy/deploy-intro.sh.
# The old static maintenance.html has been replaced by a standalone Next.js intro
# page with the original Stargate and Rasta theme.
#
# Usage:
#   bash APP&WEB/website-v2.9/deploy/deploy-oasis-intro.sh

set -euo pipefail

NEW_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../IntroPage" && pwd)/deploy/deploy-intro.sh"

if [ ! -f "${NEW_SCRIPT}" ]; then
  echo "[deploy-oasis-intro] IntroPage deploy script not found: ${NEW_SCRIPT}" >&2
  exit 1
fi

echo "[deploy-oasis-intro] Forwarding to ${NEW_SCRIPT}"
exec bash "${NEW_SCRIPT}"
