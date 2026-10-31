#!/usr/bin/env bash
# dr-parity-check.sh — read-only parity gate for the ZION V31 pool DR pair.
#
# Compares EFFECTIVE runtime parameters of the live primary (EDGE) against the
# warm standby (EDGE2). Effective = CLI flag > unit Environment= > EnvironmentFile
# > binary default — i.e. exactly what the pool process would see, not what the
# env file happens to say. systemd `${VAR}` indirection in ExecStart is resolved
# as well (`--miner-address ${ZION_POOL_WALLET}`).
#
# Why: during the 2026-10-31 DR review the standby silently diverged from the
# primary (missing --miner-address, 1000x smaller PPLNS window, different payout
# key). A promote without this gate pays miners from the wrong wallet or splits
# the PPLNS window differently. See docs/3.2/ops/DR-BRINGUP-RUNBOOK.md.
#
# Safety:
#   * read-only — never starts/stops/edits anything;
#   * secret values are NEVER printed or transmitted, only their sha256;
#   * exactly ONE ssh connection per host per run (fail2ban-safe: the EDGE sshd
#     jails our operator IP when we open many short connections).
#
# Usage:
#   bash scripts/ops/dr-parity-check.sh                 # all checks
#   bash scripts/ops/dr-parity-check.sh --only secrets  # single section
#   sections: params | secrets | binary | data | network | all   (default all)
#
# Env overrides:
#   DR_PRIMARY_HOST (default zion-v6)    DR_STANDBY_HOST (default zion-edge2)
#   DR_PRIMARY_BIN  / DR_STANDBY_BIN     binary paths to compare
#
# Exit: 0 = no FAIL (WARN allowed), 1 = at least one FAIL, 2 = usage/transport.

set -uo pipefail

PRIMARY_HOST="${DR_PRIMARY_HOST:-zion-v6}"
STANDBY_HOST="${DR_STANDBY_HOST:-zion-edge2}"

PRIMARY_UNIT="zion-v31-pool"
STANDBY_UNIT="zion-pool-standby"
PRIMARY_ENV="/etc/zion/edge-environment.sh"
STANDBY_ENV="/etc/zion/pool-standby.env"

PRIMARY_BIN="${DR_PRIMARY_BIN:-/opt/zion/V31/target/release/zion-pool}"
STANDBY_BIN="${DR_STANDBY_BIN:-/opt/zion/bin/zion-pool-standby}"

PRIMARY_DB="/opt/zion/data/v31/pool-store.db"
STANDBY_DB="/opt/zion/data/v31-standby/pool-store.db"
STANDBY_DIR="/opt/zion/data/v31-standby"
ORPHAN_DIR="/opt/zion/data/v31-pool-standby"   # osiřelý push kanál z EDGE

NGINX_POOL_VHOST="/etc/nginx/sites-enabled/pool.zionterranova.com.conf"

ONLY="all"
while [ $# -gt 0 ]; do
    case "$1" in
        --only)   ONLY="${2:-all}"; shift 2 ;;
        --only=*) ONLY="${1#--only=}"; shift ;;
        -h|--help) sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "dr-parity-check: unknown argument: $1" >&2; exit 2 ;;
    esac
done
case "$ONLY" in
    all|params|secrets|binary|data|network) ;;
    *) echo "dr-parity-check: bad --only value: $ONLY" >&2; exit 2 ;;
esac

FAILS=0
WARNS=0

c_r=$'\033[31m'; c_g=$'\033[32m'; c_y=$'\033[33m'; c_b=$'\033[36m'; c_0=$'\033[0m'
[ -t 1 ] || { c_r=""; c_g=""; c_y=""; c_b=""; c_0=""; }

hdr()  { printf '\n%s== %s ==%s\n' "$c_b" "$*" "$c_0"; }
ok()   { printf '  %sPASS%s %s\n' "$c_g" "$c_0" "$*"; }
bad()  { printf '  %sFAIL%s %s\n' "$c_r" "$c_0" "$*"; FAILS=$((FAILS+1)); }
warn() { printf '  %sWARN%s %s\n' "$c_y" "$c_0" "$*"; WARNS=$((WARNS+1)); }
note() { printf '       %s\n' "$*"; }

# ---------------------------------------------------------------- collection --
# Keys whose VALUES are safe to read (non-secret). ZION_POOL_WALLET is not read by
# the binary itself — it exists so systemd can substitute ${ZION_POOL_WALLET}.
VALUE_KEYS='ZION_POOL_BIND|ZION_POOL_SOLO_PORT|ZION_POOL_API_BIND|ZION_L1_RPC_URL|ZION_POOL_MINER_ADDRESS|ZION_POOL_WALLET|ZION_POOL_FEE_BPS|ZION_PPLNS_WINDOW_SIZE|ZION_PAYOUT_INTERVAL_S|ZION_MIN_PAYOUT_FLOWERS|ZION_POOL_NATIVE_PAYOUT_COINS|ZION_POOL_MIN_PAYOUT_NATIVE|ZION_VARDIFF_[A-Z_]+|ZION_HUMANITARIAN_ADDRESS|ZION_ISSOBELLA_ADDRESS|ZION_POOL_FEE_ADDRESS|ZION_PPLNS_STATE_PATH|ZION_POOL_STORE_DB_PATH'
SECRET_KEYS='ZION_POOL_WALLET_KEY'

# Single ssh per host. Emits a pipe-separated record stream:
#   U|EXEC|<last ExecStart payload>
#   U|ENV|<key>|<value>        unit Environment= (wins over the env file)
#   U|SEC|<key>|<sha256>
#   F|ENV|<key>|<value>        EnvironmentFile
#   F|SEC|<key>|<sha256>
#   X|BIN|<bytes>|<date>|<sha16>
#   X|VER|<version line>
#   X|STAMP|<name>|<ts>|<iso>
#   X|ROWS|<n>      X|HEIGHT|<n>
#   X|MARKER|PRESENT|ABSENT
#   X|HAWATCH|<alert-only|suspicious>
#   X|EDGEWATCH|<restarts-pool|inert>
#   X|UFW8444|<anywhere|restricted>
#   X|NGINXPROXY|<port>
#   X|NODE|<is-enabled>/<is-active>
#   X|ORPHAN|<bytes>
gather() { # gather <host> <unit> <envfile> <binary> <db> <datadir>
    local host="$1" unit="$2" envfile="$3" bin="$4" db="$5" ddir="$6"
    ssh -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=10 \
        -o ControlMaster=auto -o ControlPath=/tmp/.dpc-%r@%h:%p -o ControlPersist=120 \
        "$host" \
        "UNIT='$unit' ENVF='$envfile' BIN='$bin' DB='$db' DDIR='$ddir' ORPH='$ORPHAN_DIR' VHOST='$NGINX_POOL_VHOST' VALUE_KEYS='$VALUE_KEYS' SECRET_KEYS='$SECRET_KEYS' bash -s" \
        <<'REMOTE' 2>/dev/null
set -u

emit_secret() { printf '%s|SEC|%s|%s\n' "$1" "$2" "$(printf '%s' "$3" | sha256sum | cut -d' ' -f1)"; }

# --- last ExecStart (drop-ins override earlier ones) ---
exec_line=$(systemctl cat "$UNIT" 2>/dev/null | grep -E '^ExecStart=' | tail -n1)
printf 'U|EXEC|%s\n' "${exec_line#ExecStart=}"

# --- unit Environment= (higher precedence than EnvironmentFile) ---
systemctl cat "$UNIT" 2>/dev/null | grep -E '^Environment=' | while IFS= read -r l; do
    l=${l#Environment=}
    l=${l%\"}; l=${l#\"}
    k=${l%%=*}; v=${l#*=}
    if [[ $k =~ ^($SECRET_KEYS)$ ]]; then emit_secret U "$k" "$v"
    elif [[ $k =~ ^($VALUE_KEYS)$ ]]; then printf 'U|ENV|%s|%s\n' "$k" "$v"
    fi
done

# --- EnvironmentFile ---
if [ -r "$ENVF" ]; then
    grep -E '^[A-Z_][A-Z0-9_]*=' "$ENVF" | while IFS= read -r l; do
        k=${l%%=*}; v=${l#*=}
        v=${v%\"}; v=${v#\"}
        if [[ $k =~ ^($SECRET_KEYS)$ ]]; then emit_secret F "$k" "$v"
        elif [[ $k =~ ^($VALUE_KEYS)$ ]]; then printf 'F|ENV|%s|%s\n' "$k" "$v"
        fi
    done
fi

# --- binary provenance ---
if [ -r "$BIN" ]; then
    bytes=$(stat -c %s "$BIN" 2>/dev/null)
    date=$(stat -c %y "$BIN" 2>/dev/null | cut -d. -f1)
    sha=$(sha256sum "$BIN" 2>/dev/null | cut -c1-16)
    printf 'X|BIN|%s|%s|%s\n' "${bytes:-?}" "${date:-?}" "${sha:-?}"
    printf 'X|VER|%s\n' "$("$BIN" --version 2>&1 | head -n1)"
fi

# --- replication stamps (standby data dir) ---
for f in "$DDIR"/.sync-state/*.stamp; do
    [ -r "$f" ] || continue
    ts=$(awk -F= '/^ts=/{print $2}' "$f" 2>/dev/null)
    iso=$(awk -F= '/^iso=/{print $2}' "$f" 2>/dev/null)
    printf 'X|STAMP|%s|%s|%s\n' "$(basename "$f" .stamp)" "${ts:-0}" "${iso:-?}"
done

# --- content lag (read-only sqlite) ---
if [ -r "$DB" ]; then
    rows=$(sqlite3 -readonly "file:$DB?mode=ro" 'select count(*) from payouts' 2>/dev/null)
    h=$(sqlite3 -readonly "file:$DB?mode=ro" 'select max(height) from blocks' 2>/dev/null)
    [ -n "${rows:-}" ] && printf 'X|ROWS|%s\n' "$rows"
    [ -n "${h:-}" ]    && printf 'X|HEIGHT|%s\n' "$h"
fi

# --- fencing + network guards ---
[ -e "$DDIR/ACTIVATED" ] && printf 'X|MARKER|PRESENT\n' || printf 'X|MARKER|ABSENT\n'

ha=/usr/local/sbin/pool-ha-watchdog.sh
if [ -r "$ha" ]; then
    if grep -qE 'systemctl +(start|restart) +zion-pool-standby' "$ha"; then
        printf 'X|HAWATCH|suspicious\n'
    else
        printf 'X|HAWATCH|alert-only\n'
    fi
fi

ew=/opt/zion/scripts/watchdog.sh
if [ -r "$ew" ] && grep -qE 'restart_service +"\$POOL_SERVICE"|restart_service "\$\{POOL_SERVICE\}"' "$ew"; then
    printf 'X|EDGEWATCH|restarts-pool\n'
elif [ -r "$ew" ]; then
    printf 'X|EDGEWATCH|inert\n'
fi

if command -v ufw >/dev/null 2>&1; then
    if ufw status 2>/dev/null | grep -E '^8444/tcp' | grep -q 'Anywhere'; then
        printf 'X|UFW8444|anywhere\n'
    else
        printf 'X|UFW8444|restricted\n'
    fi
fi

if [ -r "$VHOST" ]; then
    p=$(grep -hoE 'proxy_pass +http://127\.0\.0\.1:[0-9]+' "$VHOST" 2>/dev/null | grep -oE '[0-9]+$' | head -n1)
    printf 'X|NGINXPROXY|%s\n' "${p:-none}"
fi

if systemctl list-unit-files zion-v31-node.service >/dev/null 2>&1; then
    printf 'X|NODE|%s/%s\n' "$(systemctl is-enabled zion-v31-node 2>/dev/null || echo unknown)" \
                              "$(systemctl is-active zion-v31-node 2>/dev/null || echo unknown)"
fi

if [ -d "$ORPH" ]; then
    printf 'X|ORPHAN|%s\n' "$(du -sb "$ORPH" 2>/dev/null | awk '{print $1}')"
fi
REMOTE
}

# ------------------------------------------------------------------ parsing ---
rec() { # rec <raw> <prefix> ... -> matching records
    local raw="$1"; shift
    local pat="$1"
    printf '%s\n' "$raw" | grep -E "^$pat" 2>/dev/null
}
field() { # field <line> <n> — nth pipe field, 1-based
    printf '%s' "$1" | awk -F'|' -v n="$2" '{print $n}'
}

P_RAW="$(gather "$PRIMARY_HOST" "$PRIMARY_UNIT" "$PRIMARY_ENV" "$PRIMARY_BIN" "$PRIMARY_DB" "$STANDBY_DIR")"
S_RAW="$(gather "$STANDBY_HOST" "$STANDBY_UNIT" "$STANDBY_ENV" "$STANDBY_BIN" "$STANDBY_DB" "$STANDBY_DIR")"

if [ -z "$P_RAW" ] || [ -z "$S_RAW" ]; then
    echo "dr-parity-check: cannot read unit/env on $([ -z "$P_RAW" ] && echo "primary ($PRIMARY_HOST)" || echo "standby ($STANDBY_HOST)")" >&2
    echo "  hint: EDGE sshd fail2ban may have banned this IP. Wait ~10 min, or try DR_PRIMARY_HOST=zion-new (IPv4 path)." >&2
    exit 2
fi

# flags parsed from the effective ExecStart payload
F_RAW_P="$(rec "$P_RAW" 'U\|EXEC\|' | sed -E 's/^U\|EXEC\|//' | awk '
  { n=split($0,t," ")
    for(i=1;i<=n;i++){
      if(t[i] ~ /^--[a-z0-9-]+=/){ k=t[i]; sub(/=.*/,"",k); sub(/^--/,"",k); v=t[i]; sub(/^[^=]*=/,"",v); printf "F|FLAG|%s|%s\n", k, v }
      else if(t[i] ~ /^--[a-z0-9-]+$/ && (i+1)<=n && t[i+1] !~ /^--/){ k=t[i]; sub(/^--/,"",k); printf "F|FLAG|%s|%s\n", k, t[i+1] }
    } }')"
F_RAW_S="$(rec "$S_RAW" 'U\|EXEC\|' | sed -E 's/^U\|EXEC\|//' | awk '
  { n=split($0,t," ")
    for(i=1;i<=n;i++){
      if(t[i] ~ /^--[a-z0-9-]+=/){ k=t[i]; sub(/=.*/,"",k); sub(/^--/,"",k); v=t[i]; sub(/^[^=]*=/,"",v); printf "F|FLAG|%s|%s\n", k, v }
      else if(t[i] ~ /^--[a-z0-9-]+$/ && (i+1)<=n && t[i+1] !~ /^--/){ k=t[i]; sub(/^--/,"",k); printf "F|FLAG|%s|%s\n", k, t[i+1] }
    } }')"

# Every record is 4 fields: TYPE|SUBTYPE|KEY|VALUE (flags: F|FLAG|key|value).
val() { # val <raw> <type> <subtype> <key> -> last matching value
    printf '%s\n' "$1" | awk -F'|' -v t="$2" -v s="$3" -v k="$4" \
        '$1==t && $2==s && $3==k {v=$4; f=1} END{if(f)print v}'
}

resolve() { # resolve <raw> <value> — expand systemd-style ${VAR}
    local raw="$1" v="$2" k
    case "$v" in
        '${'*'}')
            k="${v#\$\{}"; k="${k%\}}"
            v="$(val "$raw" U ENV "$k")"
            [ -n "$v" ] || v="$(val "$raw" F ENV "$k")"
            ;;
    esac
    printf '%s' "$v"
}

effective() { # effective <raw> <flags> <flag> <envkey> <default>
    local raw="$1" flags="$2" flag="$3" envkey="$4" def="$5" v
    if [ -n "$flag" ]; then
        v="$(val "$flags" F FLAG "$flag")"
        [ -n "$v" ] && { resolve "$raw" "$v"; return; }
    fi
    v="$(val "$raw" U ENV "$envkey")"
    if [ -n "$v" ]; then resolve "$raw" "$v"; return; fi
    v="$(val "$raw" F ENV "$envkey")"
    if [ -n "$v" ]; then resolve "$raw" "$v"; return; fi
    printf '%s' "$def"
}

secret_sha() { # secret_sha <raw> <key> — unit Environment= wins over env file
    local raw="$1" k="$2" v
    v="$(val "$raw" U SEC "$k")"
    [ -n "$v" ] || v="$(val "$raw" F SEC "$k")"
    printf '%s' "$v"
}

xrec() { # xrec <raw> <name> -> record payload minus "X|NAME|"
    rec "$1" "X\\|$2\\|" | sed -E "s/^X\\|$2\\|//" | tail -n1
}

cmp_param() { # cmp_param <label> <primary> <standby> <blocking:1|0>
    local label="$1" p="$2" s="$3" blocking="${4:-1}"
    if [ "$p" = "$s" ]; then
        ok "$label = $p"
    elif [ "$blocking" = "1" ]; then
        bad "$label: primary='$p' standby='$s'"
    else
        warn "$label: primary='$p' standby='$s' (intentional divergence?)"
    fi
}

printf '%s\ndr-parity-check  primary=%s  standby=%s  only=%s\n%s\n' \
    "$c_b" "$PRIMARY_HOST" "$STANDBY_HOST" "$ONLY" "$c_0"

# ------------------------------------------------------------------- params ---
if [ "$ONLY" = "all" ] || [ "$ONLY" = "params" ]; then
    hdr "Effective runtime parameters (flag > unit env > env file > default)"

    # defaults mirror V31/L1/pool/src/main.rs + vardiff.rs
    cmp_param "stratum bind" \
        "$(effective "$P_RAW" "$F_RAW_P" bind ZION_POOL_BIND 0.0.0.0:8444)" \
        "$(effective "$S_RAW" "$F_RAW_S" bind ZION_POOL_BIND 0.0.0.0:8444)"
    cmp_param "solo port" \
        "$(effective "$P_RAW" "$F_RAW_P" '' ZION_POOL_SOLO_PORT '')" \
        "$(effective "$S_RAW" "$F_RAW_S" '' ZION_POOL_SOLO_PORT '')"
    cmp_param "coinbase / miner-address" \
        "$(effective "$P_RAW" "$F_RAW_P" miner-address ZION_POOL_MINER_ADDRESS zion1pool)" \
        "$(effective "$S_RAW" "$F_RAW_S" miner-address ZION_POOL_MINER_ADDRESS zion1pool)"
    cmp_param "pool fee bps" \
        "$(effective "$P_RAW" "$F_RAW_P" pool-fee-bps ZION_POOL_FEE_BPS 100)" \
        "$(effective "$S_RAW" "$F_RAW_S" pool-fee-bps ZION_POOL_FEE_BPS 100)"
    cmp_param "pplns window size" \
        "$(effective "$P_RAW" "$F_RAW_P" pplns-window-size ZION_PPLNS_WINDOW_SIZE 500000)" \
        "$(effective "$S_RAW" "$F_RAW_S" pplns-window-size ZION_PPLNS_WINDOW_SIZE 500000)"
    cmp_param "payout interval s" \
        "$(effective "$P_RAW" "$F_RAW_P" payout-interval-s ZION_PAYOUT_INTERVAL_S 30)" \
        "$(effective "$S_RAW" "$F_RAW_S" payout-interval-s ZION_PAYOUT_INTERVAL_S 30)"
    cmp_param "min payout flowers" \
        "$(effective "$P_RAW" "$F_RAW_P" min-payout-flowers ZION_MIN_PAYOUT_FLOWERS 10000000)" \
        "$(effective "$S_RAW" "$F_RAW_S" min-payout-flowers ZION_MIN_PAYOUT_FLOWERS 10000000)"
    cmp_param "native payout coins" \
        "$(effective "$P_RAW" "$F_RAW_P" native-payout-coins ZION_POOL_NATIVE_PAYOUT_COINS '')" \
        "$(effective "$S_RAW" "$F_RAW_S" native-payout-coins ZION_POOL_NATIVE_PAYOUT_COINS '')"
    cmp_param "vardiff min" \
        "$(effective "$P_RAW" "$F_RAW_P" '' ZION_VARDIFF_MIN_DIFF 1000)" \
        "$(effective "$S_RAW" "$F_RAW_S" '' ZION_VARDIFF_MIN_DIFF 1000)"
    cmp_param "vardiff start" \
        "$(effective "$P_RAW" "$F_RAW_P" '' ZION_VARDIFF_START_DIFF 1000)" \
        "$(effective "$S_RAW" "$F_RAW_S" '' ZION_VARDIFF_START_DIFF 1000)"
    cmp_param "vardiff max" \
        "$(effective "$P_RAW" "$F_RAW_P" '' ZION_VARDIFF_MAX_DIFF 100000)" \
        "$(effective "$S_RAW" "$F_RAW_S" '' ZION_VARDIFF_MAX_DIFF 100000)"
    cmp_param "vardiff target s" \
        "$(effective "$P_RAW" "$F_RAW_P" '' ZION_VARDIFF_TARGET_SECS 15)" \
        "$(effective "$S_RAW" "$F_RAW_S" '' ZION_VARDIFF_TARGET_SECS 15)"
    cmp_param "vardiff retarget shares" \
        "$(effective "$P_RAW" "$F_RAW_P" '' ZION_VARDIFF_RETARGET_SHARES 8)" \
        "$(effective "$S_RAW" "$F_RAW_S" '' ZION_VARDIFF_RETARGET_SHARES 8)"

    # intentional / expected divergences
    cmp_param "api bind" \
        "$(effective "$P_RAW" "$F_RAW_P" api-bind ZION_POOL_API_BIND 127.0.0.1:8080)" \
        "$(effective "$S_RAW" "$F_RAW_S" api-bind ZION_POOL_API_BIND 127.0.0.1:8080)" 0

    p_state="$(effective "$P_RAW" "$F_RAW_P" state-path ZION_PPLNS_STATE_PATH '')"
    s_state="$(effective "$S_RAW" "$F_RAW_S" state-path ZION_PPLNS_STATE_PATH '')"
    if [ -z "$p_state" ] || [ -z "$s_state" ]; then
        warn "state path unset on one side (defaults apply): primary='$p_state' standby='$s_state'"
    elif [ "$p_state" = "$s_state" ]; then
        bad "state path COLLIDES ($p_state) — standby would overwrite live PPLNS state"
    else
        ok "state path isolated (primary=$p_state standby=$s_state)"
    fi

    p_db="$(effective "$P_RAW" "$F_RAW_P" store-db-path ZION_POOL_STORE_DB_PATH '')"
    s_db="$(effective "$S_RAW" "$F_RAW_S" store-db-path ZION_POOL_STORE_DB_PATH '')"
    if [ -z "$p_db" ] || [ -z "$s_db" ]; then
        warn "store db unset on one side: primary='$p_db' standby='$s_db'"
    elif [ "$p_db" = "$s_db" ]; then
        bad "store db COLLIDES ($p_db) — standby would write into live history DB"
    else
        ok "store db isolated (primary=$p_db standby=$s_db)"
    fi
fi

# ------------------------------------------------------------------ secrets ---
if [ "$ONLY" = "all" ] || [ "$ONLY" = "secrets" ]; then
    hdr "Secret material parity (sha256 only — values never leave the host)"
    for k in $SECRET_KEYS; do
        ph="$(secret_sha "$P_RAW" "$k")"
        sh="$(secret_sha "$S_RAW" "$k")"
        if [ -z "$ph" ] && [ -z "$sh" ]; then
            warn "$k missing on both sides"
        elif [ -z "$ph" ]; then
            bad "$k missing on primary (unexpected — primary pays miners every 30 s)"
        elif [ -z "$sh" ]; then
            bad "$k missing on standby -> promote cannot sign payouts"
        elif [ "$ph" = "$sh" ]; then
            ok "$k identical (sha256 ${ph:0:16}…)"
        else
            bad "$k DIFFERS (primary ${ph:0:16}… vs standby ${sh:0:16}…) -> payouts would come from the wrong wallet"
        fi
    done
fi

# ------------------------------------------------------------------- binary ---
if [ "$ONLY" = "all" ] || [ "$ONLY" = "binary" ]; then
    hdr "Binary provenance (standby must run the current RC build)"
    p_bin="$(xrec "$P_RAW" BIN)"; s_bin="$(xrec "$S_RAW" BIN)"
    p_sha="$(field "$p_bin" 3)";  s_sha="$(field "$s_bin" 3)"
    note "primary : $(field "$p_bin" 1) B  $(field "$p_bin" 2)  sha=$(field "$p_bin" 3)"
    note "standby : $(field "$s_bin" 1) B  $(field "$s_bin" 2)  sha=$(field "$s_bin" 3)"
    if [ -z "$p_sha" ] || [ -z "$s_sha" ]; then
        bad "binary missing on one side (primary='$PRIMARY_BIN' standby='$STANDBY_BIN')"
    elif [ "$p_sha" = "$s_sha" ]; then
        ok "binaries identical"
    else
        bad "binary skew — standby is NOT the current RC build"
    fi
    p_ver="$(xrec "$P_RAW" VER)"; s_ver="$(xrec "$S_RAW" VER)"
    note "primary --version: ${p_ver:-<no output>}"
    note "standby --version: ${s_ver:-<no output>}"
    printf '%s' "$s_ver" | grep -qi 'build ' || \
        warn "standby --version carries no build id (ZION_BUILD_ID not embedded)"
fi

# --------------------------------------------------------------------- data ---
if [ "$ONLY" = "all" ] || [ "$ONLY" = "data" ]; then
    hdr "Replication freshness + content lag"
    now_epoch="$(date -u +%s)"
    stamps="$(rec "$S_RAW" 'X\|STAMP\|')"
    if [ -z "$stamps" ]; then
        bad "no sync stamps — replication never succeeded"
    else
        while IFS= read -r line; do
            [ -n "$line" ] || continue
            body="${line#X|STAMP|}"
            note "$(field "$body" 1): $(field "$body" 3) (ts=$(field "$body" 2))"
        done <<< "$stamps"
        for spec in "pplns:180" "payouts:180" "db:5400"; do
            n="${spec%%:*}"; lim="${spec#*:}"
            line="$(printf '%s\n' "$stamps" | grep -E "\|$n\|" | tail -n1)"
            body="${line#X|STAMP|}"
            ts="$(field "$body" 2)"
            if [ -z "$ts" ] || [ "$ts" = "0" ]; then
                bad "$n.stamp missing or unreadable"
                continue
            fi
            age=$(( now_epoch - ts ))
            if [ "$age" -le "$lim" ]; then
                ok "$n age ${age}s (limit ${lim}s)"
            else
                bad "$n age ${age}s exceeds ${lim}s — replication stalled"
            fi
        done
    fi

    p_rows="$(xrec "$P_RAW" ROWS)"; s_rows="$(xrec "$S_RAW" ROWS)"
    p_h="$(xrec "$P_RAW" HEIGHT)"; s_h="$(xrec "$S_RAW" HEIGHT)"
    note "payout rows: primary=${p_rows:-?} standby=${s_rows:-?}   max height: primary=${p_h:-?} standby=${s_h:-?}"
    if [ -n "${p_rows:-}" ] && [ -n "${s_rows:-}" ]; then
        d=$(( p_rows - s_rows ))
        if [ "$d" -ge 0 ] && [ "$d" -le 500 ]; then
            ok "payout row lag ${d} (<=500 — consistent with <=60 s RPO)"
        else
            warn "payout row lag ${d} rows — inspect ledger lag before promote"
        fi
    else
        warn "could not read payouts table on one side"
    fi
    if [ -n "${p_h:-}" ] && [ -n "${s_h:-}" ]; then
        d=$(( p_h - s_h ))
        if [ "$d" -ge 0 ] && [ "$d" -le 200 ]; then
            ok "block height lag ${d} blocks"
        else
            warn "block height lag ${d} blocks (db sync is hourly)"
        fi
    fi
fi

# ------------------------------------------------------------------ network ---
if [ "$ONLY" = "all" ] || [ "$ONLY" = "network" ]; then
    hdr "Failover network path + fencing guards"

    case "$(xrec "$S_RAW" MARKER)" in
        ABSENT)  ok "ACTIVATED marker absent (no accidental promote possible)" ;;
        PRESENT) warn "ACTIVATED marker PRESENT — any systemctl start would start the standby" ;;
        *)       warn "ACTIVATED marker state unknown" ;;
    esac

    case "$(xrec "$S_RAW" HAWATCH)" in
        alert-only) ok "HA watchdog is alert-only (never promotes)" ;;
        suspicious) bad "HA watchdog contains a start/restart of zion-pool-standby — re-read it before trusting" ;;
        *)          warn "HA watchdog not readable — cannot prove it is alert-only" ;;
    esac

    case "$(xrec "$P_RAW" EDGEWATCH)" in
        restarts-pool) warn "primary watchdog auto-restarts \$POOL_SERVICE — MUST be stopped before promote (split-brain)" ;;
        inert)         ok "primary watchdog does not auto-restart the pool" ;;
        *)             warn "primary watchdog not readable" ;;
    esac

    case "$(xrec "$S_RAW" UFW8444)" in
        anywhere)   ok "standby stratum 8444 open to Anywhere" ;;
        restricted) warn "standby stratum 8444 NOT public (EDGE + ::/64 only) — miners on IP cannot connect after promote" ;;
        *)          warn "ufw not readable on standby" ;;
    esac

    proxy_port="$(xrec "$S_RAW" NGINXPROXY)"
    api_port="$(effective "$S_RAW" "$F_RAW_S" api-bind ZION_POOL_API_BIND 127.0.0.1:8080 | sed 's/.*://')"
    note "pool. vhost /public/v1 -> 127.0.0.1:${proxy_port:-?} ; standby pool API binds :${api_port:-?}"
    if [ "${proxy_port:-}" = "${api_port:-}" ]; then
        ok "nginx already targets the standby pool API"
    else
        warn "nginx targets :${proxy_port:-?} (tunnel to EDGE) — repoint to :${api_port:-?} during promote"
    fi

    case "$(xrec "$S_RAW" NODE)" in
        enabled/active) ok "standby L1 node: enabled + active" ;;
        *)              warn "standby L1 node state = $(xrec "$S_RAW" NODE) — a reboot may leave the standby without L1 RPC" ;;
    esac

    orphan="$(xrec "$S_RAW" ORPHAN)"
    if [ -n "${orphan:-}" ] && [ "${orphan:-0}" -gt 0 ] 2>/dev/null; then
        warn "orphaned replication dir $ORPHAN_DIR (${orphan} B) — active timer, but the standby unit never reads it"
    else
        ok "no orphaned replication dir detected"
    fi
fi

printf '\n%s----%s\n' "$c_b" "$c_0"
if [ "$FAILS" -gt 0 ]; then
    printf '%sRESULT: FAIL%s  (%d fail, %d warn) — promote is NOT safe\n' "$c_r" "$c_0" "$FAILS" "$WARNS"
    exit 1
fi
printf '%sRESULT: PASS%s  (0 fail, %d warn)\n' "$c_g" "$c_0" "$WARNS"
exit 0
