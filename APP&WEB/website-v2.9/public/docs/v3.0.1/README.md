# ZION v3.0.1 — Genesis Launch

> **Launched:** June 11, 2026
> **Network:** zion-mainnet-1
> **Status:** MainNet Core live, pool active, mining operational
>
> **⚠️ Historical document.** This page describes the original **v3.0.1 Genesis Launch** on 11 June 2026.
> The current public line is **v3.0.5 All Green / Mainnet Beta** running on a new genesis hash after the July 2026 hard reset.
> See [mainnet/README.md](../mainnet/README.md) for the current status, transition timeline and security incident summary.

---

## What is 3.0.1

v3.0.1 is the **Genesis Launch** of ZION TerraNova MainNet. It represents the first public mainnet block (genesis #0) with full operational infrastructure.

### Key achievements

- ✅ **Hard genesis #0** — clean reset, all nodes bootstrapped from block 0
- ✅ **Edge dual-node** — primary + follower with cross-sync isolation during reset
- ✅ **Pool server live** — algorithm-aware share validation, dual-algo support
- ✅ **CPU mining** — headless miner running `deeksha_lite_v1`
- ✅ **GPU mining** — OpenCL/CUDA/Metal backends with proper RDNA1 detection
- ✅ **Fee split 89/5/5/1** — constitutional on-chain distribution
- ✅ **DAO governance** — treasury, proposals, voting active
- ✅ **WARP bridge** — cross-chain atomic swaps operational
- ✅ **Auto-backup** — automated every 15 min

---

## Critical fixes in 3.0.1

### DCR backdoor removed
A stealth Decred worker was auto-mining for a foreign BTC wallet, stealing all GPU capacity. All DCR files removed.

### RDNA1 fix
RX 5700 XT was misdetected as GCN. Fixed by prioritizing RDNA check. Result: ~18 KH/s in Fire mode.

### GPU/CPU path separation
GPU kernel hash is now submitted directly. CPU re-computes only for audit. Eliminated false rejects.

### Algorithm-aware pool validation
Pool now validates shares using the miner's advertised algorithm instead of hardcoded `deeksha_lite_v1`.

---

## Mining

| Algorithm | Best for | Benchmark (RX 5700 XT) |
|-----------|----------|------------------------|
| `deeksha_lite_v1` | CPU / general GPU | 9.70 KH/s |
| `deeksha_lite_fire` | High-end GPU (thermal) | **18.16 KH/s** |
| `cosmic_harmony_ekam_deeksha_v2` | Conservative / future | 3.11 KH/s |

**Pool connection:** Available via ZION web dashboard or public DNS endpoint.
**Required:** `ZION_PAYOUT_ADDRESS=<valid zion1... address>`

---

## Live topology

```
Edge (public VPS):
  node1    — Primary / Genesis
  node2    — Follower / Peer
  pool     — Active
  bridge   — Cross-chain relay
  DAO      — Governance daemon
  WARP     — Universal bridge
  miner    — CPU headless

Local backup:
  node     — Sync only
  dashboard — Metrics + backup UI
```

---

## Documents

- [MainNet Launch Sequence](./MAINNET_LAUNCH_SEQUENCE.md)
- [v3.0.1 Status & KAT Vectors](./StatusV3.md)
- [v3.0.1 Roadmap](./ROADMAP.md)

---

*ZION TerraNova v3.0.1 Genesis Launch • updated 11 Jun 2026*
