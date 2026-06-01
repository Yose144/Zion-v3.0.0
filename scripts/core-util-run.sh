#!/usr/bin/env bash
# ZION V3 — zion-core-util wrapper for the dashboard API.
# Runs core-util with given arguments and prints a JSON object with
# stdout, stderr, and exit code.
#
# Usage: core-util-run.sh -Cmd "verify-db V3/data/zion-node-state.db"
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

CMD=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        -Cmd) CMD="${2:-}"; shift 2 ;;
        *)    shift ;;
    esac
done

json_escape() { python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'; }

EXE="$REPO_ROOT/V3/target/release/core-util"
if [[ ! -x "$EXE" ]]; then
    if [[ -x "$REPO_ROOT/V3/target/debug/core-util" ]]; then
        EXE="$REPO_ROOT/V3/target/debug/core-util"
    else
        echo '{"ok":false,"error":"core-util not found. Run: cargo build --release -p zion-core --bin core-util"}'
        exit 1
    fi
fi

# Split CMD into words (whitespace-separated; mirrors the .ps1 behaviour).
read -r -a ARG_LIST <<< "$CMD"

set +e
STDOUT="$(cd "$REPO_ROOT" && "$EXE" "${ARG_LIST[@]}" 2>/tmp/core-util.$$.err)"
EXIT_CODE=$?
STDERR="$(cat /tmp/core-util.$$.err 2>/dev/null)"; rm -f /tmp/core-util.$$.err
set -e 2>/dev/null || true

printf '{"ok":true,"stdout":%s,"stderr":%s,"exit_code":%d,"cmd":%s,"exe":%s}\n' \
    "$(printf '%s' "$STDOUT" | json_escape)" \
    "$(printf '%s' "$STDERR" | json_escape)" \
    "$EXIT_CODE" \
    "$(printf '%s' "$CMD" | json_escape)" \
    "$(printf '%s' "$EXE" | json_escape)"
exit 0
