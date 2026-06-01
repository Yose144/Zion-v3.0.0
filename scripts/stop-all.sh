#!/usr/bin/env bash
# ZION V3 — Stop ALL services (core + monitoring)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Stopping ALL ZION services..."

[[ -f "$SCRIPT_DIR/stop-stack.sh" ]]      && bash "$SCRIPT_DIR/stop-stack.sh"      || true
[[ -f "$SCRIPT_DIR/stop-monitoring.sh" ]] && bash "$SCRIPT_DIR/stop-monitoring.sh" || true

echo "All services stopped."
