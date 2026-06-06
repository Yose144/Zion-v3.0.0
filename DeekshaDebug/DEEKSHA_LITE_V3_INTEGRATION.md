# DeekshaLite v1 — V3 Integration Plan

## Overview

DeekshaLite v1 is a simplified ASIC-resistant consensus algorithm designed for maximum GPU compatibility (especially AMD GCN). It replaces the complex `ekam_v3` pipeline with a 4-step process that removes NPU Mix and Cosmic Fusion.

## Why a New Algorithm Variant

| Problem with ekam_v3 | DeekshaLite Solution |
|---------------------|----------------------|
| NPU Mix (LayerNorm, GELU, int8 MLP) | Removed — compiler bugs on GCN |
| Cosmic Fusion (Keccak+AES+XOR chain) | Removed — pointer cast bugs on GCN |
| Complex scratchpad (Blake3 XOF + AES + Merkabah + Kabala + Brahma) | Simplified SHA3-512 fill + XOR passes |
| ~10-15% acceptance on GCN | Target: 100% acceptance on all GPUs |

## Algorithm Pipeline

```
Step 1: Keccak256(header || nonce) → 32B
Step 2: Memory-hard scratchpad (128 KiB, 2 passes, 64 random reads) → 32B
Step 3: AES-128 CTR mixing (4 rounds) → 32B
Step 4: Keccak256(final_input) → 32B (mining hash)
```

## V3 Integration Points

### 1. New Module: `V3/L1/cosmic-harmony/src/deeksha_lite.rs`

```rust
pub const POW_PROFILE_LITE: &str = "deeksha_lite_v1";

pub fn deeksha_lite(header: &[u8], nonce: u64) -> Hash32 { ... }
pub fn deeksha_lite_self_test() -> bool { ... }
pub fn deeksha_lite_find_nonce(...) -> Option<(u64, Hash32)> { ... }
```

### 2. OpenCL Kernel: `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite.cl`

- Single kernel `deeksha_lite_mine`
- No s4_mode needed (simple enough for full GPU pipeline)
- Byte-level memory access (no pointer casts)
- Uses existing `keccak_f1600` and AES helpers from main kernel

### 3. GPU Backend: `V3/L1/miner/src/gpu_backend.rs`

Add new backend variant:
```rust
GpuBackend::DeekshaLite { pro_que, kernel, ... }
```

### 4. Pool Support: `V3/L1/pool/src/`

Pool must recognize new pow_profile and validate shares accordingly:
```rust
fn validate_deeksha_lite_share(header, nonce, hash, target) -> bool
```

### 5. Configuration

```rust
// miner selects algorithm based on pool job
enum ConsensusAlgorithm {
    EkamV3,      // current default
    DeekshaLite, // new GCN-friendly option
}
```

Pool can signal which algorithm to use via stratum extension:
```
job {"algo": "deeksha_lite_v1", "header": "...", "target": "..."}
```

Or use height-based activation (fork).

## Fork Strategy

Option A: Height-based activation
```rust
const DEEKSHA_LITE_ACTIVATION_HEIGHT: u64 = 100_000; // TBD

fn get_consensus_algo(height: u64) -> ConsensusAlgorithm {
    if height >= DEEKSHA_LITE_ACTIVATION_HEIGHT {
        ConsensusAlgorithm::DeekshaLite
    } else {
        ConsensusAlgorithm::EkamV3
    }
}
```

Option B: Per-job algorithm selection (stratum)
- Pool sends `algo` field in job message
- Miner switches algorithm dynamically
- Allows A/B testing before fork

## Performance Targets

| Metric | Target |
|--------|--------|
| CPU single-thread | 4500+ H/s |
| GPU RX 5600 XT | 8000+ H/s (full pipeline) |
| GPU Vega 64 | 3000+ H/s (full pipeline) |
| Acceptance rate | 95%+ on all GPUs |

## Testing Plan

1. CPU reference validation (determinism, self-test)
2. OpenCL kernel GPU vs CPU comparison
3. Pool share acceptance test (1 hour minimum)
4. ASIC resistance review (memory-hardness analysis)
5. Fork rehearsal on testnet

## Files to Create/Modify

### New Files
- `V3/L1/cosmic-harmony/src/deeksha_lite.rs` — Rust reference
- `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite.cl` — OpenCL kernel
- `V3/L1/cosmic-harmony/src/deeksha_lite_test.rs` — test vectors

### Modified Files
- `V3/L1/cosmic-harmony/src/lib.rs` — export new functions
- `V3/L1/miner/src/gpu_backend.rs` — add DeekshaLite backend
- `V3/L1/pool/src/share_validation.rs` — validate both algorithms
- `V3/L1/core/src/consensus.rs` — height-based activation
- `V3/L1/miner/src/main.rs` — algorithm selection logic
- `V3/L1/pool/src/stratum.rs` — algo field in job message

## Timeline

| Step | Est. Time |
|------|-----------|
| Rust reference + tests | 30 min |
| OpenCL kernel | 45 min |
| GPU backend integration | 45 min |
| Pool validation | 30 min |
| End-to-end test | 30 min |
| **Total** | **~3 hours** |

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Lower ASIC resistance than ekam_v3 | Increase scratchpad size or passes |
| Network split at fork | Coordinate with all pool operators |
| GPU still miscompiled | Further simplify (remove AES rounds) |

## Decision Points

1. **Fork or dual-algo?** Fork is cleaner but harder to coordinate. Dual-algo allows gradual migration.
2. **Scratchpad size?** 128 KiB is conservative. Could raise to 256 KiB for more ASIC resistance.
3. **AES rounds?** 4 rounds is minimal. Could add more if GPU handles it.
4. **Activation height?** Needs community/pool agreement.
