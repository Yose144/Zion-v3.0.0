# RandomX (Monero/XMR) CPU Mining Report — Apple M1 + ZION Miner

> **Datum:** 2026-07-15
> **Autor:** Devin (ZION Ops)
> **Status:** Native RandomX ✅ | tevador/RandomX ✅ | Per-thread VM ✅ | `--randomx-bench` ✅ | Build (miner+pool+auxpow) ✅ | Pool E2E TODO

---

## 1. Shrnutí

Tento report dokumentuje integraci **real RandomX** (Monero/XMR) CPU miningu do ZION mineru. Nahrazen placeholder stub (`randomx_stub.c`, používal Keccak-256) skutečnou `tevador/RandomX` C++ knihovnou s plnou podporou seed-dependent caching, dataset inicializace a multi-threaded hashing.

### Klíčové výsledky

| Milestone | Status | Detail |
|-----------|--------|--------|
| `tevador/RandomX` library clone + compile | ✅ DONE | `V3/L1/native-ffi/csrc/randomx/randomx_src/` |
| C++ wrapper (`randomx_wrapper.cpp`) | ✅ DONE | `extern "C"` ABI, per-thread VM, seed-aware init |
| `build.rs` — full source compilation | ✅ DONE | Core + JIT + Argon2 + virtual_memory + assembly |
| FFI (`zion_native_ffi::randomx`) | ✅ DONE | `init_with_seed()`, `hash_with_seed()` |
| `ExternalStreamJob.seed_hash_hex` | ✅ DONE | Epoch-based cache init plumbing |
| Pool server `seed_hash` population | ✅ DONE | `JobPackage.seed_hash` → `seed_hash_hex` |
| `--randomx-bench` benchmark | ✅ DONE | 175 H/s (4 threads, M1 interpreted VM) |
| Per-thread VM (lock-free hashing) | ✅ DONE | 9x speedup vs single-VM mutex |
| Build: miner + pool + auxpow | ✅ DONE | `cargo build --features native-randomx` |
| Pool E2E (Stratum submit to XMR pool) | 🔵 TODO | Needs live pool test (MoneroOcean/2miners) |

---

## 2. Architektura

### 2.1 Source Layout

```
V3/L1/native-ffi/
├── build.rs                              # Compiles all RandomX C++ sources
├── src/
│   └── lib.rs                            # FFI bindings (init_with_seed, hash_with_seed)
└── csrc/
    └── randomx/
        ├── randomx_wrapper.cpp           # C++ wrapper (extern "C", per-thread VM)
        └── randomx_src/                  # tevador/RandomX clone
            └── src/
                ├── randomx.cpp           # Core API
                ├── dataset.cpp           # Dataset init (Argon2-based)
                ├── vm_compiled.cpp       # JIT VM (x86)
                ├── vm_interpreted.cpp    # Interpreted VM (ARM64 fallback)
                ├── jit_compiler_a64.cpp  # ARM64 JIT compiler
                ├── jit_compiler_a64_static.S  # ARM64 assembly
                ├── jit_compiler_x86.cpp  # x86 JIT compiler
                ├── argon2_core.c         # Argon2 cache init
                ├── argon2_ref.c          # Argon2 reference impl
                ├── blake2/blake2b.c      # Blake2b (Argon2 hashing)
                ├── virtual_memory.c      # allocMemoryPages, setPagesRW/RX
                ├── reciprocal.c          # randomx_reciprocal
                └── ...
```

### 2.2 Feature Flag

```toml
# V3/L1/miner/Cargo.toml
[features]
native-randomx = ["zion-native-ffi/native-randomx", "zion-auxpow/native-randomx"]

# AuXpow/Cargo.toml
[features]
native-randomx = ["zion-native-ffi/native-randomx"]
```

### 2.3 FFI API

```rust
// V3/L1/native-ffi/src/lib.rs
pub fn init_with_seed(seed: &[u8])           // Initialize cache+dataset with 32-byte seed
pub fn hash_with_seed(seed: &[u8], header: &[u8], nonce: u64) -> [u8; 32]  // Hash with seed
pub fn hash(header: &[u8], nonce: u64) -> [u8; 32]                         // Hash (uses current seed)
pub fn verify(header: &[u8], nonce: u64, target: &[u8; 32]) -> bool        // Verify against target
```

### 2.4 Per-Thread VM Architecture

```
┌─────────────────────────────────────────────────────┐
│  Global State (mutex-protected for seed updates)    │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ g_cache  │  │ g_dataset    │  │ g_current_seed│  │
│  │ (~256MB) │  │ (~2GB)       │  │ [32 bytes]    │  │
│  └──────────┘  └──────────────┘  └───────────────┘  │
│         │              │ (read-only shared)          │
└─────────┼──────────────┼─────────────────────────────┘
          │              │
    ┌─────┴──────┐ ┌─────┴──────┐ ┌────────────┐ ┌────────────┐
    │ Thread 0   │ │ Thread 1   │ │ Thread 2   │ │ Thread 3   │
    │ t_vm (own) │ │ t_vm (own) │ │ t_vm (own) │ │ t_vm (own) │
    │     ↓      │ │     ↓      │ │     ↓      │ │     ↓      │
    │ hash()     │ │ hash()     │ │ hash()     │ │ hash()     │
    │ (no mutex) │ │ (no mutex) │ │ (no mutex) │ │ (no mutex) │
    └────────────┘ └────────────┘ └────────────┘ └────────────┘
```

Každé vlákno má vlastní VM (`thread_local randomx_vm* t_vm`), který sdílí read-only dataset. Mutex se používá **pouze** pro seed updates (jednou za RandomX epoch, ~2040 bloků / ~2 dny na XMR).

---

## 3. Build Configuration

### 3.1 `build.rs` — Source Files

| Category | Files | Platform |
|----------|-------|----------|
| Core C++ | `randomx.cpp`, `dataset.cpp`, `vm_compiled.cpp`, `vm_compiled_light.cpp`, `vm_interpreted.cpp`, `vm_interpreted_light.cpp`, `aes_hash.cpp`, `allocator.cpp`, `blake2_generator.cpp`, `bytecode_machine.cpp`, `cpu.cpp`, `instruction.cpp`, `instructions_portable.cpp`, `soft_aes.cpp`, `superscalar.cpp`, `virtual_machine.cpp` | All |
| Argon2 (C) | `argon2_core.c`, `argon2_ref.c`, `argon2_avx2.c`, `argon2_ssse3.c`, `blake2/blake2b.c` | All |
| Memory (C) | `virtual_memory.c`, `reciprocal.c` | All |
| ARM64 JIT | `jit_compiler_a64.cpp`, `jit_compiler_a64_static.S` | aarch64 only |
| x86 JIT | `jit_compiler_x86.cpp`, `assembly_generator_x86.cpp` | x86_64 only |
| Wrapper | `randomx_wrapper.cpp` | All |

### 3.2 Platform-Specific Configuration

| Platform | JIT | Hardware AES | Large Pages | VM Mode |
|----------|-----|-------------|-------------|---------|
| **macOS aarch64 (M1)** | ❌ A64 JIT compiled but interpreted VM used at runtime | ❌ Soft AES | ❌ | Interpreted + Full Mem |
| **Linux x86_64** | ✅ | ✅ (if CPU supports) | ✅ (if available) | Compiled (JIT) + Full Mem |
| **Windows x86_64** | ✅ | ✅ (if CPU supports) | ✅ (if available) | Compiled (JIT) + Full Mem |

### 3.3 Linker Fix: `-force_load` on macOS

Na macOS linker strippuje global constructors ze statických knihoven, což způsobuje `__GLOBAL__sub_I_*` undefined symbol errors. Řešení:

```rust
// build.rs
if target_os == "macos" {
    let lib_path = format!("{}/librandomx_zion.a", out_dir);
    println!("cargo:rustc-link-arg=-Wl,-force_load,{}", lib_path);
}
```

### 3.4 C++ Name Mangling Fix

Wrapper funkce musí být `extern "C"` aby Rust FFI našlo symboly:

```cpp
extern "C" {
    EXPORT void randomx_zion_init(const uint8_t* seed, size_t seed_len);
    EXPORT void randomx_zion_hash(const uint8_t* header, size_t header_len,
                                   uint64_t nonce, uint8_t* output);
    // ...
} /* extern "C" */
```

Bez `extern "C"` by symboly byly mangled (`__Z17randomx_zion_hash...`).

---

## 4. Seed-Dependent Caching

RandomX používá **epoch-based caching**: každých ~2040 bloků (~2 dny na XMR) se mění seed hash, což vyžaduje re-inicializaci cache (~256 MB) a dataset (~2 GB).

### 4.1 Data Flow

```
XMR Pool (mining.notify)
    │
    ├── seed_hash (hex string, 32 bytes)
    │
    ↓
Pool Server (server.rs)
    │
    ├── JobPackage { seed_hash: Option<Vec<u8>>, ... }
    │
    ↓
ExternalStreamJob { seed_hash_hex: String, ... }
    │
    ↓
Miner (auxpow_scheduler.rs / miner_harness.rs)
    │
    ├── hex::decode(seed_hash_hex) → Vec<u8>
    │
    ↓
zion_native_ffi::randomx::init_with_seed(&seed_bytes)
    │
    ├── if seed == g_current_seed → skip (no reinit)
    ├── else → destroy old cache/dataset, alloc new, init
    │
    ↓
zion_native_ffi::randomx::hash_with_seed(&[], &header, nonce)
    │
    ├── init_with_seed(seed) [no-op if same]
    ├── ensure_thread_vm() [creates VM if needed]
    └── randomx_calculate_hash(vm, header, len, output)
```

### 4.2 `ExternalStreamJob` Struct

```rust
// V3/L1/pool/src/lib.rs
pub struct ExternalStreamJob {
    pub job_id: String,
    pub blob_hex: String,
    pub target_hex: String,
    pub seed_hash_hex: String,  // ← NEW: RandomX epoch seed
    pub algorithm: String,
    // ...
}
```

---

## 5. Benchmark Results (Apple M1)

### 5.1 `--randomx-bench`

```bash
cargo run --bin zion-miner --features native-randomx,native-verushash -- --randomx-bench
# Env: ZION_BENCH_SECS=10 ZION_THREADS=4
```

### 5.2 Results

| Config | Throughput | Per-thread | Notes |
|--------|-----------|-----------|-------|
| 1 thread (old single-VM mutex) | 19 H/s | 19 H/s | Mutex contention on every hash |
| 1 thread (per-thread VM) | 44 H/s | 44 H/s | 2.3x speedup |
| 4 threads (old single-VM mutex) | 1 H/s | 0.25 H/s | Mutex kills parallelism |
| **4 threads (per-thread VM)** | **175 H/s** | **44 H/s** | **9x speedup, linear scaling** |

### 5.3 Mode: Interpreted VM (ARM64)

Na Apple Silicon (M1) se používá **interpreted VM** (no JIT):
- A64 JIT compiler se kompiluje, ale `RANDOMX_FLAG_JIT` se nenastavuje při vytváření VM
- Důvod: A64 JIT má global constructor linking issues na macOS (i s `-force_load`)
- Soft AES (no hardware AES na Apple Silicon)
- Dataset: full memory mode (~2 GB)

**Expected on x86_64 (Linux/Intel):** ~500-1000 H/s s JIT + hardware AES.

### 5.4 XMR Network Estimates

| Metric | Value |
|--------|-------|
| XMR network difficulty | ~350G (varies) |
| Expected time per block (175 H/s) | ~23204 days |
| Pool share (diff 1M) | ~95 min |

RandomX je **memory-hard** — na M1 s interpreted VM je hashrate nízký. Na x86_64 serveru s JIT by byl ~5-10x vyšší.

---

## 6. Commity

| Commit | Popis |
|--------|-------|
| `11a13c212` | feat(miner): RandomX support + seed_hash plumbing for triple-stream mining |
| `dbf6031e0` | perf(randomx): per-thread VMs for lock-free multi-threaded hashing |

---

## 7. Další kroky

### 7.1 Pool E2E Test

1. **Connect to XMR pool** (MoneroOcean, 2miners, SupportXMR)
2. **Verify Stratum handshake** — `mining.subscribe`, `mining.authorize`, `mining.notify`
3. **Verify seed_hash propagation** — pool → server → miner → FFI
4. **Verify share submission** — `mining.submit` (3-param: `[worker, job_id, nonce]`)
5. **Verify epoch transition** — seed change triggers cache/dataset reinit

### 7.2 Performance Optimization

1. **A64 JIT fix** — investigate global constructor linking issue on macOS
   - Možné řešení: compile `jit_compiler_a64.cpp` jako separate `.o` a link explicitně
   - Nebo: použít `RANDOMX_FLAG_JIT` na ARM64 a ignorovat global constructor warning
2. **Hardware AES na ARM64** — Apple Silicon má ARMv8 Crypto Extensions (AES instructions)
   - RandomX `aes_hash.cpp` podporuje ARM64 hardware AES
   - Potřebné: `__ARM_FEATURE_CRYPTO` define nebo `RANDOMX_HAVE_AES`
3. **Large pages na Linux** — `RANDOMX_FLAG_LARGE_PAGES` pro ~10-20% speedup na x86_64

### 7.3 Production Deployment

1. **Edge server build** — `cargo build --release --features native-randomx` na x86_64
2. **Memory requirements** — ~2 GB pro dataset + ~256 MB pro cache = ~2.3 GB RAM per miner instance
3. **Multi-algo coexistence** — RandomX (CPU) + VerusHash (CPU) + ZION (GPU) triple-stream

---

## 8. Reference

- [tevador/RandomX](https://github.com/tevador/RandomX) — upstream library
- [RandomX spec](https://github.com/tevador/RandomX/blob/master/doc/specification.md)
- [Monero stratum](https://github.com/monero-project/monero/blob/master/src/rpc/core_rpc_server.cpp)
- Wrapper: `V3/L1/native-ffi/csrc/randomx/randomx_wrapper.cpp`
- FFI: `V3/L1/native-ffi/src/lib.rs` § `randomx` module
- Build: `V3/L1/native-ffi/build.rs` § `build_randomx()`
- Benchmark: `V3/L1/miner/src/main.rs` § `--randomx-bench`
- Status: `StatusV3.md` § Supported External Coins (XMR row)
- Roadmap: `ROADMAP.md` § 5.9
