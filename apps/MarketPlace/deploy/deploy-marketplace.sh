#!/usr/bin/env bash
# ZION MarketPlace deploy — Next.js standalone to market.zionterranova.com
#
# Builds locally, rsyncs to /opt/zion/APP&WEB/MarketPlace on EDGE2 (web ingress
# after the 2026-10-22 cutover), fixes ownership, restarts zion-marketplace
# and runs a smoke check.
#
# Prisma note: `npx prisma generate` runs BEFORE `next build` so the generated
# client + debian-openssl-3.0.x engine (binaryTargets in prisma/schema.prisma)
# get traced into .next/standalone — the remote needs no npm install.
#
# Invoice PDF prerequisite (server, one-time — done on EDGE2 2026-10-27):
#   sudo -u zion HOME=/home/zion npx --prefix .next/standalone puppeteer browsers install chrome
#   apt-get install libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 \
#     libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
#     libasound2t64 libpango-1.0-0 libcairo2 libnss3 libnspr4 libx11-xcb1 libxcb-dri3-0
# Without Chrome in ~zion/.cache/puppeteer, /api/invoice/[id]/download?format=pdf → 500.
#
# Usage:
#   bash apps/MarketPlace/deploy/deploy-marketplace.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_HOST="${ZION_EDGE_HOST:-zion-edge2}"
REMOTE_DIR="/opt/zion/APP&WEB/MarketPlace"
SERVICE="zion-marketplace.service"

echo "[deploy-marketplace] Installing deps + generating Prisma client..."
cd "$ROOT_DIR"
npm ci
npx prisma generate

echo "[deploy-marketplace] Building (standalone)..."
npm run build

if [[ ! -f "${ROOT_DIR}/.next/standalone/server.js" ]]; then
  echo "[deploy-marketplace] ERROR: .next/standalone/server.js missing" >&2
  exit 1
fi
if [[ ! -d "${ROOT_DIR}/.next/standalone/node_modules/.prisma" ]]; then
  echo "[deploy-marketplace] ERROR: standalone is missing .prisma client (did 'npx prisma generate' run before build?)" >&2
  exit 1
fi

echo "[deploy-marketplace] Syncing to ${EDGE_HOST}:${REMOTE_DIR}"
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env.production' \
  --exclude='.next/cache' \
  --exclude='.next/trace' \
  -e 'ssh' \
  "${ROOT_DIR}/" \
  "${EDGE_HOST}:${REMOTE_DIR}/"

echo "[deploy-marketplace] Fixing ownership and restarting ${SERVICE}"
ssh "${EDGE_HOST}" "chown -R zion:zion '${REMOTE_DIR}' && systemctl daemon-reload && systemctl restart ${SERVICE}"

echo "[deploy-marketplace] Smoke check..."
sleep 3
local_code=$(ssh "${EDGE_HOST}" "curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3100/" || echo 000)
live_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 'https://market.zionterranova.com/')
if [[ "$local_code" == "200" && "$live_code" == "200" ]]; then
  echo "[deploy-marketplace] OK — local :3100=$local_code, live=$live_code. Deploy verified."
else
  echo "[deploy-marketplace] FAIL — local :3100=$local_code, live=$live_code (want 200/200)" >&2
  ssh "${EDGE_HOST}" "systemctl status ${SERVICE} --no-pager -l | tail -15" || true
  exit 1
fi
