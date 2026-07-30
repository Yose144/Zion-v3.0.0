#!/usr/bin/env bash
# ZION OASIS Web deploy — static export to oasis.zionterranova.com
#
# Builds APP&WEB/OasisWeb as a static Next.js export and rsyncs the dist/
# directory to /var/www/oasis on the Edge server, then reloads nginx.
#
# Usage:
#   bash APP&WEB/OasisWeb/deploy/deploy-oasis-web.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_HOST="${ZION_EDGE_HOST:-zion-post-wipe}"
REMOTE="root@${EDGE_HOST}"
REMOTE_DIR="/var/www/oasis"

echo "[deploy-oasis-web] Building static export..."
cd "$ROOT_DIR"
npm run build

echo "[deploy-oasis-web] Syncing ${ROOT_DIR}/dist/ to ${REMOTE}:${REMOTE_DIR}"
ssh "${REMOTE}" "mkdir -p ${REMOTE_DIR}"
rsync -avz --delete "${ROOT_DIR}/dist/" "${REMOTE}:${REMOTE_DIR}/"

echo "[deploy-oasis-web] Validating and reloading nginx..."
ssh "${REMOTE}" "nginx -t && nginx -s reload"

echo "[deploy-oasis-web] Done — https://oasis.zionterranova.com"
curl -fsS -o /dev/null 'https://oasis.zionterranova.com/' && echo '[deploy-oasis-web] Health check: 200' || {
  echo '[deploy-oasis-web] Health check failed' >&2
  exit 1
}
