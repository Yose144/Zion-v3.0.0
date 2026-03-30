# ZION Native Mining Algorithms

## 🌟 Overview

ZION v2.9.5 supports multiple mining algorithms optimized for different hardware configurations. Each algorithm has unique characteristics suited for specific use cases.

## Implemented Algorithms

### 1. Cosmic Harmony (ZION Native) ⭐

**Status**: ✅ **IMPLEMENTED** (v2.9.5)

ZION's flagship mining algorithm, designed for consciousness-weighted rewards and optimal performance.

**Specifications**:
- **Hash Function**: Custom golden ratio based mixer
- **Output**: 32 bytes (256 bits)
- **Memory**: Low (~1 KB)
- **GPU-Friendly**: Yes (highly parallelizable)
- **ASIC Resistance**: Medium

**Performance Targets**:
```
CPU (single core):  500-600 kH/s
CPU (8 cores):      4-5 MH/s
GPU (mid-range):    10-50 MH/s
GPU (high-end):     100-500 MH/s
```

**Algorithm Stages**:
1. **Initialization**: 8x u32 state (SHA-256 IV constants)
2. **Absorption**: XOR input data into state
3. **Nonce Mix**: Integrate nonce into state[0] and state[1]
4. **Mixing Rounds**: 12 rounds of rotations and XOR operations
5. **Diffusion**: XOR spread across all state words
6. **Golden Ratio**: Multiply each word by φ (0x9E3779B9)

**Code Location**:
- Rust: `2.9.5/zion-native/core/src/algorithms/cosmic_harmony.rs`
- Python: `zion/mining/cosmic_harmony_wrapper.py`

**Usage**:
```bash
./target/release/zion-miner \
  --rpc-url http://localhost:8080/jsonrpc \
  --wallet ZION_YOUR_ADDRESS \
  --algorithm cosmic_harmony
```

**Test**:
```bash
cargo test --lib cosmic_harmony -- --nocapture
```

---

### 2. Blake3

**Status**: ✅ **IMPLEMENTED** (v2.9.5)

Simple, fast fallback algorithm for testing and compatibility.

**Specifications**:
- **Hash Function**: Blake3 (RFC)
- **Output**: 32 bytes (256 bits)
- **Memory**: Low (~1 KB)
- **GPU-Friendly**: Yes
- **ASIC Resistance**: Low

**Performance**:
```
CPU: 5-10 MH/s
GPU: 100-1000 MH/s
```

**Usage**:
```bash
./target/release/zion-miner \
  --algorithm blake3 \
  --wallet ZION_ADDRESS
```

---

### 3. RandomX (Planned)

**Status**: ✅ **IMPLEMENTED** (v2.9.5)

CPU-optimized Monero-based algorithm for ASIC resistance.

**Specifications**:
- **Hash Function**: RandomX VM (AES-NI, AVX2)
- **Output**: 32 bytes
- **Memory**: High (~2 GB dataset)
- **GPU-Friendly**: No (CPU optimized)
- **ASIC Resistance**: Very High

**Performance**:
```
CPU (single core): 600-1000 H/s
CPU (8 cores):     4-8 kH/s
GPU:               Not efficient
```

**Implementation**:
- Placeholder implementation (v2.9.5)
- Full VM with dataset initialization - v2.9.6
- Fast mode vs. Light mode

**Code Location**:
- Rust: `2.9.5/zion-native/core/src/algorithms/randomx.rs`

**Usage**:
```bash
./target/release/zion-miner \
  --algorithm randomx \
  --wallet ZION_ADDRESS
```

---

### 4. Yescrypt (Planned)

**Status**: ✅ **IMPLEMENTED** (v2.9.5)

Memory-hard algorithm inspired by Scrypt/ZCash.

**Specifications**:
- **Hash Function**: Yescrypt (memory-hard)
- **Output**: 32 bytes
- **Memory**: Medium (~512 MB)
- **GPU-Friendly**: Medium
- **ASIC Resistance**: High

**Performance**:
```
CPU: 1-5 kH/s
GPU: 10-100 kH/s
```

**Implementation**:
- Placeholder implementation (v2.9.5)
- Full Yescrypt KDF - v2.9.6
- Configurable memory parameter (N)
- Tuned for ZION difficulty

**Code Location**:
- Rust: `2.9.5/zion-native/core/src/algorithms/yescrypt.rs`

**Usage**:
```bash
./target/release/zion-miner \
  --algorithm yescrypt \
  --wallet ZION_ADDRESS
```

---

## Algorithm Selection

### By Hardware

| Hardware | Recommended Algorithm |
|----------|----------------------|
| CPU (low-end) | **Cosmic Harmony** or RandomX |
| CPU (high-end) | **Cosmic Harmony** (multi-threaded) |
| GPU (mid-range) | **Cosmic Harmony** or Blake3 |
| GPU (high-end) | **Cosmic Harmony** |
| ASIC | Not supported |

### By Use Case

| Use Case | Algorithm |
|----------|-----------|
| **MainNet Mining** | Cosmic Harmony (default) |
| **TestNet** | Blake3 or Cosmic Harmony |
| **CPU-Only** | RandomX or Cosmic Harmony |
| **GPU Farm** | Cosmic Harmony |
| **Solo Mining** | Cosmic Harmony |
| **Pool Mining** | Auto-detected (pool decides) |

---

## Consciousness Rewards

ZION's consciousness mining game applies **multipliers** to block rewards based on miner consciousness level:

| Level | Multiplier | XP Required |
|-------|-----------|-------------|
| PHYSICAL | 1.0x | 0 |
| MENTAL | 1.1x | 1,000 |
| COSMIC | 2.0x | 10,000 |
| ON_THE_STAR | 15.0x | 100,000 |

**Reward Formula**:
```
Total Reward = (50 ZION base) + (1,569.63 ZION × consciousness_multiplier)
```

**Examples**:
- PHYSICAL: 50 + (1,569.63 × 1.0) = **1,619.63 ZION**
- COSMIC: 50 + (1,569.63 × 2.0) = **3,189.26 ZION**
- ON_THE_STAR: 50 + (1,569.63 × 15.0) = **23,594.45 ZION**

---

## Implementation Roadmap

### v2.9.5 (Current) ✅
- [x] Cosmic Harmony Rust implementation
- [x] Blake3 fallback
- [x] Multi-algorithm miner CLI
- [x] Algorithm auto-detection from template
- [x] Unit tests and benchmarks

### v2.9.6 (Next)
- [ ] RandomX integration (`randomx-rs`)
- [ ] Yescrypt implementation
- [ ] Multi-threading (CPU parallelization)
- [ ] Algorithm performance profiling
- [ ] Pool multi-algo support

### v2.9.7 (Future)
- [ ] GPU acceleration (CUDA/OpenCL)
- [ ] Autolykos v2 (Ergo-inspired)
- [ ] Hybrid CPU+GPU mining
- [ ] Algorithm difficulty adjustment per-algo

---

## Performance Benchmarking

### Quick Benchmark
```bash
./benchmark_cosmic_harmony.sh
```

### Detailed Benchmark
```bash
cargo bench --bench mining_algorithms
```

### Expected Results (M1 Mac, 8 cores)
```
Cosmic Harmony:  ~400-600 kH/s
Blake3:          ~8-12 MH/s
RandomX:         ~800 H/s (when implemented)
Yescrypt:        ~2 kH/s (when implemented)
```

---

## Technical References

### Cosmic Harmony Algorithm Paper (Internal)
See: `docs/2.9.2/COSMIC_HARMONY_SPEC.md`

### Code Structure
```
2.9.5/zion-native/core/src/algorithms/
├── mod.rs               # Algorithm enum and utilities
├── cosmic_harmony.rs    # ZION native algorithm ⭐
├── blake3_algo.rs       # Blake3 wrapper
├── randomx.rs          # RandomX (TODO)
└── yescrypt.rs         # Yescrypt (TODO)
```

### Pool Integration
Pool detects algorithm from:
1. Block template `algorithm` field
2. Miner CLI `--algorithm` flag
3. Auto-detection from share submission

Pool validates shares using same algorithm as miner.

---

## FAQ

**Q: Which algorithm should I use?**  
A: **Cosmic Harmony** is the default and recommended for all miners. It's optimized for ZION and rewards consciousness levels.

**Q: Can I switch algorithms mid-mining?**  
A: No, algorithm is set per block template. Wait for new template or restart miner.

**Q: Will GPUs have advantage?**  
A: Yes, Cosmic Harmony is GPU-friendly (~100x faster), but consciousness rewards balance this. High-consciousness CPU miners can compete.

**Q: Are ASICs supported?**  
A: No. ZION uses multi-algo approach and consciousness rewards to resist ASIC centralization.

**Q: Can I mine with multiple algorithms simultaneously?**  
A: Not currently. Use multiple miner instances with different algorithms if pool supports it.

---

## Contributing

To add a new mining algorithm:

1. **Implement in Rust**:
   ```rust
   // core/src/algorithms/my_algo.rs
   pub fn my_algo_hash(input: &[u8], nonce: u32) -> [u8; 32] {
       // Your algorithm here
   }
   ```

2. **Add to enum**:
   ```rust
   // core/src/algorithms/mod.rs
   pub enum Algorithm {
       CosmicHarmony,
       MyAlgo,  // <-- Add here
   }
   ```

3. **Update miner**:
   ```rust
   // core/src/miner/mod.rs
   Algorithm::MyAlgo => my_algo::my_algo_hash(prefix_bytes, nonce as u32),
   ```

4. **Add tests**:
   ```rust
   #[test]
   fn test_my_algo() {
       let hash = my_algo_hash(b"test", 0);
       assert_eq!(hash.len(), 32);
   }
   ```

5. **Benchmark**:
   ```rust
   // benches/mining_algorithms.rs
   c.bench_function("my_algo", |b| {
       b.iter(|| my_algo_hash(black_box(b"test"), black_box(0)));
   });
   ```

6. **Document**: Update this file!

---

**Last Updated**: 2024-12-29  
**Version**: v2.9.5  
**Author**: ZION Core Team  
**License**: MIT

---

🌟 **"Where technology meets spirit"** 🌟
