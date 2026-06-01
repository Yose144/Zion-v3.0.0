#!/usr/bin/env bash
# ZION V3 — Launch FULL stack (core + monitoring), Linux/macOS
set -uo pipefail
source "$(dirname "$0")/_lib.sh"

zlog "ZION V3 — FULL LAUNCH (CORE + MONITORING)"

# Stop any existing core processes first so ports are free
zlog "[0/2] Stopping existing ZION processes..."
bash "$SCRIPTS_DIR/stop-stack.sh" || true
sleep 2

# 1. Core stack (node1 + node2 + pool + miner)
zlog "[1/2] Launching core stack..."
bash "$SCRIPTS_DIR/launch-stack.sh" || true
sleep 5

# 2. Monitoring (Prometheus + Grafana) — best effort (needs Docker)
zlog "[2/2] Launching monitoring stack..."
bash "$SCRIPTS_DIR/start-monitoring.sh" || zlog "[WARN] monitoring not started (Docker unavailable)"

zlog "FULL STACK READY"
zlog "  Dashboard  : http://127.0.0.1:8766"
zlog "  Node 1 RPC : http://127.0.0.1:8443"
zlog "  Pool       : tcp://127.0.0.1:8444"
zlog "  Prometheus : http://127.0.0.1:9090"
zlog "  Grafana    : http://127.0.0.1:3000"
