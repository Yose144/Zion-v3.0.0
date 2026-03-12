#!/bin/bash
# Deploy miner bug fix to the canonical primary host
# Fixes: reconnect on submit loop death + stale share dropping
# Commit: 12efed5

set -e

SSH_KEY=~/.ssh/zion_hetzner_key
# P1-29: accept-new prevents MITM
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"
# P1-30: Use dedicated deploy user instead of root when available
DEPLOY_USER="${DEPLOY_USER:-root}"
REPO_DIR="/root/zion-2.9.6"

SERVERS=(
  "91.98.122.165:Zion2"
)

deploy_server() {
  local entry="$1"
  local ip="${entry%%:*}"
  local name="${entry##*:}"
  local log="/tmp/deploy-${name}.log"

  echo "🚀 [$name] Starting deploy on $ip..."

  ssh $SSH_OPTS ${DEPLOY_USER}@$ip bash -s <<'REMOTE_SCRIPT' > "$log" 2>&1
    set -e
    cd /root/zion-2.9.6

    echo "📥 Git pull..."
    git pull origin main

    echo "🔨 Building miner image..."
    docker compose -f docker/docker-compose.testnet.yml build miner

    echo "🔄 Restarting miner..."
    docker compose -f docker/docker-compose.testnet.yml up -d miner

    echo "⏳ Waiting 10s for miner to start..."
    sleep 10

    echo "📊 Miner status:"
    docker ps --format "{{.Names}} | {{.Image}} | {{.Status}}" | grep miner

    echo "📋 Last 20 log lines:"
    docker logs --tail 20 zion-miner 2>&1

    echo "✅ Deploy complete!"
REMOTE_SCRIPT

  local exit_code=$?
  if [ $exit_code -eq 0 ]; then
    echo "✅ [$name] Deploy SUCCESS"
  else
    echo "❌ [$name] Deploy FAILED (exit $exit_code)"
  fi

  echo "--- [$name] Log ---"
  cat "$log"
  echo "--- [$name] End ---"
  echo ""

  return $exit_code
}

echo "=========================================="
echo "🚀 ZION Miner Fix Deploy — All 3 Servers"
echo "=========================================="
echo "Started: $(date)"
echo ""

# Deploy all 3 in parallel
pids=()
for server in "${SERVERS[@]}"; do
  deploy_server "$server" &
  pids+=($!)
done

# Wait for all and collect results
failures=0
for i in "${!pids[@]}"; do
  if ! wait "${pids[$i]}"; then
    failures=$((failures + 1))
  fi
done

echo "=========================================="
echo "📊 DEPLOY SUMMARY"
echo "   Servers: ${#SERVERS[@]}"
echo "   Failures: $failures"
echo "   Finished: $(date)"
echo "=========================================="

exit $failures
