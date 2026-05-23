# ZION V3 Mainnet Launch — E2E Testing Plan

> **Goal:** Validate the entire V3 stack end-to-end before mainnet launch.
> **Scope:** Docker stack, local binaries, GPU mining, blocks, payouts, PPLNS, transactions, balances, CLI.
> **Last updated:** 2026-05-18

---

## 1. Prerequisites

### 1.1 Environment
- Windows 10/11 with MINGW64 / WSL2 recommended for Docker
- Docker Desktop ≥ 29.x (`docker info` must pass)
- Docker Compose v2 (`docker compose version` must pass)
- Rust 1.95+ (`rustc --version`)
- AMD GPU with OpenCL 2.1+ OR NVIDIA with CUDA 12.4+

### 1.2 Build
```bash
# Full workspace release build (takes ~10 min on first run)
cargo build --manifest-path V3/Cargo.toml --workspace --release

# GPU miner build (AMD OpenCL)
cargo build --manifest-path V3/Cargo.toml -p zion-miner --release --features gpu-opencl
```

### 1.3 Known Fixes Already Applied
- `V3/L1/miner/src/gpu_backend.rs:93` — `_work_size` → `work_size` (fixes GPU OpenCL compile)
- Czech comments translated to English in `hiranyagarbha.rs`, `knowledge_base.rs`, `rag.rs`
- Dead code / unused import warnings resolved across V3 workspace

---

## 2. Test Matrix

| # | Test | Tool | Expected Result | Priority |
|---|------|------|-------------------|----------|
| 2.1 | Docker stack up | `docker compose` | All services healthy | P0 |
| 2.2 | Node RPC health | `curl /health` | `{"status":"ok"}` | P0 |
| 2.3 | GPU miner init | `zion-miner --gpu opencl` | OpenCL device detected, self-test PASS | P0 |
| 2.4 | GPU hashrate | Miner logs | `gpu_hps > 20` (RX 5600 XT ~28 H/s) | P0 |
| 2.5 | Share acceptance | Pool logs | `share_status=Accepted`, 100% rate | P0 |
| 2.6 | Block mined | Node RPC `getChainInfo` | `chain_height >= 1` | P0 |
| 2.7 | Coinbase split | `getBlockByHeight` | 4 tx: miner 89% + humanitarian 5% + issobella 5% + pool_fee 1% | P0 |
| 2.8 | Balance confirmed | `getBalance` | Balances match block reward splits | P0 |
| 2.9 | PPLNS payout | Pool logs | `revenue_total_usd` increments, PPLNS window recorded | P1 |
| 2.10 | CLI doctor | `zion doctor` | All checks green for local stack | P1 |
| 2.11 | CLI status | `zion status` | Node/Pool/Miner status accurate | P1 |
| 2.12 | Submit raw tx | `sendRawTransaction` RPC | Tx accepted, appears in mempool | P1 |
| 2.13 | 100 miner stress | 100x `zion-miner` instances | Pool handles load, no crashes | P2 |
| 2.14 | Difficulty retarget | After N blocks | Difficulty adjusts smoothly | P2 |
| 2.15 | Reconnect resilience | Kill/restart node | Pool auto-reconnects, miner resumes | P2 |

---

## 3. Step-by-Step Execution

### Phase A — Docker Stack (Recommended)

```bash
# A1. Configure environment
cp V3/docker/.env.example V3/docker/.env
# Edit .env:
#   ZION_NODE_ID=v3-mainnet-local
#   ZION_MINER_ADDRESS=zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3
#   ZION_HUMANITARIAN_WALLET=zion1m4v5z8z850u480c5c208z274e334369275n5y20
#   ZION_ISSOBELLA_WALLET=zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702
#   ZION_POOL_FEE_WALLET=zion1p2a7a5q0t2z5z545y6m6j5e864n002v4z6w95w5

# A2. Start stack
docker compose -f V3/docker/docker-compose.yml --profile mainnet up -d

# A3. Verify health
docker compose -f V3/docker/docker-compose.yml ps
docker compose -f V3/docker/docker-compose.yml logs -f node
```

### Phase B — Local Binary Fallback (If Docker Fails)

```bash
# B1. Node
export ZION_NODE_ID=local-node
export ZION_P2P_BIND=0.0.0.0:8333
export ZION_RPC_BIND=0.0.0.0:8443
export ZION_MINER_ADDRESS=zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3
export ZION_HUMANITARIAN_WALLET=zion1m4v5z8z850u480c5c208z274e334369275n5y20
export ZION_ISSOBELLA_WALLET=zion19242q4x0l3785003n8l0s873k3f5v8d4d8wz702
export ZION_POOL_FEE_WALLET=zion1p2a7a5q0t2z5z545y6m6j5e864n002v4z6w95w5
V3/target/release/node.exe

# B2. Pool (in new terminal)
export ZION_POOL_BIND=0.0.0.0:8444
export ZION_NODE_RPC_ADDR=127.0.0.1:8443
export ZION_POOL_WALLET=zion1l56685k280p364g686j88644g3j4r375755e8p7
export ZION_POOL_PAYOUT_SK_HEX=[REDACTED — pool SK removed for security]
V3/target/release/server.exe

# B3. GPU Miner (in new terminal)
export ZION_POOL_ADDR=127.0.0.1:8444
export ZION_WORKER_NAME=gpu-worker-1
export ZION_MINER_ID=gpu-miner-1
V3/target/release/zion-miner.exe --gpu opencl --loops 100000
```

### Phase C — Validation Commands

```bash
# C1. Node health
curl -s http://127.0.0.1:8443/health

# C2. Chain info
curl -s -X POST http://127.0.0.1:8443 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}'

# C3. Block by height
curl -s -X POST http://127.0.0.1:8443 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getBlockByHeight","params":[1],"id":1}'

# C4. Balance
curl -s -X POST http://127.0.0.1:8443 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getBalance","params":["zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3"],"id":1}'

# C5. CLI doctor
V3/target/release/zion.exe doctor

# C6. CLI status
V3/target/release/zion.exe status
```

---

## 4. Expected Results

### 4.1 Block Reward Split (5.4 ZION subsidy)

| Recipient | Address | Percentage | Amount (ZION) |
|-----------|---------|------------|---------------|
| Miner | `zion1f8m...66j3` | 89% | 4.80605963 |
| Humanitarian | `zion1m4v...5y20` | 5% | 0.27000335 |
| Issobella | `zion1924...z702` | 5% | 0.27000335 |
| Pool Fee | `zion1p2a...95w5` | 1% | 0.05400067 |

### 4.2 GPU Hashrate Targets

| Hardware | Expected H/s | Notes |
|----------|-------------|-------|
| AMD RX 5600 XT | 25–35 H/s | OpenCL, work_size=262144 |
| NVIDIA RTX 3060 | 40–60 H/s | CUDA backend |
| CPU (12 threads) | 15–20 H/s | AVX2 fallback |

### 4.3 PPLNS Window

- Pool PPLNS window: default 24 hours
- Share difficulty: starts at 1, vardiff retargets every 6 shares / 10s target
- Payout execution: enabled via `ZION_POOL_PAYOUT_SK_HEX`
- Revenue mode: single lane, `zion:100%:$1.25`

---

## 5. Known Issues & Workarounds

| Issue | Workaround | Fix Needed |
|-------|-----------|------------|
| Pool sends `Bye` after every iteration | Miner auto-reconnects with backoff | Investigate pool session keep-alive |
| `_work_size` compile error (GPU) | Rename to `work_size` in `gpu_backend.rs:93` | **Already fixed** |
| Node external peer sync fails | Expected for isolated local test | None (local-only test) |
| CLI status shows external IPs | Uses default `zion.toml` | Configure `zion config set` for local |
| Docker `gpu-opencl` not available | Use local binary with `--gpu opencl` | Add GPU passthrough to Docker Compose |

---

## 6. Post-Test Checklist

- [ ] At least 1 block mined and accepted
- [ ] Block reward split matches 89/5/5/1%
- [ ] All 4 recipient balances updated
- [ ] GPU miner self-test PASS (all 6 stages)
- [ ] Pool accepted shares ≥ 100
- [ ] PPLNS revenue > 0 USD
- [ ] CLI doctor all-green
- [ ] No panic / crash in node, pool, or miner logs
- [ ] Git commit with test results documentation
- [ ] Push to origin/main

---

## 7. Documentation Output

After completing tests, write results to:
- `test-results-V3-mainnet-e2e-YYYY-MM-DD.md` in repo root
- Include: block hashes, nonce values, hashrate logs, payout tx IDs, CLI screenshots

---

## 8. Emergency Stop

```bash
# Stop all services
docker compose -f V3/docker/docker-compose.yml down

# Or kill local processes
taskkill //F //IM node.exe
taskkill //F //IM server.exe
taskkill //F //IM zion-miner.exe
```

---

*Generated for ZION V3 mainnet launch validation.*
