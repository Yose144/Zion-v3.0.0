# REPORT: OpenCL On-Device Target Check Fix — 50x ZION Hashrate on AMD

**Date:** 2026-08-10
**Commit:** `08ef9dbf1`
**Deploy:** `zion-trinity-smos-v7.zip`
**Rig:** SMOS 518837 (ZionRig) — RX 5600 XT 6GB (RDNA1/gfx1010) + RX Vega 64 8GB (GCN/gfx900)

---

## 1. Problem

ZION Deeksha hashrate na AMD rigu byla **16 kH/s** (RX 5600 XT + Vega 64), zatímco CUDA na GTX 1070 Ti dosahovala **2.46 MH/s** — rozdíl **~150x**.

## 2. Root Cause

`OpenClDeekshaLiteMiner::mine_batch()` v `V31/L1/miner/src/gpu/mod.rs` předávala `target_u32=0` (benchmark mode) kernelu při reálné těžbě:

```rust
// BROKEN — benchmark mode during real mining
self.kernel.set_arg(6, 0u32)?; // output-all / benchmark mode
```

V benchmark mode kernel zapisoval **VŠECHNY hashe** do output bufferu:
- 8192 nonces × 32 bytes = **256 KB DMA transfer per chunk**
- CPU iteroval přes každý hash pro target check
- Double-buffered async readback přenášel 256KB × N chunků

CUDA `CudaDeekshaLiteMiner::mine_batch()` už používala on-device target check:
```rust
// CUDA — correct: on-device target check
let target_u32 = u32::from_be_bytes([target.bytes[0], ...]);
func.launch(cfg, (..., target_u32, ...));  // GPU checks target
```

GPU kernel `deeksha_lite.cl` **má** on-device target check implementovaný (lines 604-618):
```c
if (target_u32 != 0) {
    uint hash_be = ...;
    if (hash_be <= target_u32) {
        uint old = atomic_xchg(result_flag, 1u);
        if (old == 0u) {
            *result_nonce = nonce;
            // write only 32 bytes (winning hash)
        }
    }
}
```

Ale Rust mine_batch ho nikdy nepoužil — vždy poslal `target_u32=0`.

## 3. Fix

Přidán on-device target check path do `OpenClDeekshaLiteMiner::mine_batch()`:

```rust
let target_u32 = u32::from_be_bytes([target.bytes[0], ...]);

if target_u32 != 0 {
    // Reset result buffers (flag=0, nonce=SENTINEL)
    // Launch all chunks back-to-back with target_u32
    // Single queue.finish() at the end
    // Read only result_nonce + result_hash (40 bytes, not 256KB+)
    return Ok(GpuBatchResult { ... });
}
// Benchmark mode (target_u32 == 0) preserved for benchmark()
```

Architektura přesně zrcadlí CUDA mine_batch:
- Žádný inter-chunk sync (kernel atomic early-exit to řeší)
- Jeden `queue.finish()` na konci
- DMA read pouze 40 bytů (nonce + hash)

## 4. Wrapper Optimalizace

Přepnuto na **dedicated GPU mode** pro čisté měření fixu:

| Parametr | Před | Po |
|----------|------|-----|
| `ZION_ZANO_RESERVE` | 0 (shared) | 1 (dedicated) |
| `ZION_EXT_GPU_GAP_MS` | 1000 (1s sleep!) | 0 |
| `ZION_STREAM2_BATCH` | 262144 | 2097152 (2M) |
| `ZION_STREAM2_FORCE_COIN` | — | ZANO |
| `ZION_MINER_CPU_COIN` | — | VRSC |
| `tui` feature | ne | ano |

## 5. Výsledky

### Hashrate

| Stream | Před | Po | Zlepšení |
|--------|------|-----|----------|
| **ZION** | 16 kH/s | **802 kH/s** | **50x** |
| **ZANO** | 0 (idle) | 12.3 MH/s | ✅ |
| **VRSC** | 0 (idle) | 1.38 MH/s | ✅ |
| **GPU load** | 50% | **100%** | 2x |

### Shares

| Metrika | Hodnota |
|---------|---------|
| ZION accepted | 290 |
| ZION rejected | 0 |
| ZANO accepted | 1+ |
| Accept rate | **100%** |

### Hardware

| GPU | Temp | Power | Role |
|-----|------|-------|------|
| RX 5600 XT | 52°C | 82W | ZION Deeksha |
| RX Vega 64 | 59°C | 127W | ZANO ProgPoWZ |
| Total rig | — | 309W | — |

## 6. Srovnání CUDA vs OpenCL (po fixu)

| GPU | Backend | ZION Hashrate | Poznámka |
|-----|---------|---------------|----------|
| GTX 1070 Ti (8GB) | CUDA | 2.46 MH/s | Reference |
| RX 5600 XT (6GB) | OpenCL | ~800 kH/s | Po fixu (1 GPU na ZION) |
| RX Vega 64 (8GB) | OpenCL | ~800 kH/s* | *Odhad z dedicated mode |

OpenCL je nyní ~3x pomalejší než CUDA na srovnatelném hardware — což je normální rozdíl (compiler, occupancy). Původních 150x bylo způsobeno benchmark mode bugem.

## 7. Další kroky

1. **Paralelní mode (2x ZION + 2x ZANO):** RESERVE=0, obě GPU těží obě mince přes time-slicing. S target check fixem by time-slicing overhead měl být minimální.
2. **Per-GPU work_size tuning:** RX 5600 XT optimal ~6128, Vega 64 ~16384.
3. **LOCAL_SIZE experiment:** RDNA1 s 256 vs GCN s 64.
4. **ZANO duty cycle tuning:** GAP_MS a DUTY_PCT pro vyvážení ZION vs ZANO hashrate.

## 8. Soubory

| Soubor | Změna |
|--------|-------|
| `V31/L1/miner/src/gpu/mod.rs` | +107 lines: on-device target check path |
| `V31/scripts/smos/wrapper_v31_trinity.sh` | Dedicated GPU mode + TUI |

## 9. Build

```bash
docker run --rm \
  -v "$(pwd)/V31:/workspace" \
  -v zion-cargo-cache:/root/.cargo/registry \
  -w /workspace \
  rust:1.97-bullseye \
  bash -c 'apt-get update -qq && apt-get install -y -qq ocl-icd-opencl-dev opencl-headers && \
           cargo build --release --bin zion-miner \
           --features auxpow,gpu-opencl,native-hashers,native-verushash,tui'
```

Features: `auxpow,gpu-opencl,native-hashers,native-verushash,tui`
Output: 8.5MB, GLIBC ≤2.30 (SMOS compatible)
