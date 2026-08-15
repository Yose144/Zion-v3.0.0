#!/usr/bin/env bash
# ZION OASIS Web deploy — Next.js static export to oasis.zionterranova.com
#
# Builds APP&WEB/OasisWeb as a static export, rsyncs dist/ to /var/www/oasis
# on the Edge server, installs/updates the nginx site, reloads nginx and
# runs a health check.
#
# Usage:
#   bash APP&WEB/OasisWeb/deploy/deploy-oasis-web.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_HOST="${ZION_EDGE_HOST:-62.171.141.136}"
EDGE_PORT="${ZION_EDGE_PORT:-2222}"
EDGE_USE_IPV6="${ZION_EDGE_USE_IPV6:-0}"
SSH_KEY="${ZION_EDGE_SSH_KEY:-$HOME/.ssh/zion-edge-post-wipe-2026-07-29}"
REMOTE="root@${EDGE_HOST}"
REMOTE_DIR="/var/www/oasis"
NGINX_CONF="/etc/nginx/sites-enabled/oasis.zionterranova.com.conf"

SSH_OPTS="-i ${SSH_KEY} -p ${EDGE_PORT} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
[[ "$EDGE_USE_IPV6" == "1" ]] && SSH_OPTS="${SSH_OPTS} -6"

echo "[deploy-oasis-web] Building Next.js static export..."
cd "$ROOT_DIR"
NEXT_PUBLIC_OASIS_API_URL= npm run build

if [[ ! -f "${ROOT_DIR}/dist/index.html" ]]; then
  echo "[deploy-oasis-web] ERROR: dist/index.html not found. Did 'npm run build' succeed with output: 'export'?" >&2
  exit 1
fi

echo "[deploy-oasis-web] Syncing ${ROOT_DIR}/dist/ to ${REMOTE}:${REMOTE_DIR}"
ssh ${SSH_OPTS} "${REMOTE}" "mkdir -p ${REMOTE_DIR}"
rsync -avz --delete -e "ssh ${SSH_OPTS}" "${ROOT_DIR}/dist/" "${REMOTE}:${REMOTE_DIR}/"

echo "[deploy-oasis-web] Updating nginx config..."
rsync -avz -e "ssh ${SSH_OPTS}" "${ROOT_DIR}/deploy/nginx-oasis.conf" "${REMOTE}:${NGINX_CONF}"

echo "[deploy-oasis-web] Disabling stale zion-oasis-web service and reloading nginx..."
ssh ${SSH_OPTS} "${REMOTE}" "systemctl disable zion-oasis-web.service 2>/dev/null || true; systemctl stop zion-oasis-web.service 2>/dev/null || true; nginx -t && nginx -s reload"

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
    rsync -avz -e "ssh ${SSH_OPTS}" "${deb}" "${REMOTE}:${DOWNLOADS_DIR}/" || {
      echo "[deploy-oasis-web] Skipping ${deb} (optional artifact)";
    }
  fi
done
shopt -u nullglob

if [[ -f "${SHA256SUMS}" ]]; then
  echo "[deploy-oasis-web] Syncing SHA256SUMS.txt to ${DOWNLOADS_DIR}"
  rsync -avz -e "ssh ${SSH_OPTS}" "${SHA256SUMS}" "${REMOTE}:${DOWNLOADS_DIR}/" || {
    echo "[deploy-oasis-web] Skipping SHA256SUMS.txt (optional artifact)";
  }
fi

echo "[deploy-oasis-web] Done — https://oasis.zionterranova.com"
sleep 3
curl -fsS -o /dev/null 'https://oasis.zionterranova.com/' && echo '[deploy-oasis-web] Health check: 200' || {
  echo '[deploy-oasis-web] Health check failed' >&2
  exit 1
}
