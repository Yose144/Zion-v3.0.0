# ZION V3 — Mainnet Autonomous Launch Runbook

**Version:** 1.0 — 2026-05-19
**Scope:** Complete end-to-end procedure for a clean, autonomous mainnet launch from a fresh machine.
**Prerequisite:** This runbook assumes you have the `2.9.6-main` repo cloned and Rust toolchain installed.

---

## Table of Contents

1. [Preflight Checklist](#1-preflight-checklist)
2. [Key Generation & Rotation](#2-key-generation--rotation)
3. [Canonical vs Fresh Keys Decision](#3-canonical-vs-fresh-keys-decision)
4. [Environment File Assembly](#4-environment-file-assembly)
5. [L1 Core Stack Launch](#5-l1-core-stack-launch)
6. [L2 Services Launch](#6-l2-services-launch)
7. [L3/L4 Services Launch](#7-l3l4-services-launch)
8. [Monitoring & Verification](#8-monitoring--verification)
9. [Emergency Procedures](#9-emergency-procedures)
10. [Post-Launch Maintenance](#10-post-launch-maintenance)

---

## 1. Preflight Checklist

Before touching any keys or starting binaries, verify:

- [ ] Repo is a **fresh clone** post-2026-05-14 (old clones may contain leaked secrets in git history)
- [ ] Machine is **air-gapped or offline** for key generation (Step 2)
- [ ] Rust toolchain installed: `rustc --version` >= 1.80
- [ ] `cargo` works: `cargo check --manifest-path V3/Cargo.toml --workspace`
- [ ] For GPU mining: AMD/Intel OpenCL drivers or NVIDIA CUDA installed
- [ ] Ports 8333, 8443, 8444, 8445, 9115 are free (or you will override)
- [ ] At least 50 GB free disk space for chain state + logs
- [ ] `.gitignore` covers all `.env*` files (verify: `cat .gitignore | grep env`)

---

## 2. Key Generation & Rotation

### 2.1 Offline Wallet Generation (CRITICAL — DO THIS FIRST)

All key generation MUST happen on an offline machine. The `gen-keys` binary generates Ed25519 keypairs deterministically via `rand::thread_rng()`. For production mainnet, use a hardware RNG or air-gapped machine.

**Step A — Build the generator (online OK):**

```bash
cd /path/to/2.9.6-main
cargo build --manifest-path V3/Cargo.toml --release -p zion-core --bin gen-keys
```

**Step B — Copy `gen-keys.exe` (or binary) to OFFLINE machine.**

**Step C — Run offline and redirect to secure file:**

```bash
# OFFLINE MACHINE
./gen-keys > ~/.zion-mainnet-keys.env
```

This outputs:

| Variable | Description |
|----------|-------------|
| `ZION_MINER_ADDRESS` | Default miner coinbase address (89% recipient) |
| `ZION_HUMANITARIAN_WALLET` | 5% tithe recipient (Children Future Fund) |
| `ZION_ISSOBELLA_WALLET` | 5% Issobella fund recipient |
| `ZION_POOL_FEE_WALLET` | 1% pool operator fee recipient |
| `ZION_POOL_WALLET` | Pool operational wallet (UTXO signer) |
| `ZION_POOL_PAYOUT_SK_HEX` | **SECRET** — pool payout signing key |

**Step D — Secure the output:**

```bash
# OFFLINE MACHINE
chmod 600 ~/.zion-mainnet-keys.env
# Print to paper wallet or hardware backup
cat ~/.zion-mainnet-keys.env
# NEVER commit this file. NEVER copy to cloud.
```

### 2.2 Canonical Mainnet Keys (Repo-Pinned)

If you want to use the **deterministic canonical addresses** (reconstructible from public labels in `genesis.rs`), run this instead:

```bash
cargo run --manifest-path V3/Cargo.toml --release -p zion-core --bin canonical-mainnet-operator-env
```

Output (these are the same addresses hardcoded in Docker `.env.example`):

```
ZION_MINER_ADDRESS=zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3
ZION_HUMANITARIAN_WALLET=zion1m4v5z8z850u480c5c208z274e334369275n5y20
ZION_ISSOBELLA_WALLET=zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702
ZION_POOL_FEE_WALLET=zion1p2a7a5q0t2z5z545y6m6j5e864n002v4z6w95w5
ZION_POOL_WALLET=zion1l56685k280p364g686j88644g3j4r375755e8p7
ZION_POOL_PAYOUT_SK_HEX=<reproducible-from-label>
```

> **SECURITY WARNING:** The canonical pool payout SK is derived from a **public label** in the repo. Anyone can reconstruct it. For production with real funds, **always generate fresh keys** (Section 2.1) and override env vars.

### 2.3 Key Rotation (If Replacing Existing Keys)

If you previously used canonical or test keys and now want exclusive custody:

1. Generate fresh keys (Section 2.1)
2. Update all `.env` files and Docker compose files
3. Restart the pool with the new `ZION_POOL_WALLET` and `ZION_POOL_PAYOUT_SK_HEX`
4. The pool will begin accumulating UTXOs to the new wallet address
5. Old balances in the previous wallet remain accessible with the old SK

---

## 3. Canonical vs Fresh Keys Decision

| Scenario | Recommendation |
|----------|----------------|
| **Local test / rehearsal** | Use `canonical-mainnet-operator-env` or `gen-keys` |
| **Private solo mining** | Use `gen-keys` fresh addresses |
| **Public pool with external miners** | **MANDATORY:** Use `gen-keys` fresh addresses. Never expose canonical SK. |
| **Bridge validator** | Generate separate secp256k1 keys (Section 6) |
| **DAO operator** | Generate separate DAO admin key (Section 6) |

---

## 4. Environment File Assembly

Create a single `.env.mainnet` file. Below is the **complete** variable reference.

### 4.1 L1 Node Variables (Required)

```bash
# === IDENTITY ===
ZION_NODE_ID=mainnet-node-001
ZION_NODE_STATE_PATH=/data/zion/state          # Linux
# ZION_NODE_STATE_PATH=C:\Zion\state.db       # Windows

# === NETWORK BIND ===
ZION_P2P_BIND=0.0.0.0:8333
ZION_RPC_BIND=0.0.0.0:8443

# === SEED PEERS ===
# Greenfield genesis node: leave empty or "none"
ZION_SEED_PEERS=none
# Follower node example:
# ZION_SEED_PEERS=91.98.122.165:8333,5.78.194.94:8333

# === FEE SPLIT ADDRESSES (all 3 must be set together) ===
ZION_MINER_ADDRESS=<your-miner-address>
ZION_HUMANITARIAN_WALLET=<your-humanitarian-address>
ZION_ISSOBELLA_WALLET=<your-issobella-address>
ZION_POOL_FEE_WALLET=<your-pool-fee-address>

# Optional overrides (defaults 5/5/1; only change after DAO vote):
# ZION_HUMANITARIAN_TITHE_PCT=5
# ZION_ISSOBELLA_FUND_PCT=5
# ZION_POOL_FEE_PCT=1
```

### 4.2 L1 Pool Variables (Required)

```bash
# === POOL BIND ===
ZION_POOL_BIND=0.0.0.0:8444
ZION_NODE_RPC_ADDR=127.0.0.1:8443
ZION_POOL_LOOP_COUNT=1000000
ZION_MAX_SESSIONS_PER_IP=10
ZION_NONCE_COUNT=4096               # Match GPU work_size for optimal hashrate

# === POOL PAYOUT WALLET (UTXO signer) ===
ZION_POOL_WALLET=<your-pool-wallet-address>
ZION_POOL_PAYOUT_SK_HEX=<your-pool-secret-key-hex>
```

### 4.3 L1 Miner Variables (Required)

```bash
ZION_POOL_ADDR=127.0.0.1:8444
ZION_LOOP_COUNT=1000000
ZION_MINER_THREADS=2
ZION_WORKER_NAME=worker1
ZION_MINER_ID=gpu-miner-001
ZION_GPU_BACKEND=opencl            # or "cuda" for NVIDIA
ZION_GPU_WORK_SIZE=4096
```

### 4.4 L2 Bridge Variables (Required for Bridge)

```bash
ZION_BRIDGE_CONFIG=V3/L2/bridge/config/bridge-mainnet.toml
ZION_VALIDATOR_PRIVATE_KEY=<secp256k1-validator-private-key-hex>
# Optional: additional validator keys for 3/5 multisig
# ZION_VALIDATOR_EXTRA_KEYS=<key1>,<key2>,<key3>
# ZION_VALIDATOR_EXTRA_IDS=val-02,val-03,val-04
ANKR_API_KEY=<ankr-premium-api-key>
```

### 4.5 L2 DAO Variables (Required for DAO)

```bash
DAO_CONFIG=V3/L2/dao/config/dao-mainnet.toml
DAO_API_PORT=8455
ZION_DAO_API_KEY=<strong-api-key-for-write-endpoints>
DAO_DB_PATH=/data/dao/dao.db
DAO_L1_RPC=http://127.0.0.1:8443
```

### 4.6 L2 Atomic Swap Variables (Required for Swap)

```bash
ZION_SWAP_ESCROW_KEY=<escrow-ed25519-private-key-hex>
ZION_RPC_TOKEN=<bearer-token-for-l1-rpc>
```

### 4.7 L3/L4 Variables (Optional)

```bash
# === Hiran Inference ===
HIRAN_TAG=v2.2
HIRAN_PORT=8002
HIRAN_MODEL=/models/hiran-v2.2-q5_k_m.gguf
HIRAN_BACKEND=llama_cpp
HIRAN_DEVICE=cuda
HIRAN_CTX_SIZE=4096
HIRAN_N_GPU_LAYERS=99
HIRAN_THREADS=4

# === Oasis Game Server ===
OASIS_BIND=0.0.0.0
OASIS_PORT=8094
OASIS_DB=/data/oasis/oasis.db

# === AI Native API (L3) ===
HIRANYAGARBHA_BIND=0.0.0.0:8457
LLM_BASE_URL=https://api.vast.ai/v1
LLM_MODEL=meta/llama-3.1-8b-instruct
NVIDIA_API_KEY=<nvidia-api-key>
VAST_API_KEY=<vast-api-key>
```

### 4.8 Monitoring Variables (Optional)

```bash
RUST_LOG=info
GF_SECURITY_ADMIN_PASSWORD=<strong-grafana-password>
PROMETHEUS_RETENTION=30d
```

---

## 5. L1 Core Stack Launch

### 5.1 Native Binary Launch (Windows / Linux)

**Build first:**

```bash
cd /path/to/2.9.6-main
cargo build --manifest-path V3/Cargo.toml --release
```

**On Linux:**

```bash
# Load env
set -a; source .env.mainnet; set +a

# Start node (background)
./V3/target/release/node &

# Start pool (background)
./V3/target/release/server &

# Start miner (foreground or background)
./V3/target/release/zion-miner
```

**On Windows (PowerShell):**

```powershell
# Load env from file
Get-Content .env.mainnet | ForEach-Object {
    if ($_ -match '^([^#][^=]*)=(.*)$') {
        [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
    }
}

# Start processes
Start-Process ./V3/target/release/node.exe -WindowStyle Hidden
Start-Process ./V3/target/release/server.exe -WindowStyle Hidden
Start-Process ./V3/target/release/zion-miner.exe -WindowStyle Hidden
```

**Or use the provided scripts:**

```powershell
# Windows with log files
powershell -ExecutionPolicy Bypass -File scripts/launch-stack.ps1

# Watch logs
powershell -ExecutionPolicy Bypass -File scripts/watch-logs.ps1

# Stop everything
powershell -ExecutionPolicy Bypass -File scripts/stop-stack.ps1
```

### 5.2 Docker Compose Launch (Recommended for Production)

```bash
cd /path/to/2.9.6-main

# Copy and edit env
cp V3/docker/.env.mainnet.example .env.mainnet
nano .env.mainnet   # Fill in ALL secrets

# Launch mainnet profile
docker compose -f V3/docker/docker-compose.yml --profile mainnet up -d

# With monitoring
docker compose -f V3/docker/docker-compose.yml --profile mainnet --profile monitoring up -d

# View logs
docker compose -f V3/docker/docker-compose.yml logs -f node
docker compose -f V3/docker/docker-compose.yml logs -f pool
```

### 5.3 P2P Bootstrap Sequence

For a multi-node mainnet:

| Step | Node | `ZION_SEED_PEERS` | Action |
|------|------|-------------------|--------|
| 1 | Genesis (Helsinki) | `none` | Start first. Mines genesis block. |
| 2 | Seed 1 (Prague) | `Helsinki:8333` | Connects to genesis. Syncs chain. |
| 3 | Seed 2 (US) | `Helsinki:8333,Prague:8333` | Connects to both. |
| 4 | Seed 3 (Singapore) | `Helsinki:8333,Prague:8333,US:8333` | Full mesh. |
| 5 | External miners | Any seed pool:8444 | Connect via pool stratum. |

> **Rule:** Never include a node's OWN public IP in its `ZION_SEED_PEERS` list.

### 5.4 GPU Miner Tuning

For optimal GPU hashrate, ensure pool and miner agree on batch size:

```bash
# Pool must send large nonce windows
ZION_NONCE_COUNT=4096       # or 8192 for high-end GPUs

# Miner must match
ZION_GPU_WORK_SIZE=4096
```

Expected hashrate (AMD RX 5700 XT class): **~6 KH/s**

---

## 6. L2 Services Launch

### 6.1 Bridge Relayer (3/5 Multisig Validator)

**Prerequisites:**
- 5 validator secp256k1 private keys generated offline
- Ankr Premium API key
- Bridge config file edited

```bash
# Edit config
nano V3/L2/bridge/config/bridge-mainnet.toml

# Set env
export ZION_BRIDGE_CONFIG=V3/L2/bridge/config/bridge-mainnet.toml
export ZION_VALIDATOR_PRIVATE_KEY=<validator-1-sk>
export ANKR_API_KEY=<ankr-key>

# Build & run
cargo build --manifest-path V3/Cargo.toml --release -p zion-bridge
./V3/target/release/zion-bridge
```

### 6.2 DAO Daemon

```bash
export DAO_CONFIG=V3/L2/dao/config/dao-mainnet.toml
export ZION_DAO_API_KEY=<dao-admin-key>
export DAO_L1_RPC=http://127.0.0.1:8443

cargo build --manifest-path V3/Cargo.toml --release -p zion-dao
./V3/target/release/zion-dao
```

### 6.3 Atomic Swap Daemon

```bash
export ZION_SWAP_ESCROW_KEY=<escrow-sk>
export ZION_RPC_TOKEN=<l1-rpc-bearer-token>

cargo build --manifest-path V3/Cargo.toml --release -p zion-atomic-swap
./V3/target/release/zion-atomic-swap
```

### 6.4 Swap Aggregator

```bash
export SWAP_AGGREGATOR_BIND=0.0.0.0:8456
export SWAP_AGGREGATOR_DB=/data/swap-aggregator.db
export BRIDGE_API_URL=http://127.0.0.1:8455
export BASE_RPC_URL=<base-l2-rpc>
export WZION_ADDRESS=<wrapped-zion-contract>

cargo build --manifest-path V3/Cargo.toml --release -p zion-swap-aggregator
./V3/target/release/zion-swap-aggregator
```

---

## 7. L3/L4 Services Launch

### 7.1 WARP Cross-Chain Relay

```bash
# No special ZION env vars; uses config file
cargo build --manifest-path V3/Cargo.toml --release -p zion-warp
./V3/target/release/zion-warp --config V3/L3/warp/config/warp-mainnet.toml
```

### 7.2 Oasis Game Server

```bash
export OASIS_BIND=0.0.0.0
export OASIS_PORT=8094
export OASIS_DB=/data/oasis/oasis.db

cargo build --manifest-path V3/Cargo.toml --release -p zion-oasis
./V3/target/release/zion-oasis
```

### 7.3 Hiran v2.2 Inference (Optional)

```bash
export HIRAN_MODEL=/models/hiran-v2.2-q5_k_m.gguf
export HIRAN_BACKEND=llama_cpp
export HIRAN_DEVICE=cuda
export HIRAN_PORT=8002

# If using Docker:
docker compose -f V3/docker/docker-compose.yml --profile hiran up -d
```

---

## 8. Monitoring & Verification

### 8.1 Health Checks

```bash
# Node health
curl -s http://localhost:8443/health | jq .

# Pool health
curl -s http://localhost:8444/health | jq .

# Oasis health
curl -s http://localhost:8094/health | jq .

# Metrics (Prometheus format)
curl -s http://localhost:9115/metrics
```

### 8.2 Chain Verification

```bash
# Get chain info
printf '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}\n' | nc -w 2 127.0.0.1 8443 | jq .

# Expected: height increasing, tip_hash non-null, network="Mainnet"
```

### 8.3 P2P Verification

```bash
# Check known peers
printf '{"jsonrpc":"2.0","method":"getPeers","params":[],"id":1}\n' | nc -w 2 127.0.0.1 8443 | jq .

# Check sync status on follower node
printf '{"jsonrpc":"2.0","method":"getStatus","params":[],"id":1}\n' | nc -w 2 127.0.0.1 8443 | jq .
```

### 8.4 Pool Verification

```bash
# Pool stats endpoint (if ZION_ROUTING_METRICS_BIND is set)
curl -s http://localhost:8455/stats | jq .

# Check PPLNS window
# Look for: zion_pplns_window_size, zion_pplns_registered_miners, zion_pplns_total_paid_flowers
```

### 8.5 Payout Verification

Watch pool logs for:

```
BLOCK_FOUND miner=worker1 height=N nonce=X hash=...
payout_submitted height=N miners=M deferred=0 tx_id=...
fee_payout_submitted height=N recipients=3 tx_id=...
```

If you see `payout_submit_failed` with "no spendable UTXOs", the pool wallet has not yet received a block subsidy. This is expected on a fresh chain until the pool wallet mines or receives its first coinbase.

### 8.6 Grafana Dashboard

Access: `http://localhost:3000`
- Login: `admin` / password from `GF_SECURITY_ADMIN_PASSWORD`
- Pre-configured dashboards: Node health, Pool stats, Network topology

---

## 9. Emergency Procedures

### 9.1 Stop Everything Immediately

**Native:**
```bash
# Linux
pkill -f 'node|server|zion-miner|zion-bridge|zion-dao|zion-warp'

# Windows
powershell -ExecutionPolicy Bypass -File scripts/stop-stack.ps1
```

**Docker:**
```bash
docker compose -f V3/docker/docker-compose.yml --profile mainnet down
docker compose -f V3/docker/docker-compose.yml --profile monitoring down
```

### 9.2 Rotate Compromised Keys

If any secret key is leaked:

1. Stop all services immediately
2. Generate fresh keys (Section 2.1)
3. Update `.env.mainnet` with new addresses and SKs
4. Delete old state files (or keep for forensic analysis)
5. Restart services
6. Update any downstream configs (bridge validators, DAO, etc.)

### 9.3 Pool Wallet With No UTXOs

If payouts fail with "no spendable UTXOs":

**Option A:** Fund the pool wallet from a genesis/premine address:
```bash
# Send some ZION from a premine address to the pool wallet
# (Requires premine private key — only premine custodians can do this)
```

**Option B:** Configure miner to use pool wallet as its `ZION_MINER_ADDRESS` so pool wallet receives coinbase directly.

**Option C:** Accept that initial payouts will rollback until the pool wallet has mined at least one block.

### 9.4 Genesis Chain Reset

Only for **test rehearsals**, never on public mainnet:

```bash
# Delete chain state
rm -f /data/zion/state
rm -f /data/zion/peers.json

# Restart node
```

---

## 10. Post-Launch Maintenance

### 10.1 Daily Checks

- [ ] Node height is increasing
- [ ] Pool has active miner sessions
- [ ] No `payout_submit_failed` errors (unless UTXO-related)
- [ ] Disk space > 20% free
- [ ] All L2 services responsive

### 10.2 Weekly Tasks

- [ ] Review Grafana dashboards for anomalies
- [ ] Rotate logs: `logrotate` or manual archive
- [ ] Check for security updates: `apt update && apt upgrade` (Linux)
- [ ] Backup chain state to secondary location
- [ ] Verify `.env` file permissions are `600`

### 10.3 Monthly Tasks

- [ ] Review fee split constants for drift (run unit tests)
- [ ] Check PPLNS window saturation
- [ ] Update seed peer list if topology changed
- [ ] Review bridge validator health (3/5 quorum)
- [ ] Audit access logs for unauthorized RPC calls

---

## Appendix A: Complete Env Var Reference

### L1 Core (Node)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ZION_NODE_ID` | Yes | `v3-node-0` | Node identity string |
| `ZION_P2P_BIND` | No | `0.0.0.0:8333` | P2P listener address |
| `ZION_RPC_BIND` | No | `0.0.0.0:8443` | RPC listener address |
| `ZION_NODE_STATE_PATH` | No | — | Chain state file path |
| `ZION_SEED_PEERS` | No | — | Bootstrap peer list (`none` = empty) |
| `ZION_MINER_ADDRESS` | Yes* | — | Miner coinbase address |
| `ZION_HUMANITARIAN_WALLET` | Yes* | — | 5% tithe address |
| `ZION_ISSOBELLA_WALLET` | Yes* | — | 5% fund address |
| `ZION_POOL_FEE_WALLET` | Yes* | — | 1% fee address |
| `ZION_WEBSOCKET_BIND` | No | `0.0.0.0:8445` | WebSocket server |
| `ZION_METRICS_BIND` | No | `0.0.0.0:9115` | Node metrics HTTP |
| `ZION_ACCEPT_LIMIT` | No | — | Shared accept limit |
| `ZION_P2P_ACCEPT_LIMIT` | No | — | P2P accept limit |
| `ZION_RPC_ACCEPT_LIMIT` | No | — | RPC accept limit |
| `ZION_SYNC_BATCH_LIMIT` | No | `32` | Block sync batch size |

> *All 4 fee addresses must be set together or all omitted.

### L1 Pool

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ZION_POOL_BIND` | No | `0.0.0.0:8444` | Stratum listener |
| `ZION_NODE_RPC_ADDR` | No | `127.0.0.1:8443` | Node RPC endpoint |
| `ZION_POOL_LOOP_COUNT` | No | `1000000` | Iterations before pool sends `Bye` |
| `ZION_MAX_SESSIONS_PER_IP` | No | `10` | Anti-DoS session limit |
| `ZION_NONCE_COUNT` | No | `1024` | Nonces per job batch |
| `ZION_POOL_WALLET` | Yes | — | Pool UTXO signer address |
| `ZION_POOL_PAYOUT_SK_HEX` | Yes | — | **SECRET** Pool signing key |
| `ZION_ROUTING_METRICS_BIND` | No | — | Pool metrics HTTP |

### L1 Miner

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ZION_POOL_ADDR` | Yes | — | Pool stratum endpoint |
| `ZION_LOOP_COUNT` | No | `1` | Mining iterations |
| `ZION_MINER_THREADS` | No | auto | CPU threads |
| `ZION_WORKER_NAME` | No | `default` | Stratum worker name |
| `ZION_MINER_ID` | No | — | Miner identity |
| `ZION_GPU_BACKEND` | No | `cpu` | `cpu`, `opencl`, `cuda` |
| `ZION_GPU_WORK_SIZE` | No | `4096` | GPU batch size |
| `ZION_PROFILE` | No | `pool` | `pool`, `solo`, `benchmark`, `dual` |

---

## Appendix B: File Locations

| Purpose | Path |
|---------|------|
| Node binary | `V3/target/release/node` |
| Pool binary | `V3/target/release/server` |
| Miner binary | `V3/target/release/zion-miner` |
| Key generator | `V3/target/release/gen-keys` |
| Canonical env printer | `V3/target/release/canonical-mainnet-operator-env` |
| Genesis source | `V3/L1/core/src/genesis.rs` |
| Fee split constants | `V3/L1/core/src/emission.rs` |
| Docker compose | `V3/docker/docker-compose.yml` |
| Env example | `V3/docker/.env.mainnet.example` |
| Windows launch scripts | `scripts/launch-stack.ps1`, `scripts/stop-stack.ps1` |
| Windows log viewers | `scripts/watch-logs.ps1`, `scripts/live-logs.ps1` |
| Audit report | `V3/AUDIT_REPORT_2026-05-19.md` |
| Windows stack status | `MAINNETSTATUSW11.md` |

---

## Appendix C: Canonical Mainnet Addresses (Public)

These addresses are derived from public labels in `genesis.rs` and are **reconstructible by anyone**:

```
Humanitarian (Children Future Fund):  zion1m4v5z8z850u480c5c208z274e334369275n5y20
Issobella Fund:                        zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702
Pool Fee (1%):                        zion1p2a7a5q0t2z5z545y6m6j5e864n002v4z6w95w5
Default Miner (89%):                  zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3
Pool Payout Wallet:                   zion1l56685k280p364g686j88644g3j4r375755e8p7
```

> **Never use the canonical pool payout SK for production with external miners.** Generate fresh keys.

---

*Generated with [Devin](https://cli.devin.ai/docs)*
*For support: https://windsurf.com/support*
