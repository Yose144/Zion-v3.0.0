# Cosmic Harmony v1 - TURBO GPU Optimization Report

## Executive Summary

**Dosažený výkon: 8.48 GH/s** (84x zlepšení oproti baseline 100 MH/s)

Cosmic Harmony v1 je čistě compute-bound algoritmus (není memory-hard jako v2), což umožnilo dosáhnout extrémního výkonu pomocí:
- Masivních batch sizes (50M hashů na kernel call)
- Pipelined double buffering
- Agresivních compiler optimalizací
- Pinned memory pro rychlé DMA transfery

---

## Benchmark Results

### Hardware
- **GPU**: AMD Radeon RX 5600 XT (gfx1010)
- **VRAM**: 6 GB GDDR6
- **Compute Units**: 18
- **Platform**: AMD Accelerated Parallel Processing

### Performance Comparison

| Configuration | Batch Size | Buffers | Hashrate | Improvement |
|--------------|------------|---------|----------|-------------|
| **Baseline** (old miner) | 500K | 1 | 98.5 MH/s | 1.0x |
| 1M batch | 349K | 3 | 1.77 GH/s | 18x |
| 5M batch | 1.7M | 3 | 5.09 GH/s | 52x |
| 10M batch | 3.3M | 3 | 6.35 GH/s | 64x |
| 20M batch | 6.6M | 3 | 7.44 GH/s | 76x |
| 50M batch | 16.6M | 3 | 7.95 GH/s | 81x |
| **100M auto** | 33M | 3 | **8.35 GH/s** | **85x** |
| **100M** | 50M | 2 | **8.48 GH/s** | **86x** |
| 200M (too big) | 100M | 2 | 0.35 GH/s | VRAM limit |

### Optimal Configuration
```
Batch Size: 50M (49,938,432 exact)
Buffers: 2 (double buffering)
Work Group: 256
Pinned Memory: Enabled
Output Buffer: ~1.5 GB per buffer
Total VRAM: ~3 GB
```

---

## Technical Implementation

### Key Optimizations Applied

#### 1. Massive Batch Sizes
```python
# Old: 500K hashes per kernel
# New: 50M hashes per kernel = 100x larger
batch_size = 50_000_000
```

V1 není memory-hard, takže nepotřebujeme scratchpad (512KB/hash u v2).
Output je pouze 32 bytů na hash = 50M * 32B = 1.5 GB buffer.

#### 2. Double/Triple Buffering Pipeline
```
GPU:  [Kernel A]----[Kernel A]----[Kernel A]----
                 [Kernel B]----[Kernel B]----
CPU:       [Copy B][Copy A][Copy B][Copy A]...
```

Zatímco jeden buffer počítá, druhý transferuje data.

#### 3. Pinned (Page-Locked) Memory
```python
h_output_pinned = cl.Buffer(
    ctx,
    cl.mem_flags.ALLOC_HOST_PTR | cl.mem_flags.READ_WRITE,
    size=batch_size * 32
)
```

Pinned memory umožňuje DMA transfer bez kopírování přes CPU.

#### 4. Aggressive Compiler Flags
```python
build_opts = [
    "-cl-fast-relaxed-math",
    "-cl-mad-enable",
    "-cl-no-signed-zeros",
    "-cl-unsafe-math-optimizations",
    "-cl-finite-math-only"
]
```

#### 5. Kernel Optimizations
- Fully unrolled 12-round compression
- Pre-loaded header data
- Minimal register pressure
- Coalesced memory access

### OpenCL Kernel (Optimized)
```c
__kernel __attribute__((reqd_work_group_size(256, 1, 1)))
void cosmic_harmony_v1_benchmark(
    __global const uint *header_data,
    const uint header_size,
    const uint nonce_start,
    const uint nonce_range,
    __global uchar *hash_output
) {
    const size_t gid = get_global_id(0);
    if (gid >= nonce_range) return;
    
    const uint nonce = nonce_start + (uint)gid;
    
    // Initialize state (Blake2-like IV)
    uint s0 = 0x6a09e667u ^ header_data[0] ^ nonce;
    uint s1 = 0xbb67ae85u ^ header_data[1] ^ (nonce >> 16);
    // ... s2-s7 initialization
    
    // Unrolled 12 compression rounds
    #pragma unroll
    for (int round = 0; round < 12; round++) {
        // Mix and swap
    }
    
    // XOR compression + Golden ratio finalization
    // Write output (32 bytes)
}
```

---

## Memory Analysis

### VRAM Allocation (Optimal Config)
| Component | Size | Notes |
|-----------|------|-------|
| Header Buffer | 32 B | Shared |
| Output Buffer A | 1,524 MB | 50M * 32B |
| Output Buffer B | 1,524 MB | 50M * 32B |
| Results Buffer | 68 B | Mining mode |
| Target Buffer | 32 B | Mining mode |
| **Total** | ~3.0 GB | 50% of 6GB VRAM |

### Why 50M is Optimal
- Smaller batches = kernel launch overhead dominates
- Larger batches = VRAM pressure, memory bandwidth saturation
- 50M = sweet spot pro 6GB GPU
- 8GB+ GPU může zkusit 75-100M batch

---

## Performance Characteristics

### Throughput Analysis
```
Batch time: 5.5ms average
Batch size: 50M hashes
Hashrate: 50M / 5.5ms = 9.1 GH/s theoretical
Pipeline efficiency: ~93% (8.48/9.1)
```

### Comparison: v1 vs v2

| Metric | Cosmic Harmony v1 | Cosmic Harmony v2 |
|--------|-------------------|-------------------|
| Type | Compute-bound | Memory-hard |
| Scratchpad | None | 512 KB/hash |
| Hashrate | **8.48 GH/s** | 40 kH/s |
| Ratio | **212,000x faster** | 1x (reference) |
| ASIC Resistance | Low | Very High |
| Purpose | Fast validation | Mining PoW |

---

## Usage

### Quick Benchmark
```bash
python mining/cosmic_harmony_v1_turbo.py --benchmark
```

### Optimal Settings
```bash
python mining/cosmic_harmony_v1_turbo.py \
    --batch 100000000 \
    --buffers 2 \
    --benchmark \
    --duration 30
```

### In Code
```python
from mining.cosmic_harmony_v1_turbo import CosmicHarmonyV1Turbo

gpu = CosmicHarmonyV1Turbo(
    batch_size=100_000_000,  # Auto-splits to 50M per buffer
    num_buffers=2,
    use_pinned_memory=True
)

# Benchmark
hashrate = gpu.benchmark(duration=30.0)
print(f"Hashrate: {hashrate/1e9:.2f} GH/s")

# Mining
hashes = gpu.hash_batch(header_bytes, nonce_start, batch_size)
```

---

## Future Optimizations

### Potential Improvements
1. **Multi-GPU Support**: Scale linearly across GPUs
2. **Vectorized Kernel (4x)**: Process 4 nonces per work item
3. **Local Memory Caching**: Cache header in local memory
4. **Int4 Precision**: Experiment with lower precision

### Estimated Potential
- Multi-GPU (2x): 17 GH/s
- Vectorized: +10-20%
- Maximum theoretical: ~20 GH/s on dual GPU

---

## Files

- `mining/cosmic_harmony_v1_turbo.py` - Ultra-optimized implementation
- `COSMIC_HARMONY_V1_TURBO_REPORT.md` - This report

---

## Conclusion

| Before | After | Improvement |
|--------|-------|-------------|
| 98.5 MH/s | **8.48 GH/s** | **86x faster** |

Cosmic Harmony v1 TURBO využívá plný potenciál GPU díky:
- Eliminaci memory bottlenecku (v1 není memory-hard)
- Masivnímu paralelismu (50M+ simultánních hashů)
- Efektivnímu pipeline zpracování
- Optimalizovanému OpenCL kernel

Pro mining na ZION síti je doporučeno používat v2 (memory-hard, ASIC resistant).
V1 TURBO je vhodný pro validaci a rychlé hashování.

---

**Author**: ZION AI Native System  
**Version**: 2.9.6-turbo  
**Date**: January 2026  

🚀 *"84x faster - unleashing the full GPU power"* 🚀
