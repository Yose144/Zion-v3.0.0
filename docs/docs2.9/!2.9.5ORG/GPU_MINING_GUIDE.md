# ⚡ ZION TerraNova v2.9.5 — GPU Mining Guide

**Verze:** 1.0  
**Datum:** 7. února 2026  
**Status:** ✅ Production Ready (macOS Metal), 🔧 Beta (OpenCL), ⏳ Planned (CUDA)

---

## 📊 Executive Summary

ZION GPU mining využívá **Cosmic Harmony v3 (CHv3)** pipeline akcelerovaný na GPU. Dosažený výkon:

| Backend | Hardware | Hashrate | Accept Rate | Commit |
|---------|----------|----------|-------------|--------|
| **Metal** (Rust) | Apple M1 (8 GPU cores) | **2.64 MH/s** | 100% | `8676bc4` |
| **Metal** (Python) | Apple M1 | **2.59 MH/s** | 100% | — |
| **OpenCL** (Python) | PyOpenCL | ~500 kH/s | ⚠️ Nedostatečně testováno | — |
| **CPU** (referenční) | Apple M1 (1 thread) | ~500 kH/s | 100% | — |

**GPU mining je 5× rychlejší než CPU** na stejném hardware.

---

## 🏗️ Architektura

```
┌─────────────────────────────────────────────────────────────┐
│                    GPU MINING STACK                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Stratum Client (pool connection, job/share I/O)      │   │
│  └────────────┬──────────────────────────┬──────────────┘   │
│               │                          │                   │
│    ┌──────────▼──────────┐    ┌──────────▼──────────┐       │
│    │   CPU Mining Loop   │    │   GPU Mining Loop    │       │
│    │   (Rayon threads)   │    │   (async dispatch)   │       │
│    └─────────────────────┘    └──────────┬──────────┘       │
│                                          │                   │
│                               ┌──────────▼──────────┐       │
│                               │   GPU Backend        │       │
│                               │  ┌──────┐ ┌───────┐ │       │
│                               │  │Metal │ │OpenCL │ │       │
│                               │  │(.metal)│ │(.cl) │ │       │
│                               │  └──────┘ └───────┘ │       │
│                               └─────────────────────┘       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### CHv3 Pipeline na GPU (4 kroky)

```
Input: header[80 bytes] + nonce[8 bytes]
                │
     ┌──────────▼──────────┐
     │  1. Keccak-256       │  88B → 32B hash
     └──────────┬──────────┘
                │
     ┌──────────▼──────────┐
     │  2. SHA3-512         │  32B → 64B hash (padding 0x06)
     └──────────┬──────────┘
                │
     ┌──────────▼──────────┐
     │  3. Golden Matrix    │  8×8 φ-matrix transform
     └──────────┬──────────┘
                │
     ┌──────────▼──────────┐
     │  4. Cosmic Fusion    │  4 rounds: Keccak-256 + XOR mask
     │     + final SHA3-512 │  → 32B final hash
     └──────────┬──────────┘
                │
     ┌──────────▼──────────┐
     │  Target Check        │  hash[0..4] LE u32 ≤ target
     └─────────────────────┘
```

---

## 🚀 Quick Start

### Metoda 1: Rust Universal Miner (doporučeno)

```bash
# Krok 1: Build s Metal podporou (macOS)
cd 2.9.5/zion-universal-miner
cargo build --release --features metal

# Krok 2: Spusť GPU mining
./target/release/zion-universal-miner \
  --pool 77.42.31.72:3333 \
  --wallet zion1YOUR_WALLET_ADDRESS \
  --worker gpu-rig-01 \
  --gpu \
  --algorithm cosmic_harmony
```

### Metoda 2: Python GPU Launcher

```bash
# Benchmark (otestuj GPU bez poolu)
python zion_gpu_launcher.py --benchmark

# Pool mining
python zion_gpu_launcher.py \
  --algo ch_v3 \
  --pool helsinki \
  --wallet zion1YOUR_WALLET_ADDRESS

# Zobrazení GPU zařízení
python zion_gpu_launcher.py --list-gpus
```

### Metoda 3: Build from Source (celý stack)

```bash
# Krok 1: Clone repo
git clone https://github.com/Yose144/Zion-2.9.git
cd Zion-2.9/2.9.5

# Krok 2: Build CHv3 engine s GPU
cd zion-cosmic-harmony-v3
cargo build --release --features "metal,parallel"

# Krok 3: Build universal miner
cd ../zion-universal-miner
cargo build --release --features metal

# Krok 4: Spusť
./target/release/zion-universal-miner \
  --pool pool.zionterranova.com:3333 \
  --wallet zion1... \
  --gpu
```

---

## 🍎 Metal GPU Mining (macOS)

### Požadavky

| Komponenta | Minimum | Doporučeno |
|-----------|---------|------------|
| **macOS** | 11+ (Big Sur) | 14+ (Sonoma) |
| **Chip** | M1 | M1 Pro/Max/Ultra, M2, M3 |
| **GPU Cores** | 7 | 10+ |
| **RAM** | 8 GB (unified) | 16 GB+ |
| **Xcode CLI** | Nainstalováno | `xcode-select --install` |

### Metal Shader

Hlavní shader: `zion-cosmic-harmony-v3/src/gpu/cosmic_harmony_v3.metal`

**Buffer Layout:**

```
Buffer 0 — CHv3MiningParams (128 bytes, padded):
  ┌──────────────────────────────────────────┐
  │ offset  0: uint64_t start_nonce    (8B)  │
  │ offset  8: uint32_t header_len     (4B)  │
  │ offset 12: uint8_t  header[80]     (80B) │
  │ offset 92: uint8_t  target[32]     (32B) │
  │ offset 124: padding               (4B)  │
  └──────────────────────────────────────────┘

Buffer 1 — CHv3MiningResult (48 bytes, padded):
  ┌──────────────────────────────────────────┐
  │ offset  0: uint64_t found_nonce    (8B)  │
  │ offset  8: uint8_t  found_hash[32] (32B) │
  │ offset 40: uint32_t found (atomic) (4B)  │
  │ offset 44: padding                 (4B)  │
  └──────────────────────────────────────────┘
```

**Target porovnání (pool-kompatibilní):**

```metal
// Little-endian u32 z prvních 4 bajtů hashe
uint32_t state0 = uint32_t(hash[0])
                | (uint32_t(hash[1]) << 8)
                | (uint32_t(hash[2]) << 16)
                | (uint32_t(hash[3]) << 24);

// Target z posledních 4 bajtů target bufferu
uint32_t target_u32 = (uint32_t(params.target[28]) << 24)
                    | (uint32_t(params.target[29]) << 16)
                    | (uint32_t(params.target[30]) << 8)
                    |  uint32_t(params.target[31]);

bool below_target = (state0 <= target_u32);
```

### Výkonnostní parametry

| Parametr | Hodnota | Poznámka |
|----------|---------|----------|
| Threads per threadgroup | 384 | Optimální pro M1 |
| Batch size | 500,000 | hashů na kernel launch |
| GPU dispatch | Async | `commandBuffer.commit()` + `waitUntilCompleted()` |
| Share submit | Async (tokio) | Neblokovati GPU thread! |

### Klíčový performance fix

Původní implementace volala `pool.submit_share()` synchronně v GPU threadu:

```
GPU mine → find nonce → BLOCK on network submit (300ms) → GPU mine
Výsledek: ~700 kH/s ❌
```

Oprava — async submit přes kanál:

```
GPU mine → find nonce → send to channel (instant) → GPU mine
                          ↓
                  async task submits to pool
Výsledek: ~2.64 MH/s ✅ (3.8× zrychlení)
```

---

## 🖥️ OpenCL GPU Mining

### Požadavky

| Komponenta | Minimum |
|-----------|---------|
| **OpenCL** | 1.2+ |
| **GPU** | Jakékoliv s OpenCL (AMD, NVIDIA, Intel) |
| **PyOpenCL** (Python) | `pip install pyopencl` |

### Rust Build

```bash
cd 2.9.5/zion-universal-miner
cargo build --release --features gpu   # OpenCL backend
```

### Python OpenCL

```bash
# Instalace
pip install pyopencl numpy

# Spuštění
python zion_gpu_launcher.py \
  --algo ch_v3 \
  --pool helsinki \
  --wallet zion1... \
  --gpu-id 0
```

OpenCL kernel: `zion-cosmic-harmony-v3/src/gpu/cosmic_harmony_v3.cl` (441 řádků)

---

## 🎮 CUDA GPU Mining (plánováno)

CUDA backend existuje jako skeleton v `zion-universal-miner/src/miner/gpu/cuda.rs`.

```bash
# Až bude implementováno:
cargo build --release --features cuda
```

**Roadmap:**
- CUDA kernely pro CHv3 pipeline
- NVIDIA RTX 30/40 series optimalizace
- cuBLAS pro Golden Matrix operace

---

## ⚙️ Konfigurace

### Miner Config (JSON)

```json
{
  "gpu_mining": {
    "enabled": true,
    "algorithm": "cosmic_harmony",
    "intensity": 20,
    "temperature_limit": 85,
    "power_limit": 250
  },
  "safety": {
    "auto_shutdown_temp": 90,
    "auto_reduce_intensity_temp": 80,
    "restart_on_crash": true
  }
}
```

### CLI Flags

| Flag | Popis | Default |
|------|-------|---------|
| `--gpu` | Zapnout GPU mining | false |
| `--gpu-id N` | Vybrat konkrétní GPU | 0 (první) |
| `--gpu-ids 0,1,2` | Multi-GPU mining | všechny |
| `--algo cosmic_harmony` | Mining algoritmus | cosmic_harmony |
| `--benchmark` | Spustit benchmark bez poolu | false |
| `--list-gpus` | Zobrazit dostupná GPU | — |

---

## 📊 Výkon podle hardware

### Apple Silicon

| Chip | GPU Cores | Hashrate (est.) | Poznámka |
|------|-----------|-----------------|----------|
| M1 | 8 | **2.64 MH/s** | ✅ Ověřeno |
| M1 Pro | 14-16 | ~4.5 MH/s | Odhad |
| M1 Max | 24-32 | ~8 MH/s | Odhad |
| M1 Ultra | 48-64 | ~15 MH/s | Odhad |
| M2 | 10 | ~3.3 MH/s | Odhad |
| M3 Pro | 14-18 | ~5.5 MH/s | Odhad |

### GPU Detect (automatický)

Miner automaticky detekuje nejlepší dostupný GPU backend:

```
1. Metal (macOS)     → priorita
2. CUDA (NVIDIA)     → pokud dostupný
3. OpenCL (fallback) → univerzální
4. CPU (vždy)        → záložní
```

---

## 🐛 Troubleshooting

### GPU nedostupný
```
[WARN] No GPU device found, falling back to CPU mining
```
**Řešení:**
- macOS: `xcode-select --install` (potřeba Metal tools)
- Linux: Nainstalovat OpenCL runtime (`sudo apt install ocl-icd-opencl-dev`)
- Ověřit: `clinfo` nebo `system_profiler SPDisplaysDataType`

### Nízký hashrate
```
[INFO] GPU: 700 kH/s (expected 2.5+ MH/s)
```
**Příčiny:**
1. Synchronní share submit (blokuje GPU thread)
2. Příliš malý batch size
3. Thermal throttling

### GPU shares rejected
```
[WARN] Share rejected: invalid PoW
```
**Řešení:**
- Ověřit target byte order (LE u32 z hash[0..3])
- Zkontrolovat header offset v Metal bufferu (offset 12, ne 16!)
- Porovnat hash s CPU referencí

### Metal shader compilation error
```bash
# Zkompilovat shader ručně pro test
xcrun -sdk macosx metal -c cosmic_harmony_v3.metal -o test.air
```

---

## 📂 Soubory GPU Mining

### Rust (Production)

| Soubor | Popis |
|--------|-------|
| `zion-cosmic-harmony-v3/src/gpu/mod.rs` | GPU modul root, `GpuBackend` enum |
| `zion-cosmic-harmony-v3/src/gpu/metal.rs` | Metal miner — `MetalMiner` struct |
| `zion-cosmic-harmony-v3/src/gpu/cosmic_harmony_v3.metal` | Metal shader (462 řádků) |
| `zion-cosmic-harmony-v3/src/gpu/opencl.rs` | OpenCL miner |
| `zion-cosmic-harmony-v3/src/gpu/cosmic_harmony_v3.cl` | OpenCL kernel (441 řádků) |
| `zion-cosmic-harmony-v3/src/gpu/ffi.rs` | C-FFI API pro Python/Swift |
| `zion-universal-miner/src/miner/gpu/mod.rs` | GPU trait abstrakce |
| `zion-universal-miner/src/miner/gpu/metal.rs` | Metal backend wrapper |
| `zion-universal-miner/src/miner/gpu/opencl.rs` | OpenCL backend wrapper |
| `zion-universal-miner/src/miner/gpu/cuda.rs` | CUDA skeleton |
| `zion-universal-miner/src/miner/gpu/autotune.rs` | GPU auto-tuning |
| `zion-universal-miner/src/miner/mining_loop.rs` | Hlavní mining loop (GPU path) |

### Python (Prototyp)

| Soubor | Popis |
|--------|-------|
| `zion_gpu_launcher.py` | CLI launcher (685 řádků) |
| `desktop-agent/resources/mining/cosmic_harmony_v3_gpu.py` | PyOpenCL CHv3 miner (662 řádků) |
| `desktop-agent/resources/mining/cosmic_harmony_v2_gpu.py` | PyOpenCL CHv2 miner (787 řádků) |
| `mining/native/cosmic_harmony_v2_metal.metal` | Metal shader (legacy v2) |

---

## 🎯 Roadmap

| Milestone | Target | Status |
|-----------|--------|--------|
| Metal GPU ≥ 2 MH/s | Feb 2026 | ✅ 2.64 MH/s |
| 100% share accept rate | Feb 2026 | ✅ Ověřeno |
| OpenCL live testing | Q1 2026 | ⏳ |
| CUDA implementace | Q2 2026 | ⏳ |
| Multi-GPU support | Q2 2026 | ⏳ |
| GPU Temperature monitoring | Q2 2026 | ⏳ |

---

*ZION TerraNova v2.9.5 — GPU-Accelerated Consciousness Mining* ⚡🌟
