#!/usr/bin/env bash
# ZION Free World (L5) static site deploy
#
# Deploys APP&WEB/FreeWorld/dist to the Edge server at /var/www/freeworld
# (served by the freeworld.zionterranova.com nginx vhost — see
# V31/deploy/nginx/freeworld.zionterranova.com.conf). The vhost keeps
# proxying /api/ to the Next.js app on 127.0.0.1:3000.
#
# Usage:
#   bash APP&WEB/FreeWorld/deploy/deploy-freeworld.sh
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_HOST="${ZION_EDGE_HOST:-zion-new}"
EDGE_USER="${ZION_EDGE_USER:-root}"
SSH_KEY="${ZION_SSH_KEY:-$HOME/.ssh/zion-edge-post-wipe-2026-07-29}"
SSH_EXTRA="${ZION_SSH_OPTS:-}"
REMOTE_DIR="${ZION_REMOTE_DIR:-/var/www/freeworld}"

SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=accept-new ${SSH_EXTRA}"

if [[ "${EDGE_HOST}" =~ : ]]; then
  RSYNC_HOST="[${EDGE_HOST}]"
else
  RSYNC_HOST="${EDGE_HOST}"
fi

if [ ! -d "${ROOT_DIR}/dist" ]; then
  echo '[deploy-freeworld] dist/ not found; run npm run build first' >&2
  exit 1
fi

echo "[deploy-freeworld] Syncing ${ROOT_DIR}/dist/ to ${EDGE_HOST}:${REMOTE_DIR}"

ssh ${SSH_OPTS} "${EDGE_USER}@${EDGE_HOST}" "mkdir -p ${REMOTE_DIR}"

rsync -avz --delete -e "ssh ${SSH_OPTS}" \
  "${ROOT_DIR}/dist/" \
  "${EDGE_USER}@${RSYNC_HOST}:${REMOTE_DIR}/"

ssh ${SSH_OPTS} "${EDGE_USER}@${EDGE_HOST}" "nginx -t" || {
  echo '[deploy-freeworld] nginx config test failed' >&2
  exit 1
}

ssh ${SSH_OPTS} "${EDGE_USER}@${EDGE_HOST}" "nginx -s reload"

echo "[deploy-freeworld] Done — https://freeworld.zionterranova.com"
echo "[deploy-freeworld] Health check:"
ssh ${SSH_OPTS} "${EDGE_USER}@${EDGE_HOST}" "curl -s -o /dev/null -w '%{http_code}\n' https://freeworld.zionterranova.com/ && curl -s https://freeworld.zionterranova.com/api/free-world/fund/balance | head -c 200 && echo"
