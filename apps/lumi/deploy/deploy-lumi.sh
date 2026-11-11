#!/usr/bin/env bash
# Lumi deploy — Next.js standalone na lumi.zionterranova.com (EDGE2).
#
# Build běží lokálně (stejně jako MarketPlace), artefakt se rsyncuje na
# /opt/zion/APP&WEB/Lumi, na serveru se dotáhne Prisma engine pro Linux,
# vytvoří/aktualizuje SQLite schéma a restartuje zion-lumi.service.
#
# Předpoklady na serveru (jednorázově):
#   - /etc/zion/lumi.env (viz .env.example; DATABASE_URL=file:/opt/zion/data/lumi/lumi.db)
#   - mkdir -p /opt/zion/data/lumi && chown zion:zion /opt/zion/data/lumi
#   - nginx vhost + certbot (deploy/nginx/lumi.zionterranova.com.conf)
#   - systemd unit (deploy/systemd/zion-lumi.service)
#
# Použití:
#   bash apps/lumi/deploy/deploy-lumi.sh
#   ZION_SKIP_NPM_CI=1 bash apps/lumi/deploy/deploy-lumi.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# `lumi.zionterranova.com` je dnes (wildcard DNS) na EDGE1, ne na EDGE2.
# Pokud se DNS přesune na EDGE2, spusť s LUMI_EDGE_HOST=zion-edge2.
EDGE_HOST="${LUMI_EDGE_HOST:-zion-v6}"
EDGE_USER="${LUMI_EDGE_USER:-root}"
SSH_KEY="${LUMI_SSH_KEY:-$HOME/.ssh/zion-edge-post-wipe-2026-07-29}"
SSH_EXTRA="${LUMI_SSH_OPTS:-}"
REMOTE_DIR="/opt/zion/APP&WEB/Lumi"
SERVICE="zion-lumi.service"
SITE_URL="${LUMI_SITE_URL:-https://lumi.zionterranova.com}"
PRISMA_CLI="npx --yes prisma@5.22.0"

SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=accept-new ${SSH_EXTRA}"
SSH() { ssh ${SSH_OPTS} "${EDGE_USER}@${EDGE_HOST}" "$@"; }

echo "[deploy-lumi] Závislosti + Prisma client"
cd "$ROOT_DIR"
if [[ "${ZION_SKIP_NPM_CI:-0}" != "1" ]]; then
  (cd ../.. && npm ci --ignore-scripts)
fi
npm run db:generate

echo "[deploy-lumi] Build (standalone)"
NEXT_PUBLIC_SITE_URL="${SITE_URL}" npm run build

if [[ ! -f "${ROOT_DIR}/.next/standalone/server.js" ]]; then
  echo "[deploy-lumi] ERROR: .next/standalone/server.js chybí" >&2
  exit 1
fi
if [[ ! -d "${ROOT_DIR}/.next/standalone/.next/static" ]]; then
  echo "[deploy-lumi] WARN: dokopírovávám .next/static do standalone"
  cp -a "${ROOT_DIR}/.next/static" "${ROOT_DIR}/.next/standalone/.next/static"
fi
if [[ ! -d "${ROOT_DIR}/.next/standalone/public" ]]; then
  echo "[deploy-lumi] WARN: dokopírovávám public/ do standalone"
  mkdir -p "${ROOT_DIR}/.next/standalone/public"
  cp -rL "${ROOT_DIR}/public/." "${ROOT_DIR}/.next/standalone/public/"
fi

if ! SSH "test -f '${REMOTE_DIR}/package.json'"; then
  if [[ "${LUMI_FIRST_DEPLOY:-0}" == "1" ]]; then
    echo "[deploy-lumi] První deploy — vytvářím ${REMOTE_DIR}"
    SSH "mkdir -p '${REMOTE_DIR}'"
  else
    echo "[deploy-lumi] ERROR: ${REMOTE_DIR}/package.json na ${EDGE_HOST} chybí — odmítám rsync --delete" >&2
    echo "[deploy-lumi]        První deploy: LUMI_FIRST_DEPLOY=1 bash …" >&2
    exit 1
  fi
fi

echo "[deploy-lumi] Synchronizace na ${EDGE_HOST}:${REMOTE_DIR}"
# Nezapisujeme .next/standalone přímo do REMOTE_DIR (smazalo by src/, prisma/).
# `--exclude='/node_modules'` je záměrně kotvené: vnořené node_modules
# standalone stromu se musí přenést.
rsync -avz --delete \
  --exclude='/node_modules' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='.next/cache' \
  --exclude='.next/trace' \
  --exclude='prisma/*.db' \
  --exclude='*.db-journal' \
  --exclude='*.db-wal' \
  --exclude='*.db-shm' \
  -e "ssh ${SSH_OPTS}" \
  "${ROOT_DIR}/" \
  "${EDGE_USER}@${EDGE_HOST}:${REMOTE_DIR}/"

echo "[deploy-lumi] Prisma na serveru (Linux engine + schéma)"
REMOTE_SCRIPT=$(cat <<'EOS'
set -eu
cd '@REMOTE@'
if [ -f /etc/zion/lumi.env ]; then
  set -a
  # shellcheck disable=SC1091
  . /etc/zion/lumi.env
  set +a
fi
mkdir -p /opt/zion/data/lumi
@PRISMA@ generate --schema prisma/schema.prisma
@PRISMA@ db push --schema prisma/schema.prisma --skip-generate
# Vygenerovaný klient (custom output) musí být i ve standalone stromu.
mkdir -p .next/standalone/src/generated
rm -rf .next/standalone/src/generated/prisma
cp -a src/generated/prisma .next/standalone/src/generated/prisma
# Engine pro macOS z lokálního buildu je na Linuxu jen mrtvá váha.
find .next/standalone/src/generated/prisma -name 'libquery_engine-darwin*' -delete 2>/dev/null || true
chown -R zion:zion /opt/zion/data/lumi '@REMOTE@'
EOS
)
shopt -u patsub_replacement 2>/dev/null || true
REMOTE_SCRIPT="${REMOTE_SCRIPT//@REMOTE@/${REMOTE_DIR}}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//@PRISMA@/${PRISMA_CLI}}"
SSH bash -s <<<"${REMOTE_SCRIPT}"

echo "[deploy-lumi] Restart ${SERVICE}"
# Statické assety servíruje nginx přímo; musí být čitelné pro www-data.
# /opt/zion je 750 zion:zion — nginx (www-data) potřebuje průchod (o+x),
# ale ne čtení obsahu. Public stromy musí být 644/755.
SSH "chmod o+x /opt/zion 2>/dev/null || true; \
  chmod -R a+rX '${REMOTE_DIR}/public' '${REMOTE_DIR}/.next/standalone/public' '${REMOTE_DIR}/.next/standalone/.next/static' 2>/dev/null || true; \
  systemctl daemon-reload && systemctl enable ${SERVICE} >/dev/null 2>&1 || true; systemctl restart ${SERVICE}"

echo "[deploy-lumi] Seed katalogu"
SEED_RESULT=$(SSH "if [ -f /etc/zion/lumi.env ]; then set -a; . /etc/zion/lumi.env; set +a; fi; if [ -n \"\${LUMI_SEED_TOKEN:-}\" ]; then curl -s -X POST -H \"Authorization: Bearer \$LUMI_SEED_TOKEN\" http://127.0.0.1:3200/api/seed; fi" || true)
echo "[deploy-lumi] seed → ${SEED_RESULT:0:200}"

echo "[deploy-lumi] Smoke check"
sleep 3
LOCAL_CODE=$(SSH "curl -s -o /dev/null -w '%{http_code}' --max-time 15 http://127.0.0.1:3200/" || echo 000)
LIVE_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${SITE_URL}/" || echo 000)
HEALTH=$(curl -s --max-time 20 "${SITE_URL}/api/health" || true)
PRODUCTS_JSON=$(curl -s --max-time 20 "${SITE_URL}/api/products?limit=1" || true)
ASSET_PATH=$(curl -s --max-time 20 "${SITE_URL}/" | grep -o '/_next/static/[^"]*' | head -1 || true)
if [[ -n "${ASSET_PATH}" ]]; then
  ASSET_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${SITE_URL}${ASSET_PATH}" || echo 000)
else
  ASSET_CODE=000
fi

if [[ "${LOCAL_CODE}" == "200" && "${LIVE_CODE}" == "200" && "${ASSET_CODE}" == "200" ]] \
   && grep -q '"ok":true' <<<"${HEALTH}" && grep -q '"data"' <<<"${PRODUCTS_JSON}"; then
  echo "[deploy-lumi] OK — local :3200=${LOCAL_CODE}, live=${LIVE_CODE}, static=${ASSET_CODE}, health OK, products OK."
else
  echo "[deploy-lumi] FAIL — local=${LOCAL_CODE}, live=${LIVE_CODE}, static=${ASSET_CODE}" >&2
  echo "  /api/health   → ${HEALTH:0:300}" >&2
  echo "  /api/products → ${PRODUCTS_JSON:0:300}" >&2
  SSH "systemctl status ${SERVICE} --no-pager -l | tail -20" || true
  SSH "journalctl -u ${SERVICE} -n 40 --no-pager | tail -30" || true
  exit 1
fi

echo "[deploy-lumi] Hotovo."
