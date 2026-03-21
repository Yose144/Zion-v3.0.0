# ZION V3 Node Operator Guide

> **Version:** 3.0.0 (v2.9.8 Deeksha canonical)  
> **Network:** ZION Mainnet

---

## Quick Start

### Build from source

```bash
cd V3
cargo build --release -p zion-core
# binaries:
#   target/release/zion-node
#   target/release/zion-pool-server
```

### Run a node

```bash
export ZION_NODE_ID="my-node-01"
export ZION_P2P_BIND="0.0.0.0:8334"
export ZION_RPC_BIND="127.0.0.1:8332"
export ZION_SEED_PEERS="91.98.122.165:8334,46.225.126.243:8334"
export ZION_NODE_STATE_PATH="/var/lib/zion/state"
./zion-node
```

### Run a pool (requires a running node)

```bash
export ZION_POOL_BIND="0.0.0.0:3333"
export ZION_NODE_RPC_ADDR="127.0.0.1:8332"
export ZION_ROUTING_METRICS_BIND="0.0.0.0:9550"
./zion-pool-server
```

---

## Node Environment Variables

### Identity & Networking

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_NODE_ID` | `v3-node-0` | Unique node identifier |
| `ZION_MINER_ADDRESS` | *(empty)* | Coinbase address for block rewards |
| `ZION_P2P_BIND` | `127.0.0.1:10000` | P2P listener bind address |
| `ZION_RPC_BIND` | `127.0.0.1:8332` | RPC listener bind address |
| `ZION_POOL_BIND` | `127.0.0.1:9332` | Pool mining listener (for local miner) |
| `ZION_SEED_PEERS` | *(none)* | Comma-separated bootstrap peer addresses |

### Connection Limits

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_ACCEPT_LIMIT` | *(unbounded)* | Global connection limit |
| `ZION_P2P_ACCEPT_LIMIT` | *(inherits above)* | P2P-only connection limit |
| `ZION_RPC_ACCEPT_LIMIT` | *(inherits above)* | RPC-only connection limit |

### State & Sync

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_NODE_STATE_PATH` | *(in-memory)* | Path for persistent LMDB blockchain store |
| `ZION_SYNC_BATCH_LIMIT` | `32` | Max blocks per peer sync batch |

### Monitoring

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_METRICS_BIND` | `0.0.0.0:9115` | Prometheus metrics HTTP endpoint |

---

## Pool Server Environment Variables

### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_POOL_BIND` | `127.0.0.1:8444` | Stratum listener bind address |
| `ZION_NODE_RPC_ADDR` | *(none)* | Node RPC for template/submit |
| `ZION_ACCEPT_LIMIT` | *(unbounded)* | Max miner connections |
| `ZION_POOL_LOOP_COUNT` | `1` | Job iterations per session |
| `ZION_JOB_TTL_MS` | `15000` | Job expiry (ms) |
| `ZION_MAX_SESSIONS_PER_IP` | `10` | Rate limit: max sessions per IP |

### PPLNS Payouts

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_PPLNS_WINDOW_SIZE` | `1000` | Sliding share window for payout calculation |
| `ZION_PPLNS_MIN_PAYOUT` | *(core constant)* | Min payout threshold (flowers) |

### Revenue Routing

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_REVENUE_MULTISTREAM` | `false` | Enable 50/25/25 multi-lane routing |
| `ZION_STREAM_ZION_PCT` | `50` | ZION lane weight |
| `ZION_STREAM_BLAKE3_PCT` | `25` | Blake3 external lane weight |
| `ZION_STREAM_NCL_PCT` | `25` | NCL AI lane weight |
| `ZION_USER_DEFAULT_GROUP` | `zion` | Default session group for miners |
| `ZION_BACKEND_MINER_IDS` | *(empty)* | Backend miner IDs (auto-routed) |
| `ZION_BACKEND_WORKER_HINTS` | `backend,revenue,ncl` | Worker name hints for backend detection |

### Metrics

| Variable | Default | Description |
|----------|---------|-------------|
| `ZION_ROUTING_METRICS_BIND` | *(none)* | HTTP bind for pool metrics endpoint |
| `ZION_ROUTING_LOG_EVERY` | `25` | Log routing snapshot every N submits |

---

## Docker Deployment

### docker-compose (recommended)

```yaml
# docker-compose.v3-testnet.yml
services:
  zion-node:
    image: zion-v3-node:latest
    ports:
      - "8334:8334"   # P2P
      - "8332:8332"   # RPC
      - "9115:9115"   # Metrics
    environment:
      - ZION_NODE_ID=prod-node-01
      - ZION_P2P_BIND=0.0.0.0:8334
      - ZION_RPC_BIND=0.0.0.0:8332
      - ZION_METRICS_BIND=0.0.0.0:9115
      - ZION_SEED_PEERS=91.98.122.165:8334
      - ZION_NODE_STATE_PATH=/data/state

  zion-pool:
    image: zion-v3-pool:latest
    ports:
      - "3333:3333"    # Stratum
      - "9550:9550"    # Pool metrics
    environment:
      - ZION_POOL_BIND=0.0.0.0:3333
      - ZION_NODE_RPC_ADDR=zion-node:8332
      - ZION_ROUTING_METRICS_BIND=0.0.0.0:9550
      - ZION_MAX_SESSIONS_PER_IP=10
```

### Build Docker images

```bash
docker build -f docker/Dockerfile.core -t zion-v3-node:latest .
docker build -f docker/Dockerfile.pool -t zion-v3-pool:latest .
docker build -f docker/Dockerfile.miner -t zion-v3-miner:latest .
```

---

## Monitoring Setup

### Prometheus

The node exposes metrics on `ZION_METRICS_BIND` (default `:9115`):

```
GET /metrics    → Prometheus exposition format
GET /health     → JSON health check
```

**Node metrics:**
- `zion_chain_height` — current chain tip
- `zion_mempool_size` — pending transactions
- `zion_peer_count` — connected peers
- `zion_blocks_accepted_total` — accepted blocks
- `zion_blocks_rejected_total` — rejected blocks
- `zion_template_height` — latest template height

The pool exposes metrics on `ZION_ROUTING_METRICS_BIND`:

```
GET /metrics    → Prometheus exposition format
GET /health     → JSON health check
GET /stats      → JSON detailed stats
```

**Pool metrics:**
- `zion_pool_submits_total` — total share submissions
- `zion_pool_accepted_total` — accepted shares
- `zion_pool_rejected_total` — rejected shares
- `zion_pool_active_sessions` — connected miners
- `zion_pool_uptime_seconds` — pool uptime
- `zion_pplns_window_used` — PPLNS window fill level
- `zion_pplns_registered_miners` — registered payout addresses

### Prometheus scrape config

```yaml
scrape_configs:
  - job_name: 'zion-node'
    static_configs:
      - targets: ['localhost:9115']
  - job_name: 'zion-pool'
    static_configs:
      - targets: ['localhost:9550']
```

### Alert rules (recommended)

```yaml
groups:
  - name: zion
    rules:
      - alert: PoolNoMiners
        expr: zion_pool_active_sessions == 0
        for: 5m
      - alert: HighRejectRate
        expr: (zion_pool_rejected_total / zion_pool_submits_total) > 0.10
        for: 10m
      - alert: NodeNotSyncing
        expr: changes(zion_chain_height[10m]) == 0
        for: 15m
```

---

## Server Hardening

See [HARDENING.md](../../docs/ops/HARDENING.md) for the full checklist:

- **Firewall (ufw):** Allow 8334 (P2P), 3333 (stratum). Restrict 8332 (RPC), 9115, 9550 to monitoring subnet.
- **Docker log limits:** `--log-opt max-size=50m --log-opt max-file=3`
- **Logrotate:** Rotate miner/pool stdout logs daily, keep 14 days.
- **Unattended upgrades:** Enable for security patches.
- **SSH:** Key-only auth, disable root password login.

---

## Troubleshooting

**Node won't sync:**  
Check `ZION_SEED_PEERS` — at least one reachable seed is required. Verify
firewall allows outbound TCP on port 8334.

**Pool shows 0 sessions:**  
Ensure `ZION_POOL_BIND` is on `0.0.0.0` (not `127.0.0.1`) if miners connect
remotely. Check Docker port mapping.

**High stale rate (>5%):**  
Reduce `ZION_JOB_TTL_MS` or increase miner hash rate. Network latency between
miner and pool also contributes — prefer geographically close pools.

**Metrics endpoint not responding:**  
Verify `ZION_METRICS_BIND` / `ZION_ROUTING_METRICS_BIND` are set and the port
is not blocked by firewall.
