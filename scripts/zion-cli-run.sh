#!/usr/bin/env bash
# ZION V3 — zion-cli wrapper for dashboard API (Linux/macOS)
# Runs zion-cli with the given command and emits JSON {ok,stdout,stderr,exit_code,cmd,exe}.
# Usage: zion-cli-run.sh "node status"
set -uo pipefail
source "$(dirname "$0")/_lib.sh"

CMD="${*:-}"

emit_json() { python3 - "$@" <<'PY'
import json, sys
keys = ["ok","stdout","stderr","exit_code","cmd","exe","error"]
d = {}
for kv in sys.argv[1:]:
    k, _, v = kv.partition("=")
    if k == "ok": d[k] = (v == "1")
    elif k == "exit_code": d[k] = int(v) if v.lstrip("-").isdigit() else v
    else: d[k] = v
print(json.dumps(d))
PY
}

ZION_EXE="$(find_exe zion || true)"
if [[ -z "$ZION_EXE" ]]; then
    ZION_EXE="$(find_exe zion-cli || true)"
fi
if [[ -z "$ZION_EXE" ]]; then
    emit_json "ok=0" "error=zion-cli not built. Run 'cargo build --release -p zion-cli' first."
    exit 1
fi

OUT_FILE="$(mktemp)"; ERR_FILE="$(mktemp)"
# shellcheck disable=SC2086
"$ZION_EXE" $CMD > "$OUT_FILE" 2> "$ERR_FILE"
RC=$?
emit_json "ok=1" "stdout=$(cat "$OUT_FILE")" "stderr=$(cat "$ERR_FILE")" "exit_code=$RC" "cmd=$CMD" "exe=$ZION_EXE"
rm -f "$OUT_FILE" "$ERR_FILE"
exit 0
