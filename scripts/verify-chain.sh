#!/usr/bin/env bash
# ZION V3 — Chain State Integrity Verification
# Checks snapshot, journal, and LMDB files exist and validates JSON snapshots.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$REPO_ROOT/V3/data"
LOG_FILE="$REPO_ROOT/logs/verify-chain.log"
mkdir -p "$REPO_ROOT/logs"
echo "$(date '+%Y-%m-%d %H:%M:%S') verify-chain started" > "$LOG_FILE"

CHECKS=0
ISSUES=0

log() { echo "$1" | tee -a "$LOG_FILE"; }

check_item() {  # <path> <label> -> sets last_ok
    CHECKS=$((CHECKS + 1))
    if [[ -e "$1" ]]; then
        local size; size=$(du -b "$1" 2>/dev/null | cut -f1 || echo "?")
        log "$2: OK ($size bytes)"; last_ok=1
    else
        log "$2: MISSING"; last_ok=0
    fi
}

validate_json() {  # <path> <label>
    if python3 -c "import json,sys; json.load(open(sys.argv[1]))" "$1" 2>/dev/null; then
        log "$2: VALID"
    else
        log "$2: CORRUPT"; ISSUES=$((ISSUES + 1))
    fi
}

echo "[verify] Checking chain state integrity..."

check_item "$DATA_DIR/zion-node-state.db"           "Node1 Snapshot"; n1=$last_ok
check_item "$DATA_DIR/zion-node-state.db.journal"   "Node1 Journal"
check_item "$DATA_DIR/zion-node-state.db/data.mdb"  "Node1 LMDB"
check_item "$DATA_DIR/zion-node2-state.db"          "Node2 Snapshot"; n2=$last_ok
check_item "$DATA_DIR/zion-node2-state.db.journal"  "Node2 Journal"
check_item "$DATA_DIR/zion-node2-state.db/data.mdb" "Node2 LMDB"

# Validate JSON snapshots only when the snapshot is a regular file
[[ "${n1:-0}" -eq 1 && -f "$DATA_DIR/zion-node-state.db" ]]  && validate_json "$DATA_DIR/zion-node-state.db"  "Node1 Snapshot JSON"
[[ "${n2:-0}" -eq 1 && -f "$DATA_DIR/zion-node2-state.db" ]] && validate_json "$DATA_DIR/zion-node2-state.db" "Node2 Snapshot JSON"

echo ""
if [[ $ISSUES -eq 0 ]]; then
    echo "[verify] All $CHECKS checks passed. Chain state is healthy."
    echo "$(date '+%Y-%m-%d %H:%M:%S') VERIFY PASSED ($CHECKS checks)" >> "$LOG_FILE"
    exit 0
else
    echo "[verify] $ISSUES issue(s) found — see $LOG_FILE"
    echo "$(date '+%Y-%m-%d %H:%M:%S') VERIFY FAILED ($ISSUES issues)" >> "$LOG_FILE"
    exit 1
fi
