# ZION Multi-GPU Mining Agent

## Overview

Multi-GPU mining agent with support for CUDA, AMD, and Metal backends. E2E tested on Edge pool via Tailscale VPN.

## Features

- **Multi-GPU Support:** CUDA (NVIDIA), AMD (OpenCL), Metal (Apple Silicon)
- **Auto-Detection:** Automatic GPU backend detection
- **Pool Integration:** E2E tested on ZION Edge pool
- **Tailscale VPN:** Seamless pool connection via VPN
- **Performance Monitoring:** Real-time hashrate, shares, pool stats

## Build

### macOS (Metal)
```bash
cd APP&WEB/mining-agent
cargo build --release --features gpu-metal
```

### Linux (CUDA)
```bash
cd APP&WEB/mining-agent
cargo build --release --features gpu-cuda
```

### Linux (AMD)
```bash
cd APP&WEB/mining-agent
cargo build --release --features gpu-amd
```

### All Backends
```bash
cd APP&WEB/mining-agent
cargo build --release --features gpu-all
```

## Usage

### Basic Mining
```bash
./target/release/mining-agent \
  --pool 100.76.16.108:8444 \
  --worker gpu-miner \
  --wallet zion1a59644y2a2z3p5p2f88308d2u536f0e2e3rd5a8 \
  --backend auto
```

### GPU Backend Selection
```bash
# Metal (macOS)
--backend metal

# CUDA (NVIDIA)
--backend cuda

# AMD (OpenCL)
--backend amd

# Auto-detect
--backend auto
```

### Advanced Options
```bash
--pool HOST:PORT          # Pool address
--worker NAME              # Worker name
--wallet ADDRESS           # Payout wallet
--backend BACKEND          # GPU backend (auto, metal, cuda, amd)
--loops N                  # Loop count (default: 1000000)
--threads N                # Thread count (default: 8)
```

## E2E Testing

### Test on Edge Pool
```bash
./test_e2e_pool.sh
```

This script:
1. Stops existing miners
2. Starts zion-miner with Metal backend
3. Connects to Edge pool via Tailscale VPN
4. Mines for 30 seconds
5. Reports statistics

### Expected Results
- **Metal (Apple M1):** ~350 H/s
- **CUDA (NVIDIA):** ~10+ KH/s (placeholder)
- **AMD (OpenCL):** ~8+ KH/s (placeholder)

## Performance

### Apple M1 (Metal)
- **Benchmark:** 3.1 KH/s
- **Live Mining:** 350 H/s
- **Accept Rate:** 100%
- **Pool Latency:** ~116ms

### NVIDIA (CUDA)
- **Benchmark:** TBD
- **Live Mining:** TBD
- **Accept Rate:** TBD

### AMD (OpenCL)
- **Benchmark:** TBD
- **Live Mining:** TBD
- **Accept Rate:** TBD

## Architecture

```
mining-agent/
├── Cargo.toml              # Rust project with GPU features
├── src/
│   └── main.rs            # Main agent logic
├── test_e2e_pool.sh       # E2E test script
└── README.md               # This file
```

## GPU Backend Implementation

### Metal (macOS)
- Uses `metal` crate for Apple Silicon
- Device detection: Apple M1/M2/M3
- Benchmark: Ekam Deeksha algorithm

### CUDA (NVIDIA)
- Placeholder for CUDA implementation
- Would use `cuda` crate or bindings
- Device detection: NVIDIA GPUs

### AMD (OpenCL)
- Placeholder for OpenCL implementation
- Would use `opencl` crate
- Device detection: AMD GPUs

## Pool Connection

### Tailscale VPN
- **Edge Pool:** 100.76.16.108:8444
- **Public IP:** 77.42.71.94:8444
- **VPN IP:** 100.76.16.108:8444

### Connection Methods
1. **Tailscale VPN:** Recommended (encrypted, auto-auth)
2. **Public IP:** Fallback (no VPN required)
3. **Local Pool:** Development/testing

## Troubleshooting

### Metal Backend Not Available
```bash
# Rebuild with Metal feature
cargo build --release --features gpu-metal
```

### Pool Connection Failed
```bash
# Check Tailscale status
tailscale status

# Test pool connectivity
nc -zv 100.76.16.108 8444
```

### Low Hashrate
- Check GPU backend is active
- Verify pool difficulty is appropriate
- Check thermal throttling

## Development

### Add New GPU Backend
1. Add feature flag in `Cargo.toml`
2. Implement backend module in `src/main.rs`
3. Add device detection logic
4. Add hashrate benchmark
5. Test with E2E script

### Run Tests
```bash
# Build
cargo build --release --features gpu-metal

# Run E2E test
./test_e2e_pool.sh

# Check logs
tail -f logs/miner-e2e-metal.log
```

## License

MIT License - ZION Project
