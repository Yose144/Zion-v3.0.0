#!/usr/bin/env bash
# ZION OASIS Web deploy — Next.js standalone to oasis.zionterranova.com
#
# Builds APP&WEB/OasisWeb as a standalone Next.js app, rsyncs
# dist/standalone/ to /opt/zion/oasis-web on the Edge server,
# installs/updates the zion-oasis-web systemd service and nginx site,
# then starts the service.
#
# Usage:
#   bash APP&WEB/OasisWeb/deploy/deploy-oasis-web.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_HOST="${ZION_EDGE_HOST:-62.171.141.136}"
EDGE_PORT="${ZION_EDGE_PORT:-2222}"
SSH_KEY="${ZION_EDGE_SSH_KEY:-$HOME/.ssh/zion-edge-post-wipe-2026-07-29}"
REMOTE="root@${EDGE_HOST}"
REMOTE_DIR="/opt/zion/oasis-web"
NGINX_CONF="/etc/nginx/sites-enabled/oasis.zionterranova.com.conf"
SERVICE="zion-oasis-web"

SSH_OPTS="-i ${SSH_KEY} -p ${EDGE_PORT} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo "[deploy-oasis-web] Building Next.js standalone..."
cd "$ROOT_DIR"
NEXT_PUBLIC_OASIS_API_URL= npm run build

if [[ ! -d "${ROOT_DIR}/dist/standalone" ]]; then
  echo "[deploy-oasis-web] ERROR: dist/standalone/ not found. Did 'npm run build' succeed with output: 'standalone'?" >&2
  exit 1
fi

echo "[deploy-oasis-web] Syncing ${ROOT_DIR}/dist/standalone/ to ${REMOTE}:${REMOTE_DIR}"
ssh ${SSH_OPTS} "${REMOTE}" "mkdir -p ${REMOTE_DIR} && chown -R zion:zion ${REMOTE_DIR} 2>/dev/null || true"
rsync -avz --delete -e "ssh ${SSH_OPTS}" "${ROOT_DIR}/dist/standalone/" "${REMOTE}:${REMOTE_DIR}/"

echo "[deploy-oasis-web] Installing systemd service..."
rsync -avz -e "ssh ${SSH_OPTS}" "${ROOT_DIR}/deploy/zion-oasis-web.service" "${REMOTE}:/etc/systemd/system/${SERVICE}.service"

# Ensure service user exists and has correct perms
ssh ${SSH_OPTS} "${REMOTE}" "id -u zion >/dev/null 2>&1 || useradd -r -s /bin/false zion; chown -R zion:zion ${REMOTE_DIR}"

# (Optional) env file template
echo "[deploy-oasis-web] Ensuring .env file exists..."
ssh ${SSH_OPTS} "${REMOTE}" "test -f ${REMOTE_DIR}/.env || echo '# NODE_ENV=production\n# NEXT_PUBLIC_OASIS_API_URL=' > ${REMOTE_DIR}/.env"

echo "[deploy-oasis-web] Updating nginx config..."
rsync -avz -e "ssh ${SSH_OPTS}" "${ROOT_DIR}/deploy/nginx-oasis.conf" "${REMOTE}:${NGINX_CONF}"

echo "[deploy-oasis-web] Reloading systemd and nginx..."
ssh ${SSH_OPTS} "${REMOTE}" "systemctl daemon-reload && systemctl enable ${SERVICE}.service && systemctl restart ${SERVICE}.service"
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
sleep 3
curl -fsS -o /dev/null 'https://oasis.zionterranova.com/' && echo '[deploy-oasis-web] Health check: 200' || {
  echo '[deploy-oasis-web] Health check failed' >&2
  exit 1
}
