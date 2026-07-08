#!/usr/bin/env bash
# zion-live.sh — Live terminal monitor for all ZION backend services
#
# Usage:
#   ./scripts/zion-live.sh              # all services (journalctl)
#   ./scripts/zion-live.sh backup       # only backup node
#   ./scripts/zion-live.sh edge         # edge node 1 (via SSH tunnel logs)
#   ./scripts/zion-live.sh logs         # tail -f all log files
#   ./scripts/zion-live.sh status       # one-shot status overview

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"

MODE="${1:-all}"

case "$MODE" in
  status)
    echo "════════════════════════════════════════════════════════════════"
    echo "  ZION Backend Status — $(date '+%Y-%m-%d %H:%M:%S')"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    echo "── Systemd user services ──"
    for s in zion-dashboard zion-backup-node zion-ssh-tunnel; do
      state=$(systemctl --user is-active $s.service 2>/dev/null)
      color=$([ "$state" = "active" ] && echo "\033[32m" || echo "\033[31m")
      reset="\033[0m"
      printf "  ${color}%-25s${reset} %s\n" "$s" "$state"
    done
    echo ""
    echo "── Backup Node (RPC :8446) ──"
    _ci=$(curl -s -X POST http://127.0.0.1:8446/jsonrpc -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' 2>/dev/null)
    _ni=$(curl -s -X POST http://127.0.0.1:8446/jsonrpc -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","method":"getNodeInfo","params":[],"id":1}' 2>/dev/null)
    if [ -n "$_ci" ] && [ -n "$_ni" ]; then
      _h=$(echo "$_ci" | jq -r '.result.chain_height' 2>/dev/null)
      _t=$(echo "$_ci" | jq -r '.result.tip_hash[:16]' 2>/dev/null)
      _p=$(echo "$_ni" | jq -r '.result.known_peers' 2>/dev/null)
      _n=$(echo "$_ni" | jq -r '.result.node_id' 2>/dev/null)
      echo "  Height: $_h  Peers: $_p  Node: $_n  Tip: ${_t}…"
    else
      echo "  (unreachable)"
    fi
    echo ""
    echo "── Edge Node 1 (RPC :8443 via tunnel) ──"
    _ci=$(curl -s -X POST http://127.0.0.1:8443/jsonrpc -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' 2>/dev/null)
    _ni=$(curl -s -X POST http://127.0.0.1:8443/jsonrpc -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","method":"getNodeInfo","params":[],"id":1}' 2>/dev/null)
    if [ -n "$_ci" ] && [ -n "$_ni" ]; then
      _h=$(echo "$_ci" | jq -r '.result.chain_height' 2>/dev/null)
      _t=$(echo "$_ci" | jq -r '.result.tip_hash[:16]' 2>/dev/null)
      _p=$(echo "$_ni" | jq -r '.result.known_peers' 2>/dev/null)
      _n=$(echo "$_ni" | jq -r '.result.node_id' 2>/dev/null)
      echo "  Height: $_h  Peers: $_p  Node: $_n  Tip: ${_t}…"
    else
      echo "  (unreachable)"
    fi
    echo ""
    echo "── Edge Node 2 (RPC :8448 via tunnel) ──"
    _ci=$(curl -s -X POST http://127.0.0.1:8448/jsonrpc -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' 2>/dev/null)
    _ni=$(curl -s -X POST http://127.0.0.1:8448/jsonrpc -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","method":"getNodeInfo","params":[],"id":1}' 2>/dev/null)
    if [ -n "$_ci" ] && [ -n "$_ni" ]; then
      _h=$(echo "$_ci" | jq -r '.result.chain_height' 2>/dev/null)
      _t=$(echo "$_ci" | jq -r '.result.tip_hash[:16]' 2>/dev/null)
      _p=$(echo "$_ni" | jq -r '.result.known_peers' 2>/dev/null)
      _n=$(echo "$_ni" | jq -r '.result.node_id' 2>/dev/null)
      echo "  Height: $_h  Peers: $_p  Node: $_n  Tip: ${_t}…"
    else
      echo "  (unreachable)"
    fi
    echo ""
    echo "── Dashboard (:8766) ──"
    curl -s -u Yose:3nityOne13 http://127.0.0.1:8766/api/status 2>/dev/null | \
      jq -r '"  Topology: \(.topology)  Pool: \(.pool.running // false | if . then "running" else "stopped" end)  Miner: \(.miner.running // false | if . then "running" else "stopped" end)"' 2>/dev/null || echo "  (unreachable)"
    echo ""
    echo "── Recent watchdog log ──"
    tail -5 "$LOG_DIR/watchdog.log" 2>/dev/null || echo "  (no watchdog log)"
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    ;;

  backup)
    echo ">>> Live journalctl: zion-backup-node.service (Ctrl+C to exit)"
    echo ""
    journalctl --user -u zion-backup-node.service -f --no-pager -o cat
    ;;

  dashboard)
    echo ">>> Live journalctl: zion-dashboard.service (Ctrl+C to exit)"
    echo ""
    journalctl --user -u zion-dashboard.service -f --no-pager -o cat
    ;;

  tunnel)
    echo ">>> Live journalctl: zion-ssh-tunnel.service (Ctrl+C to exit)"
    echo ""
    journalctl --user -u zion-ssh-tunnel.service -f --no-pager -o cat
    ;;

  watchdog)
    echo ">>> Live watchdog log (Ctrl+C to exit)"
    echo ""
    tail -f "$LOG_DIR/watchdog.log" 2>/dev/null || echo "No watchdog log found."
    ;;

  logs)
    echo ">>> tail -f all log files in logs/ (Ctrl+C to exit)"
    echo ""
    tail -f "$LOG_DIR"/*.log
    ;;

  edge)
    echo ">>> Edge server services via SSH (Ctrl+C to exit)"
    echo ""
    ssh zion-new "journalctl -u zion-node -f --no-pager -o cat" 2>/dev/null || \
      echo "SSH to zion-new failed. Check ~/.ssh/config and key."
    ;;

  all|"")
    echo ">>> Live view: all ZION systemd services + log files (Ctrl+C to exit)"
    echo ">>> Services: backup-node, dashboard, ssh-tunnel"
    echo ">>> Logs: node-backup, miner, pool, bridge, dao, warp, oasis, free-world, issobella, watchdog"
    echo ""
    # Combine journalctl + tail -f log files
    journalctl --user -u zion-backup-node.service -u zion-dashboard.service -u zion-ssh-tunnel.service \
      -f --no-pager -o cat &
    JPID=$!
    tail -f "$LOG_DIR"/node-backup.log "$LOG_DIR"/miner.log "$LOG_DIR"/bridge.log \
         "$LOG_DIR"/dao.log "$LOG_DIR"/warp.log "$LOG_DIR"/watchdog.log \
         "$LOG_DIR"/oasis.log "$LOG_DIR"/free-world.log "$LOG_DIR"/issobella.log 2>/dev/null &
    TPID=$!
    trap "kill $JPID $TPID 2>/dev/null" EXIT INT TERM
    wait
    ;;

  *)
    echo "Usage: $0 [status|backup|dashboard|tunnel|watchdog|logs|edge|all]"
    echo ""
    echo "  status    — one-shot overview of all services"
    echo "  backup    — live journalctl for backup node"
    echo "  dashboard — live journalctl for dashboard"
    echo "  tunnel    — live journalctl for SSH tunnel"
    echo "  watchdog  — live tail of watchdog.log"
    echo "  logs      — tail -f all *.log files"
    echo "  edge      — live journalctl for edge node 1 (via SSH)"
    echo "  all       — combined live view (default)"
    ;;
esac
