#!/usr/bin/env bash
# Kompletní stress test poolu + měření na primárním zion-v3 a uložení reportu na server.
#
# Počítá s tím, že:
#   - na tvém počítači máš sestavený `zion-miner` (cargo build -p zion-miner --release)
#   - SSH alias `zion-v3-primary` → 204.168.245.175 (nebo nastav STRESS_SSH_HOST)
#   - na poolu je pro >10 workerů z jedné IP: ZION_MAX_SESSIONS_PER_IP=0
#     (overlay /opt/zion/V3/docker/docker-compose.stress-unlimited-ip.yml)
#
# Použití (z kořene git repozitáře):
#   ./V3/scripts/stress-mainnet-zionv3-report.sh 120 120
#   ./V3/scripts/stress-mainnet-zionv3-report.sh 120 120   → 120 workerů, 120 s běh
#
# Env:
#   STRESS_SSH_HOST=zion-v3-primary
#   STRESS_POOL_EXTERNAL=204.168.245.175:8444
#   STRESS_WALLET=zion1...
#   STRESS_SKIP_STRESS=1  — jen snapshot + report (bez minérů)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V3_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COUNT="${1:?počet workerů, např. 120}"
DURATION="${2:-120}"
SSH_HOST="${STRESS_SSH_HOST:-zion-v3-primary}"
POOL_EXTERNAL="${STRESS_POOL_EXTERNAL:-204.168.245.175:8444}"
REMOTE_STRESS_LOG_DIR="${STRESS_REMOTE_LOG_DIR:-/opt/zion/V3/logs/stress}"
MINERS_SCRIPT="$SCRIPT_DIR/stress-pool-miners.sh"
REPORT_ID="$(date -u +%Y%m%d_%H%M%SZ)"
WORKDIR="${TMPDIR:-/tmp}/zion-stress-report-$REPORT_ID"
LOCAL_REPORT_MD="$WORKDIR/report.md"

run_ssh() {
  ssh -o BatchMode=yes -o ConnectTimeout=20 "$SSH_HOST" "$@"
}

rpc_chain() {
  run_ssh 'curl -sS -m 15 -X POST http://127.0.0.1:8443/ -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"getChainInfo\",\"params\":[],\"id\":1}"'
}

snapshot_pool_env() {
  run_ssh 'docker inspect zion-v3-pool --format "{{range .Config.Env}}{{println .}}{{end}}" 2>/dev/null | grep -E "MAX_SESSIONS|POOL_BIND|NODE_RPC" || true'
}

pool_logs_since() {
  local since="$1"
  run_ssh "docker logs zion-v3-pool --since \"$since\" 2>&1" || true
}

docker_stats() {
  run_ssh 'docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" zion-v3-node zion-v3-pool 2>/dev/null || docker stats --no-stream'
}

mkdir -p "$WORKDIR"

[[ -x "$MINERS_SCRIPT" ]] || chmod +x "$MINERS_SCRIPT"

echo "SSH: $SSH_HOST | pool $POOL_EXTERNAL | workers=$COUNT | duration=${DURATION}s | window id=$REPORT_ID" >&2

if ! ssh -o BatchMode=yes -o ConnectTimeout=12 "$SSH_HOST" 'hostname' >/dev/null 2>&1; then
  echo "Nepodařilo se SSH na $SSH_HOST (nastav STRESS_SSH_HOST nebo ~/.ssh/config)." >&2
  exit 1
fi

T0_ISO="$(run_ssh 'date -u +%Y-%m-%dT%H:%M:%SZ')"
echo "čas začátku měření (UTC): $T0_ISO" >&2

CHAIN_BEFORE="$(rpc_chain | tee "$WORKDIR/chain-before.json")"
POOL_ENV_BEFORE="$(snapshot_pool_env | tee "$WORKDIR/pool-env.txt")"

if [[ "${STRESS_SKIP_STRESS:-0}" != "1" ]]; then
  echo "start mineru ..." >&2
  bash "$MINERS_SCRIPT" start "$COUNT" "$POOL_EXTERNAL"
  echo "bezi ${DURATION}s ..." >&2
  sleep "$DURATION"
  STOP_OUT="$(bash "$MINERS_SCRIPT" stop 2>&1 | tee "$WORKDIR/stop-miners.log")"
else
  echo "STRESS_SKIP_STRESS=1 — minery se nespouštějí" | tee "$WORKDIR/stop-miners.log"
fi

T1_ISO="$(run_ssh 'date -u +%Y-%m-%dT%H:%M:%SZ')"
CHAIN_AFTER="$(rpc_chain | tee "$WORKDIR/chain-after.json")"
STATS_END="$(docker_stats | tee "$WORKDIR/docker-stats-end.txt")"

echo "stahuji log poolu od ${T0_ISO} ..." >&2
pool_logs_since "$T0_ISO" >"$WORKDIR/pool-logs-slice.log"

# Statistiky z řezu logu
SLICE="$WORKDIR/pool-logs-slice.log"
count_match() {
  local pat="$1"
  if [[ -f "$SLICE" ]]; then
    grep -c "$pat" "$SLICE" 2>/dev/null || echo 0
  else
    echo 0
  fi
}

C_SESSION="$(count_match 'session_start')"
C_HELLO="$(count_match 'wire_hello=')"
C_ACCEPT="$(count_match 'share_status=Accepted')"
C_REJECT_LIMIT="$(count_match 'rate_limit_reject')"

tip_before="$(python3 -c "import json;print(json.load(open('$WORKDIR/chain-before.json'))['result']['tip_hash'])" 2>/dev/null || echo "?")"
height_before="$(python3 -c "import json;print(json.load(open('$WORKDIR/chain-before.json'))['result']['chain_height'])" 2>/dev/null || echo "?")"
tip_after="$(python3 -c "import json;print(json.load(open('$WORKDIR/chain-after.json'))['result']['tip_hash'])" 2>/dev/null || echo "?")"
height_after="$(python3 -c "import json;print(json.load(open('$WORKDIR/chain-after.json'))['result']['chain_height'])" 2>/dev/null || echo "?")"

HOSTNAME_REM="$(run_ssh 'hostname' 2>/dev/null || echo unknown)"

cat >"$LOCAL_REPORT_MD" <<EOF
# ZION V3 — stress test poolu (report)

| Pole | Hodnota |
|------|---------|
| Čas (UTC) | $REPORT_ID |
| SSH host | \`$SSH_HOST\` |
| Hostname serveru | \`$HOSTNAME_REM\` |
| Pool (externí) | \`$POOL_EXTERNAL\` |
| Počet workerů | $COUNT |
| Délka běhu (s) | $DURATION |
| Okno logu poolu | od \`$T0_ISO\` (docker \`--since\`) |

## Řetězec (JSON-RPC getChainInfo)

| | Před | Po |
|---|------|-----|
| height | $height_before | $height_after |
| tip (prefix) | \`${tip_before:0:16}…\` | \`${tip_after:0:16}…\` |

## Pool — proměnné (výběr)

\`\`\`
$(cat "$WORKDIR/pool-env.txt")
\`\`\`

## Počty v řezu logu poolu

| Metrika | Počet |
|---------|------|
| \`session_start\` | $C_SESSION |
| \`wire_hello=\` | $C_HELLO |
| \`share_status=Accepted\` | $C_ACCEPT |
| \`rate_limit_reject\` | $C_REJECT_LIMIT |

## Docker stats (konec běhu)

\`\`\`
$(cat "$WORKDIR/docker-stats-end.txt")
\`\`\`

## Tail logu poolu (posledních 80 řádků z řezu)

\`\`\`
$(tail -80 "$SLICE" 2>/dev/null || echo "(žádný log)")
\`\`\`

## Artefakty (lokálně)

- Adresář: \`$WORKDIR\`
- Kompletní řez logu: \`pool-logs-slice.log\`

---
*Generováno skriptem \`V3/scripts/stress-mainnet-zionv3-report.sh\`.*
EOF

echo "nahravam report na server $SSH_HOST:${REMOTE_STRESS_LOG_DIR} ..." >&2
run_ssh "mkdir -p \"$REMOTE_STRESS_LOG_DIR\""
scp -o BatchMode=yes "$LOCAL_REPORT_MD" "$SSH_HOST:$REMOTE_STRESS_LOG_DIR/report-$REPORT_ID.md"
scp -o BatchMode=yes "$SLICE" "$SSH_HOST:$REMOTE_STRESS_LOG_DIR/pool-logs-$REPORT_ID.log" 2>/dev/null || true

echo "" >&2
echo "Hotovo. Report na serveru: $REMOTE_STRESS_LOG_DIR/report-$REPORT_ID.md" >&2
echo "Lokální kopie: $LOCAL_REPORT_MD" >&2
if [[ "${STRESS_PRINT_REPORT:-0}" == "1" ]]; then
  cat "$LOCAL_REPORT_MD"
fi
