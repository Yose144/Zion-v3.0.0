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
#   bash apps/website-v2.9/deploy/deploy-web2.9.sh [--artifact-dir /path/to/tested/standalone-app]

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_HOST="${ZION_EDGE_HOST:-zion-edge2}"
EDGE_USER="${ZION_EDGE_USER:-root}"
REMOTE_DIR="/opt/zion/APP&WEB/website-v2.9"
SERVICE="zion-website.service"

ARTIFACT_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --artifact-dir) [[ $# -ge 2 && -n "$2" ]] || exit 2; ARTIFACT_DIR="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
if [[ -n "$ARTIFACT_DIR" ]]; then
  APP_DIR="$(cd "$ARTIFACT_DIR" && pwd)"
else
  cd "$ROOT_DIR"
  npm run build
  # K1.2: s root workspace (lockfile v rootu repa) Next zanoří standalone strom
  # podle cesty ve workspace — `.next/standalone/apps/website-v2.9/server.js`.
  # Najdi server.js, ať skript přežije další změnu layoutu (K1.3 ho sjednotí).
  APP_DIR="$(dirname "$(find "${ROOT_DIR}/.next/standalone" -maxdepth 4 -name server.js -not -path "*/node_modules/*" | head -1)")"
  if [[ -z "$APP_DIR" ]] || [[ ! -f "${APP_DIR}/server.js" ]] || [[ ! -d "${ROOT_DIR}/.next/static" ]]; then
    echo "[deploy-web2.9] ERROR: standalone server or static assets missing" >&2
    exit 1
  fi
  echo "[deploy-web2.9] standalone: ${APP_DIR#"${ROOT_DIR}/"}"

  # K1.2: workspace deps are hoisted at standalone root — fold them into the
  # app dir so the artifact stays self-contained for deploy-next-artifact.sh.
  if [[ ! -d "${APP_DIR}/node_modules" && -d "${ROOT_DIR}/.next/standalone/node_modules" ]]; then
    rsync -a "${ROOT_DIR}/.next/standalone/node_modules/" "${APP_DIR}/node_modules/"
  fi

  mkdir -p "${APP_DIR}/.next/static"
  rsync -a --delete "${ROOT_DIR}/.next/static/" "${APP_DIR}/.next/static/"
  rsync -a --delete "${ROOT_DIR}/public/" "${APP_DIR}/public/"
  # Herní 3D modely avatarů mají jediný zdroj v gitu: `apps/nirvana/public/models/avatars/`.
  # Do `public/` webu se nepřidávají duplicitně, deploy je sem dokopíruje.
  NIRVANA_AVATARS="${ROOT_DIR}/../nirvana/public/models/avatars"
  if [[ -d "$NIRVANA_AVATARS" ]]; then
    mkdir -p "${APP_DIR}/public/models/avatars"
    rsync -a "$NIRVANA_AVATARS/" "${APP_DIR}/public/models/avatars/"
    echo "[deploy-web2.9] avatar GLB: $(find "${APP_DIR}/public/models/avatars" -name '*.glb' | wc -l | tr -d ' ')"
  else
    echo "[deploy-web2.9] WARN: ${NIRVANA_AVATARS} chybí — 3D náhledy avatarů nebudou fungovat" >&2
  fi
  if [[ -d "${ROOT_DIR}/archive-content" ]]; then
    rsync -a --delete "${ROOT_DIR}/archive-content/" "${APP_DIR}/archive-content/"
  fi
fi

bash "${ROOT_DIR}/../../scripts/ops/deploy-next-artifact.sh" "$APP_DIR" "$EDGE_HOST" "${REMOTE_DIR}/.next/standalone" "$SERVICE" 3000 'https://app.zionterranova.com'

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
