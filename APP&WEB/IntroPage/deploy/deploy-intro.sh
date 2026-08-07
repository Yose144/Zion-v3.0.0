#!/usr/bin/env bash
# ZION Intro landing deploy
#
# Deploys the static export of APP&WEB/IntroPage to the Edge server
# at /var/www/zion-maintenance and reloads nginx.
#
# Usage:
#   bash APP&WEB/IntroPage/deploy/deploy-intro.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_HOST="${ZION_EDGE_HOST:-zion-new}"
EDGE_USER="${ZION_EDGE_USER:-root}"
SSH_KEY="${ZION_SSH_KEY:-$HOME/.ssh/zion-edge-post-wipe-2026-07-29}"
SSH_EXTRA="${ZION_SSH_OPTS:-}"
REMOTE_DIR="${ZION_REMOTE_DIR:-/var/www/zion-maintenance}"

SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=accept-new ${SSH_EXTRA}"

# Wrap IPv6 hostnames in brackets for rsync
if [[ "${EDGE_HOST}" =~ : ]]; then
  RSYNC_HOST="[${EDGE_HOST}]"
else
  RSYNC_HOST="${EDGE_HOST}"
fi

if [ ! -d "${ROOT_DIR}/dist" ]; then
  echo '[deploy-intro] dist/ not found; run npm run build first' >&2
  exit 1
fi

echo "[deploy-intro] Syncing ${ROOT_DIR}/dist/ to ${EDGE_HOST}:${REMOTE_DIR}"

# Ensure target directory exists and is empty-safe
ssh ${SSH_OPTS} "${EDGE_USER}@${EDGE_HOST}" "mkdir -p ${REMOTE_DIR}"

# Sync the whole Next.js static export
rsync -avz --delete -e "ssh ${SSH_OPTS}" \
  "${ROOT_DIR}/dist/" \
  "${EDGE_USER}@${RSYNC_HOST}:${REMOTE_DIR}/"

# Verify nginx config before reload
ssh ${SSH_OPTS} "${EDGE_USER}@${EDGE_HOST}" "nginx -t" || {
  echo '[deploy-intro] nginx config test failed' >&2
  exit 1
}

# Reload nginx
ssh ${SSH_OPTS} "${EDGE_USER}@${EDGE_HOST}" "nginx -s reload"

echo "[deploy-intro] Done — https://zionterranova.com"
echo "[deploy-intro] Health check:"
ssh ${SSH_OPTS} "${EDGE_USER}@${EDGE_HOST}" "curl -s -o /dev/null -w '%{http_code}' https://127.0.0.1/ --insecure"
