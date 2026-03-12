# ZION v2.9.9 — Cílová architektura (Final Architecture)

> Po dokončení Pure Code migrace bude repozitář obsahovat pouze tyto aktivní cesty.

---

## L1/cosmic-harmony — PoW algoritmus

```
L1/cosmic-harmony/
├── Cargo.toml
├── src/
│   ├── lib.rs                       # Public API: cosmic_harmony_ekam_deeksha()
│   ├── deeksha.rs                   # Kanonická CPU implementace (Blake3 XOF pipeline)
│   ├── scratchpad.rs                # Memory-hard fáze (legacy SHA3 — k odstranění v 2.9.9)
│   ├── scratchpad_ekam.rs           # Ekam memory-hard (Blake3 XOF init + mixing)
│   ├── hugepages.rs                 # HugePages (2 MiB) scratchpad allocator (mmap + mlock)
│   ├── golden_matrix.rs             # φ-transform (8×8 golden ratio matrix)
│   ├── algorithms_npu.rs            # INT8 MLP (64→128→64) + GELU + LayerNorm
│   ├── cosmic_fusion.rs             # 8-round AES-128 + Keccak fusion
│   ├── keccak.rs                    # Keccak-256 / SHA3-512 primitiva
│   └── gpu/
│       ├── mod.rs                   # GPU trait abstrakce
│       ├── metal_miner.rs           # Apple Metal backend — mine(), benchmark()
│       └── kernels/
│           ├── cosmic_harmony_ekam_deeksha.metal   # Metal shader (kanonický)
│           ├── cosmic_harmony_deeksha.cl            # OpenCL kernel (kanonický)
│           └── cosmic_harmony_deeksha.cu            # CUDA kernel (kanonický)
```

**Smazáno v 2.9.9:**
- ~~`mine()` legacy dispatch~~ → přejmenován `mine_ekam()` na `mine()`
- ~~`has_ekam_kernels()`~~ → odstraněno (vždy true)
- ~~`pipeline_mine` field~~ → odstraněno
- ~~`cosmic_harmony_v42.*` kernel soubory~~ → smazány

**Přidáno v 2.9.9:**
- `hugepages.rs` — HugePages (2 MiB) scratchpad allocator inspirovaný XMRig VirtualMemory
  - Linux: `MAP_HUGETLB | MAP_POPULATE` → 1 TLB entry pro celý 64 KiB scratchpad
  - macOS x86_64: `VM_FLAGS_SUPERPAGE_SIZE_2MB`
  - macOS arm64: fallback `mmap` + `madvise(MADV_RANDOM|MADV_WILLNEED)` + `mlock` (nativní 16K stránky)
  - Thread-local pool — každé mining vlákno dostane vlastní mmap buffer

---

## L1/miner — Mining runtime

```
L1/miner/
├── Cargo.toml
├── src/
│   └── miner/
│       ├── mod.rs                   # GPU mining loop, stratum dispatch
│       ├── native_algos.rs          # NativeAlgorithm enum (CosmicHarmony + aliasy)
│       ├── python_fallback.rs       # Jediný variant: DeekshaCanonical
│       └── gpu/
│           ├── mod.rs               # GpuMiner trait, create_miner(), batch heuristic
│           ├── metal.rs             # Metal wrapper: mine_batch() → inner.mine()
│           ├── benchmark.rs         # Auto-tune benchmark harness
│           └── kernels/             # Sync kopie z L1/cosmic-harmony
```

**Smazáno v 2.9.9:**
- ~~`CosmicHarmonyV42` enum varianta~~ → odstraněna (alias zachován v from_str())
- ~~`PythonMinerVariant::Chv3Gpu`~~ → odstraněna
- ~~`PythonMinerVariant::Chv42`~~ → odstraněna
- ~~`PythonMinerVariant::Legacy`~~ → odstraněna
- ~~`if has_ekam_kernels()` guard v metal.rs~~ → přímé volání `mine()`

---

## APP&WEB/desktop-agent — Desktop mining klient

```
APP&WEB/desktop-agent/
├── package.json
├── src/
│   ├── main.js                      # Electron orchestrace (Rust → Python fallback)
│   └── ui/renderer.js               # UI
├── scripts/
│   └── prepare-rust-miner.js        # Packaging Rust binárky + GPU assets
└── resources/
    └── mining/
        ├── cosmic_harmony_deeksha_fallback.py        # Python stratum miner (kanonický)
        ├── cosmic_harmony_gpu.py                     # GPU wrapper (Metal/OpenCL/CUDA)
        ├── cosmic_harmony_deeksha_gpu.py             # GPU benchmark dispatcher
        ├── cosmic_harmony_ekam_deeksha.metal          # Metal shader
        ├── cosmic_harmony_deeksha.cl                  # OpenCL kernel
        ├── cosmic_harmony_deeksha.cu                  # CUDA kernel
        ├── deeksha_npu_weights.bin                    # NPU váhy (16,960 B)
        ├── libcosmic_harmony_deeksha.dylib            # Native lib (macOS)
        ├── librandomx_zion.dylib                      # RandomX (XMR)
        └── libyescrypt_zion.dylib                     # Yescrypt (LTC)
```

**Smazáno v 2.9.9:**
- ~~5 legacy Python skriptů~~ (v3_gpu, v3_python, v4_metal_gpu, v4_native, native)
- ~~3 legacy GPU kernel soubory~~ (v42.metal, v42.cu, v42.cl + canonical.cl duplikát)
- ~~5 legacy binary knihoven~~ (libcosmic_harmony*.dylib bez _deeksha)
- ~~`cosmic_harmony_v42_gpu.py`~~ → přejmenován na `cosmic_harmony_gpu.py`

---

## GPU kernel synchronizace

Po v2.9.9 existuje **jeden zdroj pravdy** per backend shader:

| Backend | Kanonický soubor | Entrypoint |
|---------|-----------------|------------|
| Metal | `cosmic_harmony_ekam_deeksha.metal` | `cosmic_harmony_ekam_mine` |
| OpenCL | `cosmic_harmony_deeksha.cl` | `ekam_deeksha_mine` |
| CUDA | `cosmic_harmony_deeksha.cu` | `ekam_deeksha_mine` / `ekam_cuda_mine()` |

Synchronizační cesta:
```
L1/cosmic-harmony/src/gpu/kernels/    ← zdroj pravdy
    ↓ (prepare-rust-miner.js sync)
L1/miner/src/miner/gpu/kernels/       ← build-time kopie
L1/native-libs/all/                    ← packaging kopie
APP&WEB/desktop-agent/resources/mining/ ← runtime kopie
```

---

## Kanonická pipeline (po v2.9.9 = po v2.9.8, beze změn)

```
┌─────────────────────────────────────────────────────────┐
│ header (≤80 B) + nonce (8 B) = 88 B                    │
│                    │                                     │
│                    ▼                                     │
│             Keccak-256 (0x01 pad)                       │
│                    │ 32 B                                │
│                    ▼                                     │
│             SHA3-512 (0x06 pad)                          │
│                    │ 64 B                                │
│                    ▼                                     │
│          Golden Matrix (φ^k FP)                         │
│                    │ 64 B                                │
│                    ▼                                     │
│  ┌─────── Memory-Hard (64 KiB) ───────┐                │
│  │ Blake3 XOF init (1024 blocks)       │                │
│  │ 2 passes (Blake3 XOF mixing)        │                │
│  │ 64 random reads (Keccak-256)        │                │
│  └─────────────────────────────────────┘                │
│                    │ 64 B                                │
│                    ▼                                     │
│      NPU Mix (INT8 MLP 64→128→64)                      │
│          GELU + LayerNorm + Residual                    │
│                    │ 64 B                                │
│                    ▼                                     │
│    Cosmic Fusion (8 rounds × AES-128)                   │
│                    │ 64 B                                │
│                    ▼                                     │
│         SHA3-512 → first 32 B = HASH                    │
└─────────────────────────────────────────────────────────┘

Test vektor:
  header = "ZION_DEEKSHA_GENESIS_V298_CANONICAL"
  nonce  = 0x2980_0001_0000_0001
  hash   = 6339f2fb178fe2957a10d9e2a84cf9d5e340064f0d165e845b6a54eaf7924fbd
```

---

## Výkonové metriky (baseline pro 2.9.9)

| Platforma | Backend | Batch | Hashrate | Poznámka |
|-----------|---------|-------|----------|----------|
| Apple M1 | Rust Metal | 8192 | **28.2 kH/s** | Release build, Ekam dispatch |
| Apple M1 | Python Metal | 8192 | **9.6 kH/s** | PyObjC backend |
| Apple M1 | Rust CPU (8T) | — | **5.4 kH/s** | Ekam Deeksha |
| Apple M1 | Rust CPU (1T) | — | **1.2 kH/s** | Ekam Deeksha |

Tyto hodnoty se v 2.9.9 **nesmí změnit** (čistě refactoring, žádná změna pipeline).
