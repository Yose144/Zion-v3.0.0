#!/usr/bin/env bash
# ZION V3 — Stop Test Mainnet

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$REPO_ROOT/run"
V3_DIR="$REPO_ROOT/V3"

echo "[stop] Stopping ZION test mainnet services ..."

# Stop native processes
for svc in node pool zion-miner; do
  pidfile="$PID_DIR/${svc}.pid"
  if [[ -f "$pidfile" ]]; then
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      echo "[stop] Stopping $svc (PID $pid) ..."
      kill "$pid" 2>/dev/null || true
      sleep 2
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  else
    # Fallback: pkill by binary name
    pkill -f "target/release/$svc" 2>/dev/null || true
  fi
done

# Stop Docker monitoring
if command -v docker &>/dev/null; then
  echo "[stop] Stopping Prometheus + Grafana ..."
  cd "$V3_DIR/docker"
  docker compose -f docker-compose.yml --profile monitoring down 2>/dev/null || true
fi

echo "[stop] All services stopped."
echo "[stop] To restart: bash scripts/launch-test-mainnet.sh"
