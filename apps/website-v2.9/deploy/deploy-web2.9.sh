#!/usr/bin/env bash
# ZION website-v2.9 deploy — Next.js to app.zionterranova.com
#
# Builds locally, copies public/ into .next/standalone/public/ (standalone
# server serves public ONLY from there — missing dir = all assets 404),
# rsyncs to /opt/zion/APP&WEB/website-v2.9 on EDGE2, fixes ownership for the
# zion service user, restarts zion-website.service, and runs a post-deploy
# smoke check (homepage + assets + api).
#
# Requires:
#   - SSH alias `zion-edge2` (207.180.217.100) — the live web host.
#     Override via ZION_EDGE_HOST if topology changes.
#   - npm installed locally and the `npm run build` working
#
# Usage:
#   bash apps/website-v2.9/deploy/deploy-web2.9.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_HOST="${ZION_EDGE_HOST:-zion-edge2}"
EDGE_USER="${ZION_EDGE_USER:-root}"
REMOTE_DIR="/opt/zion/APP&WEB/website-v2.9"
SERVICE="zion-website.service"

echo "[deploy-web2.9] Building locally..."
cd "$ROOT_DIR"
npm run build

STANDALONE_STATIC_DIR="${ROOT_DIR}/.next/standalone/.next/static"
if [[ ! -d "$STANDALONE_STATIC_DIR" ]] || [[ -z "$(find "$STANDALONE_STATIC_DIR" -type f -print -quit)" ]]; then
  echo "[deploy-web2.9] ERROR: standalone build is missing .next/static assets" >&2
  exit 1
fi

# Standalone server serves public assets ONLY from .next/standalone/public/.
# Next.js does NOT copy public/ there automatically — without this step every
# /images/*, /docs/*, favicon etc. returns 404 (incident 2026-10-22).
echo "[deploy-web2.9] Copying public/ -> .next/standalone/public/"
mkdir -p "${ROOT_DIR}/.next/standalone/public"
rsync -a --delete "${ROOT_DIR}/public/" "${ROOT_DIR}/.next/standalone/public/"

# archive-content/ (Archive Pass gated books) — served by /api/archive/docs
# which resolves it relative to cwd (.next/standalone on the server).
if [[ -d "${ROOT_DIR}/archive-content" ]]; then
  echo "[deploy-web2.9] Copying archive-content/ -> .next/standalone/archive-content/"
  mkdir -p "${ROOT_DIR}/.next/standalone/archive-content"
  rsync -a --delete "${ROOT_DIR}/archive-content/" "${ROOT_DIR}/.next/standalone/archive-content/"
fi

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
healthy=0
for i in $(seq 1 12); do
  if curl -fsS -o /dev/null --max-time 10 'https://app.zionterranova.com/'; then
    echo "[deploy-web2.9] app.zionterranova.com is healthy after ~${i}0s"
    healthy=1
    break
  fi
  sleep 5
done

if [[ "$healthy" -eq 0 ]]; then
  echo "[deploy-web2.9] ERROR: app.zionterranova.com did not become healthy" >&2
  ssh "${EDGE_HOST}" "systemctl status ${SERVICE} --no-pager -l" || true
  exit 1
fi

# Post-deploy smoke — catches missing public assets (404 images/docs) that a
# homepage-only check cannot see.
echo "[deploy-web2.9] Smoke check (assets + api)..."
fail=0
check() {
  local url="$1" want="${2:-200}"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$url")
  if [[ "$code" == "$want" ]]; then
    echo "  OK   $url -> $code"
  else
    echo "  FAIL $url -> $code (want $want)" >&2
    fail=1
  fi
}
check 'https://app.zionterranova.com/'
check 'https://app.zionterranova.com/images/home/hero.webp'
check 'https://app.zionterranova.com/favicon.png'
check 'https://app.zionterranova.com/manifest.json'
check 'https://app.zionterranova.com/api/health'
# Local origin check on the host itself (bypasses CDN/tunnel layer)
ssh "${EDGE_HOST}" "curl -s -o /dev/null -w '  local :3000 -> %{http_code}\n' --max-time 10 http://127.0.0.1:3000/"

if [[ "$fail" -ne 0 ]]; then
  echo "[deploy-web2.9] ERROR: smoke check failed — see FAIL lines above" >&2
  exit 1
fi
echo "[deploy-web2.9] Deploy complete and verified."
