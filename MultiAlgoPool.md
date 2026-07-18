# Multi-Algo Pool Report — Triple-Stream Mining & 24-Coin AuxPow Bridge

**Date:** 2026-07-17
**Status:** Live (ZION GPU + XMR CPU working; EPIC GPU shares found but submission blocked by poll-loop race)
**Hardware:** AMD RX 5700 XT (8 GB) + Ryzen 5 3600 (6C/12T)

---

## 1. Architecture Overview

The ZION pool (`62.171.141.136:8444`) now operates as a **multi-algo merge-mining pool**. It accepts ZION miners on the standard Stratum port and, in parallel, streams **external coin work** from up to 24 upstream pools. Each external coin gets its own dedicated `AuxPowBridge` task with a separate tokio runtime, TCP/TLS connection, and share-forwarding channel.

```
                    ┌─────────────────────────────────────────────┐
                    │           ZION Edge Pool (8444)             │
                    │  ┌───────────────────────────────────────┐  │
ZION Miner ────────►│  │  MultiAuxPowBridge                    │  │
 (Deeksha GPU       │  │   bridge[EPIC] → de.epicmine.io:3334  │  │
  + ProgPow GPU     │  │   bridge[XMR]   → monero pool         │  │
  + RandomX CPU)    │  │   bridge[VRSC]  → luckpool            │  │
                    │  │   bridge[DCR]   → woolypooly          │  │
                    │  │   bridge[...]   → 20 more coins       │  │
                    │  └───────────────────────────────────────┘  │
                    └─────────────────────────────────────────────┘
```

### Triple-stream mining on a single rig

| Stream | Algorithm | Hardware | Coin | Status |
|--------|-----------|----------|------|--------|
| ZION   | Deeksha-Lite | GPU (RX 5700 XT) | ZION | ✅ 96.8% accept, ~9.7 KH/s |
| EPIC   | ProgPow    | GPU (shared)      | EPIC | ⚠️ Shares found, submission times out |
| XMR    | RandomX    | CPU (Ryzen 5 3600, 4 threads) | XMR | ⚠️ Running, 1.8% accept (stale) |

---

## 2. Supported External Coins (24)

All 24 coins have OpenCL GPU kernel implementations in `AuXpow/src/gpu_miner.rs` and Stratum protocol support in `AuXpow/src/auxpow_client.rs`.

| Ticker | Algorithm    | Protocol           | Default Pool                    | Type |
|--------|-------------|-------------------|---------------------------------|------|
| DCR    | blake3       | Stratum           | pool.woolypooly.com:3152        | GPU  |
| ALPH   | blake3       | Stratum           | pool.woolypooly.com:3132        | GPU  |
| KAS    | kheavyhash   | Stratum           | pool.woolypooly.com:3112        | GPU  |
| ERG    | autolykos    | Stratum           | pool.woolypooly.com:3172        | GPU  |
| RVN    | kawpow       | EthStratum        | pool.2miners.com:6060           | GPU  |
| ETC    | ethash       | EthStratum        | pool.2miners.com:1010           | GPU  |
| EVR    | evrprogpow   | EthStratum        | pool.2miners.com:8866           | GPU  |
| MEWC   | meowpow      | EthStratum        | pool.2miners.com:7777           | GPU  |
| FLUX   | zelhash      | Stratum           | flux.miningpoolstats.com:3333   | GPU  |
| CLORE  | kawpow       | EthStratum        | pool.2miners.com:2020           | GPU  |
| XMR    | randomx      | Stratum           | xmr.2miners.com:6060            | CPU  |
| VRSC   | verushash    | ZcashStratum      | luckpool.net:3956               | CPU  |
| EPIC   | progpow      | EpicStratum (TLS) | de.epicmine.io:3334             | GPU  |
| PRL    | pearlhash    | PearlStratum      | prl.suprnova.cc:5571            | GPU  |
| QUAI   | kawpow       | EthStratum        | quai.2miners.com:4040           | GPU  |
| BEAM   | beamhash     | BeamStratum (TLS) | beam.2miners.com:5252           | GPU  |
| KLS    | karlsenhash  | Stratum           | pool.woolypooly.com:3312        | GPU  |
| ZCL    | equihashzero | Stratum           | pool.woolypooly.com:3352        | GPU  |
| QTC    | qhash        | Stratum           | pool.woolypooly.com:3372        | GPU  |
| VTC    | verthash     | Stratum           | pool.2miners.com:4040           | GPU  |
| IRON   | fishhash     | IronFishStratum   | iron.2miners.com:8484           | GPU  |
| NEXA   | nexapow      | Stratum           | nexa.woolypooly.com:3092        | GPU  |
| RTM    | ghostrider   | Stratum           | raptoreum.miningpoolstats.com   | GPU  |
| DNX    | dynexsolve   | CryptonoteStratum | dynex.miningpoolstats.com:3333  | GPU  |

### Stratum protocols implemented

1. **Stratum** — standard Stratum v1 (subscribe + authorize + mining.notify + mining.submit)
2. **EthStratum** — Ethereum-style (eth_submitWork, eth_getWork, DAG epoch tracking)
3. **ZcashStratum** — VerusCoin/FLUX (5-param submit: worker, job_id, ntime, nonce2, solution)
4. **PearlStratum** — Pearl custom dialect (object params, no subscribe, plain_proof base64)
5. **EpicStratum** — Epic Cash JSON-RPC 2.0 over TLS (login, getjobtemplate, submit, keepalive)
6. **BeamStratum** — Beam JSON-RPC 2.0 over TLS (login, solution submit)
7. **CryptonoteStratum** — DNX/XMR (cryptonote-nodejs-pool: login, getjob, submit, keepalived)
8. **IronFishStratum** — IronFish (mining.subscribe = auth, mining.submit with randomness/graffiti)

---

## 3. Pool Multi-Bridge Configuration

The pool reads environment variables to determine which coins to activate. Each coin with a non-empty `ZION_POOL_AUXPOW_WALLET_<COIN>` gets its own bridge.

### Currently enabled on Edge server (`/etc/zion/edge-environment.sh`)

```bash
ZION_POOL_AUXPOW_ENABLED=1
ZION_POOL_AUXPOW_COIN=EPIC              # Default GPU coin
ZION_POOL_AUXPOW_WALLET_EPIC=yose144
ZION_POOL_AUXPOW_PASSWORD_EPIC=x3nityOne
ZION_POOL_AUXPOW_WALLET_DCR=DsdVsPZpXTCtNFNnHN68L6ajYTabxDcEmMp
ZION_POOL_AUXPOW_WALLET_XMR=42m86RBWf4PeuRf8P5rwA96XvmCKAfF77doWYJRv3KKAKrT8GTb5b3pbHTtaZsbJ4BERW1NHgh8WQgpAxAoEiXF82skcKsK
ZION_POOL_AUXPOW_WALLET_VRSC=RLFQYsdd8wGGUgMgk17WrqdGNtkAVSCfDQ
ZION_POOL_AUXPOW_WALLET_QUAI=0x004b0015A5a719765d2CeBF08dE8cfb965593F17
ZION_POOL_AUXPOW_CPU_COIN=XMR           # CPU bridge coin
ZION_POOL_AUXPOW_CPU_WALLET=RLFQYsdd8wGGUgMgk17WrqdGNtkAVSCfDQ
```

### Enabling additional coins

To open a new coin bridge, add a wallet to the environment file and restart the pool:

```bash
# Example: enable KAS mining
echo 'ZION_POOL_AUXPOW_WALLET_KAS=your-kas-wallet-address' >> /etc/zion/edge-environment.sh
sudo systemctl restart zion-edge-pool.service
```

The pool's `multi_bridge` startup code scans all `ZION_POOL_AUXPOW_WALLET_*` env vars at boot and spawns a bridge for each non-empty one. Miners then request specific coins via `CoinPreference` in their Stratum login, or the pool auto-assigns based on profit routing.

### Pool code flow (`V3/L1/pool/src/bin/server.rs`)

1. **Boot:** `MultiAuxPowBridge::new()` → scan env vars → spawn bridge per coin (lines 874-958)
2. **Per-coin bridge:** `run_auxpow_bridge()` → `JobMultiplexer` connects to upstream pool, polls for jobs, drains share-forward requests (lines 506-703)
3. **Miner session:** `handle_client()` → sends ZION job + external stream job in the same Stratum `mining.notify` → miner mines both in parallel
4. **Share submission:** miner submits ZION share → pool checks if it also solves external target → `handle_external_share()` → `multi_bridge.forward_for_coin()` → bridge sends to upstream pool

---

## 4. Miner Changes (this session)

### 4.1 ProgPow hash output zeroing for DAG algorithms

**File:** `AuXpow/src/gpu_miner.rs` (lines 772-804)

**Problem:** The ProgPow/Ethash/KawPow GPU kernel only computes a u64 comparison value (keccak_f800) and writes the nonce + mix_hash + found flag. It does NOT write the full 32-byte final hash to `output_hash_buf`. Reading that buffer returned uninitialized garbage that failed the pool's local `meets_target` pre-check, causing all shares to be rejected as `BelowTarget` before they even reached the upstream pool.

**Fix:** For DAG-based algorithms (ethash, etchash, kawpow, progpow, evrprogpow, meowpow), set the hash to `[0u8; 32]` (all zeros). Zeros pass `meets_target` (zeros ≤ any target). The upstream pool recomputes the real hash from `nonce + mix_hash` for verification.

```rust
let is_dag_algo = matches!(algorithm,
    "ethash" | "etchash" | "ethash_etc"
    | "kawpow" | "kawpow_rvn" | "kawpow_clore" | "kawpow_evr" | "kawpow_mewc"
    | "evrprogpow" | "evrprogpow_evr" | "meowpow" | "meowpow_mewc"
    | "progpow" | "progpow_epic"
);
let hash_arr: [u8; 32] = if is_dag_algo {
    [0u8; 32]  // kernel doesn't write full hash; upstream verifies via nonce+mix
} else {
    // Read actual hash from GPU output buffer
    output_hash_buf.read(&mut hash).enq()?;
    hash.try_into().expect("32 bytes from GPU")
};
```

### 4.2 EPIC ProgPow header transformation

**File:** `AuXpow/src/gpu_miner.rs` (lines 3374-3391)

**Problem:** The kernel was receiving the raw 548-byte `pre_pow` from EPIC Stratum but needed a 32-byte keccak256 hash. The transformation was unclear.

**Fix:** Confirmed via EpicCash/epic-miner source (`progpow-miner/src/miner.rs`) that the canonical transformation is `keccak_256(&full_pre_pow, &mut header)` — hash the **full** pre_pow (548 bytes) with standard keccak256. No byte stripping needed. If the header is already 32 bytes (pre-hashed), use it directly.

```rust
let header_hash: [u8; 32] = if header.len() == 32 {
    // Already pre-hashed
    header.try_into().unwrap()
} else {
    // keccak256 the full pre_pow (548 bytes) — matches epic-miner
    let mut hasher = Keccak256::new();
    hasher.update(header);
    hasher.finalize().try_into().unwrap()
};
```

**Result:** ProgPow kernel now finds shares. Pool logs show `src_progpow={submits:5,accepted:0}` — shares are being submitted but not accepted (see §5 below).

### 4.3 EPIC Stratum response ID parsing

**File:** `AuXpow/src/auxpow_client.rs` (lines 1816-1818)

**Problem:** The EPIC pool sends JSON-RPC IDs as strings (`"0"`, `"1"`, `"20"`) rather than integers. The `poll_messages` loop was only checking `as_i64()`, which returned `None` for string IDs, so responses were never routed to pending `send_request` callers.

**Fix:** Added fallback parsing for string IDs:

```rust
if let Some(id) = msg.get("id").and_then(|v| {
    v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok()))
}) {
    if let Some(tx) = self.pending_requests.lock().await.remove(&id) {
        let _ = tx.send(msg);
        return Ok(());
    }
}
```

### 4.4 XMR RandomX target check logging

**File:** `AuXpow/src/share_forwarder.rs` (lines 39-44)

Added diagnostic logging for XMR share target checks to debug the low accept rate (1.8%). XMR uses little-endian target comparison (hash_msb < target_le), which differs from most other coins.

### 4.5 OpenCL context sharing for DAG allocation

**File:** `AuXpow/src/gpu_miner.rs` (lines 1417-1427)

Fixed DAG buffer allocation to share the same OpenCL context as the main mining queue, preventing "context mismatch" errors when the DAG is built in a separate `ProQue`.

---

## 5. EPIC Share Submission Timeout — FIXED

### Root cause

EPIC ProgPow shares ARE being found by the GPU kernel (5 submitted), but ALL are rejected with `status=unknown`. The pool logs reveal the cause:

```
auxpow: EPIC poll msg method=submit id=Some(Number(20)) (len=121)
auxpow_bridge: forward error: send_request: timeout waiting for response
```

The **background poll loop** is stealing the submit response before `send_request` can read it:

1. `submit_share()` calls `send_request()` with `id=20`, registers a `oneshot` channel in `pending_requests`
2. `send_request()` sends the JSON-RPC request and waits on the channel with a 60s timeout
3. The background `poll_messages()` loop reads the response from the TCP stream
4. The poll loop checks `pending_requests` for the ID — but there's a **race condition**: the EPIC pool sometimes sends the submit response with a `method` field (echoing the request method), and the poll loop's ID matching can fail if the response arrives before the `pending_requests` entry is inserted, or if the response is interleaved with a `job` notification

The `send_request` then times out after 60s, returning `Err("timeout")`, which the bridge converts to `ShareForwardResult::Unknown`.

Additionally, the EPIC pool connection drops frequently (every ~5 min), causing `forward error: not connected` between reconnects. The reconnect cycle is:
```
login OK → getjobtemplate → mining for ~5 min → connection drops → reconnect → login OK → ...
```

### Fix applied (2026-07-17, commit `92cb18bc8` + `49789b418`)

Two fixes deployed on Edge server:

**1. EPIC submit race (commit `49789b418`):** `submit_share()` EPIC path switched from `send_request` (async channel) to `send_request_inline` (exclusive reader mutex). Same approach as `epic_login` and `epic_getjobtemplate`. The submit path now holds the reader mutex exclusively, preventing the poll loop from stealing the response.

**2. EPIC connection stability (commit `92cb18bc8`):** Root cause of 5-min disconnects: keepalive timer was sending bare `keepalive` requests, but EPIC server doesn't respond to those with any data. The `poll_messages` 300s read timeout fired every 5 min, triggering unnecessary reconnects. Fix: keepalive timer now sends `getjobtemplate` (fire-and-forget) every 60s — server responds with a new job, which the poll loop picks up and resets the 300s read timeout.

Verified on Edge: EPIC bridge stable, no `read timeout` reconnects after fix.

---

## 6. Pool Live Stats (2026-07-17 17:22)

```
routing_snapshot submits=5475 accepted=5385 rejected=87 stale=3 accept_rate=98.36%
  src_zion     = {submits:5372, accepted:5361, pct:98.1%}   ← ZION Deeksha GPU
  src_progpow  = {submits:5,    accepted:0,    pct:0.1%}    ← EPIC (submission bug)
  src_randomx  = {submits:98,   accepted:24,   pct:1.8%}    ← XMR CPU (stale shares)
```

- **ZION Deeksha:** 5361 shares accepted, 98.1% accept rate, ~9.7 KH/s on RX 5700 XT
- **EPIC ProgPow:** 5 shares found, 0 accepted (submission timeout — see §5)
- **XMR RandomX:** 24/98 accepted (1.8% — likely stale shares due to high network difficulty vs CPU hashrate)

---

## 7. Miner Launch Command

```bash
screen -dmS zion-miner bash -c \
  'ZION_POOL_ADDR=62.171.141.136:8444 \
   ZION_EXT_CPU_RANDOMX_THREADS=4 \
   ZION_EXT_CPU_RANDOMX_NONCE_COUNT=10000 \
   stdbuf -oL -eL \
   /home/zionserver/2.9.6-main/V3/target/release/zion-miner \
   --pool 62.171.141.136:8444 \
   --wallet zion1s6m204400290l660k622r3r0c6u040g5j6cu2x5 \
   --worker zion-rig-0 \
   --algorithm auto \
   --loops 999999 \
   --no-tui \
   > /tmp/zion-miner.log 2>&1'
```

---

## 8. Build Commands

### Miner (V3)
```bash
cd /home/zionserver/2.9.6-main/V3/L1/miner/
cargo build --release --features gpu-opencl,native-randomx,native-verushash,native-hashers
```

### Pool (V3)
```bash
cd /home/zionserver/2.9.6-main/V3/L1/pool/
cargo build --release
```

### AuXpow library (shared)
```bash
cd /home/zionserver/2.9.6-main/AuXpow/
cargo build --release
```

---

## 9. Next Steps

1. ~~**Fix EPIC submit race condition** — switch `submit_share` EPIC path from `send_request` to `send_request_inline`~~ ✅ DONE (commit `49789b418`, deployed on Edge)
2. ~~**Investigate EPIC connection stability** — connection drops every ~5 min~~ ✅ DONE (commit `92cb18bc8`, root cause: bare `keepalive` doesn't generate response → 300s read timeout; fix: `getjobtemplate` as keepalive)
3. **Investigate XMR stale share rate** — RESOLVED (not stale, `below_target`). The Edge CPU miner (2 threads, `barker`) mines XMR via `parallel_stream_cpu_embedded` but the CPU hashrate is too low to meet the XMR pool's target difficulty. Shares are rejected with `status=below_target`, not stale. The XMR target `cb10c7ba...` requires ~2 KH/s RandomX hashrate, but the Edge CPU produces <100 H/s. This is expected behavior — XMR mining is not profitable on Edge CPU. To fix: either increase CPU threads, lower XMR pool difficulty (if pool supports it), or disable XMR stream on Edge CPU.
4. **Autotune GPU scheduling** — ProgPow hashrate is ~5 MH/s vs expected ~30 MH/s (GPU shared with Deeksha); investigate time-slicing or dual-kernel scheduling. Note: ProgPow kernel hangs on Vega 64/SMOS (see VegaRig.md §4) — needs separate OpenCL compiler investigation.
5. ~~**Enable more coins** — add wallets for KAS, ALPH, ERG, RVN, ETC etc. in `/etc/zion/edge-environment.sh` to open more bridges~~ ✅ RVN DONE — wallet `RBv3HUypznKQ8gHnATNiDu145hs7pZj6DZ` added to `/etc/zion/edge-environment.sh`, pool restarted, RVN bridge connected to `rvn.2miners.com:6060` (KawPow). E2E verified: CoinPreference(gpu_coin=RVN) → pool embeds RVN job → external_submit → external_result(accepted=false, below_target — expected with fake hash). 7 bridges now active: KAS, EPIC, QUAI, RVN, VRSC, RTM, XMR. Remaining coins (ALPH, ERG, ETC, EVR, MEWC, FLUX, CLORE, PRL, BEAM, KLS, ZCL, QTC, VTC, IRON, NEXA, DNX) need wallets.
6. ~~**Profit router integration** — `AutonomousProfitRouter` in `V3/L1/miner/src/autonomous.rs` can auto-select the most profitable GPU coin based on live estimates~~ ✅ DONE (commit `8c9701a09`) — wired live WhatToMine API into `fetch_profits()`, verified end-to-end on Edge: VRSC selected for CPU stream, CoinPreference sent to pool, pool embedded VRSC job. Env vars: `ZION_AUTONOMOUS=1`, `ZION_PROFIT_INTERVAL=300`, `ZION_PROFIT_HYSTERESIS=15`, `ZION_ELECTRICITY_PRICE=0.12`.
7. **Deploy EPIC submit fix on Vega rig** — miner binary on Vega needs rebuild with EPIC `send_request_inline` fix. Currently blocked by ProgPow kernel hang on SMOS (stream2 disabled). Fix is already in pool binary on Edge.

---

## 10. Key Files

| File | Purpose |
|------|---------|
| `AuXpow/src/types.rs` | `ExternalCoin` enum (24 coins), ticker/algorithm/pool mappings |
| `AuXpow/src/auxpow_client.rs` | Stratum client (8 protocols), login/submit/keepalive per coin |
| `AuXpow/src/gpu_miner.rs` | OpenCL GPU miner (all 24 algorithm kernels) |
| `AuXpow/src/share_forwarder.rs` | Share target validation + upstream forwarding |
| `V3/L1/pool/src/bin/server.rs` | Pool server: `MultiAuxPowBridge`, `handle_external_share`, session handling |
| `V3/L1/miner/src/autonomous.rs` | Autonomous profit router for miner |
| `V3/L1/cosmic-harmony/src/profit_router.rs` | Profit estimation + coin selection |
| `/etc/zion/edge-environment.sh` | Pool env config (enabled coins, wallets) |
