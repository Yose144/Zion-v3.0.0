# Fire Algorithm Hard Fork Implementation Plan

## Executive Summary

Implementace Fire algoritmu (deeksha_lite_fire) do V3 stacku jako hard fork, založená na úspěšné Metal implementaci (commit 777b44aa) která dosáhla:
- **0 GPU_CPU_MISMATCH** 
- **0 rejected shares**
- **~6.8 KH/s hashrate** na Apple M1
- **Úspěšné block finding**

## Root Cause Analysis

### Problém s aktuálním OpenCL/CUDA Fire
- GPU_CPU_MISMATCH způsobené **unaligned memory access**
- Nesprávné buffer bindings
- Chybějící async dispatch
- Nesprávné algorithm reporting

### Úspěšná Metal implementace (777b44aa)
**Klíčové fixy:**
1. **8-byte alignment**: `ulong[]` místo `uchar[]` před casting na `ulong*`
2. **Proper buffer bindings**: 6 buffers, no NPU
3. **Async dispatch**: `addCompletedHandler` pro non-blocking
4. **Correct algorithm reporting**: `algorithm()` vrací "deeksha_lite_fire"

## Implementation Plan

### Phase 1: OpenCL Kernel Fix

#### 1.1 Memory Alignment Fix
**Soubor:** `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite_fire.cl`

**Změny:**
```c
// PŘED (špatně - unaligned):
uchar temp[64];
ulong *ptr = (ulong*)temp;  // UNALIGNED!

// PO (správně - aligned):
ulong temp[8];  // 8-byte aligned
// nebo
__private uchar temp[64] __attribute__((aligned(8)));
```

**Konkrétní místa k opravě:**
- Line 238: `ulong4 av=vload4(0,(__private ulong*)acc);` → přidat alignment
- Line 209: `vstore4(v,0,(__global ulong*)(pad+off));` → ověřit alignment
- Line 373: `vstore4(hv, 0, (__global ulong*)slot);` → ověřit alignment

#### 1.2 Thermal Loop Alignment
**Soubor:** `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite_fire.cl`

**Změny:**
```c
// Line 283-326: thermal_loop function
// Přidat alignment pro data array
void thermal_loop(__private uchar data[32] __attribute__((aligned(8)), ulong nonce)
```

#### 1.3 Buffer Structure Fix
**Soubor:** `V3/L1/miner/src/gpu_backend.rs`

**Změny:**
```rust
// OpenCL buffer bindings pro Fire
// Musí odpovídat Metal verzi (6 buffers, no NPU)
pub struct OpenCLFireBuffers {
    header_state: cl::Buffer,
    nonce_base: cl::Buffer,
    nonce_count: cl::Buffer,
    output_hashes: cl::Buffer,
    scratchpad_pool: cl::Buffer,
    // NO NPU buffer (odstranit pokud existuje)
}
```

### Phase 2: CUDA Kernel Fix

#### 2.1 Create CUDA Kernel
**Soubor:** `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite_fire.cu`

**Založit na:** `deeksha_lite_fire.cl` + Metal alignment fixy

**Klíčové CUDA specifické změny:**
```cuda
// CUDA alignment
__align__(8) uchar data[32];

// CUDA atomic operations
atomicMin(&result_nonce, nonce);

// CUDA memory alignment
__device__ void thermal_loop(__align__(8) uchar data[32], unsigned long long nonce)
```

#### 2.2 CUDA Backend Integration
**Soubor:** `V3/L1/miner/src/gpu_backend.rs`

**Přidat:**
```rust
pub struct CudaDeekshaLiteFireMiner {
    device: CudaDevice,
    buffers: CudaFireBuffers,
    // ... ostatní fields
}

impl GpuMiner for CudaDeekshaLiteFireMiner {
    fn algorithm(&self) -> &str {
        "deeksha_lite_fire"
    }
    
    fn dispatch_batch(&self, ...) -> Result<Vec<u8>> {
        // Async dispatch s proper alignment
    }
}
```

### Phase 3: Miner Integration

#### 3.1 GPU Backend Selection
**Soubor:** `V3/L1/miner/src/gpu_backend.rs`

**Změny:**
```rust
pub fn create_fire_miner(backend: GpuBackend, device: &Device) -> Result<Box<dyn GpuMiner>> {
    match backend {
        GpuBackend::OpenCL => Ok(Box::new(OpenCLDeekshaLiteFireMiner::new(device)?)),
        GpuBackend::CUDA => Ok(Box::new(CudaDeekshaLiteFireMiner::new(device)?)),
        GpuBackend::Metal => Ok(Box::new(MetalDeekshaLiteFireMiner::new(device)?)),
        _ => Err("Fire not supported on this backend".into()),
    }
}
```

#### 3.2 Algorithm Reporting Fix
**Soubor:** `V3/L1/miner/src/gpu_backend.rs`

**Změny:**
```rust
// Ověřit že všechny GPU miners vrací správný algorithm
impl GpuMiner for OpenCLDeekshaLiteFireMiner {
    fn algorithm(&self) -> &str {
        "deeksha_lite_fire"  // MUSÍ být přesně tento string
    }
}
```

### Phase 4: Pool Integration

#### 4.1 Share Validation
**Soubor:** `V3/L1/pool/src/validation.rs`

**Ověřit:**
```rust
pub fn validate_candidate_with_algorithm(
    candidate: &ShareCandidate,
    algorithm: &str,
    expected_difficulty: u64,
) -> Result<bool> {
    match algorithm {
        "deeksha_lite_v1" => validate_deeksha_lite_v1(...),
        "deeksha_lite_fire" => validate_deeksha_lite_fire(...),  // MUSÍ existovat
        "cosmic_harmony_ekam_deeksha_v2" => validate_ekam_v2(...),
        _ => Err("Unknown algorithm".into()),
    }
}
```

#### 4.2 Fire Validation Function
**Soubor:** `V3/L1/pool/src/validation.rs`

**Přidat:**
```rust
pub fn validate_deeksha_lite_fire(
    header: &[u8],
    nonce: u64,
    submitted_hash: &[u8],
    expected_difficulty: u64,
) -> Result<bool> {
    // Volat cosmic-harmony validation
    cosmic_harmony::deeksha_lite_fire::validate(
        header,
        nonce,
        submitted_hash,
        expected_difficulty,
    )
}
```

### Phase 5: Node Integration

#### 5.1 Consensus Profile
**Soubor:** `V3/L1/core/src/consensus.rs`

**Ověřit:**
```rust
pub enum ConsensusProfile {
    DeekshaLiteV1,
    DeekshaLiteFire,  // MUSÍ existovat
    CosmicHarmonyEkamDeekshaV2,
}
```

#### 5.2 Block Validation
**Soubor:** `V3/L1/core/src/peer_block_validation.rs`

**Ověřit:**
```rust
pub fn validate_block_with_algorithm(
    block: &Block,
    algorithm: &str,
) -> Result<bool> {
    match algorithm {
        "deeksha_lite_v1" => validate_deeksha_lite_v1_block(block),
        "deeksha_lite_fire" => validate_deeksha_lite_fire_block(block),  // MUSÍ existovat
        "cosmic_harmony_ekam_deeksha_v2" => validate_ekam_v2_block(block),
        _ => Err("Unknown algorithm".into()),
    }
}
```

### Phase 6: Hard Fork Coordination

#### 6.1 Block Height
**Soubor:** `V3/L1/core/src/genesis.rs` nebo `V3/L1/core/src/emission.rs`

**Definovat fork height:**
```rust
pub const FIRE_FORK_HEIGHT: u64 = 1000000;  // Příklad - upravit podle consensus
```

#### 6.2 Fork Logic
**Soubor:** `V3/L1/core/src/consensus.rs`

**Přidat:**
```rust
pub fn get_consensus_profile_for_height(height: u64) -> ConsensusProfile {
    if height >= FIRE_FORK_HEIGHT {
        ConsensusProfile::DeekshaLiteFire
    } else {
        ConsensusProfile::DeekshaLiteV1
    }
}
```

### Phase 7: Testing

#### 7.1 Unit Tests
```bash
cargo test -p zion-cosmic-harmony deeksha_lite_fire
cargo test -p zion-pool validate_deeksha_lite_fire
cargo test -p zion-core validate_deeksha_lite_fire_block
```

#### 7.2 Integration Tests
```bash
# Local pool test
cargo run --release -p zion-pool --bin server &
cargo run --release -p zion-miner --algorithm deeksha_lite_fire

# Ověřit: 0 GPU_CPU_MISMATCH, 0 rejected shares
```

#### 7.3 GPU KAT Benchmark
```bash
cargo run --release -p zion-miner -- --gpu-kat-bench --algorithm deeksha_lite_fire
```

### Phase 8: Deployment

#### 8.1 Build
```bash
cargo build --release --manifest-path V3/Cargo.toml --workspace
```

#### 8.2 Edge Deployment
```bash
# Build na Edge serveru
ssh root@77.42.71.94
cd /root/zion-2.9.6-main
git pull origin main
cargo build --release --manifest-path V3/Cargo.toml --workspace

# Restart services
systemctl restart zion-node
systemctl restart zion-pool
```

#### 8.3 Verification
```bash
# Ověřit že node běží s Fire profile
curl -s http://127.0.0.1:8443/jsonrpc -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"getChainInfo","params":[],"id":1}'

# Ověřit že pool přijímá Fire shares
curl -s http://127.0.0.1:8455/metrics | grep deeksha_lite_fire
```

## Success Criteria

1. **0 GPU_CPU_MISMATCH** na všech GPU backends (OpenCL, CUDA, Metal)
2. **0 rejected shares** při pool mining
3. **Hashrate > 5 KH/s** na typickém GPU (RX 5700 XT, RTX 3060)
4. **Block finding** potvrzeno v pool metrics
5. **Consensus fork** úspěšně aktivován na definovaném height
6. **All tests passing** (unit, integration, KAT)

## Rollback Plan

Pokud se něco pokazí:
1. Git revert na před-fork commit
2. Redeploy předchozí verze
3. Fork height posunout do budoucnosti
4. Opakovat testování

## Timeline Estimate

- Phase 1 (OpenCL fix): 2-3 hodiny
- Phase 2 (CUDA implementation): 4-6 hodin
- Phase 3 (Miner integration): 1-2 hodiny
- Phase 4 (Pool integration): 1-2 hodiny
- Phase 5 (Node integration): 2-3 hodiny
- Phase 6 (Fork coordination): 1 hodina
- Phase 7 (Testing): 2-3 hodiny
- Phase 8 (Deployment): 1-2 hodiny

**Celkem: 14-22 hodin**

## References

- Commit 777b44aa: Metal Fire kernel (úspěšná reference)
- Commit 8d5d44ca: GPU/CPU hash path decoupling
- Commit 21c7a028: Algorithm-aware share validation
- V3/L1/cosmic-harmony/src/deeksha_lite_fire.rs (CPU reference)
- V3/L1/miner/src/deeksha_lite_fire.metal (Metal reference)
