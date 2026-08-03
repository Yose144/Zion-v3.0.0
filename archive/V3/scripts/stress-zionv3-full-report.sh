#!/usr/bin/env bash
#
# Kompletní stress test poolu primárního Zion V3 + report (ČJ) uložený na serveru i lokálně.
#
# Bere se:
#   - SSH alias `zion-v3-primary` (204.168.245.175) podle ~/.ssh/config
#   - Lokálně sestavený `zion-miner` (release)
#   - Pool musí povolit >10 TCP z jedné IP: na serveru soubor
#       /opt/zion/V3/docker/docker-compose.stress-unlimited-ip.yml
#     s prostředím ZION_MAX_SESSIONS_PER_IP=0 a:
#       docker compose -f docker-compose.v3-mainnet.yml \\
#                      -f docker-compose.stress-unlimited-ip.yml up -d pool
#
# Použití (z kořene monorepa nebo kdekoliv — skript pozná V3/scripts):
#   ./V3/scripts/stress-zionv3-full-report.sh
#   COUNT=120 DURATION_SEC=180 ./V3/scripts/stress-zionv3-full-report.sh
#
# Proměnné:
#   SSH_HOST        výchozí zion-v3-primary
#   POOL_EXTERNAL   výchozí 204.168.245.175:8444  (miner z notebooku přes WAN)
#   COUNT           počet paralelních zion-miner procesů na tomto počítači
#   DURATION_SEC    délka zátěže v sekundách
#   STRESS_WALLET / STRESS_THREADS / STRESS_BACKEND — předávají se do stress-pool-miners.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH_HOST="${SSH_HOST:-zion-v3-primary}"
POOL_EXTERNAL="${POOL_EXTERNAL:-204.168.245.175:8444}"
COUNT="${COUNT:-100}"
DURATION_SEC="${DURATION_SEC:-120}"
REMOTE_STRESS_LOG_DIR="${REMOTE_STRESS_LOG_DIR:-/opt/zion/V3/logs/stress}"

TS="$(date -u +%Y%m%d_%H%M%SZ)"
HOSTNAME_LOCAL="$(hostname 2>/dev/null || echo unknown)"

ssh_batch() {
  ssh -o BatchMode=yes "$SSH_HOST" "$@"
}

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "chybí příkaz: $1" >&2
    exit 1
  }
}

require ssh
require scp
require curl

stress_ctl() {
  # shellcheck disable=SC2090
  STRESS_WALLET="${STRESS_WALLET:-}" \
    STRESS_THREADS="${STRESS_THREADS:-}" \
    STRESS_BACKEND="${STRESS_BACKEND:-}" \
    "${SCRIPT_DIR}/stress-pool-miners.sh" "$@"
}

rpc_chain() {
  ssh_batch curl -sS -m 15 -X POST "http://127.0.0.1:8443/" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}'
}

pool_sessions_env() {
  ssh_batch bash -lc "docker inspect zion-v3-pool 2>/dev/null | tr ',' '\n' | grep -o 'ZION_MAX_SESSIONS_PER_IP=[^\\\"]*' | head -1" || echo "docker_inspect_failed"
}

docker_pool_slice() {
  local since="$1"
  local out="$2"
  ssh_batch "docker logs zion-v3-pool --since \"$since\" 2>&1" >"$out" || true
}

grep_count_safe() {
  local f="$1"
  local pat="$2"
  grep -ch "$pat" "$f" 2>/dev/null || echo "0"
}

echo ">>> příprava: SSH=$SSH_HOST pool=$POOL_EXTERNAL workers=$COUNT trvání=${DURATION_SEC}s …" >&2
ssh_batch "mkdir -p '$REMOTE_STRESS_LOG_DIR'"
T0="$(ssh_batch 'date -u -d "-10 seconds" +%Y-%m-%dT%H:%M:%SZ')" # záběr logů před startem
echo ">>> okno pool logů --since=$T0" >&2

POOL_ENV_BEFORE="$(pool_sessions_env)"
CHAIN_BEFORE="$(rpc_chain || echo "{}")"

TMPDIR_ROOT="${TMPDIR:-/tmp}/zionv3-stress_${TS}_$$"
mkdir -p "$TMPDIR_ROOT"
POOL_SLICE="$TMPDIR_ROOT/pool_since_T0.txt"
STATS_BEFORE="$TMPDIR_ROOT/docker_stats_before.txt"
STATS_AFTER="$TMPDIR_ROOT/docker_stats_after.txt"
LOCAL_REPORT="$TMPDIR_ROOT/report_${TS}.md"
REMOTE_REPORT="${REMOTE_STRESS_LOG_DIR}/report_${TS}.md"

echo ">>> snapshot výchozích metrik …" >&2
ssh_batch "docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}' "'"'"\$(docker ps -q)"'"'"" >"$STATS_BEFORE" 2>&1 || true

echo ">>> start lokálních minerů …" >&2
stress_ctl start "$COUNT" "$POOL_EXTERNAL"

echo ">>> běh zátěže ${DURATION_SEC}s …" >&2
sleep "$DURATION_SEC"

echo ">>> stop lokálních minerů …" >&2
stress_ctl stop

sleep 8
CHAIN_AFTER="$(rpc_chain || echo "{}")"
ssh_batch "docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'" >"$STATS_AFTER" 2>&1 || true

echo ">>> stahuji výřez docker logs pool …" >&2
docker_pool_slice "$T0" "$POOL_SLICE"

sess_starts="$(grep_count_safe "$POOL_SLICE" 'session_start')"
rej_ip="$(grep_count_safe "$POOL_SLICE" 'rate_limit_reject')"
accepted_line="$(grep_count_safe "$POOL_SLICE" 'accepted')"
share_acc="$(grep_count_safe "$POOL_SLICE" 'share_status=Accepted')"
wire_res_ok="$(grep_count_safe "$POOL_SLICE" '"accepted":true')"
bytes_slice="$(wc -c <"$POOL_SLICE" | tr -d ' ')"
peer_before="$(rpc_peers)"
peer_before="${peer_before:-{}}"
sleep 1 || true

# znovu přečíst po zátěži (nadřazeno pod stop + sleep níže už je CHAIN_AFTER — peers přidej před závěrem)
true

{
  cat <<EOF
# ZION V3 — stress test poolu + report

**Čas (UTC):** \`${TS}\`  
**Řídicí stroj:** \`${HOSTNAME_LOCAL}\`  
**Cílový SSH host:** \`${SSH_HOST}\`  
**Pool (externí adresa pro minery):** \`${POOL_EXTERNAL}\`  
**Počet lokálních workerů:** **${COUNT}**  
**Délka zátěže:** **${DURATION_SEC} s**  
**Okno pool logů:** \`docker logs --since ${T0}\`

## Předpoklady

- Na pool kontejneru musí být \`ZION_MAX_SESSIONS_PER_IP=0\` (nebo ≥ počet spojení z jedné WAN IP), jinak \`rate_limit_reject\`.
- Detekovaná proměnná z \`docker inspect\` (řetězec): \`${POOL_ENV_BEFORE}\`

## Stav řetězce (JSON-RPC getChainInfo)

### Před zátěží

\`\`\`json
${CHAIN_BEFORE}
\`\`\`

### Po zátěži

\`\`\`json
${CHAIN_AFTER}
\`\`\`

## Docker stats

### Před (částečně)

\`\`\`
$(head -20 "$STATS_BEFORE" 2>/dev/null || echo "(neuloženo)")
\`\`\`

### Po

\`\`\`
$(head -20 "$STATS_AFTER" 2>/dev/null || echo "(neuloženo)")
\`\`\`

## Agregace z výřezu logu \`zion-v3-pool\`

| Metrika | Hodnota |
|---------|--------:|
| Velikost výřezu (bajty) | ${bytes_slice} |
| \`session_start\` | ${sess_starts} |
| \`rate_limit_reject\` | ${rej_ip} |
| řádky s \`accepted\` | ${accepted_line} |
| \`share_status=Accepted\` | ${share_acc} |
| \`"accepted":true\` (wire) | ${wire_res_ok} |

## Jak zopakovat

\`\`\`bash
COUNT=120 DURATION_SEC=180 ./V3/scripts/stress-zionv3-full-report.sh
\`\`\`

## Příloha

Lokální kopie výřezu logu: \`$POOL_SLICE\` (necommitujte; může být velká).

EOF
} >"$LOCAL_REPORT"

echo ">>> nahrávám report na server: $REMOTE_REPORT …" >&2
scp "$LOCAL_REPORT" "${SSH_HOST}:${REMOTE_REPORT}"

echo ""
echo "Hotovo."
echo "  Lokální report:  $LOCAL_REPORT"
echo "  Na zion-v3:      $REMOTE_REPORT"
echo "  Log výřez pool:  $POOL_SLICE"
