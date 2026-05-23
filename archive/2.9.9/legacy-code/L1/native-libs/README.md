# ZION Native Algorithm Libraries

High-performance C/C++ implementations for multi-chain mining.

## Libraries (v2.9.5 M3.5)

| Library | Size | Algorithm | Coins | Performance |
|---------|------|-----------|-------|-------------|
| `librandomx_zion` | 242KB | RandomX | XMR, ZEPH | ~2000 H/s CPU |
| `libyescrypt_zion` | 91KB | Yescrypt | LTC, YEC | ~500 H/s CPU |
| `libcosmic_harmony_zion` | 56KB | Cosmic Harmony v2 | ZION | ~10K H/s CPU |
| `libautolykos_zion` | 34KB | Autolykos v2 | ERG | ~50K H/s CPU |
| **`libkawpow_zion`** | **34KB** | **KawPow** | **RVN, CLORE** | **~160 KH/s CPU** |

## File Structure

```
native-libs/
├── librandomx_zion.dylib          # macOS - RandomX (Monero)
├── librandomx_zion.so.2.9.0       # Linux - RandomX
├── libyescrypt_zion.dylib         # macOS - Yescrypt (Litecoin)
├── libyescrypt_zion.so.2.9.0      # Linux - Yescrypt
├── libcosmic_harmony_zion.dylib   # macOS - Cosmic Harmony v2
├── libcosmic_harmony_zion.so.2.9.0# Linux - Cosmic Harmony v2
├── libautolykos_zion.dylib        # macOS - Autolykos v2 (Ergo)
└── libkawpow_zion.dylib           # macOS - KawPow (RVN/CLORE) ⭐
```

## Compilation

### macOS (Apple Silicon)
```bash
cd mining/native

# RandomX
clang -O3 -fPIC -shared -framework Security -o librandomx_zion.dylib randomx_zion.c

# Yescrypt  
clang -O3 -fPIC -shared -o libyescrypt_zion.dylib yescrypt_native.c

# Cosmic Harmony v2
clang -O3 -fPIC -shared -o libcosmic_harmony_zion.dylib cosmic_harmony_v2_native.c

# Autolykos v2
clang -O3 -fPIC -shared -o libautolykos_zion.dylib autolykos_v2_native.c

# KawPow (RVN/CLORE) - CRITICAL
clang -O3 -fPIC -shared -o libkawpow_zion.dylib kawpow_native.c
```

### Linux (x86_64)
```bash
gcc -O3 -fPIC -shared -o librandomx_zion.so randomx_zion.c -lpthread
gcc -O3 -fPIC -shared -o libyescrypt_zion.so yescrypt_native.c
gcc -O3 -fPIC -shared -o libcosmic_harmony_zion.so cosmic_harmony_v2_native.c
gcc -O3 -fPIC -shared -o libautolykos_zion.so autolykos_v2_native.c
gcc -O3 -fPIC -shared -o libkawpow_zion.so kawpow_native.c
```

## Rust Integration

Enable features in Cargo.toml:
```bash
# Single algorithm
cargo build --features native-kawpow

# All native algorithms  
cargo build --features native-all
```

## API Reference

### KawPow (RVN/CLORE) - **CRITICAL** ⭐

```c
// Compute KawPow hash
void kawpow_hash(
    const uint8_t* header,  // 32-byte header hash
    uint64_t nonce,         // Mining nonce
    uint32_t height,        // Block height  
    uint32_t epoch,         // DAG epoch
    uint8_t* mix_out,       // 32-byte mix hash output
    uint8_t* hash_out       // 32-byte final hash output
);

// Verify solution
int kawpow_verify(
    const uint8_t* header,
    uint64_t nonce,
    uint32_t height,
    uint32_t epoch,
    const uint8_t* expected_mix,
    const uint8_t* target
);

// Get epoch for block height
uint32_t kawpow_get_epoch(uint32_t height);

// Benchmark
double kawpow_benchmark_cpu(int iterations);

// Version
const char* kawpow_version();
```

### RandomX (librandomx_zion)

```c
int zion_randomx_init(const char* key_hex, int threads);
void zion_randomx_hash_bytes(const uint8_t* input, size_t len, uint8_t* output);
void zion_randomx_hash_bytes_vm(int vm_index, const uint8_t* input, size_t len, uint8_t* output);
int zion_randomx_get_num_threads();
int zion_randomx_check_difficulty(const uint8_t* hash, int difficulty);
void zion_randomx_cleanup();
const char* zion_randomx_version();
```

### Autolykos v2 (libautolykos_zion)

```c
uint64_t autolykos_hash(
    const uint8_t* header, 
    size_t len, 
    uint64_t nonce, 
    uint32_t height, 
    uint8_t* output
);
int autolykos_verify(
    const uint8_t* header, 
    size_t len, 
    uint64_t nonce, 
    uint32_t height, 
    uint64_t target
);
double autolykos_benchmark_cpu(int iterations);
```

### Yescrypt (libyescrypt_zion)

```c
int zion_yescrypt_hash(const uint8_t* input, size_t len, uint8_t* output);
```

### Cosmic Harmony v2 (libcosmic_harmony_zion)

```c
int zion_cosmic_harmony_hash(const uint8_t* input, size_t len, uint8_t* output);
```

## Feature Flags

```toml
[features]
native-randomx = []
native-yescrypt = []
native-cosmic-harmony = []
native-autolykos = []
native-kawpow = []
native-all = ["native-randomx", "native-yescrypt", "native-cosmic-harmony", "native-autolykos", "native-kawpow"]
```

## Performance Benchmarks

```
=== ZION KawPow Native Library Test ===
Version: ZION KawPow v1.0.0 - RVN/CLORE Compatible
CPU Hashrate: 161,118 H/s (M3 MacBook Pro)
```

### Cosmic Harmony v3 (libcosmic_harmony_v3) — **NEW** ⭐

```c
// Full CHv3 pipeline: Keccak-256 → SHA3-512 → Golden Matrix → Cosmic Fusion
int cosmic_harmony_v3_hash(const uint8_t* header, size_t len, uint64_t nonce, uint8_t* output);
int cosmic_harmony_v3_hash_raw(const uint8_t* input, size_t len, uint8_t* output);

// GPU mining (CPU fallback + Metal shader)
uint32_t cosmic_harmony_v3_gpu_count();
int32_t cosmic_harmony_v3_gpu_init(uint32_t device_id, uint32_t batch_size);
int32_t cosmic_harmony_v3_gpu_mine(const uint8_t* header, size_t len, uint64_t nonce_start,
                                   const uint8_t* target, uint64_t* found_nonce, uint8_t* found_hash);
void cosmic_harmony_v3_gpu_cleanup();

// Individual steps (for debugging/verification)
void cosmic_harmony_v3_keccak256(const uint8_t* input, size_t len, uint8_t* output);
void cosmic_harmony_v3_sha3_512(const uint8_t* input, size_t len, uint8_t* output);
void cosmic_harmony_v3_golden_matrix(const uint8_t* input, uint8_t* output);
void cosmic_harmony_v3_cosmic_fusion(const uint8_t* input, uint8_t* output);

// Info & benchmark
const char* cosmic_harmony_v3_get_info();
double cosmic_harmony_v3_benchmark(int duration_seconds);
```

## Feature Flags

```toml
[features]
native-randomx = []
native-yescrypt = []
native-cosmic-harmony = []
native-cosmic-harmony-v3 = []  # NEW: Full CHv3 pipeline (C + Metal)
native-autolykos = []
native-kawpow = []
native-all = ["native-randomx", "native-yescrypt", "native-cosmic-harmony",
              "native-cosmic-harmony-v3", "native-autolykos", "native-kawpow", ...]
```

## Version

ZION v2.9.5 - Milestone 3.5+ Native Algorithms
- ✅ 13 native libraries compiled (12 algos + CHv3 pipeline)
- ✅ Full RVN/CLORE support via KawPow
- ✅ Ergo support via Autolykos v2
- ✅ Monero support via RandomX
- ✅ Litecoin support via Yescrypt
- ✅ ZION native via Cosmic Harmony v2
- ✅ **CHv3 full pipeline** (Keccak-256 → SHA3-512 → Golden Matrix → Cosmic Fusion)
- ✅ **Metal GPU shader** for Apple Silicon (M1-M5)
- ✅ NCL integration ready
