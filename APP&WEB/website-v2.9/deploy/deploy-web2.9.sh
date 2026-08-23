#!/usr/bin/env bash
# ZION website-v2.9 deploy — Next.js to app.zionterranova.com
#
# Builds locally, rsyncs to /opt/zion/APP&WEB/website-v2.9 on the Edge server,
# fixes ownership for the zion service user, and restarts zion-website.service.
#
# Requires:
#   - SSH alias `zion-post-wipe` with key `~/.ssh/zion-edge-post-wipe-2026-07-29`
#   - npm installed locally and the `npm run build` working
#
# Usage:
#   bash APP&WEB/website-v2.9/deploy/deploy-web2.9.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_HOST="${ZION_EDGE_HOST:-zion-post-wipe}"
EDGE_USER="${ZION_EDGE_USER:-root}"
REMOTE_DIR="/opt/zion/APP&WEB/website-v2.9"
SERVICE="zion-website.service"

echo "[deploy-web2.9] Building locally..."
cd "$ROOT_DIR"
npm run build

echo "[deploy-web2.9] Syncing to ${EDGE_HOST}:${REMOTE_DIR}"
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.env.production' \
  --exclude='.env.local' \
  --exclude='.next/cache' \
  --exclude='.next/trace' \
  -e 'ssh' \
  "${ROOT_DIR}/" \
  "${EDGE_HOST}:${REMOTE_DIR}/"

echo "[deploy-web2.9] Fixing ownership and restarting ${SERVICE}"
ssh "${EDGE_HOST}" "chown -R zion:zion '${REMOTE_DIR}' && systemctl daemon-reload && systemctl restart ${SERVICE}"

echo "[deploy-web2.9] Waiting for app.zionterranova.com..."
for i in $(seq 1 12); do
  if curl -fsS 'https://app.zionterranova.com/' >/dev/null 2>&1; then
    echo "[deploy-web2.9] app.zionterranova.com is healthy after ~${i}0s"
    exit 0
  fi
  sleep 5
done

echo "[deploy-web2.9] ERROR: app.zionterranova.com did not become healthy" >&2
ssh "${EDGE_HOST}" "systemctl status ${SERVICE} --no-pager -l"
exit 1
