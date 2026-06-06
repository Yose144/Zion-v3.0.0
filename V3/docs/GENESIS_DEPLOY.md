# ZION V3 — Genesis #0 Edge Server Deploy Runbook

## Overview

This runbook deploys a **clean Genesis #0** ZION V3 mainnet stack on the Edge server (Hetzner VPS). It assumes a fresh or fully-reset environment — no stale chain state, no old databases.

**Target host:** Edge (Hetzner)  
**Public IP:** `77.42.71.94`  
**Tailscale:** `100.76.16.108`  
**Role:** Primary node + pool + bridge + DAO + atomic-swap + WARP

## Pre-Flight Checklist

| # | Item | Verification |
|---|------|-------------|
| 1 | SSH access to Edge | `ssh root@100.76.16.108` (Tailscale) |
| 2 | Tailscale active | `tailscale status` shows 100.76.16.108 |
| 3 | Docker + Compose installed | `docker compose version` |
| 4 | Rust toolchain installed | `rustc --version` ≥ 1.78 |
| 5 | Foundry installed (for bridge) | `forge --version` |
| 6 | Repo cloned at `/root/zion-2.9.6-main` | `cd /root/zion-2.9.6-main && git log --oneline -1` |
| 7 | `ZION_POOL_PAYOUT_SK_HEX` set in env | Review `edge-deploy/config/edge-environment.sh` |
| 8 | Firewall allows ports 8333, 8443, 8444, 8445 | `ufw status` or Hetzner firewall console |

## Step 1: Clean Datadir (⚠️ Destructive)

```bash
ssh root@100.76.16.108
cd /root/zion-2.9.6-main

# Stop ALL services
systemctl stop zion-edge-pool zion-edge-node2 zion-edge-node1 \
  zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp \
  zion-edge-watchdog

# Remove old state (BACKUP FIRST if you have live mainnet data!)
mkdir -p /root/zion-backups/$(date +%Y%m%d-%H%M%S)
mv data/ /root/zion-backups/$(date +%Y%m%d-%H%M%S)/ || true
rm -rf data/
mkdir -p data

# Reset any bridge / DAO / WARP SQLite databases
rm -f V3/data/*.db V3/data/*.db-shm V3/data/*.db-wal
```

> **Never run this on a live mainnet node with history.** This is for Genesis #0 only.

## Step 2: Build Release Binaries

```bash
cd /root/zion-2.9.6-main/V3
cargo build --release --workspace

# Verify binaries exist
ls -la target/release/node target/release/server target/release/zion-bridge \
  target/release/zion-dao target/release/zion-atomic-swap \
  target/release/zion-warp-server
```

Expected build time: ~8–15 min on Hetzner VPS (4 vCPU).

## Step 3: Configure Environment

```bash
cat > /root/zion-2.9.6-main/edge-deploy/config/edge-environment.sh << 'EOF'
# ZION Edge Server — Genesis #0 Environment
# DO NOT COMMIT THIS FILE — contains secrets.

# ── Fee Split (89/5/5/0 burn model) ──
ZION_MINER_ADDRESS=zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604
ZION_HUMANITARIAN_WALLET=zion165a527w5d0n085t775x3w8n8q20742a6w7xr0z3
ZION_ISSOBELLA_WALLET=zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702
ZION_POOL_FEE_PCT=0

# ── Pool (PRIMARY) ──
ZION_POOL_BIND=0.0.0.0:8444
ZION_NODE_RPC_ADDR=127.0.0.1:8443
ZION_POOL_LOOP_COUNT=1000000
ZION_MAX_SESSIONS_PER_IP=10
ZION_NONCE_COUNT=4096
ZION_VARDIFF_START_DIFF=1
ZION_VARDIFF_MAX_DIFF=10000
ZION_PPLNS_WINDOW_SIZE=500000
ZION_ROUTING_METRICS_BIND=0.0.0.0:8455
ZION_POOL_WALLET=zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604
ZION_POOL_PAYOUT_SK_HEX=<REDACTED>

# ── Node 1 (Primary / Genesis) ──
ZION_NODE_ID=zion-edge-primary
ZION_P2P_BIND=0.0.0.0:8333
ZION_RPC_BIND=127.0.0.1:8443
ZION_SEED_PEERS=none
ZION_NODE_STATE_PATH=/root/zion-2.9.6-main/data/edge-state.db

# ── Node 2 (Follower) ──
ZION_NODE2_ID=zion-edge-follower
ZION_P2P_BIND2=0.0.0.0:8334
ZION_RPC_BIND2=127.0.0.1:8446
ZION_NODE2_STATE_PATH=/root/zion-2.9.6-main/data/edge-follower-state.db

# ── Bridge ──
ZION_BRIDGE_CONFIG=/root/zion-2.9.6-main/V3/config/bridge-mainnet.toml

# ── DAO ──
ZION_DAO_CONFIG=/root/zion-2.9.6-main/V3/config/dao-mainnet.toml

# ── WARP ──
ZION_WARP_CONFIG=/root/zion-2.9.6-main/V3/config/warp-mainnet.toml
EOF

chmod 600 /root/zion-2.9.6-main/edge-deploy/config/edge-environment.sh
```

## Step 4: Install Systemd Services

```bash
cd /root/zion-2.9.6-main
./edge-deploy/setup-edge.sh
```

This installs all services and enables auto-start on boot.

## Step 5: Start Core Services (Genesis Sequence)

```bash
# 1. Start primary node (creates Genesis #0)
systemctl start zion-edge-node1
sleep 5
journalctl -u zion-edge-node1 --no-pager -n 20

# Verify Genesis block
# (If node exposes RPC, query height:)
curl -s -X POST http://127.0.0.1:8443/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' | jq .

# Expected: height = 0, chain_id = "zion-mainnet-1"

# 2. Start follower node
systemctl start zion-edge-node2

# 3. Start pool (connects to Node 1 RPC)
systemctl start zion-edge-pool

# 4. Verify pool is accepting connections
curl -s http://127.0.0.1:8455/metrics | grep zion_pool_active_sessions
```

## Step 6: Start L2/L3 Services

```bash
systemctl start zion-edge-bridge
systemctl start zion-edge-dao
systemctl start zion-edge-atomic-swap
systemctl start zion-edge-warp
```

Verify each service health:

```bash
# Bridge metrics
curl -s http://127.0.0.1:9102/metrics | grep zion_bridge_online

# DAO API
curl -s http://127.0.0.1:8450/health

# Atomic Swap API
curl -s http://127.0.0.1:8452/health

# WARP API
curl -s http://127.0.0.1:8453/health
```

## Step 7: Start Monitoring Stack

```bash
cd /root/zion-2.9.6-main/V3/docker

# Start Prometheus + Grafana + Alertmanager + Node Exporter
docker compose -f docker-compose.yml --profile monitoring up -d

# Verify Prometheus targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[].labels.job'

# Grafana login: admin / (password from docker-compose or env)
# Dashboard: http://100.76.16.108:3100
```

## Step 8: Smoke Test

Run the following from your local PC (Core) via Tailscale:

```bash
# Test P2P sync
nc -z -v 100.76.16.108 8333 && echo "P2P OK" || echo "P2P FAIL"

# Test pool connection
nc -z -v 100.76.16.108 8444 && echo "Pool OK" || echo "Pool FAIL"

# Test RPC
curl -s http://100.76.16.108:8443/jsonrpc \
  -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' | jq '.result.height'

# Test WebSocket
wscat -c ws://100.76.16.108:8445/ws 2>/dev/null && echo "WS OK" || echo "WS FAIL"
```

## Step 9: Backup Genesis State

```bash
ssh root@100.76.16.108 << 'REMOTE'
mkdir -p /root/zion-backups/genesis-0-$(date +%Y%m%d)
cp -r /root/zion-2.9.6-main/data /root/zion-backups/genesis-0-$(date +%Y%m%d)/
cp /root/zion-2.9.6-main/edge-deploy/config/edge-environment.sh \
   /root/zion-backups/genesis-0-$(date +%Y%m%d)/
sha256sum /root/zion-backups/genesis-0-$(date +%Y%m%d)/data/* > \
   /root/zion-backups/genesis-0-$(date +%Y%m%d)/checksums.sha256
REMOTE
```

## Rollback Plan

If anything fails within 24h of Genesis:

```bash
# Emergency stop
systemctl stop zion-edge-pool zion-edge-node2 zion-edge-node1

# Restore from backup
rm -rf /root/zion-2.9.6-main/data
cp -r /root/zion-backups/genesis-0-<DATE>/data /root/zion-2.9.6-main/

# Restart
systemctl start zion-edge-node1 zion-edge-node2 zion-edge-pool
```

## Post-Deploy Verification Checklist

| # | Check | Command |
|---|-------|---------|
| 1 | Node 1 height = 0 | `curl ... getChainInfo` |
| 2 | Node 2 syncing from Node 1 | `journalctl -u zion-edge-node2 -n 10` |
| 3 | Pool accepting miners | `curl localhost:8455/metrics` |
| 4 | Bridge relay online | `curl localhost:9102/metrics` |
| 5 | Grafana dashboards live | `open http://100.76.16.108:3100` |
| 6 | Alertmanager firing test | `./scripts/test-alertmanager.sh` |
| 7 | No critical alerts | `curl localhost:9090/api/v1/alerts` |
| 8 | Genesis backup exists | `ls /root/zion-backups/genesis-0-*/` |

## Related Files

- `edge-deploy/setup-edge.sh` — systemd service installer
- `edge-deploy/systemd/*.service` — individual service definitions
- `V3/docker/docker-compose.yml` — monitoring stack
- `V3/docs/BRIDGE_MAINNET_DEPLOY.md` — bridge contract deploy (after core is live)
- `scripts/provision-bridge-validators.sh` — guardian key generation
