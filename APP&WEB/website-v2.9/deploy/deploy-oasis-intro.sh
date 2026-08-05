#!/usr/bin/env bash
# ZION OASIS intro landing deploy
#
# Deploys APP&WEB/website-v2.9/public/maintenance.html (the one-page
# multichain intro + Stargate to OASIS) to /var/www/maintenance on the
# Edge server and reloads nginx. This is the canonical public face of
# https://zionterranova.com while the full Next.js website is offline.
#
# Usage:
#   ZION_EDGE_HOST=zion-post-wipe ZION_SSH_KEY=~/.ssh/zion-edge-post-wipe-2026-07-29 \
#     bash APP&WEB/website-v2.9/deploy/deploy-oasis-intro.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_HOST="${ZION_EDGE_HOST:-zion-post-wipe}"
EDGE_USER="${ZION_EDGE_USER:-root}"
SSH_KEY="${ZION_SSH_KEY:-$HOME/.ssh/zion-edge-post-wipe-2026-07-29}"
REMOTE_MAINT_DIR="${ZION_REMOTE_MAINT_DIR:-/var/www/maintenance}"

SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=accept-new"
REMOTE="${EDGE_USER}@${EDGE_HOST}"

echo "[deploy-oasis-intro] Syncing intro page to ${REMOTE}:${REMOTE_MAINT_DIR}"

# Ensure target directories exist
ssh ${SSH_OPTS} "${REMOTE}" "mkdir -p ${REMOTE_MAINT_DIR}/stargate ${REMOTE_MAINT_DIR}/assets ${REMOTE_MAINT_DIR}/images"

# Sync main HTML
rsync -avz --delete \
  "${ROOT_DIR}/public/maintenance.html" \
  "${REMOTE}:${REMOTE_MAINT_DIR}/maintenance.html"

# Sync stargate assets (portal images + nebula + theme)
rsync -avz --delete \
  "${ROOT_DIR}/public/stargate/" \
  "${REMOTE}:${REMOTE_MAINT_DIR}/stargate/"

# Sync theme assets (CSS + fonts + JS)
rsync -avz --delete \
  "${ROOT_DIR}/public/assets/" \
  "${REMOTE}:${REMOTE_MAINT_DIR}/assets/"

# Sync images (support section + icons)
rsync -avz --delete \
  "${ROOT_DIR}/public/images/" \
  "${REMOTE}:${REMOTE_MAINT_DIR}/images/"

# Sync canonical brand assets at root (tokenlist / social / metadata references)
for asset in symbol-200x200.png zion-social-banner.png; do
  if [ -f "${ROOT_DIR}/public/${asset}" ]; then
    rsync -avz --delete \
      "${ROOT_DIR}/public/${asset}" \
      "${REMOTE}:${REMOTE_MAINT_DIR}/${asset}"
  fi
done

# Sync legacy video.css if still used
if [ -f "${ROOT_DIR}/public/video.css" ]; then
  rsync -avz --delete \
    "${ROOT_DIR}/public/video.css" \
    "${REMOTE}:${REMOTE_MAINT_DIR}/video.css"
fi

# Verify nginx config before reload
ssh ${SSH_OPTS} "${REMOTE}" "nginx -t" || {
  echo '[deploy-oasis-intro] nginx config test failed' >&2
  exit 1
}

# Reload nginx to pick up any new assets/headers
ssh ${SSH_OPTS} "${REMOTE}" "nginx -s reload"

echo "[deploy-oasis-intro] Done — https://${EDGE_HOST} / https://zionterranova.com"
echo "[deploy-oasis-intro] Health check:"
ssh ${SSH_OPTS} "${REMOTE}" "curl -s -o /dev/null -w '%{http_code}' https://127.0.0.1/ --insecure"
