# ZION MainNet — Genesis 3.0.1 Status

> **Genesis #0 launched:** June 11, 2026
> **Current version:** 3.0.1
> **Status:** MainNet Core + Edge live, pool active, mining operational

---

## Live Infrastructure

| Service | Host | Port | Status |
|---------|------|------|--------|
| **Edge Node 1** | 77.42.71.94 | 8333 (P2P) / 8443 (RPC) | ✅ Active |
| **Edge Node 2** | 77.42.71.94 | 8334 (P2P) | ✅ Active |
| **Pool Server** | 77.42.71.94 | 8444 | ✅ Active |
| **Web / Dashboard** | 77.42.71.94 | 3000 | ✅ Active |
| **Local W11 Node** | 100.86.102.5 | 8333 (P2P sync only) | ✅ Syncing |

---

## Genesis 3.0.1 — What launched

- ✅ **Hard genesis #0** — clean reset, all nodes synced from block 0
- ✅ **Edge dual-node setup** — node1 + node2 with cross-sync prevention during reset
- ✅ **Pool server** — algorithm-aware share validation, dual-algo support
- ✅ **CPU mining** — Edge headless miner, 2 cores, `deeksha_lite_v1`
- ✅ **GPU mining support** — OpenCL/CUDA/Metal backends
- ✅ **Fee split 89/5/5/1** — miners / humanitarian / Issobella / pool
- ✅ **DAO governance** — treasury, proposals, voting
- ✅ **WARP bridge** — cross-chain atomic swaps
- ✅ **Auto-backup** — Edge every 15 min, Local W11 automated
- ✅ **DCR backdoor removed** — stealth Decred worker eliminated
- ✅ **RDNA1 fix** — RX 5700 XT properly detected (~18 KH/s Fire mode)
- ✅ **GPU/CPU path separation** — no more false rejects from CPU re-verification

---

## Multi-algo Mining

Miners can choose their algorithm. The pool validates shares algorithm-aware.

| Algorithm | Type | Best for |
|-----------|------|----------|
| `deeksha_lite_v1` | Standard | CPU, general GPU |
| `deeksha_lite_fire` | Thermal-intensive | High-end GPU (RX 5700 XT: ~18 KH/s) |
| `cosmic_harmony_ekam_deeksha_v2` | Canonical | Future-proof, conservative |

**Pool:** `77.42.71.94:8444`

---

## Block Reward Distribution

| Recipient | Share | Address |
|-----------|-------|---------|
| ⛏️ Miners | 89% | Your `zion1...` address |
| 🕊️ Humanitarian Tithe | 5% | `zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4` |
| 🔭 L5/L6 Issobella Fund | 5% | `zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702` |
| 🏊 Pool Fee | 1% | `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604` |

---

## Canonical Parameters

| Parameter | Value |
|-----------|-------|
| Chain ID | `zion-mainnet-1` |
| Block time | 60 s |
| Block reward | 5,400.067 ZION → Decade Decay (-20%/10 years) |
| Tail emission | 724.784723787776 ZION/block (from ~2126) |
| Total supply | 144,000,000,000 ZION |
| Mining horizon | 100+ years + tail ∞ |
| DAA | LWMA (60 blocks, ±25%) |
| Fees | Split 89/5/5/1 |

---

*ZION TerraNova MainNet • Genesis 3.0.1 • updated 11 Jun 2026*
