# ZION 2.9.5 - Native Libraries Overview

**Verze:** 1.0  
**Datum:** 19. ledna 2026  
**Status:** ✅ KOMPLETNÍ

---

## 📍 Umístění knihoven v projektu

| Lokace | Obsah | Účel |
|--------|-------|------|
| `zion/mining/` | .dylib + .so + Python wrappery | Hlavní mining knihovny |
| `desktop-agent/resources/mining/` | .dylib + .so + CH v3! | Desktop miner |
| `2.9.5/target/release/` | Rust binaries | Native Rust core |
| `build_zion/*/build-macos/` | Kompilované knihovny | Build artifacts |
| `ai/mining/` | Kopie knihoven | AI orchestrátor |

---

## ✅ Dostupné nativní knihovny

### CPU algoritmy (C/C++)

| Knihovna | Velikost | macOS | Linux | Wrapper |
|----------|----------|-------|-------|---------|
| **RandomX** | 242 KB | ✅ librandomx_zion.dylib | ✅ librandomx_zion.so.2.9.0 | `zion/mining/randomx_wrapper.py` |
| **Yescrypt** | 91 KB | ✅ libyescrypt_zion.dylib | ✅ libyescrypt_zion.so.2.9.0 | `zion/mining/yescrypt_wrapper.py` |
| **Cosmic Harmony v2** | 56 KB | ✅ libcosmic_harmony_zion.dylib | ✅ libcosmic_harmony_zion.so.2.9.0 | `zion/mining/cosmic_harmony_wrapper.py` |

### Rust implementace (2.9.5/zion-native/core)

| Modul | Soubor | Status | Poznámky |
|-------|--------|--------|----------|
| cosmic_harmony | `src/algorithms/cosmic_harmony.rs` | ✅ | ZION native |
| cosmic_harmony_v2 | `src/algorithms/cosmic_harmony_v2.rs` | ✅ | Quantum-resistant |
| randomx | `src/algorithms/randomx.rs` | ✅ | Via randomx-rs crate |
| yescrypt | `src/algorithms/yescrypt.rs` | ✅ | Memory-hard |
| blake3 | `src/algorithms/blake3_algo.rs` | ✅ | Fallback |

### CH v3 Multi-Algo Engine (Rust FFI)

| Modul | Soubor | Status |
|-------|--------|--------|
| Core algorithms | `zion-cosmic-harmony-v3/src/algorithms_opt.rs` | ✅ |
| Algorithm library (12 algos) | `zion-cosmic-harmony-v3/src/algorithm_library.rs` | ✅ |
| FFI pro Python/Node.js | `zion-cosmic-harmony-v3/src/ffi.rs` | ✅ v1 |
| GPU OpenCL | `zion-cosmic-harmony-v3/src/gpu/opencl.rs` | ✅ |
| GPU Metal (macOS) | `zion-cosmic-harmony-v3/src/gpu/metal.rs` | ✅ |
| Profit router | `zion-cosmic-harmony-v3/src/profit_router.rs` | ✅ |
| WhatToMine API | `zion-cosmic-harmony-v3/src/whattomine.rs` | ✅ |

---

## 📂 desktop-agent - Kompletní sada

```
desktop-agent/resources/mining/
├── librandomx_zion.dylib          # macOS RandomX
├── librandomx_zion.so             # Linux RandomX
├── librandomx_zion.so.2.9.0       # Linux versioned
├── libyescrypt_zion.dylib         # macOS Yescrypt
├── libyescrypt_zion.so            # Linux Yescrypt
├── libyescrypt_zion.so.2.9.0      # Linux versioned
├── libcosmic_harmony_zion.dylib   # macOS CH v2
├── libcosmic_harmony_zion.so      # Linux CH v2
├── libcosmic_harmony_zion.so.2.9.0
├── libcosmicharmony.dylib         # Alternative name
├── libzion_cosmic_harmony_v3.dylib  # 🆕 CH v3 Rust FFI!
├── cosmic_harmony_wrapper.py
├── cosmic_harmony_v2.py
├── cosmic_harmony_v2_gpu.py
├── cosmic_harmony_v3_gpu.py         # GPU miner
├── cosmic_harmony_native.py
├── native_autolykos_wrapper.py      # Autolykos native
└── gpu_autolykos_v2_engine.py       # ERG GPU
```

---

## 🔧 Python Wrappery

### randomx_wrapper.py
- **Třída:** `RandomXHasher`
- **Multi-threading:** ✅ (auto-detect CPU cores)
- **Výkon:** ~640 H/s single, ~3,500 H/s (6 threads), ~7,000 H/s (12 threads)
- **Large pages:** Podporováno (30-40% boost)
- **Fallback:** Python SHA3-256

```python
from zion.mining.randomx_wrapper import RandomXHasher
hasher = RandomXHasher(threads=6)
hash_hex = hasher.hash("block_data")
```

### yescrypt_wrapper.py
- **Třída:** `YescryptHasher`
- **Multi-threading:** ✅
- **Výkon:** 500-2,000 H/s
- **Parametry:** N=4096, r=8, p=1 (konfigurovatelné)

```python
from zion.mining.yescrypt_wrapper import YescryptHasher
hasher = YescryptHasher(threads=4)
hash_bytes = hasher.hash(b"block_data")
```

### cosmic_harmony_wrapper.py
- **Třída:** `CosmicHarmonyHasher`
- **C++ backend:** ✅
- **Fallback:** Pure Python (10-50x pomalejší)

```python
from zion.mining.cosmic_harmony_wrapper import CosmicHarmonyHasher
hasher = CosmicHarmonyHasher(use_cpp=True)
hash_bytes = hasher.hash(b"block_data", nonce=12345)
```

---

## 🚀 CH v3 FFI Usage (Python)

```python
import ctypes

# Load library
lib = ctypes.CDLL("libzion_cosmic_harmony_v3.dylib")

# Setup function
lib.cosmic_harmony_v3_hash.argtypes = [
    ctypes.POINTER(ctypes.c_uint8),  # input
    ctypes.c_size_t,                  # input_len
    ctypes.c_uint64,                  # nonce
    ctypes.POINTER(ctypes.c_uint8),  # output (32 bytes)
]
lib.cosmic_harmony_v3_hash.restype = ctypes.c_int

# Compute hash
input_data = b"block_header"
input_arr = (ctypes.c_uint8 * len(input_data))(*input_data)
output_arr = (ctypes.c_uint8 * 32)()

result = lib.cosmic_harmony_v3_hash(input_arr, len(input_data), 12345, output_arr)
hash_bytes = bytes(output_arr)
```

---

## 📊 Podporované algoritmy

### GPU algoritmy (CH v3)
| Algoritmus | Coin | Status | Implementace |
|------------|------|--------|--------------|
| Ethash | ETC | ✅ | OpenCL |
| KawPow | RVN | ✅ | OpenCL |
| Autolykos v2 | ERG | ✅ | OpenCL/CUDA |
| kHeavyHash | KAS | ✅ | OpenCL |
| Blake3 | ALPH | ✅ | Native |
| Equihash | ZEC | ✅ | OpenCL |
| ProgPow | SERO | ✅ | OpenCL |

### CPU algoritmy
| Algoritmus | Coin | Status | Implementace |
|------------|------|--------|--------------|
| RandomX | XMR | ✅ | Native C++ / Rust |
| Yescrypt | LTC/YEC | ✅ | Native C++ |
| Argon2d | — | ✅ | Rust |
| Cosmic Harmony | ZION | ✅ | Native C++ / Rust |

---

## 🛠️ Build instrukce

### C/C++ knihovny (macOS)
```bash
cd build_zion/randomx
mkdir build-macos && cd build-macos
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(sysctl -n hw.ncpu)
```

### Rust (CH v3)
```bash
cd 2.9.5
cargo build --release -p zion-cosmic-harmony-v3
# Output: target/release/libzion_cosmic_harmony_v3.dylib
```

### Rust (Native Core)
```bash
cd 2.9.5/zion-native
cargo build --release
```

---

## 📝 Poznámky

1. **macOS vs Linux:** Wrappery hledají `.dylib` (macOS) PŘED `.so` (Linux)
2. **Fallback:** Všechny wrappery mají Python fallback pro případ chybějící knihovny
3. **Thread safety:** RandomX používá per-thread VM instance
4. **CH v3 FFI:** Verze 1 - stabilní ABI pro Python/Node.js
5. **GPU:** OpenCL pro cross-platform, Metal pro macOS, CUDA volitelně

---

## 🔗 Relevantní soubory

- `2.9.5/zion-cosmic-harmony-v3/src/ffi.rs` - CH v3 FFI definice
- `2.9.5/zion-native/core/src/algorithms/mod.rs` - Rust algoritmy
- `zion/mining/*.py` - Python wrappery
- `desktop-agent/resources/mining/` - Distribuované knihovny
- `config/ch3_mining_config.yaml` - Mining konfigurace

---

*Dokument vytvořen: 19. ledna 2026*  
*Verze ZION: 2.9.5*
