# Rig.md — Trinity Triple-Stream Mining Plan

> **Goal:** SMOS rig (ZionRig, 2x Vega/RDNA1) mines ZION + ZANO + VRSC simultaneously through the ZION pool (not direct connections). Pool handles AuxPoW bridge to external pools. Revenue system tracks all 3 streams.

## Current State (2026-08-07)

- **Pool (Edge):** `zion-v31-pool` running, `auxpow_runtime` connects to ZANO (HeroMiners) + VRSC (LuckPool). Pool builds V3 `Job` messages with `external_stream` (ZANO) + `external_stream_cpu` (VRSC) fields. Pool has `ExternalSubmit` handler that forwards shares to external pools via `MultiAuxPowBridge`.
- **Miner (SMOS):** V31 miner running, ZION Stream 1 GREEN (shares accepted). But Stream 2/3 use **direct stratum connections** (`--stream2-url`, `--stream3-url`) to external pools — bypassing the pool's AuxPoW bridge and revenue system.
- **Root Cause:** V31 miner's `pool_message.rs` only has `CoinPreference` variant — missing `Job { external_stream, external_stream_cpu }` and `ExternalSubmit`. Miner can't receive AuxPoW jobs from pool or submit AuxPoW shares back to pool.

## Architecture (V3 → V31 upgrade)

```
┌─────────────────┐     V3 Protocol (JSON lines)      ┌──────────────────┐
│   SMOS Rig      │◄──────────────────────────────────►│  Edge Pool       │
│  zion-miner     │                                    │  zion-v31-pool   │
│                 │   Job { external_stream: ZANO }    │                  │
│  Stream 1: ZION │   Job { external_stream_cpu: VRSC }│  auxpow_runtime  │
│  Stream 2: ZANO │◄──────────────────────────────────►│    ZANO bridge ──► HeroMiners
│  Stream 3: VRSC │   ExternalSubmit { coin: ZANO }    │    VRSC bridge ──► LuckPool
│                 │   ExternalSubmit { coin: VRSC }    │                  │
└─────────────────┘                                    │  revenue_proxy   │
                                                       │  payout system   │
                                                       └──────────────────┘
```

## Execution Plan

### Phase 1: Upgrade miner `pool_message.rs` to full V3 protocol
- [ ] Port `ExternalStreamJob` struct from `zion_pool::v3_protocol` to miner's `pool_message.rs`
- [ ] Port `PoolMessage::Job` variant with `external_stream` + `external_stream_cpu` fields
- [ ] Port `PoolMessage::ExternalSubmit` variant
- [ ] Port `PoolMessage::ExternalResult` variant
- [ ] Port `PoolMessage::Hello`, `Welcome`, `Submit`, `Result`, `NoSolution`, `SetDifficulty`
- [ ] Add `encode_message` / `decode_message` for full PoolMessage

### Phase 2: Upgrade miner stratum client to V3 protocol
- [ ] In `runtime.rs`, add V3 protocol connection mode (when `--pool` is set, use V3 protocol not SV1)
- [ ] Parse incoming `Job` messages — extract `external_stream` (GPU AuxPoW) + `external_stream_cpu` (CPU AuxPoW)
- [ ] Route `external_stream` to GPU AuxPoW mining thread (Stream 2)
- [ ] Route `external_stream_cpu` to CPU AuxPoW mining thread (Stream 3)
- [ ] Submit ZION shares via `PoolMessage::Submit`
- [ ] Submit AuxPoW shares via `PoolMessage::ExternalSubmit`
- [ ] Remove direct stratum connection mode (`--stream2-url`, `--stream3-url`) — all jobs come from pool

### Phase 3: Wallet configuration
- [ ] Miner uses pool wallet (`zion1pool` or pool's payout address) for ZION coinbase
- [ ] Pool handles ZANO/VRSC wallet — already configured in `auxpow_runtime` env
- [ ] Pool's revenue system tracks all 3 streams (ZION + ZANO + VRSC) per miner
- [ ] Pool's payout system distributes rewards to miner's wallet

### Phase 4: Pool-side verification
- [ ] Verify pool sends `Job` messages with `external_stream` populated from `multi_bridge`
- [ ] Verify pool handles `ExternalSubmit` from miner and forwards to external pools
- [ ] Verify pool's `auxpow_runtime` stays connected to HeroMiners/LuckPool
- [ ] Verify pool's revenue system records AuxPoW shares per miner

### Phase 5: SMOS rig deployment
- [ ] Update wrapper script — remove `--stream2-url` / `--stream3-url` flags
- [ ] Miner connects only to pool (`--pool 62.171.141.136:8444`)
- [ ] Miner uses V3 protocol (not SV1) for job distribution
- [ ] Rebuild miner binary in Ubuntu 18.04 Docker (GLIBC 2.27 compat)
- [ ] Upload to Edge, rebuild ZIP, reload SMOS rig

### Phase 6: End-to-end verification
- [ ] Stream 1 (ZION): shares accepted by pool ✓
- [ ] Stream 2 (ZANO): shares accepted by pool → forwarded to HeroMiners ✓
- [ ] Stream 3 (VRSC): shares accepted by pool → forwarded to LuckPool ✓
- [ ] Pool revenue system records all 3 streams
- [ ] GPU hashrate > 0 (not CPU fallback)
- [ ] SMOS console shows stream stats

## Key Files

| Component | File | Action |
|-----------|------|--------|
| Miner pool protocol | `V31/L1/miner/src/pool_message.rs` | Expand to full V3 PoolMessage |
| Miner runtime | `V31/L1/miner/src/runtime.rs` | Add V3 protocol job routing |
| Miner stratum client | `V31/L1/miner/src/stratum_client.rs` | V3 protocol mode |
| Pool V3 protocol | `V31/L1/pool/src/v3_protocol.rs` | Already complete ✓ |
| Pool stratum server | `V31/L1/pool/src/stratum.rs` | Already sends external_stream ✓ |
| Pool auxpow bridge | `V31/L1/pool/src/auxpow_bridge.rs` | Already complete ✓ |
| Pool auxpow runtime | `V31/L1/pool/src/auxpow_runtime.rs` | Already complete ✓ |
| SMOS wrapper | `V31/scripts/smos/wrapper_v31_trinity.sh` | Remove direct stream URLs |

## V3 Reference (archive)

- `archive/V3/L1/miner/src/main.rs:3467-3638` — Job reception + external stream routing
- `archive/V3/L1/miner/src/main.rs:6193-6310` — External share submitter thread
- `archive/V3/L1/pool/src/bin/server.rs:4597-4814` — Pool job distribution with external streams
- `archive/V3/L1/pool/src/bin/server.rs:4878-4920` — Pool ExternalSubmit handler
- `archive/V3/L1/pool/src/lib.rs:44-128` — ExternalStreamJob + PoolMessage definitions
- `archive/AuXpow/src/share_forwarder.rs:88-258` — Share forwarding to external pools

## Version Target

- Miner: `3.2.0-beta` (Trinity upgrade)
- Pool: `3.2.0-beta` (already supports V3 protocol)
- Protocol: `zion-v3-stratum/0.2` (unchanged)
