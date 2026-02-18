#!/bin/bash
# Deploy miner fix via scp + docker rebuild — all 3 servers in parallel
# macOS bash 3.2 compatible (no associative arrays)

SSH_KEY=~/.ssh/zion_hetzner_key
# P1-29: accept-new prevents MITM while auto-accepting first connection
SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15"
SCP="scp -i $SSH_KEY -o StrictHostKeyChecking=accept-new"
# P1-30: Use dedicated deploy user instead of root when available
DEPLOY_USER="${DEPLOY_USER:-root}"
LOCAL_BASE="/Users/yeshuae/Desktop/ZION/Zion-2.9-main/Zion-2.9.5"
REMOTE_DIR="/root/Zion-2.9.5"

deploy_one() {
  local name="$1"
  local ip="$2"

  echo "🚀 [$name] Uploading fixed files to $ip..."
  $SCP "$LOCAL_BASE/miner/src/miner/cpu.rs" "${DEPLOY_USER}@$ip:$REMOTE_DIR/miner/src/miner/cpu.rs"
  $SCP "$LOCAL_BASE/miner/src/miner/mod.rs" "${DEPLOY_USER}@$ip:$REMOTE_DIR/miner/src/miner/mod.rs"

  echo "🔨 [$name] Rebuilding miner Docker image (this takes ~2-5 min)..."
  $SSH ${DEPLOY_USER}@$ip "cd $REMOTE_DIR && docker compose -f docker/docker-compose.testnet.yml build --no-cache miner"

  echo "🔄 [$name] Restarting miner container..."
  $SSH ${DEPLOY_USER}@$ip "cd $REMOTE_DIR && docker compose -f docker/docker-compose.testnet.yml up -d miner"

  echo "⏳ [$name] Waiting 15s for miner startup..."
  sleep 15

  echo "📊 [$name] Status:"
  $SSH ${DEPLOY_USER}@$ip 'docker ps --format "{{.Names}} | {{.Status}}" | grep miner && echo "--- Last 15 lines ---" && docker logs --tail 15 zion-miner 2>&1'

  echo "✅ [$name] DONE"
}

echo "=========================================="
echo "🚀 ZION Miner Fix Deploy (scp + rebuild)"
echo "   Files: cpu.rs, mod.rs"
echo "   Started: $(date)"
echo "=========================================="

# Run all 3 in parallel
deploy_one "Helsinki"  "77.42.31.72"   > /tmp/deploy-Helsinki.log 2>&1 &
pid1=$!
deploy_one "USA"       "5.78.145.234"  > /tmp/deploy-USA.log 2>&1 &
pid2=$!
deploy_one "Singapore" "5.223.56.124"  > /tmp/deploy-Singapore.log 2>&1 &
pid3=$!

echo "⏳ Building on all 3 servers in parallel... (Rust compile ~2-5 min)"
echo "   PIDs: Helsinki=$pid1, USA=$pid2, Singapore=$pid3"

# Wait and collect results
failures=0

wait $pid1 || failures=$((failures + 1))
echo ""
echo "====== Helsinki ======"
cat /tmp/deploy-Helsinki.log

wait $pid2 || failures=$((failures + 1))
echo ""
echo "====== USA ======"
cat /tmp/deploy-USA.log

wait $pid3 || failures=$((failures + 1))
echo ""
echo "====== Singapore ======"
cat /tmp/deploy-Singapore.log

echo ""
echo "=========================================="
echo "📊 DEPLOY COMPLETE: $((3-failures))/3 succeeded"
echo "   Finished: $(date)"
echo "=========================================="
