# ZION Ekam Deeksha GPU Benchmark Matrix

> **Date:** 2026-04-02  
> **Miner:** V3/L1/miner @ commit `9e307c4d` (TPB=48 default, --use_fast_math)  
> **Mode:** `--ekam-bench` (pure GPU, no pool overhead)  
> **Algorithm:** Ekam Deeksha v2 — 256 KiB scratchpad, 4 passes, 256 random reads, INT8 NPU Mix, 8-round Cosmic Fusion

---

## Results Summary

| GPU | Arch | VRAM | BW (GB/s) | Compute | KH/s | Optimal TPB | Optimal wc | $/hr (Vast) | KH/$ |
|-----|------|------|-----------|---------|------|-------------|------------|-------------|------|
| GTX 1060 3GB | Pascal (SM 6.1) | 3 GB GDDR5 | 192 | 6.1 | **5.9** | 48 | 2560 | $0.095 | 62 |
| GTX 1080 | Pascal (SM 6.1) | 8 GB GDDR5X | 320 | 6.1 | **9.5** | 48–256 | 16384 | $0.048 | 198 |
| RTX 2060 SUPER | Turing (SM 7.5) | 8 GB GDDR6 | 448 | 7.5 | **3.4** ¹ | — | — | — | — |
| RTX 3060 | Ampere (SM 8.6) | 12 GB GDDR6 | 360 | 8.6 | **16.5** | 24 | 4096 | $0.048 | 344 |
| AMD RX 5600 XT | RDNA1 | 6 GB GDDR6 | 288 | — | **10.0** ² | lws=256 | — | local | ∞ |
| RTX 5070 Ti | Blackwell (SM 12.0) | 16 GB GDDR7 | 896 | 12.0 | **21.0** | 48 | 49152 | $0.10 | 210 |
| A100 SXM4 | Ampere (SM 8.0) | 40 GB HBM2e | 2039 | 8.0 | **38.5** | any (flat) | any | $0.62 | 62 |

¹ RTX 2060S was benchmarked in an earlier session with pool overhead — number is lower bound (effective pool rate, not pure GPU).  
² AMD RX 5600 XT uses OpenCL backend, not CUDA. Numbers from local machine, Standard epoch.

> **AMD GPUs:** Not available on Vast.ai (NVIDIA-only platform). Cloud AMD GPU rental does not exist in any major provider as of April 2026. AMD benchmarks require local hardware.

---

## Key Findings

### 1. Lower TPB values dominate across all architectures
- **TPB=48** wins on Pascal 3GB (1060), Blackwell (5070 Ti), and ties on Ampere (A100).
- **TPB=24** (¾ warp) is optimal on Ampere RTX 3060: 16.5 KH/s vs 14.5 at TPB=32.
- **TPB=256** matches TPB=48 on GTX 1080 Pascal (8GB) — unique exception.
- TPB=256 (old default) is **catastrophically bad** on Blackwell (5.5× slower) and notably worse on Pascal 3GB (40% slower).

### 2. Memory bandwidth → hashrate is sublinear
```
A100:  2039 GB/s → 38.5 KH/s  (0.019 KH/s per GB/s)
5070Ti: 896 GB/s → 21.0 KH/s  (0.023 KH/s per GB/s)
1080:   320 GB/s →  9.5 KH/s  (0.030 KH/s per GB/s)
1060:   192 GB/s →  5.9 KH/s  (0.031 KH/s per GB/s)
```
Lower-end GPUs get more KH/s per GB/s of bandwidth. This is because:
- 256 KiB scratchpad with random reads is **latency-bound, not bandwidth-bound**
- Bigger GPUs have higher raw bandwidth but similar memory latency
- L2 cache size matters more than raw bandwidth for this workload

### 3. VRAM requirement: ~256 KiB × work_count + overhead
| VRAM | Max safe wc | Scratchpad MB |
|------|-------------|---------------|
| 3 GB | 2560 | 640 MB |
| 6 GB | 16384 | 4096 MB |
| 8 GB | 24576 | 6144 MB |
| 16 GB | 49152 | 12288 MB |
| 40 GB | 131072 | 32768 MB |

### 4. Cost efficiency (Vast.ai April 2026)
```
Best $/KH:  RTX 3060     @ $0.048/hr → 344 KH/$
Runner-up:  RTX 5070 Ti  @ $0.10/hr  → 210 KH/$
            GTX 1080     @ $0.048/hr → 198 KH/$
Worst $/KH: A100 SXM4    @ $0.62/hr  → 62 KH/$
```
**RTX 3060 is the clear cost-efficiency king** at 344 KH/$ — nearly 2× better than RTX 5070 Ti.
GTX 1080 is also excellent value. A100 gives raw power (38.5 KH/s) but at 5.5× worse cost efficiency than 3060.

### 5. 3 GB cards work!
GTX 1060 3GB achieves 5.9 KH/s with wc=2560 (640 MB scratchpad).  
The minimum VRAM for Ekam Deeksha mining is approximately **2 GB** (wc=512 → 128 MB scratchpad → 2.7 KH/s).

---

## A100 Deep Dive

A100 SXM4 showed remarkable insensitivity to tuning parameters:
- **TPB sweep (32–256):** 38.2–38.6 KH/s — essentially flat
- **Work count (16K–262K):** 38.0–38.6 KH/s — essentially flat
- **`--gpu-architecture=sm_80`:** No improvement
- **`__launch_bounds__(48, N)`:** No improvement

This confirms A100's 40 MB L2 cache and HBM2e latency hiding are already optimal for the 256 KiB random-read scratchpad pattern. The card is bottlenecked on memory latency, not occupancy or instruction throughput.

---

## Detailed Sweep Data

### GTX 1060 3GB — Work Count Sweep (TPB=48)
| wc | Scratchpad MB | KH/s |
|----|--------------|------|
| 512 | 128 | 2.74 |
| 1024 | 256 | 3.99 |
| 1536 | 384 | 5.20 |
| 2048 | 512 | 5.18 |
| **2560** | **640** | **5.90** |
| 3072 | 768 | 3.78 |

### GTX 1060 3GB — TPB Sweep (wc=2560)
| TPB | KH/s |
|-----|------|
| 32 | 5.70 |
| **48** | **5.89** |
| 64 | 5.02 |
| 96 | 5.74 |
| 128 | 4.61 |
| 256 | 3.49 |

### GTX 1080 — Work Count Sweep (TPB=48)
| wc | Scratchpad MB | KH/s |
|----|--------------|------|
| 2048 | 512 | 7.79 |
| 4096 | 1024 | 8.85 |
| 8192 | 2048 | 8.13 |
| **16384** | **4096** | **9.39** |
| 24576 | 6144 | 8.83 |

### GTX 1080 — TPB Sweep (wc=16384)
| TPB | KH/s |
|-----|------|
| 32 | 8.54 |
| 48 | 9.40 |
| 64 | 8.20 |
| 96 | 8.45 |
| 128 | 8.16 |
| **256** | **9.48** |

### RTX 3060 — Work Count Sweep (TPB=24)
| wc | Scratchpad MB | KH/s |
|----|--------------|------|
| 2048 | 512 | 13.43 |
| **4096** | **1024** | **16.53** |
| 8192 | 2048 | 12.21 |
| 16384 | 4096 | 12.48 |
| 32768 | 8192 | 12.56 |

### RTX 3060 — TPB Sweep (wc=4096)
| TPB | KH/s |
|-----|------|
| 16 | 15.04 |
| 20 | 12.68 |
| **24** | **16.52** |
| 28 | 12.69 |
| 32 | 14.43 |
| 40 | 15.11 |
| 48 | 13.85 |
| 64 | 13.69 |
| 96 | 13.20 |
| 128 | 11.49 |
| 256 | 10.15 |

### RTX 5070 Ti — TPB Sweep (wc=32768)
| TPB | KH/s |
|-----|------|
| 32 | 20.08 |
| **48** | **21.23** |
| 64 | 20.15 |
| 96 | 19.28 |
| 128 | 16.00 |
| 256 | 3.83 |

### A100 SXM4 — TPB Sweep (wc=32768)
| TPB | KH/s |
|-----|------|
| 32 | 38.25 |
| **48** | **38.62** |
| 64 | 38.23 |
| 96 | 38.43 |
| 128 | 38.38 |
| 192 | 38.23 |
| 256 | 38.20 |

---

## Recommended Tuning Defaults

| GPU Class | ZION_CUDA_TPB | ZION_GPU_WORK_SIZE | Notes |
|-----------|--------------|-------------------|-------|
| 3 GB (1060, etc.) | 48 | 2560 | VRAM-limited |
| 6 GB (2060, 1660) | 48 | 16384 | Good balance |
| 8 GB (1080, 3060 Ti) | 48 | 16384 | 1080: 256 also works |
| 12 GB (3060) | **24** | **4096** | ¾ warp optimal on Ampere |
| 16 GB (5070 Ti, 4080) | 48 | 49152 | |
| 24+ GB (A100, H100) | 48 | 65536 | Insensitive to tuning |

---

## Test Environment

| Instance | Machine | GPU | SSH | $/hr | Region |
|----------|---------|-----|-----|------|--------|
| 34010520 | 29150 | GTX 1060 3GB | ssh8.vast.ai:10520 | $0.095 | — |
| 34010529 | 45760 | GTX 1080 | ssh2.vast.ai:10528 | $0.048 | — |
| 34011678 | 31429 | RTX 3060 12GB | ssh3.vast.ai:11678 | $0.048 | South Korea |
| 34004483 | 29691 | RTX 5070 Ti | ssh4.vast.ai:14482 | $0.10 | Korea |
| 34009169 | 13280 | A100 SXM4 40GB | ssh6.vast.ai:19168 | $0.62 | Czechia |

All benchmarks run with `--ekam-bench` mode (10-second sustained measurement, no pool overhead).

---

*Last updated: 2026-04-02 | Miner commit: 9e307c4d*
