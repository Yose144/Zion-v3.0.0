#!/usr/bin/env bash
# pool-promote-guard.sh — fencing pro pool HA promote (W2.2 / G11).
#
# Proč: standby promote je dnes jen „lidská disciplína" v runbooku. Když se
# provede, zatímco primár jen zpomalil (wedged API, přetížený disk), platí dvě
# pooly ze stejné peněženky → dvojí výplata a payout historii nelze vrátit.
# Tenhle skript dělá z runbooku §4 **vynutitelnou** podmínku:
#
#   G1 primár prokazatelně mrtvý  — unit inactive AND žádný `zion-pool` proces
#   G2 auto-restart primáru pryč  — `zion-v31-watchdog.timer` inactive
#   G3 stratum primáru zavřený    — TCP EDGE:8444 neodpovídá
#   G4 parita doložená            — dr-parity-check.sh bez FAIL
#   G5 žádný jiný promote běží    — single-flight token (O_EXCL, TTL)
#   G6 cooldown                   — od minulého pokusu ≥ N sekund
#
# Degradace NENÍ smrt: pomalé API nebo wedged proces se řeší restarten na
# primáru, nikdy promote. Guard to odmítne (G1 selže, pokud proces/unit žije).
#
# Režimy:
#   --check      jen vyhodnoť (exit 0 = promote povolen, 1 = blokován)
#   --promote    vyhodnoť + při úspěchu zapiš fencing token a vypiš postup
#                (§6 runbooku). Nic sám nepřepíná.
#   --status     token, cooldown, poslední auditní záznamy
#   --release    zruš token (po dokončeném / odvolaném promotu)
#   --quiet      pro alerty: jen jeden řádek verdiktu
#
# Testy: infra/tools/pool-ha/test-promote-guard.sh (stubované příkazy).
# Záměrně bez asociativních polí — běží i na macOS bash 3.2 (vývoj/test).
set -uo pipefail

ENV_FILE="${ZION_POOL_HA_ENV:-/etc/zion/pool-standby.env}"
STATE_DIR="${ZION_POOL_HA_STATE_DIR:-/var/lib/zion-pool-ha}"
TOKEN="$STATE_DIR/promote.token"
LAST_ATTEMPT="$STATE_DIR/promote.last"
AUDIT="$STATE_DIR/promote-audit.jsonl"
TOKEN_TTL="${ZION_PROMOTE_TOKEN_TTL_S:-900}"
COOLDOWN="${ZION_PROMOTE_COOLDOWN_S:-600}"
EDGE_HOST="${ZION_POOL_EDGE_HOST:-62.171.141.136}"
STRATUM_PORT="${ZION_POOL_EDGE_STRATUM_PORT:-8444}"
PARITY_SCRIPT="${ZION_DR_PARITY_SCRIPT:-/opt/zion/scripts/dr-parity-check.sh}"
PRIMARY_SSH="${ZION_POOL_HA_SSH:-ssh -p 2222 -o BatchMode=yes -o ConnectTimeout=6 -o StrictHostKeyChecking=accept-new root@${EDGE_HOST}}"
# Preferovaná cesta: read-only sonda primáru (forced command, žádný shell).
# Když je nastavená, guard udělá JEDEN dotaz místo tří a parsuje
# `unit=… proc=… timer=…`. Nastavuje se v /etc/zion/pool-standby.env.
PROBE_CMD="${ZION_POOL_HA_PROBE_CMD:-}"
# Kam má token dorazit, aby o něm věděl i standby (např. root@207.180.217.100).
# Guard je autoritativní tam, odkud operátor promote dělá (vidí primár i standby
# a umí spustit paritu); token se ale ukládá i na standby, aby G5 (single-flight)
# platil oboustranně. Prázdné = jen lokálně.
TOKEN_SYNC="${ZION_PROMOTE_TOKEN_SYNC:-}"
TOKEN_REMOTE_PATH="${ZION_PROMOTE_TOKEN_REMOTE_PATH:-/var/lib/zion-pool-ha/promote.token}"
MODE="check"; QUIET=0

while [ $# -gt 0 ]; do
  case "$1" in
    --check) MODE="check"; shift ;;
    --promote) MODE="promote"; shift ;;
    --status) MODE="status"; shift ;;
    --release) MODE="release"; shift ;;
    --quiet) QUIET=1; shift ;;
    -h|--help) sed -n '2,27p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "pool-promote-guard: unknown arg $1" >&2; exit 2 ;;
  esac
done

mkdir -p "$STATE_DIR" 2>/dev/null || true
chmod 700 "$STATE_DIR" 2>/dev/null || true

if [ -r "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE" 2>/dev/null || true
  EDGE_HOST="${ZION_POOL_EDGE_HOST:-$EDGE_HOST}"
  STRATUM_PORT="${ZION_POOL_EDGE_STRATUM_PORT:-$STRATUM_PORT}"
fi

ACTOR="${SUDO_USER:-${USER:-unknown}}@$(hostname -s 2>/dev/null || echo host)"
NOW="$(date +%s)"

# portable timeout: coreutils `timeout` chybí na macOS, tam běží testy
_tmo() { # _tmo <secs> <cmd...>
  local secs="$1"; shift
  if command -v timeout >/dev/null 2>&1; then timeout "$secs" "$@"; else "$@"; fi
}

tg() { [ -n "${ZION_TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${ZION_TELEGRAM_CHAT_ID:-}" ] || return 0
  curl --silent --max-time 15 "https://api.telegram.org/bot${ZION_TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d chat_id="$ZION_TELEGRAM_CHAT_ID" --data-urlencode "text=$1" >/dev/null || true; }

audit() { # audit <verdict> <detail>
  printf '{"ts":"%s","epoch":%s,"actor":"%s","mode":"%s","verdict":"%s","detail":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$NOW" "$ACTOR" "$MODE" "$1" \
    "$(printf '%s' "${2:-}" | tr -d '"\\')" >> "$AUDIT" 2>/dev/null || true
  chmod 600 "$AUDIT" 2>/dev/null || true
}

# ── guards (portable: G1..G6 + D1..D6) ─────────────────────────────────────
# Jedno čtení stavu primáru, ať už přes omezenou sondu nebo přes ssh.
P_UNIT=""; P_PROC=""; P_TIMER=""; P_ERR=""
primary_probe() {
  local out
  if [ -n "$PROBE_CMD" ]; then
    out="$($PROBE_CMD 2>/dev/null || true)"
    P_UNIT="$(printf '%s' "$out" | sed -n 's/^unit=//p' | head -1)"
    P_PROC="$(printf '%s' "$out" | sed -n 's/^proc=//p' | head -1)"
    P_TIMER="$(printf '%s' "$out" | sed -n 's/^timer=//p' | head -1)"
    [ -n "$P_UNIT" ] || P_ERR="sonda primáru neodpověděla"
  else
    P_UNIT="$($PRIMARY_SSH "systemctl is-active zion-v31-pool 2>/dev/null || true" 2>/dev/null | tr -d '[:space:]')"
    local proc; proc="$($PRIMARY_SSH "pgrep -af 'zion-pool' 2>/dev/null || true" 2>/dev/null | head -1)"
    P_PROC="$([ -n "$proc" ] && echo 1 || echo 0)"
    P_TIMER="$($PRIMARY_SSH "systemctl is-active zion-v31-watchdog.timer 2>/dev/null || true" 2>/dev/null | tr -d '[:space:]')"
  fi
}

G1=fail D1=""
g1_primary_dead() {
  if [ -n "$P_ERR" ] || [ -z "$P_UNIT" ]; then
    G1=fail; D1="${P_ERR:-primár nedosažitelný (SSH)} — smrt nelze prokázat"; return
  fi
  if [ "$P_UNIT" = "active" ]; then
    G1=fail; D1="unit active → primár ŽIJE (degradace není smrt, restartuj ho)"
  elif [ "${P_PROC:-0}" = "1" ]; then
    G1=fail; D1="proces zion-pool stále běží, i když unit=$P_UNIT"
  else
    G1=ok; D1="unit=$P_UNIT, žádný proces"
  fi
}

G2=fail D2=""
g2_no_autorestart() {
  local timer="${P_TIMER:-}"
  if [ "$timer" = "active" ]; then
    G2=fail; D2="zion-v31-watchdog.timer je active → vzkřísil by pool"
  elif [ -z "$timer" ]; then
    G2=fail; D2="stav timeru neznámý (sonda/SSH)"
  else
    G2=ok; D2="timer=$timer"
  fi
}

G3=fail D3=""
g3_stratum_closed() {
  if _tmo 6 bash -c "exec 3<>/dev/tcp/${EDGE_HOST}/${STRATUM_PORT} && exec 3>&-" 2>/dev/null; then
    G3=fail; D3="stratum ${EDGE_HOST}:${STRATUM_PORT} ODPOVÍDÁ → minery by pendlovaly"
  else
    G3=ok; D3="stratum ${EDGE_HOST}:${STRATUM_PORT} zavřený"
  fi
}

G4=fail D4=""
g4_parity() {
  local out
  if [ ! -r "$PARITY_SCRIPT" ]; then
    G4=fail; D4="parity skript nenalezen ($PARITY_SCRIPT)"; return
  fi
  out="$(_tmo 180 bash "$PARITY_SCRIPT" --only data 2>&1 || true)"
  if printf '%s' "$out" | grep -q "FAIL"; then
    G4=fail; D4="parita má FAIL ($(printf '%s' "$out" | grep -m1 FAIL | cut -c1-60))"
  else
    G4=ok; D4="parita bez FAIL"
  fi
}

G5=fail D5=""
g5_no_active_token() {
  local ts exp
  if [ -f "$TOKEN" ]; then
    ts="$(sed -n 's/.*"epoch":\([0-9]*\).*/\1/p' "$TOKEN" 2>/dev/null | head -1)"
    case "$ts" in ''|*[!0-9]*) ts=0 ;; esac
    exp=$(( ts + TOKEN_TTL ))
    if [ "$NOW" -lt "$exp" ]; then
      G5=fail; D5="aktivní token z epoch ${ts} (zbývá $((exp-NOW))s) — promote už běží"
      return
    fi
    G5=ok; D5="expirovaný token (neškodí)"
  else
    G5=ok; D5="žádný token"
  fi
}

G6=fail D6=""
g6_cooldown() {
  local last
  last="$(cat "$LAST_ATTEMPT" 2>/dev/null || echo 0)"
  case "$last" in ''|*[!0-9]*) last=0 ;; esac
  if [ "$last" -gt 0 ] && [ $((NOW - last)) -lt "$COOLDOWN" ]; then
    G6=fail; D6="cooldown: od minulého pokusu $((NOW-last))s < ${COOLDOWN}s"
  else
    G6=ok; D6="cooldown ok"
  fi
}

run_guards() { primary_probe; g1_primary_dead; g2_no_autorestart; g3_stratum_closed; g4_parity; g5_no_active_token; g6_cooldown; }

verdict_ok() { [ "$G1" = ok ] && [ "$G2" = ok ] && [ "$G3" = ok ] && [ "$G4" = ok ] && [ "$G5" = ok ] && [ "$G6" = ok ]; }

summary() {
  printf ' G1%s G2%s G3%s G4%s G5%s G6%s' \
    "$([ "$G1" = ok ] && echo ✓ || echo ✗)" "$([ "$G2" = ok ] && echo ✓ || echo ✗)" \
    "$([ "$G3" = ok ] && echo ✓ || echo ✗)" "$([ "$G4" = ok ] && echo ✓ || echo ✗)" \
    "$([ "$G5" = ok ] && echo ✓ || echo ✗)" "$([ "$G6" = ok ] && echo ✓ || echo ✗)"
}

print_details() {
  printf '  %s G1 %s\n  %s G2 %s\n  %s G3 %s\n  %s G4 %s\n  %s G5 %s\n  %s G6 %s\n' \
    "$([ "$G1" = ok ] && echo ✓ || echo ✗)" "$D1" \
    "$([ "$G2" = ok ] && echo ✓ || echo ✗)" "$D2" \
    "$([ "$G3" = ok ] && echo ✓ || echo ✗)" "$D3" \
    "$([ "$G4" = ok ] && echo ✓ || echo ✗)" "$D4" \
    "$([ "$G5" = ok ] && echo ✓ || echo ✗)" "$D5" \
    "$([ "$G6" = ok ] && echo ✓ || echo ✗)" "$D6"
}

# ── režimy ─────────────────────────────────────────────────────────────────
case "$MODE" in
  check|promote)
    run_guards
    if verdict_ok; then
      if [ "$QUIET" = 1 ]; then echo "ALLOWED$(summary)"; else
        echo "pool-promote-guard: promote POVOLEN$(summary)"
        print_details
      fi
      audit "allowed" "$(summary)"
      if [ "$MODE" = check ]; then exit 0; fi

      # single-flight: O_EXCL zápis, dva souběžné prompty nemůžou projít oba
      if ! ( set -C; printf '{"epoch":%s,"actor":"%s","host":"%s","ttl":%s}\n' \
              "$NOW" "$ACTOR" "$(hostname -s 2>/dev/null || echo host)" "$TOKEN_TTL" > "$TOKEN" ) 2>/dev/null; then
        echo "pool-promote-guard: token se nepodařilo zapsat (souběh?) — STOP" >&2
        audit "blocked" "token create race"
        exit 1
      fi
      chmod 600 "$TOKEN" 2>/dev/null || true
      printf '%s\n' "$NOW" > "$LAST_ATTEMPT"; chmod 600 "$LAST_ATTEMPT" 2>/dev/null || true
      if [ -n "$TOKEN_SYNC" ]; then
        if ssh -o BatchMode=yes -o ConnectTimeout=8 "$TOKEN_SYNC" \
             "install -d -m 700 \$(dirname "$TOKEN_REMOTE_PATH") && cat > "$TOKEN_REMOTE_PATH" && chmod 600 "$TOKEN_REMOTE_PATH"" < "$TOKEN" 2>/dev/null; then
          D_TOKEN="token synchronizován na $TOKEN_SYNC:$TOKEN_REMOTE_PATH"
        else
          D_TOKEN="POZOR: token se nepodařilo synchronizovat na $TOKEN_SYNC (promote na standby nebude autorizovaný)"
        fi
      else
        D_TOKEN="token jen lokálně (ZION_PROMOTE_TOKEN_SYNC není nastaven)"
      fi
      printf '  %s\n' "$D_TOKEN"
      audit "token-issued" "ttl=${TOKEN_TTL}s"
      tg "ZION POOL HA: promote POVOLEN ($ACTOR), token na ${TOKEN_TTL}s.$(summary)"
      cat <<EOF

Fencing token: $TOKEN  (platnost ${TOKEN_TTL}s)

Postup (DR-BRINGUP-RUNBOOK §6) — skript sám nic nepřepíná:
  1. ssh zion-v6 'systemctl stop zion-v31-watchdog.timer'   # kontrola, má být inactive
  2. ssh zion-v6 'systemctl stop zion-v31-pool'             # drain
  3. ssh zion-v6 'systemctl is-active zion-v31-pool'        # MUSÍ být inactive
  4. bash $(basename "$PARITY_SCRIPT")                      # bez FAIL
  5. otevři stratum na standby (B5) + přepni pool API
  6. systemctl start zion-pool-standby                      # EDGE2
  7. po ověření: $0 --release
EOF
      exit 0
    else
      if [ "$QUIET" = 1 ]; then echo "BLOCKED$(summary)"; else
        echo "pool-promote-guard: promote BLOKOVÁN$(summary)"
        print_details
      fi
      audit "blocked" "$(summary)"
      exit 1
    fi
    ;;

  status)
    echo "pool-promote-guard status"
    echo "  host     : $(hostname -s 2>/dev/null)   actor: $ACTOR"
    if [ -f "$TOKEN" ]; then
      ts="$(sed -n 's/.*"epoch":\([0-9]*\).*/\1/p' "$TOKEN" | head -1)"; case "$ts" in ''|*[!0-9]*) ts=0 ;; esac
      echo "  token    : AKTIVNÍ (epoch ${ts}, zbývá $(( ts + TOKEN_TTL - NOW ))s)  $TOKEN"
    else
      echo "  token    : žádný"
    fi
    if [ -f "$LAST_ATTEMPT" ]; then echo "  cooldown : poslední pokus $(cat "$LAST_ATTEMPT")"; else echo "  cooldown : žádný pokus"; fi
    echo "  audit    : $AUDIT"
    [ -f "$AUDIT" ] && tail -5 "$AUDIT"
    exit 0
    ;;

  release)
    if [ -f "$TOKEN" ]; then
      rm -f "$TOKEN"
      if [ -n "$TOKEN_SYNC" ]; then
        ssh -o BatchMode=yes -o ConnectTimeout=8 "$TOKEN_SYNC" "rm -f "$TOKEN_REMOTE_PATH"" 2>/dev/null || true
      fi
      echo "pool-promote-guard: token zrušen"; audit "released" "token removed"; exit 0
    fi
    echo "pool-promote-guard: žádný token k zrušení"; exit 0
    ;;
esac
