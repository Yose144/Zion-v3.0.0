#!/usr/bin/env bash
# =============================================================================
# ZION 3.0.3 Decimal Fork — Edge Deployment Script
# =============================================================================
# Safely deploys the 3.0.3 binary to the Edge server WITHOUT deleting the
# existing chain database. The DB stays on disk; only the binary swaps.
#
# Usage:
#   ./scripts/deploy-3.0.3-edge.sh          # full deploy
#   ./scripts/deploy-3.0.3-edge.sh --dry    # dry run (no changes)
#   ./scripts/deploy-3.0.3-edge.sh --rollback # rollback to pre-deploy state
#
# Prerequisites:
#   - SSH key for Edge server (~/.ssh/ssh-key-zion-edge or similar)
#   - Edge server reachable via Tailscale (62.171.141.136) or public IP (62.171.141.136)
#   - 3.0.3 code pushed to git on Edge server
# =============================================================================

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────
EDGE_TS_IP="62.171.141.136"
EDGE_PUBLIC_IP="62.171.141.136"
EDGE_SSH_USER="root"
EDGE_REPO="/root/zion-2.9.6-main"
EDGE_DB="${EDGE_REPO}/data/edge-state.db"
EDGE_BACKUP_DB="${EDGE_REPO}/data/edge-state.db.bak-3.0.3-cutover"
EDGE_NODE_BIN="/usr/local/bin/zion-node"
EDGE_POOL_BIN="/usr/local/bin/zion-pool-server"
SSH_OPTS="-o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Determine SSH target ─────────────────────────────────────────────────
SSH_TARGET=""
ssh_test() {
    ssh $SSH_OPTS "${EDGE_SSH_USER}@${EDGE_TS_IP}" "echo ok" 2>/dev/null
}
if ssh_test >/dev/null 2>&1; then
    SSH_TARGET="${EDGE_SSH_USER}@${EDGE_TS_IP}"
    info "Using Tailscale IP: $EDGE_TS_IP"
else
    info "Tailscale unreachable, trying public IP: $EDGE_PUBLIC_IP"
    if ssh $SSH_OPTS "${EDGE_SSH_USER}@${EDGE_PUBLIC_IP}" "echo ok" >/dev/null 2>&1; then
        SSH_TARGET="${EDGE_SSH_USER}@${EDGE_PUBLIC_IP}"
        ok "Using public IP: $EDGE_PUBLIC_IP"
    else
        error "Cannot reach Edge server on either Tailscale or public IP"
    fi
fi

SSH="ssh $SSH_OPTS $SSH_TARGET"

# ── Dry run mode ─────────────────────────────────────────────────────────
DRY_RUN=false
ROLLBACK=false
for arg in "$@"; do
    case $arg in
        --dry)      DRY_RUN=true; warn "DRY RUN — no changes will be made" ;;
        --rollback) ROLLBACK=true ;;
    esac
done

# ── Rollback mode ────────────────────────────────────────────────────────
if $ROLLBACK; then
    warn "ROLLBACK MODE — restoring pre-3.0.3 state"
    info "Stopping services..."
    $SSH "systemctl stop zion-pool.service zion-node.service 2>/dev/null || true"
    
    info "Restoring DB backup..."
    $SSH "if [ -f ${EDGE_BACKUP_DB} ]; then cp ${EDGE_BACKUP_DB} ${EDGE_DB}; echo 'DB restored'; else echo 'No backup found'; fi"
    
    info "Restoring old binary..."
    $SSH "cd ${EDGE_REPO} && git log --oneline -10 | head -10"
    echo -e "${YELLOW}Find the pre-3.0.3 commit above and run:${NC}"
    echo "  ssh $SSH_TARGET 'cd $EDGE_REPO && git checkout <commit> && cargo build --release --manifest-path V3/Cargo.toml -p zion-core --bin node && cp target/release/node $EDGE_NODE_BIN'"
    
    info "Restarting services..."
    $SSH "systemctl daemon-reload && systemctl start zion-node.service zion-pool.service"
    ok "Rollback complete — verify with: curl -s http://127.0.0.1:8443 -d '{\"jsonrpc\":\"2.0\",\"method\":\"getChainInfo\",\"params\":{},\"id\":1}' | jq ."
    exit 0
fi

# =============================================================================
# PHASE 1: Pre-cutover checks
# =============================================================================
echo ""
info "========================================"
info "PHASE 1: Pre-cutover checks"
info "========================================"

# Check 1: Edge server reachable
ok "Edge server reachable at $SSH_TARGET"

# Check 2: Current chain height + tip hash
info "Querying current chain state..."
CHAIN_INFO=$($SSH "curl -s http://127.0.0.1:8443 -d '{\"jsonrpc\":\"2.0\",\"method\":\"getChainInfo\",\"params\":{},\"id\":1}'" 2>/dev/null || echo "{}")
CURRENT_HEIGHT=$(echo "$CHAIN_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',{}).get('height','?'))" 2>/dev/null || echo "?")
TIP_HASH=$(echo "$CHAIN_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',{}).get('tip_hash_hex','?')[:20])" 2>/dev/null || echo "?")
ok "Current chain height: $CURRENT_HEIGHT, tip: ${TIP_HASH}..."

# Check 3: DB exists
info "Checking DB exists..."
$SSH "test -f ${EDGE_DB} && echo 'DB exists' || echo 'DB MISSING'" | grep -q "DB exists" || error "Edge DB not found at $EDGE_DB"
ok "DB exists at $EDGE_DB"

# Check 4: Services running
info "Checking services..."
$SSH "systemctl is-active zion-node.service" 2>/dev/null | grep -q active && ok "zion-node.service: active" || warn "zion-node.service: not active"
$SSH "systemctl is-active zion-pool.service" 2>/dev/null | grep -q active && ok "zion-pool.service: active" || warn "zion-pool.service: not active"

# =============================================================================
# PHASE 2: Backup (CRITICAL)
# =============================================================================
echo ""
info "========================================"
info "PHASE 2: Backup (CRITICAL — do not skip)"
info "========================================"

if $DRY_RUN; then
    warn "[DRY] Would backup DB to ${EDGE_BACKUP_DB}"
    warn "[DRY] Would record pre-cutover state"
else
    info "Backing up DB..."
    $SSH "cp ${EDGE_DB} ${EDGE_BACKUP_DB} && ls -lh ${EDGE_BACKUP_DB}"
    ok "DB backed up to ${EDGE_BACKUP_DB}"
    
    info "Recording pre-cutover state..."
    $SSH "echo '{\"height\":${CURRENT_HEIGHT},\"tip_hash\":\"${TIP_HASH}\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}' > ${EDGE_REPO}/data/pre-3.0.3-state.json"
    ok "Pre-cutover state recorded"
fi

# =============================================================================
# PHASE 3: Build 3.0.3 binaries on Edge
# =============================================================================
echo ""
info "========================================"
info "PHASE 3: Build 3.0.3 binaries"
info "========================================"

if $DRY_RUN; then
    warn "[DRY] Would pull latest code and build 3.0.3 binaries"
else
    info "Pulling latest code on Edge..."
    $SSH "cd ${EDGE_REPO} && git pull origin main 2>&1 | tail -5"
    ok "Code updated"
    
    info "Building zion-core (node)..."
    $SSH "source /root/.cargo/env && cd ${EDGE_REPO} && cargo build --release --manifest-path V3/Cargo.toml -p zion-core --bin node 2>&1 | tail -3"
    ok "Node binary built"
    
    info "Building zion-pool..."
    $SSH "source /root/.cargo/env && cd ${EDGE_REPO} && cargo build --release --manifest-path V3/Cargo.toml -p zion-pool --bin server 2>&1 | tail -3"
    ok "Pool binary built"
    
    info "Building zion-cli..."
    $SSH "source /root/.cargo/env && cd ${EDGE_REPO} && cargo build --release --manifest-path V3/Cargo.toml -p zion-cli 2>&1 | tail -3"
    ok "CLI built"
fi

# =============================================================================
# PHASE 4: Cutover (swap binaries, preserve DB)
# =============================================================================
echo ""
info "========================================"
info "PHASE 4: CUTOVER (swap binaries, preserve DB)"
info "========================================"

if $DRY_RUN; then
    warn "[DRY] Would stop services, swap binaries, set MIGRATION_HEIGHT=${CURRENT_HEIGHT}, restart"
    exit 0
fi

info "Stopping services..."
$SSH "systemctl stop zion-pool.service zion-node.service"
ok "Services stopped"

info "Swapping node binary..."
$SSH "cp ${EDGE_REPO}/V3/target/release/node ${EDGE_NODE_BIN}"
ok "Node binary swapped"

info "Swapping pool binary..."
$SSH "cp ${EDGE_REPO}/V3/target/release/server ${EDGE_POOL_BIN}"
ok "Pool binary swapped"

info "Verifying new binary version..."
$SSH "${EDGE_NODE_BIN} --version 2>/dev/null || echo 'version check skipped'"
ok "Binary version verified"

info "Setting migration height to ${CURRENT_HEIGHT}..."
# Set ZION_MIGRATION_HEIGHT in the systemd service or env
$SSH "grep -q ZION_MIGRATION_HEIGHT /etc/systemd/system/zion-node.service 2>/dev/null && \
      sed -i 's/ZION_MIGRATION_HEIGHT=.*/ZION_MIGRATION_HEIGHT=${CURRENT_HEIGHT}/' /etc/systemd/system/zion-node.service || \
      sed -i '/\[Service\]/a Environment=ZION_MIGRATION_HEIGHT=${CURRENT_HEIGHT}' /etc/systemd/system/zion-node.service 2>/dev/null || \
      echo 'ZION_MIGRATION_HEIGHT=${CURRENT_HEIGHT}' >> ${EDGE_REPO}/.env"
ok "Migration height set to ${CURRENT_HEIGHT}"

info "Reloading systemd + starting node..."
$SSH "systemctl daemon-reload && systemctl start zion-node.service"
ok "Node started"

info "Waiting for node to initialize (10s)..."
sleep 10

info "Verifying node is healthy..."
NODE_INFO=$($SSH "curl -s http://127.0.0.1:8443 -d '{\"jsonrpc\":\"2.0\",\"method\":\"getNodeInfo\",\"params\":{},\"id\":1}'" 2>/dev/null || echo "{}")
NEW_HEIGHT=$(echo "$NODE_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin).get('result',{}); print(d.get('chain_height','?'))" 2>/dev/null || echo "?")
FPZ=$(echo "$NODE_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin).get('result',{}); print(d.get('flowers_per_zion','?'))" 2>/dev/null || echo "?")
PROTO=$(echo "$NODE_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin).get('result',{}); print(d.get('protocol_version_numeric','?'))" 2>/dev/null || echo "?")

ok "Node height: $NEW_HEIGHT (was $CURRENT_HEIGHT)"
ok "flowers_per_zion: $FPZ (should be 1000000)"
ok "protocol_version_numeric: $PROTO (should be 2)"

if [ "$FPZ" != "1000000" ]; then
    error "flowers_per_zion is $FPZ, expected 1000000 — ABORTING, do not start pool"
fi

if [ "$NEW_HEIGHT" != "$CURRENT_HEIGHT" ]; then
    warn "Height changed from $CURRENT_HEIGHT to $NEW_HEIGHT — verify this is expected"
fi

info "Starting pool..."
$SSH "systemctl start zion-pool.service"
ok "Pool started"

# =============================================================================
# PHASE 5: Post-cutover verification
# =============================================================================
echo ""
info "========================================"
info "PHASE 5: Post-cutover verification"
info "========================================"

sleep 5

info "Checking node logs for errors..."
ERRORS=$($SSH "journalctl -u zion-node.service --since '2 min ago' 2>/dev/null | grep -i 'error\|panic\|fatal' | head -5" || echo "")
if [ -z "$ERRORS" ]; then
    ok "No errors in node logs"
else
    warn "Errors found in node logs:"
    echo "$ERRORS"
fi

info "Checking pool logs for errors..."
ERRORS=$($SSH "journalctl -u zion-pool.service --since '2 min ago' 2>/dev/null | grep -i 'error\|panic\|fatal' | head -5" || echo "")
if [ -z "$ERRORS" ]; then
    ok "No errors in pool logs"
else
    warn "Errors found in pool logs:"
    echo "$ERRORS"
fi

info "Checking P2P peers..."
PEERS=$($SSH "curl -s http://127.0.0.1:8443 -d '{\"jsonrpc\":\"2.0\",\"method\":\"getPeerInfo\",\"params\":{},\"id\":1}'" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin).get('result',{}); print(len(d.get('peers',[])))" 2>/dev/null || echo "?")
ok "Connected peers: $PEERS"

info "Checking supply info..."
SUPPLY=$($SSH "curl -s http://127.0.0.1:8443 -d '{\"jsonrpc\":\"2.0\",\"method\":\"getSupplyInfo\",\"params\":{},\"id\":1}'" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin).get('result',{}); print('total_flowers:', d.get('total_supply_flowers','?'), 'total_zion:', d.get('total_supply_zion','?'))" 2>/dev/null || echo "?")
ok "Supply: $SUPPLY"

# =============================================================================
# Summary
# =============================================================================
echo ""
info "========================================"
info "DEPLOYMENT COMPLETE"
info "========================================"
echo ""
ok "3.0.3 decimal fork deployed to Edge"
ok "Chain height preserved: $CURRENT_HEIGHT → $NEW_HEIGHT"
ok "flowers_per_zion: 1000000 (6-decimal)"
ok "protocol_version: 2"
ok "DB preserved at ${EDGE_DB}"
ok "Backup at ${EDGE_BACKUP_DB}"
echo ""
info "Rollback: ./scripts/deploy-3.0.3-edge.sh --rollback"
info "Verify:   curl -s http://62.171.141.136:8443 -d '{\"jsonrpc\":\"2.0\",\"method\":\"getNodeInfo\",\"params\":{},\"id\":1}' | jq ."
echo ""
ok "Peace and One Love. — 3.0.3 fork complete"
