#!/usr/bin/env bash
# ZION OASIS Web deploy — static export to oasis.zionterranova.com
#
# Builds APP&WEB/OasisWeb as a static Next.js export, rsyncs dist/ to
# /var/www/oasis on the Edge server, updates the nginx site config to proxy
# /api to the local zion-oasis API, and reloads nginx.
#
# Usage:
#   bash APP&WEB/OasisWeb/deploy/deploy-oasis-web.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_HOST="${ZION_EDGE_HOST:-62.171.141.136}"
EDGE_PORT="${ZION_EDGE_PORT:-2222}"
SSH_KEY="${ZION_EDGE_SSH_KEY:-$HOME/.ssh/zion-edge-post-wipe-2026-07-29}"
REMOTE="root@${EDGE_HOST}"
REMOTE_DIR="/var/www/oasis"
NGINX_CONF="/etc/nginx/sites-enabled/oasis.zionterranova.com.conf"

SSH_OPTS="-i ${SSH_KEY} -p ${EDGE_PORT} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo "[deploy-oasis-web] Building static export..."
cd "$ROOT_DIR"
NEXT_PUBLIC_OASIS_API_URL= npm run build

echo "[deploy-oasis-web] Syncing ${ROOT_DIR}/dist/ to ${REMOTE}:${REMOTE_DIR}"
ssh ${SSH_OPTS} "${REMOTE}" "mkdir -p ${REMOTE_DIR}"
rsync -avz --delete -e "ssh ${SSH_OPTS}" "${ROOT_DIR}/dist/" "${REMOTE}:${REMOTE_DIR}/"

echo "[deploy-oasis-web] Updating nginx config..."
rsync -avz -e "ssh ${SSH_OPTS}" "${ROOT_DIR}/deploy/nginx-oasis.conf" "${REMOTE}:${NGINX_CONF}"

echo "[deploy-oasis-web] Validating and reloading nginx..."
ssh ${SSH_OPTS} "${REMOTE}" "nginx -t && nginx -s reload"

# Optional: mirror public desktop miner artifacts to /var/www/downloads so the
# OASIS /downloads mirror links work. This step is skipped if the artifacts do
# not exist locally (e.g. on a fresh build machine).
echo "[deploy-oasis-web] Checking for public desktop miner artifacts..."
DESKTOP_DIST="${ROOT_DIR}/../../DesktopAgentP3.0.6/dist"
DOWNLOADS_DIR="/var/www/downloads"
APPIMAGE="${DESKTOP_DIST}/zion-public-miner-v3.0.6-linux-x86_64.AppImage"
SHA256SUMS="${DESKTOP_DIST}/SHA256SUMS.txt"

ssh ${SSH_OPTS} "${REMOTE}" "mkdir -p ${DOWNLOADS_DIR}"

if [[ -f "${APPIMAGE}" ]]; then
  echo "[deploy-oasis-web] Syncing AppImage to ${DOWNLOADS_DIR}"
  rsync -avz -e "ssh ${SSH_OPTS}" "${APPIMAGE}" "${REMOTE}:${DOWNLOADS_DIR}/"
else
  echo "[deploy-oasis-web] AppImage not found at ${APPIMAGE}, skipping"
fi

shopt -s nullglob
for deb in "${DESKTOP_DIST}"/*.deb; do
  if [[ -f "${deb}" ]]; then
    echo "[deploy-oasis-web] Syncing ${deb} to ${DOWNLOADS_DIR}"
    rsync -avz -e "ssh ${SSH_OPTS}" "${deb}" "${REMOTE}:${DOWNLOADS_DIR}/"
  fi
done
shopt -u nullglob

if [[ -f "${SHA256SUMS}" ]]; then
  echo "[deploy-oasis-web] Syncing SHA256SUMS.txt to ${DOWNLOADS_DIR}"
  rsync -avz -e "ssh ${SSH_OPTS}" "${SHA256SUMS}" "${REMOTE}:${DOWNLOADS_DIR}/"
fi

echo "[deploy-oasis-web] Done — https://oasis.zionterranova.com"
curl -fsS -o /dev/null 'https://oasis.zionterranova.com/' && echo '[deploy-oasis-web] Health check: 200' || {
  echo '[deploy-oasis-web] Health check failed' >&2
  exit 1
}
