# ZION MainNet — Genesis 3.0.1 Status

> **Genesis #0 launched:** June 11, 2026
> **Current version:** 3.0.1
> **Status:** MainNet Core live, pool active, mining operational

---

## Live Infrastructure

| Service | Status |
|---------|--------|
| **Edge Node 1** | ✅ Active (Primary / Genesis) |
| **Edge Node 2** | ✅ Active (Follower / Peer) |
| **Pool Server** | ✅ Active |
| **Web / Dashboard** | ✅ Active |
| **Local Backup Node** | ✅ Syncing |

---

## Genesis 3.0.1 — What launched

- ✅ **Hard genesis #0** — clean reset, all nodes synced from block 0
- ✅ **Edge dual-node setup** — node1 + node2 with cross-sync prevention during reset
- ✅ **Pool server** — algorithm-aware share validation, dual-algo support
- ✅ **CPU mining** — Edge headless miner, multi-core, `deeksha_lite_v1`
- ✅ **GPU mining support** — OpenCL/CUDA/Metal backends
- ✅ **Fee split 89/5/5/1** — miners / humanitarian / Issobella / pool
- ✅ **DAO governance** — treasury, proposals, voting
- ✅ **WARP bridge** — cross-chain atomic swaps
- ✅ **Auto-backup** — Edge every 15 min, local backup automated
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

**Pool connection:** Available via ZION web dashboard or public DNS endpoint.

---

## Block Reward Distribution

| Recipient | Share |
|-----------|-------|
| ⛏️ Miners | 89% |
| 🕊️ Humanitarian Tithe | 5% |
| 🔭 L5/L6 Issobella Fund | 5% |
| 🏊 Pool Fee | 1% |

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
