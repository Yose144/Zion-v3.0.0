#!/usr/bin/env bash
# Run local OASIS Game stack: zion-oasis + OasisWeb dev server.
#
# Usage:
#   ./scripts/run-oasis-local.sh
#
# Ports:
#   - OASIS API:  http://127.0.0.1:8094
#   - OASIS Web:  http://localhost:3000
#
# Requirements:
#   - V31 workspace built: cd V31 && cargo build --release -p zion-oasis
#   - OasisWeb deps installed: cd APP\&WEB/OasisWeb && npm install

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  echo "[run-oasis-local] shutting down..."
  pkill -f 'zion-oasis' 2>/dev/null || true
  pkill -f 'next dev' 2>/dev/null || true
}
trap cleanup EXIT

# Ensure release binary exists
if [[ ! -x "$ROOT/V31/target/release/zion-oasis" ]]; then
  echo "[run-oasis-local] building zion-oasis..."
  cd "$ROOT/V31"
  cargo build --release -p zion-oasis
fi

# Start OASIS API
cd "$ROOT/V31/L4/oasis"
OASIS_PORT=8094 OASIS_BIND=127.0.0.1 "$ROOT/V31/target/release/zion-oasis" &
OASIS_PID=$!

# Wait for API
for i in {1..30}; do
  if curl -s http://127.0.0.1:8094/health >/dev/null 2>&1; then
    echo "[run-oasis-local] OASIS API ready at http://127.0.0.1:8094"
    break
  fi
  sleep 0.5
done

# Start OasisWeb
cd "$ROOT/APP&WEB/OasisWeb"
NEXT_PUBLIC_OASIS_API_URL=http://127.0.0.1:8094 npm run dev &
WEB_PID=$!

echo "[run-oasis-local] Oasis Web starting at http://localhost:3000"
echo "[run-oasis-local] press Ctrl+C to stop both"

wait $OASIS_PID $WEB_PID
