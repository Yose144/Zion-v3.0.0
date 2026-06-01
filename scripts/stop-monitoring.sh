#!/usr/bin/env bash
# ZION V3 — Stop Prometheus + Grafana (Linux/macOS)
set -uo pipefail
source "$(dirname "$0")/_lib.sh"

COMPOSE_FILE="$REPO_ROOT/V3/docker/docker-compose.yml"
if command -v docker >/dev/null 2>&1; then
    zlog "Stopping ZION monitoring stack..."
    ( cd "$(dirname "$COMPOSE_FILE")" && docker compose -f "$COMPOSE_FILE" --profile monitoring down ) || true
    zlog "Monitoring stack stopped."
else
    zlog "[stop-monitoring] Docker not available — nothing to stop."
fi
