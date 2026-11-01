#!/usr/bin/env bash
# Deploy the ZION ops dashboard (zero-dep Python http.server) to the EDGE box.
#
# Only the files touched by the unified ops console are synced — the deployed
# tree is otherwise left alone (v31.py, marketplace.py, … stay as they are).
#
# Usage:
#   bash ZION_OS/dashboard/deploy-dashboard.sh
#   ZION_EDGE_HOST=zion-v6 bash ZION_OS/dashboard/deploy-dashboard.sh
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="${ZION_EDGE_HOST:-zion-v6}"
REMOTE_DIR="${ZION_DASH_DIR:-/opt/zion/ZION_OS/dashboard}"
UNIT="zion-edge-python-dashboard.service"
SSH_OPTS="${ZION_SSH_OPTS:--o BatchMode=yes -o ConnectTimeout=15 -o ControlMaster=auto -o ControlPath=/tmp/zion-dash-%r@%h:%p -o ControlPersist=10m}"
VERIFY_PORT="${ZION_VERIFY_PORT:-8798}"

FILES=(app.py dashboard.html dashboard.js ops_console.py .verify_ops.py)

say() { printf '\033[1;36m[dashboard]\033[0m %s\n' "$*"; }

say "target ${HOST}:${REMOTE_DIR}"

# ── 1. backup ───────────────────────────────────────────────────────────────
STAMP="$(date +%Y%m%dT%H%M%SZ)"
ssh ${SSH_OPTS} "${HOST}" "mkdir -p ${REMOTE_DIR}/.deploy-backups/${STAMP}; \
  for f in ${FILES[*]}; do [ -f ${REMOTE_DIR}/\$f ] && cp -a ${REMOTE_DIR}/\$f ${REMOTE_DIR}/.deploy-backups/${STAMP}/\$f; done; \
  echo '[dashboard] backup → ${REMOTE_DIR}/.deploy-backups/${STAMP}'"

# ── 2. sync ─────────────────────────────────────────────────────────────────
ARGS=()
for f in "${FILES[@]}"; do ARGS+=("${SRC_DIR}/${f}"); done
rsync -az -e "ssh ${SSH_OPTS}" "${ARGS[@]}" "${HOST}:${REMOTE_DIR}/"
ssh ${SSH_OPTS} "${HOST}" "chown zion:zion ${REMOTE_DIR}/${FILES[*]} 2>/dev/null || true"

# ── 3. restart ──────────────────────────────────────────────────────────────
say "restarting ${UNIT}"
ssh ${SSH_OPTS} "${HOST}" "python3 -m py_compile ${REMOTE_DIR}/app.py ${REMOTE_DIR}/ops_console.py && systemctl restart ${UNIT}"
sleep 3
ssh ${SSH_OPTS} "${HOST}" "systemctl is-active ${UNIT}"

# ── 4. verify the aggregation layer against the real local sources ──────────
# A throw-away instance on a spare port with the desktop auth bypass, so we can
# exercise /api/ops/* end-to-end without knowing the Basic Auth password.
say "checking /api/ops/* on 127.0.0.1:${VERIFY_PORT}"
ssh ${SSH_OPTS} "${HOST}" "VERIFY_PORT=${VERIFY_PORT} bash -s" <<'REMOTE'
set -u
cd /opt/zion/ZION_OS/dashboard

# free the verification port from an earlier run
ss -tlnp 2>/dev/null | grep ":${VERIFY_PORT} " | grep -o 'pid=[0-9]*' | cut -d= -f2 | xargs -r kill 2>/dev/null || true
sleep 1

DASHBOARD_PORT="${VERIFY_PORT}" ZION_DESKTOP_EMBEDDED=1 DASHBOARD_HOST=127.0.0.1 \
  python3 app.py >/tmp/dash-verify.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT

for i in $(seq 1 25); do
  code=$(curl -s -m 3 -o /dev/null -w '%{http_code}' "http://127.0.0.1:${VERIFY_PORT}/api/ops/health" || true)
  [ "$code" = "200" ] && break
  sleep 1
done

echo "[dashboard] health   → $(curl -s -m 6 "http://127.0.0.1:${VERIFY_PORT}/api/ops/health" | head -c 260)"
curl -s -m 25 "http://127.0.0.1:${VERIFY_PORT}/api/ops/overview" -o /tmp/ops-verify.json

python3 /opt/zion/ZION_OS/dashboard/.verify_ops.py /tmp/ops-verify.json || true

kill $PID 2>/dev/null || true
wait $PID 2>/dev/null || true
tail -2 /tmp/dash-verify.log 2>/dev/null || true
REMOTE

say "done — https://dashboard.zionterranova.com/dashboard → tab \"Rigs\""
