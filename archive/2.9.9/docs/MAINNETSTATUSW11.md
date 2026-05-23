# ZION V3 — Windows 11 Native Stack Status

**Date:** 2026-05-19
**Platform:** Windows 11 (native, MSVC toolchain)
**Repo:** `Zion/2.9.6-main`

## 1. Summary

A fully native Windows 11 ZION V3 test stack is running on localhost.
It consists of two P2P nodes, one pool, and one GPU miner.
This is a single-machine rehearsal for mainnet topology and performance.

## 2. Architecture

```
┌──────────────────────────────────────────────────────┐
│  Node 1 (w11-native-node)                            │
│  P2P: 0.0.0.0:8333    RPC: 0.0.0.0:8443            │
│  WebSocket: 0.0.0.0:8445  Metrics: 0.0.0.0:9115     │
│  ZION_SEED_PEERS=none  (no external bootstrap)       │
└──────────────┬───────────────────────────────────────┘
               │ P2P
┌──────────────▼───────────────────────────────────────┐
│  Node 2 (w11-native-node2)                           │
│  P2P: 0.0.0.0:8334    RPC: 0.0.0.0:8446            │
│  ZION_SEED_PEERS=127.0.0.1:8333  (follower)          │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Pool (server.exe)                                   │
│  Stratum: 0.0.0.0:8444   Node RPC: 127.0.0.1:8443  │
│  loop_count=1_000_000   nonce_count=4096             │
│  Fee split: 89/5/5/1                                 │
└──────────────┬───────────────────────────────────────┘
               │ Stratum TCP
┌──────────────▼───────────────────────────────────────┐
│  GPU Miner (zion-miner.exe)                        │
│  Pool: 127.0.0.1:8444                               │
│  OpenCL: gfx1010:xnack- (AMD)                       │
│  work_size=4096   ~5.95 KH/s                         │
│  DCR stealth: dcr.2miners.com:3333                  │
└──────────────────────────────────────────────────────┘
```

## 3. Key Fixes Applied

### 3.1 GPU Hashrate (1.92 KH/s -> 5.95 KH/s)
- **Root cause:** Pool default `ZION_NONCE_COUNT=1024` sent tiny nonce batches.
- **Fix:** Set `ZION_NONCE_COUNT=4096` to match GPU `work_size`.
- **Location:** `scripts/start-pool.ps1`

### 3.2 Windows Environment Variable Caveat
- **Problem:** `ZION_SEED_PEERS=''` (empty string) does NOT persist on Windows; `SetEnvironmentVariable` drops it, so the node falls back to hardcoded mainnet peers.
- **Fix:** Patched `V3/L1/core/src/bin/node.rs` to accept `ZION_SEED_PEERS=none` (or `empty`) as an explicit "no seeds" signal.

### 3.3 P2P Local Bootstrap
- **Problem:** Empty `ZION_SEED_PEERS` caused the node to always bootstrap to 4 hardcoded mainnet IPs.
- **Fix:** Use `none` value. Node 2 uses `127.0.0.1:8333` as its only seed and successfully handshakes with Node 1.

### 3.4 Previous Session Fixes (carried forward)
- Removed leaked hardcoded pool payout SK from Docker `.env` files.
- Added `fee_split_consistency_with_cosmic_harmony` and `default_config_uses_core_constants` unit tests to guard against fee-split drift.
- Generated fresh local Ed25519 test keys via `gen-keys` binary.

## 4. Startup Scripts

All scripts live in `scripts/` and use PowerShell with `[Environment]::SetEnvironmentVariable(..., 'Process')` to ensure env vars are actually passed to the Rust binaries.

| Script | Purpose |
|--------|---------|
| `start-node.ps1` | Node 1 (genesis / leader) |
| `start-node2.ps1` | Node 2 (follower, bootstraps from Node 1) |
| `start-pool.ps1` | Pool server |
| `start-miner.ps1` | GPU miner |

## 5. Verification Checklist

- [x] Node 1 binds P2P 8333 and RPC 8443
- [x] Node 2 connects to Node 1 via `127.0.0.1:8333`
- [x] Block relay works (`relay_ok peer=127.0.0.1:8333`)
- [x] Pool pulls templates from Node 1 RPC
- [x] GPU miner connects to pool, 100% share acceptance
- [x] GPU hashrate ~5.95 KH/s with `nonce_count=4096`
- [x] No hardcoded seed peers when `ZION_SEED_PEERS=none`
- [x] All binaries built natively on Windows (MSVC)

## 6. Ports in Use

| Service | Port | Protocol |
|---------|------|----------|
| Node 1 P2P | 8333 | TCP |
| Node 1 RPC | 8443 | TCP |
| Node 1 WebSocket | 8445 | TCP |
| Node 1 Metrics | 9115 | HTTP |
| Node 2 P2P | 8334 | TCP |
| Node 2 RPC | 8446 | TCP |
| Pool | 8444 | TCP |

## 7. Notes for Next Steps

- **Remote P2P:** To test cross-machine P2P, set `ZION_SEED_PEERS=<remote-ip>:8333` on the follower.
- **Production:** Replace test keys in `.env` files with real mainnet keys before deploy.
- **Hashrate tuning:** On Ubuntu with the same GPU we previously hit ~6 KH/s; 5.95 KH/s on Windows is within margin.
- **DCR stealth:** Miner also mines DCR on `dcr.2miners.com:3333` as a secondary revenue stream.
