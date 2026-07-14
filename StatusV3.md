# ZION V3 — Canonical Status (Mainnet Beta)

> **Datum poslední aktualizace:** 2026-07-15
> **Protokol:** `zion-v3-node/3.0.5`
> **Genesis hash:** `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`
> **Status:** Mainnet Beta — oficiální public launch **2026-12-31**
> **Předchozí archiv:** [`docs/3.0.5/StatusV3_archive_2026-07-13.md`](./docs/3.0.5/StatusV3_archive_2026-07-13.md) (5239 řádků, historické incident reporty)

---

## 1. Blockchain State

| Metric | Value |
|--------|-------|
| **Height** | 5801+ (3-node P2P mesh, all synced) |
| **Protocol** | `zion-v3-node/3.0.5` (v2) |
| **Genesis** | `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` |
| **Decimals** | 6 (1 ZION = 1,000,000 flowers, post-3.0.3 fork) |
| **Total Supply** | 144B ZION (144e15 flowers) |
| **Circulating** | 16.81B ZION (16.78B premine + ~31.33M mined) |
| **Block Reward** | 5400.067 ZION |
| **Fee Split** | 89% miner / 5% treasury / 5% community / 1% burn |
| **Difficulty** | LWMA-60 (integer, ±25% clamp, 30–120s solve) |
| **Primary Algo** | `deeksha_lite_v1` (256 KiB scratchpad, 64 reads, 4 AES rounds) |
| **Winter Algo** | `deeksha_lite_fire` (65536 thermal iterations) |
| **Full Algo** | `cosmic_harmony_ekam_deeksha_v2` (~256 KiB + NPU) |
| **Canonical alias** | `deeksha_chv3` = `deeksha_lite_v1` (bit-identical) |

---

## 2. Network Topology

### Edge Server (Primary): `62.171.141.136`

**Hardware:** Hetzner Cloud, 4× AMD EPYC, 7.8 GB RAM, 145 GB disk, Ubuntu 24.04.4 LTS

| Service | Port(s) | Bind | Layer | Status |
|---------|---------|------|-------|--------|
| zion-node | 8333 (P2P), 9443 (RPC), 8445 (WS), 9100 (metrics) | P2P 0.0.0.0, rest 127.0.0.1 | L1 | ✅ active |
| zion-node2 | 8334 (P2P), 8448 (RPC), 9116 (metrics) | P2P 0.0.0.0, rest 127.0.0.1 | L1 | ✅ active (follower) |
| zion-pool | 8444 (Stratum), 8455 (stats/metrics HTTP) | 8444 0.0.0.0, 8455 127.0.0.1 | L1 | ✅ active (mining) |
| zion-bridge | 9101 (metrics) | 127.0.0.1 | L2 | ✅ active |
| zion-dao | 8450 (API) | 127.0.0.1 | L2 | ✅ active |
| zion-atomic-swap | 8452 (API) | 0.0.0.0 | L2 | ✅ active |
| zion-warp | 8453 (WARP API) | 0.0.0.0 | L3 | ✅ active |
| zion-dex | 8454 (DEX Router API) | 0.0.0.0 | L3 | ✅ active |
| zion-oasis | 8455 | 127.0.0.1 | L4 | ✅ active |
| zion-free-world | — | — | L5 | ✅ active |
| zion-issobella | — | — | L6 | ✅ active |
| zion-dashboard | 8766 | 127.0.0.1 | — | ✅ active |
| zion-watchdog.timer | — | — | — | ✅ active (2 min) |
| zion-web (Docker) | 3000 | 127.0.0.1 | — | ✅ Up (377 MB) |
| nginx | 80, 443 | 0.0.0.0 | — | ✅ active |

### Local Backup Node: `zionserver-144` (109.81.27.87)

| Service | Port(s) | Status |
|---------|---------|--------|
| zion-backup-node | 8446 (RPC), 8333 (P2P) | ✅ active |
| zion-dashboard | 8766 | ✅ active |
| zion-stack | L2/L3 services | ✅ active |
| zion-ssh-tunnel | 9 local + 2 reverse SSH forwards to Edge | ✅ active |

### Public Endpoints

| Endpoint | URL | Notes |
|----------|-----|-------|
| Web | `https://zionterranova.com` | Next.js Docker, 377 MB standalone |
| Dashboard | `https://dashboard.zionterranova.com` | Basic Auth |
| RPC | `rpc.zionterranova.com:8443` | nginx TCP stream proxy → 127.0.0.1:9443 |
| Pool | `62.171.141.136:8444` | Stratum |

### Resource Usage

| Resource | Used | Total | % |
|----------|------|-------|---|
| RAM | ~2.7 GB | 7.8 GB | 35% |
| Disk | 62 GB | 145 GB | 43% |
| Node1 RSS | ~3.5 MB | — | stable (post memory-leak fix) |
| Node2 RSS | ~3.5 MB | — | stable |

---

## 3. Test Status

| Crate | Tests | Status |
|-------|-------|--------|
| zion-core | 501 | ✅ |
| zion-cosmic-harmony | 201 + 1 | ✅ |
| zion-pool | 38 | ✅ |
| zion-bridge | 193 | ✅ |
| zion-dao | 40 | ✅ |
| zion-atomic-swap | 18 | ✅ |
| zion-warp | 499 | ✅ |
| zion-ncl | 42 | ✅ |
| zion-ai-native | 195 (+2 ignored) | ✅ |
| zion-cli | 21 | ✅ |
| zion-miner | 59 | ✅ |
| zion-native-ffi | 13/28 | ✅ |
| zion-oasis | 124 | ✅ |
| AuXpow | 111+ (GPU: 16, ProgPow: 6) | ✅ |
| ZionDex Router | 28 | ✅ |
| ZionDex Contracts | 7 (Solidity) | ✅ |
| **Total** | **~2,066+** | **0 failures** |

---

## 4. DeFi Contracts (Base Mainnet, Chain 8453)

| Contract | Address | Status |
|----------|---------|--------|
| wZION (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | ✅ Verified |
| ZIONBridge (5/5 multisig) | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` | ✅ Verified |
| BridgeValidator | `0x9C138dC6ebA8A883AB3802F6Dcb79C772a835627` | ✅ Verified |
| ZIONGovernance | `0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8` | ✅ Verified |
| ZIONTreasury (3/3 multisig) | `0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD` | ✅ Verified |
| ZIONStaking (12% APR) | `0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B` | ✅ Verified |
| ZIONFarm (1 wZION/s) | `0x167B2753F5D8D9F8e62875cc9e379d7804308B08` | ✅ Verified |
| ZIONAtomicSwap | (escrow funded 100K ZION) | ✅ Verified |

### Uniswap V3 Pools (Base)
| Pair | Fee | Pool Address |
|------|-----|--------------|
| wZION/USDC | 0.3% | `0x5eBdC6E1D516f42EEB54f14faCF8715AbD5B9d8d` |
| wZION/WETH | 1.0% | `0x18c0DaeF295E63F1bfBC7C39e71d0fabf4600699` (ACTIVE) |

### Multi-Chain wZION
Deployed on: Base, Arbitrum, Optimism, BSC, Polygon, Avalanche (6 chains live)

### Non-EVM Deployments
| Chain | Type | Address/ID | Status |
|-------|------|------------|--------|
| Solana | SPL Token | `HgfQZpH2JAqPdR3PcP4dEE8WRhznXh1QhJBiiwcHfT8H` | ✅ Deployed |
| Stellar | Native Asset | `ZION:GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT` | ✅ Deployed |
| Tron | TRC-20 | — | ⏳ Pending |
| Cardano | Plutus | — | ⏳ Pending |
| Cosmos | CW20 | — | ⏳ Pending |
| Aptos | Move Coin | — | ⏳ Pending |
| Sui | Move Coin | — | ⏳ Pending |
| NEAR | NEP-141 | — | ⏳ Pending |
| TON | TEP-74 | — | ⏳ Pending |

**Status:** 2/9 non-EVM chains deployed. 6 EVM chains + 2 non-EVM = 8 chains total live.

### L1 Bridge Vault
- Address: `zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7` (keyless)
- Balance: ~100M ZION

---

## 5. AuxPow + Stream Profit System

### Architecture
All revenue streams live INSIDE the Deeksha Chv3 hash pipeline. GPU always runs Deeksha Chv3; pipeline steps are parametrized by stream weights (profit-based). Pool sends weights to miners in job messages.

### Deeksha Chv3 Pipeline (6 steps, 100 work units)
| Step | Algorithm | Work Units | Revenue Source |
|------|-----------|------------|----------------|
| 1 | Keccak256 | 5u | KeccakBonus |
| 2 | SHA3-512 | 5u | Sha3Bonus |
| 3 | GoldenMatrix | 10u | Zion |
| 4 | MemoryHard | 55u | Zion |
| 5 | NpuMix | 15u | NclAi |
| 6 | CosmicFusion | 10u | Zion |

### Implementation Status

| Phase | Description | Status | Commit |
|-------|-------------|--------|--------|
| R1 | Stream profit system — weighted pipeline | ✅ DONE | `50df9b414` |
| R1b | Live API fetching (WhatToMine/CoinGecko) | ✅ DONE | `e1c28689b` |
| R1c | GPU kernel parametrizace (byproduct work) | ✅ DONE | `74a353205` |
| R2 | DCR revenue live (WoolyPooly) | ⏳ Pending | — |
| R3 | ALPH + KAS E2E (2miners) | ⏳ Pending | — |
| R4 | Stream telemetry revenue report | ✅ DONE | `d189712a7` |
| R5 | SMOS deploy + GPU mining | ✅ DONE | `32e9d07ac` |
| R6 | EthStratum protocol (ERG/EVR/MEWC/CLORE) | ✅ DONE | `5baa76d60` |
| R7 | B2b VRSC revenue (ZcashStratum, LuckPool) | ✅ DONE | `bb7d5407b` |
| R8 | True AuxPow consensus | 🔮 Future | — |

### Supported External Coins (16 total)

| Coin | Algorithm | Protocol | E2E Status |
|------|-----------|----------|------------|
| KAS | kheavyhash | Stratum | connect/auth/notify ✅, submit ⚠️ (CPU) |
| ALPH | blake3 (double) | Stratum | connect/auth/notify ✅, submit ⚠️ (CPU) |
| DCR | blake3 | Stratum | ✅ LIVE (embedded in pool stream, blake3 GPU kernel) |
| ERG | autolykos | EthStratum | protocol ✅ (R6), live E2E TODO |
| RVN | kawpow | Stratum | live E2E ✅ (GPU, shares forwarded to 2miners) |
| ETC | ethash | Stratum | connect/auth/notify ✅, submit ⚠️ (CPU) |
| EVR | autolykos | EthStratum | protocol ✅ (R6), live E2E TODO |
| MEWC | kawpow | EthStratum | protocol ✅ (R6), live E2E TODO |
| CLORE | kawpow | EthStratum | protocol ✅ (R6), live E2E TODO |
| XMR | randomx | Stratum | connect/auth/notify ✅, submit ⚠️ (needs RandomX rig miner) |
| FLUX | zelhash | Stratum | TODO |
| VRSC | verushash v2.2 | ZcashStratum | ✅ LIVE (LuckPool eu.luckpool.net:3956, pool mining VRSC) |
| EPIC | progpow | Stratum (custom HTTP) | ✅ LIVE (GPU ProgPow kernel, epoch 120 DAG, triple parallel with ZION+VRSC) |
| QUAI | kawpow | Stratum | ✅ Added (KawPoW GPU thread, 2miners pool, BTC payout, `ZION_POOL_AUXPOW_WALLET_QUAI` env var) |
| PRL | pearlhash (PoUW MatMul) | PearlStratum (custom) | ★★★ PearlStratum ✅ + CPU hasher ✅ + GPU GEMM dispatch ✅ (`0bafbfe83`) + Merkle proof ✅ (`705bff572`) + pool-routed ✅ (`f524b7117`), full PoUW ZK TODO |

### AuXpow GPU Backend (2026-07-15)

**Crate:** `zion-auxpow` — cross-platform GPU mining (OpenCL + Metal + CUDA)

| Algorithm | Coin | OpenCL (H/s) | Metal (H/s) | CUDA |
|-----------|------|-------------|-------------|------|
| blake3 | ALPH | 640M | **18.1B** | ⚠️ kernel only |
| blake3_dcr | DCR | 650M | **23.3B** | ⚠️ kernel only |
| kheavyhash | KAS | 320M | **21.1B** | ⚠️ kernel only |
| autolykos | ERG | 82M | **18.4B** | ⚠️ kernel only |
| ethash | ETC | — | — (needs DAG) | ⚠️ kernel only |
| kawpow | RVN | — | — (needs DAG) | ⚠️ kernel only |
| zelhash | FLUX | 495M | **19.5B** | ⚠️ kernel only |
| progpow | EPIC | DAG ✅ (OpenMP) | — (needs DAG) | ⚠️ kernel only |
| pearlhash | PRL | Placeholder | Placeholder | ❌ TODO (full PoUW) ★★★ |

**Features:** `gpu-opencl`, `gpu-metal`, `gpu-cuda`, `gpu-all`
**Benchmark:** `cargo run --example gpu_benchmark -p zion-auxpow --features gpu-metal`
**Auto-detect:** CUDA > Metal > OpenCL (via `GpuBackend::detect_backend()`)
**ProgPow (EPIC):** CPU hasher (keccak_f800 + KISS99 + FNV1a) ✅, OpenCL + Metal kernel ✅, 6 unit testů ✅, DAG generation ✅ (OpenMP parallel, epoch 120 ~2 GB in ~4 min on 12 cores), GPU mining ✅ (RX 5600, 15000+ batches, 0 errors), `ensure_progpow_dag()` with separate disk cache (`progpow_epoch{N}.bin`)
**Pearl (PRL):** ★★★ HIGHEST PRIORITY — PoUW MatMul + BLAKE3, 22x profitabilnější než KAS.
**Status:** PearlStratum protocol ✅ (custom dialect: object params, no subscribe, plain_proof),
CPU hasher ✅ (BLAKE3), GPU GEMM dispatch ✅ (`0bafbfe83`, 50x speedup), Merkle proof reconstruction ✅ (`705bff572`),
pool-routed mode ✅ (`f524b7117`, SMOS v3.0.35-pearl-pool-routed), cosmic-harmony + server.rs integration ✅.
8/8 Pearl tests pass. Pearl proof format fixed to match official alpha-miner (`a8aa4d1d3`).
**E2E verified against suprnova** (prl.suprnova.cc:3373) — authorize ✅, notify ✅ (job 52f06ed4_2000000,
height 86340, 76-byte header), job parsing ✅. **Remaining:** full PoUW ZK kernels
(Plonky2 ZK proofs), share submission E2E, merge mining PRL+MDL.

### Stream Profit Env Vars
```bash
ZION_STREAM_PROFIT_SWITCH=true              # enable profit-based weights
ZION_STREAM_PROFIT_API_PROVIDER=whattomine  # whattomine|coingecko|fallback
ZION_STREAM_PROFIT_INTERVAL=120             # refresh interval (seconds)
ZION_STREAM_HYSTERESIS_PCT=15.0             # min improvement % for switch
ZION_STREAM_PROFIT_SOURCES=zion,keccak_bonus,sha3_bonus,ncl_ai,deeksha_lite,thermal_bonus
```

### AuxPow Env Vars
```bash
ZION_AUXPOW_ENABLED=1                       # enable AuxPow scheduler
ZION_AUXPOW_WALLET=<wallet>                 # mining wallet
ZION_AUXPOW_ALLOCATION=0.1                  # % hashrate allocation
ZION_AUXPOW_POOL_PREFERENCE=2miners         # preferred pool
ZION_AUXPOW_HYSTERESIS=0.15                 # profit-switch threshold
ZION_AUXPOW_CIRCUIT_BREAKER_THRESHOLD=5     # failures before cooldown
ZION_AUXPOW_CIRCUIT_BREAKER_COOLDOWN=300    # cooldown seconds
# VRSC B2b revenue (LuckPool, VerusHash v2.2, CPU-only)
ZION_VRSC_WALLET=<verus_wallet>             # VRSC payout wallet (required for VRSC)
ZION_VRSC_POOL_URL=eu.luckpool.net:3956     # LuckPool EU endpoint (default)
# Triple Parallel CPU bridge (Claymore-style: ZION GPU + EPIC GPU + VRSC CPU)
ZION_POOL_AUXPOW_CPU_COIN="VRSC"            # CPU-stream coin (default: VRSC)
ZION_POOL_AUXPOW_CPU_WALLET=<verus_wallet>  # CPU bridge payout wallet
ZION_POOL_AUXPOW_CPU_WORKER_NAME="zion_triple" # CPU bridge worker name
ZION_POOL_AUXPOW_CPU_REGION="eu"            # CPU bridge pool region
# QUAI (KawPoW, 2miners, BTC payout)
ZION_POOL_AUXPOW_WALLET_QUAI=<quai_wallet>  # QUAI payout wallet
ZION_POOL_AUXPOW_PASSWORD_QUAI=<password>   # QUAI pool password (optional)
```

---

## 6. Key Configuration

### Node
```bash
ZION_BLOCK_RETENTION=1000       # keep last 1000 blocks in memory
ZION_MIGRATION_HEIGHT=1         # fresh chain post-3.0.4
ZION_BALANCE_CHECK_HEIGHT=0     # F5 balance check active from genesis
ZION_RPC_DEBUG=0                # verbose RPC logging (default off)
```

### Pool
```bash
ZION_POOL_BIND=0.0.0.0:8444
ZION_PPLNS_WINDOW_SIZE=500000   # for 10k miners
ZION_VARDIFF_TARGET_SECS=15
ZION_NONCE_COUNT=4096
ZION_MAX_SESSIONS_PER_IP=100
ZION_POOL_NO_SOLUTION_RECONNECT_COOLDOWN_SECS=300  # ban IP on NoSolution rate-limit
```

> **PPLNS composite keys (2026-07-14):** PPLNS and telemetry registry now key on `miner_id/worker_name` instead of `miner_id` alone. Previously, all workers sharing the same `miner_id` (e.g. `local-miner`) had their payout address overwritten by whichever worker connected last — all payouts went to one worker. Each worker now gets its own PPLNS entry, telemetry entry, and payout address. Verified on-chain: 5070Ti, barker, and vega-smos receive payouts to their respective addresses.

### WARP (Non-EVM)
```bash
WARP_SOL_ZION_MINT=HgfQZpH2JAqPdR3PcP4dEE8WRhznXh1QhJBiiwcHfT8H
WARP_SOL_RPC=https://api.mainnet-beta.solana.com
WARP_STELLAR_ZION_ISSUER=GDDXUOJ7ERSHHDMUKS6PBIDSXV2PB5J7GOFOKMHW6BRVAS46CFSPAYJT
WARP_STELLAR_ZION_CODE=ZION
WARP_STELLAR_RPC=https://horizon.stellar.org
```

---

## 7. Security Hardening

| Measure | Status |
|---------|--------|
| UFW Firewall (SSH/HTTP/HTTPS/P2P/Pool) | ✅ Active |
| SSH keys-only (ed25519) | ✅ Active |
| fail2ban | ✅ Active (8028+ blocked, 101 bans) |
| AppArmor (zion-node) | ✅ Complain mode |
| Private keys scrubbed (5 files) | ✅ Done |
| File permissions (600/700) | ✅ Done |
| RPC audit log | ✅ Gated behind ZION_RPC_DEBUG |
| Memory limits (cgroup 2GB/3GB) | ✅ Active |
| Swap file (4GB) | ✅ In fstab |
| Journald limited (200M) | ✅ Active |
| systemd User=zion | ⚠️ 10/12 services done (dashboard + dex still User=root) |
| External audit | ⏳ Before public launch |

---

## 8. Recent Milestones (2026-07)

| Date | Milestone | Key Commits |
|------|-----------|-------------|
| 07-15 | **QUAI (KawPoW) added** — 16th external coin. KawPoW GPU thread in miner (`kawpow_gpu_thread`), Stratum v1 protocol, 2miners pool (BTC payout). `ExternalCoin::QUAI` in AuXpow enum, pool server routing/algorithm/CH-coin mappings, miner channel+routing+share drain. Env vars: `ZION_POOL_AUXPOW_WALLET_QUAI`, `ZION_POOL_AUXPOW_PASSWORD_QUAI` | (this commit) |
| 07-15 | **Triple Parallel AuxPoW LIVE** — Claymore-style 3-stream parallel mining: ZION (GPU DeekshaChv3) + EPIC (GPU ProgPow) + VRSC (CPU VerusHash) simultaneously. Second AuxPow bridge (`cpu_auxpow_bridge`) for CPU-only coins. `external_stream_cpu` field in `PoolMessage::Job`. OpenMP-parallel DAG generation (19 threads, epoch 120 ~2GB in ~4 min). All 3 streams verified live on Edge (rx5600-test miner, 99.7% ZION accept rate, EPIC ProgPow kernel 7169+ batches, VRSC CPU thread hashing) | (this commit) |
| 07-14 | **PPLNS payout bug fix** — composite `miner_id/worker_name` keys (all workers sharing same miner_id had payouts sent to last-registered address) + telemetry registry composite keys | `bd6f1dfb3`, `85250086d` |
| 07-14 | NoSolution reconnect cooldown — ban IP for 300s on rate-limit exceed | `49f8bfb57` |
| 07-14 | Dashboard fix: web-next port 3001→3000, miner health endpoint 8444→8455 — 14/14 UP | `0c17d445c` |
| 07-14 | AuXpow Metal backend — all 6 algorithms on Apple M1 (18–23 BH/s, 28–224x vs OpenCL) | `a3cbc790b` |
| 07-13 | Stream Profit R1b — live API fetching | `e1c28689b` |
| 07-13 | Stream Profit R1c — GPU kernel parametrizace | `74a353205`, `87bb2b2f0` |
| 07-13 | EthStratum R6 — eth_getWork/eth_submitWork/eth_submitHashrate | `5baa76d60` |
| 07-13 | R7: VRSC B2b revenue — ZcashStratum protocol, VerusHash v2.2, LuckPool | `bb7d5407b` |
| 07-13 | VerusHash C++ native build — Haraka+CLHash pipeline, `native-verushash` feature | `ea4e33bf4` |
| 07-13 | DCR Blake3 kernel ROTR/ROOT fix + SMOS env vars | `dfc9cf24d` |
| 07-13 | SMOS GPU RVN live — `--no-tui`, `--algorithm kawpow`, non-interactive wrapper | `15a035290`, `09ba930da`, `d0a5bc807` |
| 07-13 | Non-EVM deploy: Solana + Stellar mainnet LIVE | `bffde9263`, `9d7ce1686` |
| 07-12 | ZionDex L3 WARP integration + AMM routing + LND | `c54422094`, `dad8702db` |
| 07-11 | AuxPow merge mining pool+dashboard integration | `44371aa10`, `f14500db3` |
| 07-11 | Pool F1-F6 scalability optimizations (1000+ miners) | `673632525` |
| 07-09 | 3.0.5 "All Green" — 11/11 services + E2E memo tests | `d425faec` |
| 07-09 | Web deploy optimization (2.57GB → 377MB) | — |
| 07-09 | Memory leak fix (OOM kill resolution) | `348abc91`, `22a160f9` |
| 07-06 | 3.0.4 Hard genesis reset — new server | — |
| 06-30 | Multi-chain wZION deploy (6 EVM chains) | — |
| 06-29 | Reverse bridge E2E verified (100 wZION burn → L1 unlock) | — |
| 06-27 | 3.0.3 decimal fork (1e12 → 1e6) | — |

---

## 9. Pending Tasks

### Blocking (for public launch)
1. **EVM contract redeploy** — New contracts with new admin keys + multisig (owner action)
2. **External audit** — Genesis configuration audit before public launch
3. **systemd User=zion** — 10/12 services done, dashboard + dex still User=root (need file relocation from /root/)

### Non-Blocking
1. Deploy remaining 7 non-EVM chains (Tron, Cardano, Cosmos, Aptos, Sui, NEAR, TON)
2. Multi-sig (5/5 WARP validators) for Solana mint authority + Stellar issuer
3. LND node start on Edge (docker compose up + channels)
4. ZionDex Router service on Edge (port 8454) — ✅ DONE (live, 7 chains)
5. R2: DCR revenue live (WoolyPooly)
6. R3: ALPH + KAS E2E (2miners)
7. R4: Stream telemetry revenue report (dashboard + API) — ✅ DONE (`d189712a7`)
8. R5: SMOS deploy + GPU mining (done — Vega rig `vega-smos` live on `zion-miner-v3.0.5-gpu-r6.zip`)
9. R7: VRSC live E2E deploy (LuckPool, needs ZION_VRSC_WALLET — VerusHash C++ native build ✅ DONE)
10. R8: True AuxPow consensus (future, 20-40h)

---

## 10. Documentation Index

| Document | Location | Description |
|----------|----------|-------------|
| **StatusV3.md** (this file) | Root | Canonical current status |
| StatusV3 archive | `docs/3.0.5/StatusV3_archive_2026-07-13.md` | Historical incident reports (5239 lines) |
| AGENTS.md | Root | Operating guidance for AI agents |
| ROADMAP.md | Root | Forward roadmap |
| AuxPlan.md | `docs/3.0.5/archive-root-md/` | AuxPow + Stream Profit development plan (archived) |
| FullRevenueAuxPow.md | Root | 3-stream parallel mining canonical architecture (ZION + Pearl + Verus) |
| AUXPOW_VRSC_B2B_PLAN.md | `docs/3.0.5/archive-root-md/` | VRSC B2b revenue integration design doc (archived) |
| ZionDex.md | `docs/3.0.5/archive-root-md/` | ZionDex DEX router documentation (archived) |
| Genesis reset runbook | `docs/3.0.4/GENESIS_HARD_RESET_CANONICAL.md` | Hard reset procedure |
| Security disclosures | `docs/security/SECURITY_DISCLOSURE_2026-07.md` | ZION-2026-001 through 005 |
| Contract addresses | `docs/3.0.5/CONTRACT_ADDRESSES.md` | All deployed contracts |
| AuxPow integration report | `docs/3.0.5/AUXPOW_INTEGRATION_REPORT_2026-07-11.md` | Pool+dashboard integration |
| Pool perf report | `docs/3.0.5/POOL_PERF_REPORT_2026-07-11.md` | F1-F6 optimizations |
| 3.0.5 all-green report | `docs/3.0.5/REPORT_3.0.5_ALL_GREEN_CZ.md` | Protocol upgrade verification |
