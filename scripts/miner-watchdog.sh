#!/usr/bin/env bash
# zion-miner-watchdog.sh — keep the desktop-agent + miners alive and push a
# status beacon to the Edge dashboard (/api/rig-beacon).
#
# Runs every 60s via zion-miner-watchdog.timer (user systemd, linger=on).
# Restart policy:
#   - agent (launch-electron.js) dead            -> relaunch wrapper (needs wayland session)
#   - zion-miner / SRBMiner dead while agent up  -> streak++; after 3 ticks kill
#                                                 agent -> next tick relaunches it
# Beacon is sent on every tick regardless of state (dead = degraded/offline).

set -uo pipefail

STATE_DIR="$HOME/.config/zion-desktop-agent"
STATE_FILE="$STATE_DIR/watchdog-state.env"
LOG_FILE="$STATE_DIR/watchdog.log"
WRAPPER="$HOME/bin/start-desktop-agent.sh"
ENV_FILE="$HOME/2.9.6-main/scripts/backup-beacon.env"
EDGE_URL="https://dashboard.zionterranova.com/api/rig-beacon"
MINER_METRICS="http://127.0.0.1:9116/metrics"
SRB_LOG="$STATE_DIR/srbminer.log"
UID_NUM="$(id -u)"

mkdir -p "$STATE_DIR"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
  if [ "$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)" -gt 4000 ]; then
    tail -2000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
  fi
}

# ── load watchdog state ──────────────────────────────────────────────────
MINER_STREAK=0; SRB_STREAK=0; RESTARTS=0; LAST_ACTION="boot"
[ -f "$STATE_FILE" ] && . "$STATE_FILE" 2>/dev/null || true

# ── process checks ───────────────────────────────────────────────────────
AGENT_PID=$(pgrep -f "^node scripts/launch-electron" | head -1 || true)
MINER_PID=$(pgrep -f "resources/zion-miner" | head -1 || true)
SRB_PID=$(pgrep -f "SRBMiner-MULTI" | head -1 || true)

# ── restart logic ────────────────────────────────────────────────────────
# The agent runs as user service zion-desktop-agent.service bound to
# graphical-session.target — restart goes through systemd so the process
# lands in its own cgroup with the session env (DISPLAY/XAUTHORITY imported
# by gnome-session). Spawning from here via nohup would die with this
# oneshot service's cgroup teardown.
SESSION_ACTIVE=0
systemctl --user is-active --quiet graphical-session.target && SESSION_ACTIVE=1

restart_agent() {
  local why="$1"
  if [ "$SESSION_ACTIVE" = "1" ]; then
    systemctl --user restart zion-desktop-agent.service >/dev/null 2>&1
    RESTARTS=$((RESTARTS + 1)); LAST_ACTION="agent restart: $why"
    log "restart agent ($why)"
  else
    LAST_ACTION="agent dead, no graphical session"
    log "cannot restart agent ($why) — graphical-session.target inactive"
  fi
}

if [ -z "$AGENT_PID" ]; then
  restart_agent "agent dead"
elif [ -z "$MINER_PID" ]; then
  MINER_STREAK=$((MINER_STREAK + 1)); LAST_ACTION="zion-miner dead (streak $MINER_STREAK)"
  if [ "$MINER_STREAK" -ge 3 ]; then
    MINER_STREAK=0
    restart_agent "zion-miner dead 3 ticks"
  fi
else
  MINER_STREAK=0
fi

if [ -n "$AGENT_PID" ] && [ -n "$MINER_PID" ] && [ -z "$SRB_PID" ]; then
  SRB_STREAK=$((SRB_STREAK + 1))
  if [ "$SRB_STREAK" -ge 3 ]; then
    SRB_STREAK=0
    restart_agent "SRBMiner dead 3 ticks"
  fi
else
  SRB_STREAK=0
fi

# re-check after potential relaunch actions
AGENT_PID=$(pgrep -f "^node scripts/launch-electron" | head -1 || true)
MINER_PID=$(pgrep -f "resources/zion-miner" | head -1 || true)
SRB_PID=$(pgrep -f "SRBMiner-MULTI" | head -1 || true)

# ── metrics collection ───────────────────────────────────────────────────
ZM_HPS=0; ZM_ACC=0; ZM_REJ=0; ZM_TOTAL=0; ZM_POOL=""
if [ -n "$MINER_PID" ]; then
  MET=$(curl -s -m 3 "$MINER_METRICS" 2>/dev/null || true)
  if [ -n "$MET" ]; then
    ZM_HPS=$(awk '/^zion_miner_hash_rate/{print $2; exit}' <<<"$MET")
    ZM_ACC=$(awk '/^zion_miner_shares_accepted/{print $2; exit}' <<<"$MET")
    ZM_REJ=$(awk '/^zion_miner_shares_rejected/{print $2; exit}' <<<"$MET")
    ZM_TOTAL=$(awk '/^zion_miner_total_hashes/{print $2; exit}' <<<"$MET")
    ZM_POOL=$(grep -oE 'pool="[^"]+"' <<<"$MET" | head -1 | cut -d'"' -f2 || true)
  fi
fi

SRB_MHS=0; SRB_ACC=0; SRB_REJ=0
GPU_JSON="[]"
if [ -n "$SRB_PID" ] && [ -f "$SRB_LOG" ]; then
  SRB_TAIL=$(tail -40 "$SRB_LOG" 2>/dev/null || true)
  SRB_MHS=$(grep -oE 'Total: [0-9.]+ MH/s' <<<"$SRB_TAIL" | tail -1 | grep -oE '[0-9.]+' || true)
  SRB_ACC=$(grep -oE 'A:[0-9]+' <<<"$SRB_TAIL" | tail -1 | cut -d: -f2 || true)
  SRB_REJ=$(grep -oE ' R:[0-9]+' <<<"$SRB_TAIL" | tail -1 | tr -d ' R:' || true)
  GPU_JSON=$(SRB_TAIL_ENV="$SRB_TAIL" python3 - <<'PYEOF' 2>/dev/null
import json, re, os
gpus = {}
for line in os.environ.get("SRB_TAIL_ENV", "").splitlines():
    m = re.match(r'.*(GPU\d+) (.+?): ([\d.]+) MH/s \[T:(\d+)C FAN:(\d+)RPM P:([\d.]+)W', line)
    if m:
        gpus[m.group(1)] = {"gpu": m.group(1), "name": m.group(2), "mhs": float(m.group(3)),
                            "temp_c": int(m.group(4)), "fan_rpm": int(m.group(5)), "power_w": float(m.group(6))}
print(json.dumps(list(gpus.values())))
PYEOF
)
  [ -z "$GPU_JSON" ] && GPU_JSON="[]"
  SRB_MHS=${SRB_MHS:-0}; SRB_ACC=${SRB_ACC:-0}; SRB_REJ=${SRB_REJ:-0}
fi

SYS_UP=$(cut -d' ' -f1 /proc/uptime 2>/dev/null || echo 0)
LOAD1=$(cut -d' ' -f1 /proc/loadavg 2>/dev/null || echo 0)
MEM_TOT=$(awk '/MemTotal/{print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)
MEM_AVL=$(awk '/MemAvailable/{print int($2/1024)}' /proc/meminfo 2>/dev/null || echo 0)

if [ -n "$MINER_PID" ] && [ -n "$SRB_PID" ]; then RIG_STATUS="online"
elif [ -n "$AGENT_PID" ]; then RIG_STATUS="degraded"
else RIG_STATUS="offline"; fi

# ── persist state ────────────────────────────────────────────────────────
cat > "$STATE_FILE" <<EOF
MINER_STREAK=$MINER_STREAK
SRB_STREAK=$SRB_STREAK
RESTARTS=$RESTARTS
LAST_ACTION="$LAST_ACTION"
EOF

# ── beacon payload + send ────────────────────────────────────────────────
export WD_RIG_ID="$(hostname -s)" WD_RIG_NAME="$(hostname -s)" \
  WD_AGENT_PID="${AGENT_PID:-0}" WD_MINER_PID="${MINER_PID:-0}" WD_SRB_PID="${SRB_PID:-0}" \
  WD_ZM_HPS="${ZM_HPS:-0}" WD_ZM_ACC="${ZM_ACC:-0}" WD_ZM_REJ="${ZM_REJ:-0}" \
  WD_ZM_TOTAL="${ZM_TOTAL:-0}" WD_ZM_POOL="${ZM_POOL:-}" \
  WD_SRB_MHS="${SRB_MHS:-0}" WD_SRB_ACC="${SRB_ACC:-0}" WD_SRB_REJ="${SRB_REJ:-0}" \
  WD_GPU_JSON="$GPU_JSON" WD_SYS_UP="${SYS_UP:-0}" WD_LOAD1="${LOAD1:-0}" \
  WD_MEM_TOT="${MEM_TOT:-0}" WD_MEM_AVL="${MEM_AVL:-0}" \
  WD_RESTARTS="$RESTARTS" WD_LAST_ACTION="$LAST_ACTION" \
  WD_MINER_STREAK="$MINER_STREAK" WD_SRB_STREAK="$SRB_STREAK"

PAYLOAD=$(python3 - "$RIG_STATUS" <<'PYEOF'
import json, sys, os
e = os.environ
print(json.dumps({
  "rig_id": e["WD_RIG_ID"], "name": e["WD_RIG_NAME"], "status": sys.argv[1],
  "agent":  {"running": bool(int(e.get("WD_AGENT_PID") or 0)), "pid": int(e.get("WD_AGENT_PID") or 0)},
  "zion_miner": {"running": bool(int(e.get("WD_MINER_PID") or 0)), "pid": int(e.get("WD_MINER_PID") or 0),
                 "hashrate_hps": float(e.get("WD_ZM_HPS") or 0),
                 "hashrate_khs": float(e.get("WD_ZM_HPS") or 0) / 1000.0,
                 "shares_accepted": int(float(e.get("WD_ZM_ACC") or 0)),
                 "shares_rejected": int(float(e.get("WD_ZM_REJ") or 0)),
                 "total_hashes": int(float(e.get("WD_ZM_TOTAL") or 0)),
                 "pool": e.get("WD_ZM_POOL") or None,
                 "worker": "dest-zion@g=zion", "backend": "opencl"},
  "qtu_miner": {"running": bool(int(e.get("WD_SRB_PID") or 0)), "pid": int(e.get("WD_SRB_PID") or 0),
                "hashrate_hs": float(e.get("WD_SRB_MHS") or 0),
                "shares_accepted": int(e.get("WD_SRB_ACC") or 0),
                "shares_rejected": int(e.get("WD_SRB_REJ") or 0),
                "miner": "SRBMiner-MULTI", "algo": "quantus"},
  "gpus": json.loads(e.get("WD_GPU_JSON") or "[]"),
  "gpu_count": len(json.loads(e.get("WD_GPU_JSON") or "[]")),
  "system": {"uptime_s": float(e.get("WD_SYS_UP") or 0), "load1": float(e.get("WD_LOAD1") or 0),
             "mem_total_mb": int(e.get("WD_MEM_TOT") or 0), "mem_avail_mb": int(e.get("WD_MEM_AVL") or 0)},
  "watchdog": {"restarts": int(e.get("WD_RESTARTS") or 0), "last_action": e.get("WD_LAST_ACTION") or "",
               "miner_streak": int(e.get("WD_MINER_STREAK") or 0),
               "srb_streak": int(e.get("WD_SRB_STREAK") or 0)},
}))
PYEOF
) || PAYLOAD=""

SENT="no-payload"
if [ -n "$PAYLOAD" ]; then
  set -a; [ -f "$ENV_FILE" ] && . "$ENV_FILE"; set +a
  if [ -n "${ZION_DASHBOARD_USER:-}" ] && [ -n "${ZION_DASHBOARD_PASS:-}" ]; then
    RESP=$(curl -s -m 8 -o /dev/null -w '%{http_code}' -X POST "$EDGE_URL" \
      -u "${ZION_DASHBOARD_USER}:${ZION_DASHBOARD_PASS}" \
      -H 'Content-Type: application/json' -d "$PAYLOAD" 2>/dev/null || echo "curl-fail")
    SENT="edge=$RESP"
  else
    SENT="no-creds"
  fi
fi

log "status=$RIG_STATUS agent=${AGENT_PID:-none} miner=${MINER_PID:-none} srb=${SRB_PID:-none} zm=${ZM_HPS}H/s qtu=${SRB_MHS}MH/s beacon=$SENT"
