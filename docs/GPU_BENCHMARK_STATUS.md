# Ekam Deeksha v2 — GPU Benchmark Status

> **Aktualizováno:** 2026-04-02  
> **Verze:** V3 mainnet miner (`gpu_backend.rs` commit `9e307c4d`)  
> **Benchmark mode:** `--ekam-bench` (čistý GPU throughput, bez pool overhead)  
> **Algoritmus:** Ekam Deeksha v2 — 256 KiB scratchpad, 4 passes, 256 random reads, INT8 NPU Mix, 8× CosmicFusion

---

## Souhrnná tabulka

| GPU | Arch | Gen | VRAM | Bus | BW (GB/s) | Compute | KH/s | Opt TPB | $/hr | KH/$/hr | Poznámky |
|-----|------|-----|------|-----|-----------|---------|------|---------|------|---------|----------|
| AMD RX 5600 XT | RDNA1 | 2019 | 6 GB GDDR6 | 192-bit | 288 | — | **10.0** | lws=256 | local | ∞ | OpenCL backend, VRAM 25% |
| RTX 5070 Ti | Blackwell | 2025 | 16 GB GDDR7 | 256-bit | 896 | sm_120 | **21.0** | 48 | $0.10 | 210 | Vast.ai Korea |
| A100 SXM4 40GB | Ampere | 2020 | 40 GB HBM2e | 5120-bit | 2039 | sm_80 | **38.5** | 48* | $0.62 | 62 | Vast.ai Czechia |
| GTX 1060 6GB | Pascal | 2016 | 6 GB GDDR5 | 192-bit | 192 | sm_61 | — | — | $0.09 | — | *testuje se* |
| GTX 1080 8GB | Pascal | 2016 | 8 GB GDDR5X | 256-bit | 320 | sm_61 | — | — | $0.04 | — | *testuje se* |
| RTX 2060 Super | Turing | 2019 | 8 GB GDDR6 | 256-bit | 448 | sm_75 | **3.35** | 256† | — | — | Pre-optimization (TPB=256) |
| RTX 3060 | Ampere | 2021 | 12 GB GDDR6 | 192-bit | 360 | sm_86 | **2.64** | 256† | — | — | Pre-optimization (TPB=256) |

\* A100 je necitlivá na TPB (38.2–38.6 KH/s pro TPB 32–256)  
† RTX 2060S a RTX 3060 měřeny před TPB optimalizací — s TPB=48 budou výrazně rychlejší

---

## Detailní výsledky per GPU

### NVIDIA A100 SXM4 40GB (Ampere, sm_80)

**Instance:** Vast.ai #34009169, Czechia, $0.62/hr  
**Driver:** 595.58.03 | **CUDA:** 13.2

**TPB sweep (wc=32768):**

| TPB | KH/s |
|-----|------|
| 32 | 38.25 |
| 48 | **38.62** |
| 64 | 38.23 |
| 96 | 38.43 |
| 128 | 38.38 |
| 192 | 38.23 |
| 256 | 38.20 |

**Work count sweep (TPB=48):**

| wc | KH/s |
|----|------|
| 16384 | 38.34 |
| 32768 | 38.64 |
| 49152 | 38.43 |
| 65536 | 38.33 |
| 98304 | 38.04 |
| 131072 | 38.33 |
| 163840 | 38.50 |
| 262144 | 38.07 |

**Optimalizace testovány:**
- `--gpu-architecture=sm_80`: bez efektu (38.24 KH/s)
- `__launch_bounds__(48, 1)`: bez efektu (38.37 KH/s)
- `__launch_bounds__(48, 2)`: bez efektu (38.52 KH/s)

**Závěr:** A100 je stabilně ~38.5 KH/s bez ohledu na TPB/wc/compile flags. Velký L2 cache (40 MB) a HBM2e latency maskují parametrické rozdíly.

---

### NVIDIA RTX 5070 Ti (Blackwell, sm_120)

**Instance:** Vast.ai #34004483, Korea, $0.10/hr  
**Driver:** 580.126.09 | **VRAM:** 16 GB GDDR7

**TPB sweep (wc=32768):**

| TPB | KH/s |
|-----|------|
| 32 | 18.98 |
| 48 | **21.23** |
| 64 | 20.15 |
| 96 | 15.69 |
| 128 | 11.15 |
| 192 | 7.31 |
| 256 | 3.83 |

**Work count sweep (TPB=48):**

| wc | KH/s |
|----|------|
| 1024 | 5.37 |
| 4096 | 14.51 |
| 8192 | 18.84 |
| 16384 | 19.33 |
| 32768 | 20.15 |
| 49152 | 21.03 |

**Kritický nález:** TPB=256 (starý default) → 3.83 KH/s. TPB=48 → 21.23 KH/s (**5.5× zlepšení**).

**`__forceinline__` test:** Přidání na všechny ~25 device funkcí → 81% regrese (21→3.9 KH/s) kvůli register spill. **Zamítnuto.**

**`--use_fast_math`:** Přidáno do NVRTC compile (pomáhá sqrtf v NPU LayerNorm). Izolovaný benchmark neproveden.

---

### AMD Radeon RX 5600 XT (RDNA1)

**Lokální karta** — OpenCL backend  
**Optimální nastavení:** `ZION_OCL_VRAM_PCT=25`, `local_work_size=256`

| Epoch | Topologie | KH/s |
|-------|-----------|------|
| 0 (Standard, 128D) | 64→128→64 | **8.6–8.8** |
| 3 (Deep, 64D) | 64→64→64→64 | **~6.6** |
| Avg | — | **~10** |

**Kompilační optimalizace:** `-DNPU_MAX_DIM=N -DWGS=N` per epoch snižuje register pressure.

---

### RTX 2060 Super / RTX 3060 (Pre-optimalizace)

Měřeno s **TPB=256** (starý default) — výrazně suboptimální.

| GPU | KH/s (TPB=256) | Odhad s TPB=48 |
|-----|-----------------|----------------|
| RTX 2060 Super | 3.35 | ~12-15* |
| RTX 3060 | 2.64 | ~10-13* |

\* Odhad na základě 5.5× zlepšení pozorovaného na 5070 Ti. Skutečný poměr závisí na arch.

---

## Škálovací analýza

```
KH/s vs Memory Bandwidth:

  A100 SXM4    ████████████████████████████████████████  38.5 KH/s  (2039 GB/s)
  RTX 5070 Ti  █████████████████████                     21.0 KH/s  ( 896 GB/s)
  RX 5600 XT   ██████████                               10.0 KH/s  ( 288 GB/s)

  Škálování: sublineární (latency-bound, ne bandwidth-bound)
  
  Poměr BW:  A100/5070Ti = 2.28×  →  hashrate poměr = 1.83×
  Poměr BW:  A100/5600XT = 7.08×  →  hashrate poměr = 3.85×
```

**Důvod sublinearity:** 256 KiB scratchpad s 256 random reads je latency-bound. Vyšší bandwidth pomáhá, ale ne lineárně — závisí na cache hit rate a memory latency. A100's 40 MB L2 pojme ~160 scratchpadů vs. 5070 Ti's ~48 MB L2 (srovnatelné), ale HBM2e má vyšší latency než GDDR7.

---

## Cost Efficiency Ranking

| GPU | KH/s | $/hr | **KH/$ za hodinu** | Poznámka |
|-----|------|------|---------------------|----------|
| RX 5600 XT | 10.0 | $0 | **∞** | Vlastní karta |
| RTX 5070 Ti | 21.0 | $0.10 | **210** | Nejlepší cloud value |
| GTX 1080 | ? | $0.04 | **?** | Testuje se |
| GTX 1060 | ? | $0.09 | **?** | Testuje se |
| A100 SXM4 | 38.5 | $0.62 | **62** | Surový výkon, drahý |

---

## Konfigurace mineru

```bash
# Doporučené env vars per GPU
# A100 / high-end:
ZION_CUDA_TPB=48          # (A100 necitlivá, 48 safe default)
ZION_CUDA_WORK_CAP=32768  # (A100 zvládne víc, ale plateau)

# RTX 5070 Ti / Blackwell:
ZION_CUDA_TPB=48          # CRITICAL — 5.5× vs default 256
ZION_CUDA_WORK_CAP=49152

# Starší GPU (Pascal/Turing/Ampere consumer):
ZION_CUDA_TPB=48          # Start here, profile per card
ZION_CUDA_WORK_CAP=8192   # Menší VRAM = menší batch

# OpenCL (AMD):
ZION_OCL_VRAM_PCT=25
ZION_OCL_LOCAL_SIZE=256
```

---

## Instance status (live)

| Instance | GPU | Status | SSH | $/hr |
|----------|-----|--------|-----|------|
| 34009169 | A100 SXM4 | ✅ running | ssh6.vast.ai:19168 | $0.62 |
| 34004483 | RTX 5070 Ti | ✅ running | ssh4.vast.ai:14482 | $0.10 |
| 34010520 | GTX 1060 | ⏳ booting | — | $0.09 |
| 34010529 | GTX 1080 | ⏳ booting | — | $0.04 |

---

*Benchmark mode: `--ekam-bench` — čistý GPU throughput bez stratum/pool overhead.  
Skutečný mining hashrate bude nižší o 10-30% (job fetch, submission, idle between batches).*
