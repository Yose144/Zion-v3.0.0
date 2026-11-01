#!/usr/bin/env bash
# Fleet-agent ingress: move POST/GET /api/agent/* from the operator PC to EDGE.
#
# Before:  agent → https://zionterranova.com/api/agent/ → nginx(EDGE2)
#                 → 127.0.0.1:8088 (sshd reverse-tunnel endpoint) → operator PC
#                 → vastctl serve (PC)
#
# After:   agent → https://zionterranova.com/api/agent/ → nginx(EDGE2)
#                 → 127.0.0.1:8088 (ssh -L leg of zion-edge-tunnel) → EDGE
#                 → vastctl serve (same instance the dashboard uses)
#
# What the script does (idempotent):
#   1. EDGE: allow `permitopen 127.0.0.1:8088` for the edgetunnel key
#   2. EDGE2: add `-L 127.0.0.1:8088:127.0.0.1:8088` to zion-edge-tunnel
#   3. copy the agent registry (per-rig secrets) from this PC to EDGE
#   4. restart vastctl-serve + vastctl-daemon on EDGE (daemon caches the registry)
#   5. verify: EDGE2 → EDGE /api/agent/fleet, public heartbeat fails closed
#
# With --retire-pc it also stops + disables the now-unused PC units
# (vastctl-serve, vastctl-daemon, vastctl-tunnel, vastctl-tunnel-edge2).
#
# Usage:
#   bash infra/tools/vast/deploy-agent-ingress.sh             # migrate / verify
#   bash infra/tools/vast/deploy-agent-ingress.sh --retire-pc # + turn the PC off
set -euo pipefail

EDGE="${ZION_EDGE_HOST:-zion-v6}"
EDGE2="${ZION_EDGE2_HOST:-zion-edge2}"
SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=15 -o ControlMaster=auto -o ControlPath=/tmp/zion-agent-%r@%h:%p -o ControlPersist=10m"
REGISTRY_LOCAL="${VASTCTL_AGENT_DB_LOCAL:-$HOME/.local/share/vastctl-agents.json}"
REGISTRY_REMOTE="${VASTCTL_AGENT_DB_REMOTE:-/root/.local/share/vastctl-agents.json}"
RETIRE=0
[ "${1:-}" = "--retire-pc" ] && RETIRE=1

say() { printf '\033[1;36m[agent-ingress]\033[0m %s\n' "$*"; }

# ── 1. EDGE: permit the 8088 forward for the tunnel user ────────────────────
say "EDGE: permitopen 8088 for edgetunnel"
ssh ${SSH_OPTS} "${EDGE}" 'bash -s' <<'REMOTE'
set -eu
F=/home/edgetunnel/.ssh/authorized_keys
if [ ! -f "$F" ]; then echo "[agent-ingress] missing $F" >&2; exit 1; fi
if grep -q 'permitopen="127.0.0.1:8088"' "$F"; then
  echo "  already allowed"
else
  cp -a "$F" "$F.bak-$(date +%Y%m%dT%H%M%SZ)-permit8088"
  python3 - "$F" <<'PY'
import sys, pathlib
p = pathlib.Path(sys.argv[1]); s = p.read_text()
s = s.replace('restrict,port-forwarding,', 'restrict,port-forwarding,permitopen="127.0.0.1:8088",', 1)
p.write_text(s)
PY
  chown edgetunnel:edgetunnel "$F"; chmod 600 "$F"
  echo "  added"
fi
REMOTE

# ── 2. EDGE2: forward 8088 → EDGE in the tunnel unit ───────────────────────
say "EDGE2: add -L 127.0.0.1:8088 to zion-edge-tunnel"
ssh ${SSH_OPTS} "${EDGE2}" 'bash -s' <<'REMOTE'
set -eu
U=/etc/systemd/system/zion-edge-tunnel.service
if grep -q "127.0.0.1:8088:127.0.0.1:8088" "$U"; then
  echo "  already present"
else
  cp -a "$U" "/root/zion-edge-tunnel.service.bak-$(date +%Y%m%dT%H%M%SZ)"
  python3 - "$U" <<'PY'
import sys, pathlib
p = pathlib.Path(sys.argv[1]); s = p.read_text()
anchor = "-L 127.0.0.1:8766:127.0.0.1:8766"
assert anchor in s, "tunnel unit not in the expected shape"
s = s.replace(anchor, anchor + " -L 127.0.0.1:8088:127.0.0.1:8088", 1)
p.write_text(s)
PY
  systemctl daemon-reload
  echo "  patched"
fi
systemctl restart zion-edge-tunnel.service
sleep 4
ss -tlnp 2>/dev/null | grep -q ':8088' && echo "  8088 listening on EDGE2" || { echo "  8088 NOT listening" >&2; exit 1; }
REMOTE

# ── 3. registry (per-rig secrets) → EDGE ───────────────────────────────────
if [ -f "${REGISTRY_LOCAL}" ]; then
  say "copying agent registry → ${EDGE}:${REGISTRY_REMOTE}"
  ssh ${SSH_OPTS} "${EDGE}" "install -d -m 0700 /root/.local/share"
  scp -q ${SSH_OPTS} "${REGISTRY_LOCAL}" "${EDGE}:${REGISTRY_REMOTE}.new"
  ssh ${SSH_OPTS} "${EDGE}" "mv ${REGISTRY_REMOTE}.new ${REGISTRY_REMOTE} && chmod 600 ${REGISTRY_REMOTE} && chown root:root ${REGISTRY_REMOTE}"
else
  say "no local registry at ${REGISTRY_LOCAL} — skipping (agents will re-enroll)"
fi

# ── 4. restart EDGE services (daemon caches the registry) ──────────────────
say "restarting vastctl on EDGE"
ssh ${SSH_OPTS} "${EDGE}" "systemctl restart vastctl-serve.service vastctl-daemon.service && sleep 3 && systemctl is-active vastctl-serve.service vastctl-daemon.service | tr '\n' ' '"

# ── 5. verify ──────────────────────────────────────────────────────────────
say "verify: EDGE2 → EDGE /api/agent/fleet"
ssh ${SSH_OPTS} "${EDGE2}" 'bash -s' <<'REMOTE'
set -u
curl -s -m 25 http://127.0.0.1:8088/api/agent/fleet | python3 -c '
import json, sys, time
d = json.load(sys.stdin)
rigs = d.get("rigs") or []
print("[agent-ingress] fleet via EDGE: %d rig(s)" % len(rigs))
for r in rigs:
    print("   %s %s enrolled=%s age=%ss" % (
        r.get("rig_id"), r.get("hostname"), r.get("enrolled"), round(r.get("age_s") or 0)))
'
REMOTE

say "verify: public heartbeat fails closed"
code=$(curl -s -o /dev/null -m 20 -w '%{http_code}' -X POST https://zionterranova.com/api/agent/heartbeat \
  -H 'Content-Type: application/json' -d '{}')
echo "  POST /api/agent/heartbeat (bez tokenu) → HTTP ${code} (očekáváno 403)"

# ── 6. optional: retire the PC-side control plane ──────────────────────────
if [ "${RETIRE}" = "1" ]; then
  say "retiring PC units (vastctl-serve / daemon / tunnels)"
  export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
  for u in vastctl-serve.service vastctl-daemon.service vastctl-tunnel.service vastctl-tunnel-edge2.service; do
    systemctl --user stop "$u" 2>/dev/null || true
    systemctl --user disable "$u" 2>/dev/null || true
  done
  systemctl --user is-active vastctl-serve.service vastctl-daemon.service vastctl-tunnel.service vastctl-tunnel-edge2.service 2>&1 | tr '\n' ' '; echo
fi

say "done — agents enrolují na EDGE, dashboard je vidí v Rigs → Fleet → Fleet agenti"
