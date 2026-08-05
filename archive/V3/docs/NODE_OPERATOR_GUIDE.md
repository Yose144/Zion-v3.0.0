# ZION V3 Node Operator Guide

Version: 3.0.0  
Network: ZION Mainnet track  
Last updated: 2026-03-28

This guide documents the **current V3 mainnet deployment model**.

It intentionally reflects the live mainnet-track stack used in the 2026-03-28 fee-split rollout.

## 1. Critical Notes

- The canonical production manifest is the root-level `docker/docker-compose.v3-mainnet.yml`
- Do not assume `V3/docker/docker-compose.v3-mainnet.yml` is the deploy source of truth
- Node RPC on current V3 mainnet is **raw TCP JSON-RPC** on port `8443`, not HTTP
- The exact post-deploy verification flow lives in `MAINNET_DEPLOY_RUNBOOK.md`

## 2. Build From Source

From `V3/`:

```bash
cd V3
cargo build --release -p zion-core -p zion-pool -p zion-miner
```

Expected binaries:

- `target/release/node`
- `target/release/server`
- `target/release/zion-miner`

## 3. Recommended Docker Deploy

From repo root:

```bash
cd /path/to/2.9.6
docker compose --env-file .env -f docker/docker-compose.v3-mainnet.yml up -d --build
```

Current service set in the canonical manifest:

- `core`
- `seed1`
- `pool`
- `miner`
- `redis`

### Required `.env`

Minimum practical variables:

- `REDIS_PASSWORD`
- `MINER_WALLET`
- `MINER_WORKER`

Common optional variables:

- `NODE_ID`
- `SEED_NODE_ID`
- `SEED_PEERS`
- `HUMANITARIAN_WALLET`
- `ISSOBELLA_WALLET`
- `POOL_FEE_WALLET`
- `MINER_CPUS`

## 4. Current Mainnet Port Model

### Core

- P2P: `8333/tcp`
- RPC: `8443/tcp` raw JSON-RPC
- internal pool listener on core: `8444/tcp`
- metrics: `9115/http`

### Pool

- stratum: `3333/tcp`
- stats and metrics: `8080/http`

### Redis

- internal only: `6379/tcp`

## 5. Running Binaries Manually

### Node

Example mainnet-track node launch:

```bash
export ZION_NODE_ID="v3-mainnet-local"
export ZION_NODE_STATE_PATH="/var/lib/zion/chain_state.json"
export ZION_P2P_BIND="0.0.0.0:8333"
export ZION_RPC_BIND="0.0.0.0:8443"
export ZION_POOL_BIND="0.0.0.0:8444"
export ZION_METRICS_BIND="0.0.0.0:9115"
export ZION_SEED_PEERS="77.42.71.94:8333,100.76.16.108:8333"
export ZION_MINER_ADDRESS="zion1..."

# Set all three fee-wallet vars together, or none of them.
export ZION_HUMANITARIAN_WALLET="zion1..."
export ZION_ISSOBELLA_WALLET="zion1..."
export ZION_POOL_FEE_WALLET="zion1..."

./target/release/node
```

Important runtime rule:

- `ZION_HUMANITARIAN_WALLET`, `ZION_ISSOBELLA_WALLET`, and `ZION_POOL_FEE_WALLET` must either all be set together or all be omitted
- For the Core + Edge fleet, exclude the host's own public address from `ZION_SEED_PEERS`; external or fresh nodes can use the full public seed list

### Pool

Example pool launch against a local node:

```bash
export ZION_POOL_BIND="0.0.0.0:3333"
export ZION_NODE_RPC_ADDR="127.0.0.1:8443"
export ZION_ROUTING_METRICS_BIND="0.0.0.0:8080"
export ZION_POOL_LOOP_COUNT="4294967295"
export ZION_NONCE_COUNT="500000"
export ZION_NONCE_STRIDE="65536"
export ZION_JOB_TTL_MS="3600000"

./target/release/server
```

### Miner

Example miner launch against a local or nearby pool:

```bash
export ZION_POOL_ADDR="127.0.0.1:3333"
export ZION_MINER_ID="zion1..."
export ZION_WORKER_NAME="mainnet-miner"
export ZION_LOOP_COUNT="4294967295"
export ZION_NONCE_COUNT="500000"
export ZION_JOB_TTL_MS="3600000"

./target/release/zion-miner
```

## 6. Node Environment Variables

### Identity and Networking

| Variable | Purpose |
|----------|---------|
| `ZION_NODE_ID` | unique node identifier |
| `ZION_MINER_ADDRESS` | miner coinbase address |
| `ZION_HUMANITARIAN_WALLET` | 5% fee-split recipient |
| `ZION_ISSOBELLA_WALLET` | 5% fee-split recipient |
| `ZION_POOL_FEE_WALLET` | 1% fee-split recipient |
| `ZION_P2P_BIND` | P2P bind address |
| `ZION_RPC_BIND` | raw TCP JSON-RPC bind address |
| `ZION_POOL_BIND` | internal pool listener bind |
| `ZION_SEED_PEERS` | bootstrap peer list |

### Limits and State

| Variable | Purpose |
|----------|---------|
| `ZION_ACCEPT_LIMIT` | global connection limit |
| `ZION_P2P_ACCEPT_LIMIT` | P2P-only limit |
| `ZION_RPC_ACCEPT_LIMIT` | RPC-only limit |
| `ZION_NODE_STATE_PATH` | persistent chain state file |
| `ZION_SYNC_BATCH_LIMIT` | max batch size for peer sync |

### Monitoring

| Variable | Purpose |
|----------|---------|
| `ZION_METRICS_BIND` | node metrics HTTP endpoint |

## 7. Pool Environment Variables

### Core flow

| Variable | Purpose |
|----------|---------|
| `ZION_POOL_BIND` | public stratum listener |
| `ZION_NODE_RPC_ADDR` | raw TCP RPC target for template/submit |
| `ZION_ACCEPT_LIMIT` | max miner connections |
| `ZION_POOL_LOOP_COUNT` | session loop count |
| `ZION_JOB_TTL_MS` | job expiry |
| `ZION_NONCE_COUNT` | nonce scan window |
| `ZION_NONCE_STRIDE` | nonce stride |
| `ZION_MAX_SESSIONS_PER_IP` | session cap per IP |

### Routing and metrics

| Variable | Purpose |
|----------|---------|
| `ZION_REVENUE_MULTISTREAM` | multi-lane revenue routing |
| `ZION_USER_DEFAULT_GROUP` | default miner group |
| `ZION_BACKEND_MINER_IDS` | backend auto-routing allowlist |
| `ZION_BACKEND_WORKER_HINTS` | backend worker pattern matching |
| `ZION_ROUTING_METRICS_BIND` | pool metrics and stats HTTP bind |
| `ZION_ROUTING_LOG_EVERY` | periodic routing snapshot interval |

## 8. Health Checks And Verification

### Core metrics

Node metrics HTTP server:

- `GET /metrics`
- `GET /health`

Example:

```bash
curl -s http://127.0.0.1:9115/health
curl -s http://127.0.0.1:9115/metrics | head -20
```

### Pool stats

Pool API surface on current mainnet stack:

- `GET /health`
- `GET /metrics`
- `GET /stats`

Example:

```bash
curl -s http://127.0.0.1:8080/health
curl -s http://127.0.0.1:8080/stats
```

### Raw JSON-RPC check

Do not use HTTP curl against `8443`.

Use `nc` with line-delimited JSON-RPC:

```bash
printf '%s\n' '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}' | nc -w 2 127.0.0.1 8443
```

Example block lookup:

```bash
printf '%s\n' '{"jsonrpc":"2.0","method":"getBlockByHeight","params":[465],"id":1}' | nc -w 2 127.0.0.1 8443
```

## 9. Hardening

See `../docker/HARDENING.md` for current V3 server hardening guidance.

At minimum:

- restrict public exposure to the ports that are actually needed
- keep RPC and metrics access tight if they do not need public reachability
- enable Docker log limits and log rotation
- keep SSH key-only

## 10. Troubleshooting

### Node will not sync

- verify `ZION_SEED_PEERS` points to reachable `host:8333` peers
- verify outbound TCP on `8333` is allowed
- confirm all peers agree on `chain_height` and `tip_hash`

### RPC looks dead

- check whether you are mistakenly treating `8443` as HTTP
- use raw TCP JSON-RPC over `nc`
- inspect `docker logs zion-core`

### Fee split did not activate after deploy

- inspect live `zion-core` env, not only the compose file on disk
- confirm all three fee wallet variables are present together
- wait for the first new block and inspect it over `getBlockByHeight`
- follow `MAINNET_DEPLOY_RUNBOOK.md`

### Pool shows zero miners

- verify `ZION_POOL_BIND=0.0.0.0:3333`
- verify Docker port mapping for `3333`
- inspect `http://127.0.0.1:8080/stats`

### High stale or reject rate

- inspect recent `zion-pool` and `zion-miner` logs
- check whether the restart window is still recovering
- prefer geographically close miner-to-pool placement

## 11. Canonical References

- `MAINNET_DEPLOY_RUNBOOK.md`
- `../README.md`
- `../ROADMAP.md`
