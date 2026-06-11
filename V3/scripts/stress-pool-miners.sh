#!/usr/bin/env bash
# Spawn many zion-miner processes against one pool (stress / load test).
#
# Pool default ZION_MAX_SESSIONS_PER_IP=10 rejects >10 connections from one public IP.
# On the pool host set before testing (compose / .env):
#   ZION_MAX_SESSIONS_PER_IP=0
# then: docker compose ... up -d pool
#
# Usage:
#   ./V3/scripts/stress-pool-miners.sh start 120 204.168.245.175:8444
#   ./V3/scripts/stress-pool-miners.sh status
#   ./V3/scripts/stress-pool-miners.sh stop
#
# Env:
#   ZION_MINER_BIN   — path to zion-miner (default: search)
#   STRESS_THREADS   — ZION_THREADS per process (default 1)
#   STRESS_WALLET    — zion1 miner_id for all workers (default: canonical default miner)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V3_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$V3_ROOT/.." && pwd)"
STATE_DIR="${TMPDIR:-/tmp}/zion-stress-pool"
PID_FILE="$STATE_DIR/miner.pids"
DEFAULT_WALLET="${STRESS_WALLET:-zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604}"

find_miner_bin() {
  if [[ -n "${ZION_MINER_BIN:-}" && -x "$ZION_MINER_BIN" ]]; then
    echo "$ZION_MINER_BIN"
    return
  fi
  for c in \
    "$V3_ROOT/target/release/zion-miner" \
    "$V3_ROOT/target/debug/zion-miner" \
    "$REPO_ROOT/V3/target/release/zion-miner" \
    "$(command -v zion-miner 2>/dev/null || true)"; do
    [[ -n "$c" && -x "$c" ]] || continue
    echo "$c"
    return
  done
  echo "Build zion-miner first: cargo build -p zion-miner --release --manifest-path $V3_ROOT/Cargo.toml" >&2
  exit 1
}

cmd="${1:-}"
case "$cmd" in
start)
  count="${2:?need count e.g. 120}"
  pool="${3:?need host:port e.g. 204.168.245.175:8444}"
  wallet="${4:-$DEFAULT_WALLET}"
  threads="${STRESS_THREADS:-1}"
  bin="$(find_miner_bin)"
  mkdir -p "$STATE_DIR/log"
  rm -f "$PID_FILE"
  echo "stress: bin=$bin pool=$pool workers=$count threads_each=$threads miner_id=$wallet" >&2
  for i in $(seq 1 "$count"); do
    log="$STATE_DIR/log/worker-$i.log"
    env ZION_POOL_ADDR="$pool" \
      ZION_MINER_ID="$wallet" \
      ZION_WORKER_NAME="stress-$i" \
      ZION_THREADS="$threads" \
      ZION_BACKEND="${STRESS_BACKEND:-cpu}" \
      ZION_PROFILE="${STRESS_PROFILE:-pool}" \
      ZION_LOOP_COUNT="${STRESS_LOOP_COUNT:-1000000}" \
      ZION_NONCE_COUNT="${STRESS_NONCE_COUNT:-1000000}" \
      ZION_MINER_VERBOSE="${STRESS_MINER_VERBOSE:-0}" \
      "$bin" >>"$log" 2>&1 &
    echo $! >>"$PID_FILE"
  done
  echo "started $count pids → $PID_FILE" >&2
  ;;
stop)
  [[ -f "$PID_FILE" ]] || { echo "no pid file $PID_FILE"; exit 0; }
  while read -r pid; do
    [[ "$pid" =~ ^[0-9]+$ ]] || continue
    kill "$pid" 2>/dev/null || true
  done <"$PID_FILE"
  rm -f "$PID_FILE"
  echo "stop sent" >&2
  ;;
status)
  if [[ ! -f "$PID_FILE" ]]; then
    echo "no active stress run ($PID_FILE missing)"
    exit 0
  fi
  alive=0
  while read -r pid; do
    [[ "$pid" =~ ^[0-9]+$ ]] || continue
    if kill -0 "$pid" 2>/dev/null; then
      alive=$((alive + 1))
    fi
  done <"$PID_FILE"
  total=$(wc -l <"$PID_FILE" | tr -d ' ')
  echo "pids tracked=$total still_running=$alive"
  ;;
*)
  sed -n '1,20p' "$0" | tail -n +2
  exit 1
  ;;
esac
