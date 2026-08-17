# SHARE VERIFICATION & BLOCK GROWTH REPORT
**Date:** 2026-08-08 21:10 CET
**Chain:** Zion V3.2 (V31 native)

---

## Summary

Both GPUs are mining EkamDeeksha v3.2 with accepted shares and growing chain.

## Verified Results (5-minute window: 21:04 - 21:09)

### Chain Growth
| Metric | Start | End | Delta |
|--------|-------|-----|-------|
| Height | 730 | 734 | +4 blocks |
| Accepted blocks | 731 | 735 | +4 |

### Shares by Miner (5 min)
| Miner | Wallet | Shares | GPU | Status |
|-------|--------|--------|-----|--------|
| zionserver-gpu | zion1f0t4x... | 1182 | Edge GPU | ✅ |
| v31-miner | zion1pool | 68 | Edge CPU | ✅ |
| vega-smos | zion1s6m204... | 54 | Vega 64 OpenCL | ✅ |
| mac-m1-metal | zion1d2k5v... | 4 | Mac M1 Metal | ✅ |

### Blocks Found (5 min)
| Height | Miner | Worker |
|--------|-------|--------|
| 731 | zion1f0t4x... | zionserver-gpu |
| 732 | zion1f0t4x... | zionserver-gpu |
| 733 | zion1pool | v31-miner |
| 734 | zion1f0t4x... | zionserver-gpu |

## GPU Status

### Mac M1 Metal GPU
- **Backend:** Metal (Apple M1)
- **Algorithm:** deeksha_lite_v1 (Ekam v3.2)
- **Hashrate:** 3.88 KH/s (work_size=4096)
- **Hash match:** Bit-identical to CPU reference
- **Shares:** ✅ Accepted by pool
- **Wallet:** zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6
- **Worker:** mac-m1-metal

### Vega 64 OpenCL GPU (Rig)
- **Backend:** OpenCL (AMD Vega 64 gfx900)
- **Algorithm:** deeksha_lite_v1 (Ekam v3.2)
- **Shares:** ✅ 54 shares / 5 min (rig self-recovered after SMOS crash)
- **Wallet:** zion1s6m204400290l660k622r3r0c6u040g5j6cu2x5 (old wallet still in running miner)
- **Worker:** vega-smos
- **Note:** Rig recovered autonomously — SMOS agent API still shows None but miner process is running and submitting shares

## Optimizations Applied

1. **gpu_guard.rs:** scratchpad_bytes 256→512 KiB (matches v3.2 kernel)
2. **gpu_guard.rs:** Vega 64 work_size 16384→4096 (2 GiB scratchpad, safe for 8GB HBM2)
3. **Metal kernel:** u64-optimized SHA3-512 (sha3_512_65_u64) — +45% M1 hashrate
4. **Metal backend:** batch_size cap at 8192
5. **Linux build:** Ubuntu 18.04 Docker container (GLIBC 2.25 compat for SMOS)

## Conclusion

✅ **Both GPUs verified — shares accepted, chain growing (730→734)**
✅ **Mac M1 Metal: 3.88 KH/s, hash bit-identical, shares accepted**
✅ **Vega 64 OpenCL: 54 shares/5min, rig self-recovered**
✅ **Chain growth: +4 blocks in 5 minutes**

---

Generated with [Devin](https://devin.ai)
