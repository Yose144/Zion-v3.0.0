# DeekshaDebug - Algorithm Development & Testing

This directory contains the development and testing environment for DeekshaLite algorithms with energy and thermal optimizations.

## Overview

DeekshaDebug provides three implementations of the DeekshaLite algorithm:

1. **Standard DeekshaLite** - Reference implementation with 256 KiB scratchpad
2. **Energy-Optimized Lite** - Reduced memory operations for summer/low-power usage
3. **Thermal-Optimized Fire** - Enhanced thermal loop for winter/heating applications

## Build & Run

```bash
# Build all binaries
cargo build --release --manifest-path DeekshaDebug/Cargo.toml

# Run standard benchmark
cargo run --release --manifest-path DeekshaDebug/Cargo.toml --bin deeksha_lite_benchmark

# Run energy-optimized benchmark
cargo run --release --manifest-path DeekshaDebug/Cargo.toml --bin deeksha_lite_optimized_benchmark

# Run thermal-optimized benchmark
cargo run --release --manifest-path DeekshaDebug/Cargo.toml --bin deeksha_lite_fire_optimized_benchmark

# Compare all algorithms
cargo run --release --manifest-path DeekshaDebug/Cargo.toml --bin compare_all_algorithms
```

## Algorithm Specifications

### Standard DeekshaLite
- **Scratchpad**: 256 KiB (8192 blocks × 32B)
- **Random Reads**: 64
- **AES Rounds**: 4
- **Purpose**: Maximum ASIC resistance, reference implementation

### Energy-Optimized Lite
- **Scratchpad**: 128 KiB (4096 blocks × 32B)
- **Random Reads**: 32 (50% reduction)
- **AES Rounds**: 3 (25% reduction)
- **Purpose**: Summer mode, minimal power consumption

### Thermal-Optimized Fire
- **Scratchpad**: 128 KiB (4096 blocks × 32B)
- **Random Reads**: 32 (focus on thermal loop)
- **AES Rounds**: 3 (focus on thermal loop)
- **Thermal Loop**: 131,072 iterations (2x standard)
- **Thermal Chains**: 12 independent ulong chains
- **Purpose**: Winter mode, efficient heat generation

## Performance Results

| Algorithm | Throughput | Power Efficiency | Heat Output |
|-----------|------------|------------------|-------------|
| Standard | 308 H/s | Baseline | Baseline |
| Energy-Optimized | 626 H/s | 2.0x | 0.5x |
| Thermal-Optimized | 397 H/s | 1.3x | 2.0x |

## Use Cases

### Summer Mode (Energy Efficiency)
- Use Energy-Optimized Lite
- 103% faster than standard
- 50% less memory bandwidth
- Lower temperature operation

### Winter Mode (Heating)
- Use Thermal-Optimized Fire
- 2x thermal intensity
- Maximum ALU utilization
- Efficient heat generation

### Standard Mode (Compatibility)
- Use Standard DeekshaLite
- Full 256 KiB scratchpad
- Maximum ASIC resistance
- Reference implementation

## Integration with V3

The optimizations developed here can be ported to the main V3 codebase:

1. **V3/L1/cosmic-harmony/src/deeksha_lite.rs** - Standard implementation
2. **V3/L1/cosmic-harmony/src/deeksha_lite_fire.rs** - Fire implementation
3. **V3/L1/cosmic-harmony/src/gpu/kernels/** - OpenCL kernels

## Testing

All implementations include comprehensive tests:

- Deterministic hash verification
- Cross-algorithm hash differentiation
- Performance regression testing
- Self-test validation

## Future Development

1. **GPU Kernels**: Port optimizations to OpenCL/CUDA
2. **Automatic Switching**: Seasonal algorithm selection
3. **Power Monitoring**: Real-time power consumption tracking
4. **Thermal Management**: Temperature-based algorithm tuning
5. **ASIC Resistance**: Ongoing security analysis

## Files

- `src/deeksha_lite.rs` - Standard implementation
- `src/deeksha_lite_optimized.rs` - Energy-optimized version
- `src/deeksha_lite_fire_optimized.rs` - Thermal-optimized version
- `src/bin/compare_all_algorithms.rs` - Comprehensive comparison tool
- `src/bin/*_benchmark.rs` - Individual benchmark tools

---

*For production deployment, see V3/L1/cosmic-harmony/ for the main implementation.*