#!/usr/bin/env bash
# Quick overview of all running ZION services

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"

echo "╔═══════════════════════════════════════════════╗"
echo "║   ZION V3 — Live Log Overview                 ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

for svc in node1 node2 pool miner; do
    log="$LOG_DIR/$svc.log"
    if [[ -f "$log" ]]; then
        lines=$(wc -l < "$log" 2>/dev/null || echo 0)
        last=$(tail -n 1 "$log" 2>/dev/null || echo "N/A")
        printf "%-8s | %6s lines | %s\n" "$svc" "$lines" "$last"
    else
        printf "%-8s | no log file\n" "$svc"
    fi
done

echo ""
echo "Run:  bash scripts/watch-logs.sh   for live tail"
