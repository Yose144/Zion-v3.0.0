#!/usr/bin/env bash
# Deploy the vast.ai control plane (vastctl) to the EDGE box as two services:
#
#   vastctl-daemon.service  — probe loop: status.json → /var/www/zion-maintenance
#                             + scp mirror to EDGE2 (replaces the operator-PC
#                             reverse tunnel that used to feed the apex)
#   vastctl-serve.service   — HTTP API on 127.0.0.1:8088 (status, offers, rent,
#                             launch, stop, exec, logs, smos, inference)
#
# Why EDGE: the daemon already ran there with VASTAI_API_KEY and working SSH to
# the rigs, but from a deleted tree (/root/build/warpd-zis) — every restart
# would have failed. The dashboard (also on EDGE, 127.0.0.1:8766) can then talk
# to 127.0.0.1:8088 without any tunnel from the operator PC.
#
# Usage:
#   bash infra/tools/vast/deploy-vastctl-edge.sh          # deploy + restart
#   ZION_VAST_HOST=zion-v6 bash ...                       # custom ssh alias
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SRC_DIR}/../../.." && pwd)"
HOST="${ZION_VAST_HOST:-zion-v6}"
REMOTE_DIR="${ZION_VAST_DIR:-/opt/zion/vastctl}"
ENV_FILE="/etc/zion/vastctl.env"
PUSH_TARGET="${ZION_VAST_PUSH:-/var/www/zion-maintenance/vast-rigs/status.json}"
SSH_OPTS="${ZION_SSH_OPTS:--o BatchMode=yes -o ConnectTimeout=15 -o ControlMaster=auto -o ControlPath=/tmp/zion-vastctl-%r@%h:%p -o ControlPersist=10m}"

say() { printf '\033[1;36m[vastctl-edge]\033[0m %s\n' "$*"; }

say "target ${HOST}:${REMOTE_DIR}"

# ── 1. source tree ──────────────────────────────────────────────────────────
ssh ${SSH_OPTS} "${HOST}" "install -d -m 0750 -o root -g root ${REMOTE_DIR}"

rsync -az --info=stats1 \
  "${SRC_DIR}/vastctl.py" \
  "${SRC_DIR}/vast_inference.py" \
  "${SRC_DIR}/agent.py" \
  "${SRC_DIR}/code_run.py" \
  "${SRC_DIR}/bootstrap-agent.sh" \
  "${SRC_DIR}/zion-sheet-apply.sh" \
  "${SRC_DIR}/zion-coder-job.sh" \
  "${REPO_ROOT}/infra/vast/xmrig-vast-cpu.json" \
  "${HOST}:${REMOTE_DIR}/" 2>&1 | tail -3

ssh ${SSH_OPTS} "${HOST}" "chmod 0640 ${REMOTE_DIR}/*.py ${REMOTE_DIR}/*.json; chmod 0755 ${REMOTE_DIR}/*.sh"

# ── 2. secrets file (kept across deploys) ───────────────────────────────────
# The old unit carried VASTAI_API_KEY inline; move it into a 0600 env file the
# first time and reuse it afterwards.
ssh ${SSH_OPTS} "${HOST}" "bash -s" <<'REMOTE'
set -eu
ENV_FILE=/etc/zion/vastctl.env
if [ ! -s "$ENV_FILE" ]; then
  KEY="$(grep -ho 'VASTAI_API_KEY=[^"]*' /etc/systemd/system/vastctl-daemon.service 2>/dev/null | head -1 | cut -d= -f2-)"
  if [ -z "${KEY:-}" ]; then
    echo "[vastctl-edge] VASTAI_API_KEY not found in the old unit — create $ENV_FILE manually" >&2
    exit 1
  fi
  install -d -m 0755 /etc/zion
  umask 077
  printf 'VASTAI_API_KEY=%s\n' "$KEY" > "$ENV_FILE"
  echo "[vastctl-edge] wrote $ENV_FILE from the previous unit"
fi
chmod 0600 "$ENV_FILE"
REMOTE

# ── 3. units ────────────────────────────────────────────────────────────────
say "installing units"
ssh ${SSH_OPTS} "${HOST}" "cat > /etc/systemd/system/vastctl-daemon.service" <<UNIT
[Unit]
Description=vastctl daemon — vast.ai rig probe loop (status.json → edge webroots)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${REMOTE_DIR}
EnvironmentFile=${ENV_FILE}
Environment=VASTCTL_PRL_POOL=stratum+tcp://62.171.141.136:8444
ExecStart=/usr/bin/python3 ${REMOTE_DIR}/vastctl.py \\
    --config ${REMOTE_DIR}/xmrig-vast-cpu.json daemon \\
    --interval 60 \\
    --json-out ${PUSH_TARGET} \\
    --push root@207.180.217.100:${PUSH_TARGET} \\
    --autodeploy-xmrig
Restart=always
RestartSec=15
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT

ssh ${SSH_OPTS} "${HOST}" "cat > /etc/systemd/system/vastctl-serve.service" <<UNIT
[Unit]
Description=vastctl serve — vast.ai + SMOS control API (127.0.0.1:8088)
After=network-online.target vastctl-daemon.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${REMOTE_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/python3 ${REMOTE_DIR}/vastctl.py \\
    --config ${REMOTE_DIR}/xmrig-vast-cpu.json serve --port 8088 --bind 127.0.0.1
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT

ssh ${SSH_OPTS} "${HOST}" "systemctl daemon-reload && systemctl enable vastctl-daemon.service vastctl-serve.service >/dev/null && systemctl restart vastctl-daemon.service vastctl-serve.service"

# ── 4. verify ───────────────────────────────────────────────────────────────
say "waiting for the API…"
for i in $(seq 1 20); do
  code="$(ssh ${SSH_OPTS} "${HOST}" "curl -s -m 4 -o /dev/null -w '%{http_code}' http://127.0.0.1:8088/api/status" || true)"
  [ "${code}" = "200" ] && break
  sleep 2
done

ssh ${SSH_OPTS} "${HOST}" "bash -s" <<'REMOTE'
set -u
echo "[vastctl-edge] serve :8088  → $(curl -s -m 5 -o /dev/null -w '%{http_code}' http://127.0.0.1:8088/api/status)"
echo "[vastctl-edge] status.json → $(python3 - <<'PY'
import json, os, time
p = "/var/www/zion-maintenance/vast-rigs/status.json"
try:
    d = json.load(open(p))
    age = int(time.time() - os.path.getmtime(p))
    print(f"{d.get('ts')} rigs={len(d.get('rigs') or [])} ${d.get('total_dph',0):.4f}/h age={age}s")
except Exception as e:
    print("MISSING/INVALID:", e)
PY
)"
systemctl is-active vastctl-daemon.service vastctl-serve.service | tr '\n' ' '; echo
REMOTE

say "done — dashboard can now use http://127.0.0.1:8088"
