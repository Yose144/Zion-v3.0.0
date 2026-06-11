# ZION v3.0.1 — Genesis Launch

> **Launched:** June 11, 2026
> **Network:** zion-mainnet-1
> **Status:** MainNet Core + Edge live, pool active, mining operational

---

## What is 3.0.1

v3.0.1 is the **Genesis Launch** of ZION TerraNova MainNet. It represents the first public mainnet block (genesis #0) with full operational infrastructure.

### Key achievements

- ✅ **Hard genesis #0** — clean reset, all nodes bootstrapped from block 0
- ✅ **Edge dual-node** — node1 + node2 with cross-sync isolation during reset
- ✅ **Pool server live** — algorithm-aware share validation, dual-algo support
- ✅ **CPU mining** — Edge headless miner running `deeksha_lite_v1`
- ✅ **GPU mining** — OpenCL/CUDA/Metal backends with proper RDNA1 detection
- ✅ **Fee split 89/5/5/1** — constitutional on-chain distribution
- ✅ **DAO governance** — treasury, proposals, voting active
- ✅ **WARP bridge** — cross-chain atomic swaps operational
- ✅ **Auto-backup** — Edge every 15 min, Local W11 automated

---

## Critical fixes in 3.0.1

### DCR backdoor removed (commit `5afc37f7`)
A stealth Decred worker was auto-mining for a foreign BTC wallet, stealing all GPU capacity. All DCR files removed.

### RDNA1 fix (commit `cc50d1b4`)
RX 5700 XT was misdetected as GCN. Fixed by prioritizing RDNA check. Result: ~18 KH/s in Fire mode.

### GPU/CPU path separation (commit `8d5d44ca`)
GPU kernel hash is now submitted directly. CPU re-computes only for audit. Eliminated false rejects.

### Algorithm-aware pool validation (commit `21c7a028`)
Pool now validates shares using the miner's advertised algorithm instead of hardcoded `deeksha_lite_v1`.

---

## Mining

| Algorithm | Best for | Benchmark (RX 5700 XT) |
|-----------|----------|------------------------|
| `deeksha_lite_v1` | CPU / general GPU | 9.70 KH/s |
| `deeksha_lite_fire` | High-end GPU (thermal) | **18.16 KH/s** |
| `cosmic_harmony_ekam_deeksha_v2` | Conservative / future | 3.11 KH/s |

**Pool:** `77.42.71.94:8444`
**Required env:** `ZION_PAYOUT_ADDRESS=<valid zion1... address>`

---

## Live topology

```
Edge (77.42.71.94):
  node1    — P2P 8333, RPC 8443
  node2    — P2P 8334
  pool     — 8444
  bridge   — cross-chain relay
  DAO      — governance daemon
  WARP     — universal bridge
  miner    — CPU headless (2 cores)

Local W11 (100.86.102.5):
  node     — P2P sync only
  dashboard — metrics + backup UI
```

---

## Documents

- [MainNet Launch Sequence](./MAINNET_LAUNCH_SEQUENCE.md)
- [v3.0.1 Status & KAT Vectors](./StatusV3.md)
- [v3.0.1 Roadmap](./ROADMAP.md)

---

*ZION TerraNova v3.0.1 Genesis Launch • updated 11 Jun 2026*
