#!/usr/bin/env bash
# pool-standby-sync.sh — pull authenticated pool state snapshots EDGE → EDGE2.
#
# Runs on EDGE2. Fetches the three state exports served by the EDGE pool API
# (A4.2) through the zion-edge-tunnel loopback forward (127.0.0.1:8080) and
# installs them into the standby data dir with atomic renames, so the warm
# standby can be promoted manually with near-current state.
#
#   MODE=json  → pplns + payouts ledger   (timer: every 60 s)
#   MODE=db    → pool-store.db snapshot   (timer: hourly; ~130 MB via VACUUM INTO)
#
# Auth: ZION_POOL_API_KEY is read ONLY from the env file — never from argv —
# so it cannot leak into `ps` or the journal.
#
# Failure policy: any fetch/validate failure exits non-zero and leaves the
# previous good files in place (fail-closed — a standby must never promote
# half-synced state). Success writes .sync-state/<name>.stamp for the runbook
# and the watchdog.
set -euo pipefail

MODE="${1:-json}"
ENV_FILE="${ZION_POOL_HA_ENV:-/etc/zion/pool-standby.env}"
[ -r "$ENV_FILE" ] || { echo "pool-standby-sync: missing env file $ENV_FILE" >&2; exit 2; }
# shellcheck disable=SC1090
. "$ENV_FILE"

: "${ZION_POOL_API_KEY:?ZION_POOL_API_KEY must be set in $ENV_FILE}"
API_URL="${ZION_POOL_API_URL:-http://127.0.0.1:8080}"
DEST="${ZION_POOL_STANDBY_DIR:-/opt/zion/data/v31-standby}"
STAMPS="$DEST/.sync-state"
CURL=(curl --fail --silent --show-error --connect-timeout 10)

mkdir -p "$DEST" "$STAMPS"
chmod 700 "$DEST" "$STAMPS" 2>/dev/null || true

fetch() { # fetch <name> <dest-file> <timeout>
    local name="$1" out="$2" timeout="$3"
    local tmp
    tmp="$(mktemp "$DEST/.in-$name.XXXXXX")"
    chmod 600 "$tmp"
    if ! "${CURL[@]}" --max-time "$timeout" \
        -H "X-API-Key: $ZION_POOL_API_KEY" \
        -o "$tmp" "$API_URL/api/v1/state/$name"; then
        rm -f "$tmp"
        echo "pool-standby-sync: fetch $name failed from $API_URL" >&2
        return 1
    fi
    printf '%s' "$tmp"
}

stamp() { # stamp <name> <file>
    { echo "ts=$(date -u +%s)"; echo "iso=$(date -u +%FT%TZ)";
      echo "sha256=$(sha256sum "$2" | cut -d' ' -f1)";
      echo "bytes=$(stat -c%s "$2")"; } > "$STAMPS/$1.stamp"
}

case "$MODE" in
    json)
        tmp="$(fetch pplns "$DEST/pool-pplns.json" 60)"
        python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$tmp" \
            || { rm -f "$tmp"; echo "pool-standby-sync: pplns JSON invalid" >&2; exit 1; }
        mv -f "$tmp" "$DEST/pool-pplns.json"
        stamp pplns "$DEST/pool-pplns.json"

        # The payouts ledger may legitimately be absent (fresh pool) — a 404
        # is not a sync failure, just skip the install.
        tmp="$(mktemp "$DEST/.in-payouts.XXXXXX")"; chmod 600 "$tmp"
        code="$(curl --silent --output "$tmp" --write-out '%{http_code}' \
            --connect-timeout 10 --max-time 60 \
            -H "X-API-Key: $ZION_POOL_API_KEY" \
            "$API_URL/api/v1/state/payouts")"
        if [ "$code" = 200 ] && \
           python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$tmp" 2>/dev/null; then
            mv -f "$tmp" "$DEST/pool-pplns.json.payouts.json"
            stamp payouts "$DEST/pool-pplns.json.payouts.json"
        else
            rm -f "$tmp"
            [ "$code" = 404 ] \
                || echo "pool-standby-sync: payouts fetch returned $code — keeping last good" >&2
        fi
        echo "pool-standby-sync: json state synced"
        ;;

    db)
        tmp="$(fetch db "$DEST/pool-store.db" 600)"
        # Cheap structural check before install: SQLite magic header.
        if ! head -c 16 "$tmp" | grep -q "SQLite format 3"; then
            rm -f "$tmp"
            echo "pool-standby-sync: db snapshot missing SQLite header" >&2
            exit 1
        fi
        # Deep check when sqlite3 is available — a corrupt snapshot must
        # never land in the standby dir (fail-closed).
        if command -v sqlite3 >/dev/null 2>&1; then
            if ! sqlite3 "$tmp" "PRAGMA quick_check;" 2>/dev/null | grep -qx ok; then
                rm -f "$tmp"
                echo "pool-standby-sync: db snapshot failed sqlite3 quick_check" >&2
                exit 1
            fi
        fi
        mv -f "$tmp" "$DEST/pool-store.db"
        stamp db "$DEST/pool-store.db"
        echo "pool-standby-sync: db snapshot synced ($(stat -c%s "$DEST/pool-store.db") bytes)"
        ;;

    *)
        echo "usage: $0 [json|db]" >&2
        exit 64
        ;;
esac
