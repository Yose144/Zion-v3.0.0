#!/usr/bin/env bash
# ZION nirvana deploy — Next.js standalone to nirvana.zionterranova.com (EDGE)
#
# Builds locally, copies public/ + .next/static into the standalone tree
# (standalone server serves them ONLY from next to server.js — monorepo
# layout nests the app at .next/standalone/nirvana/), rsyncs to
# /opt/zion/APP&WEB/nirvana on EDGE, fixes ownership for the zion service
# user, restarts zion-nirvana.service, and runs a post-deploy smoke check.
#
# Requires:
#   - SSH alias `zion-new` (62.171.141.136) — EDGE host where
#     nirvana.zionterranova.com DNS points.
#   - npm installed locally and `npm run build` working
#
# Usage:
#   bash apps/nirvana/deploy/deploy-nirvana.sh [--artifact-dir /path/to/tested/standalone-app]

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_HOST="${ZION_EDGE_HOST:-zion-new}"
REMOTE_DIR="/opt/zion/APP&WEB/nirvana"
SERVICE="zion-nirvana.service"
SITE="https://nirvana.zionterranova.com"

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
  APP_DIR="${ROOT_DIR}/.next/standalone/nirvana"
  if [[ ! -f "${APP_DIR}/server.js" ]]; then
    echo "[deploy-nirvana] ERROR: standalone build missing ${APP_DIR}/server.js" >&2
    exit 1
  fi

  # Standalone server serves public/ and .next/static ONLY from next to
  # server.js — Next does not copy them there (see deploy-web2.9.sh).
  echo "[deploy-nirvana] Staging public/ + .next/static into standalone tree"
  rsync -a --delete "${ROOT_DIR}/public/" "${APP_DIR}/public/"
  rsync -a --delete "${ROOT_DIR}/.next/static/" "${APP_DIR}/.next/static/"
fi

bash "${ROOT_DIR}/../../scripts/ops/deploy-next-artifact.sh" "$APP_DIR" "$EDGE_HOST" "${REMOTE_DIR}" "$SERVICE" 3010 'https://nirvana.zionterranova.com'

echo "[deploy-nirvana] Waiting for ${SITE}..."
healthy=0
for i in $(seq 1 12); do
  if curl -fsS -o /dev/null --max-time 10 "${SITE}/"; then
    echo "[deploy-nirvana] ${SITE} is healthy after ~${i}0s"
    healthy=1
    break
  fi
  sleep 5
done

if [[ "$healthy" -eq 0 ]]; then
  echo "[deploy-nirvana] ERROR: ${SITE} did not become healthy" >&2
  ssh "${EDGE_HOST}" "systemctl status ${SERVICE} --no-pager -l" || true
  exit 1
fi

echo "[deploy-nirvana] Smoke check..."
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
check "${SITE}/"
check "${SITE}/textures/milkyway-eso-4k.jpg"
check "${SITE}/textures/earth-blue-marble.webp"
check "${SITE}/api/oasis/worlds"
ssh "${EDGE_HOST}" "curl -s -o /dev/null -w '  local :3010 -> %{http_code}\n' --max-time 10 http://127.0.0.1:3010/"

if [[ "$fail" -ne 0 ]]; then
  echo "[deploy-nirvana] ERROR: smoke check failed — see FAIL lines above" >&2
  exit 1
fi
echo "[deploy-nirvana] Deploy complete and verified."
