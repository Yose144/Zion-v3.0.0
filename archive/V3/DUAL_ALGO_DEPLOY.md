# Dual-Algo Deployment Guide — DeekshaLite v1

## Summary

V3 now supports dual-algo mining: the pool signals the algorithm per job, and the miner routes to the correct backend.

- **cosmic_harmony_ekam_deeksha_v2** (default): Full pipeline with NPU Mix + Cosmic Fusion
- **deeksha_lite_v1**: Simplified GCN-friendly pipeline (no NPU, no Cosmic Fusion)

## Components Changed

| Component | Change |
|-----------|--------|
| `zion-core` | `BlockCandidate::hash_with_algorithm()` for dual-algo hash routing |
| `zion-pool` | `ServerConfig.algorithm` env var, dual-algo hello validation, job signalling, share validation |
| `zion-miner` | `MinerConfig.algorithm` env var, dual-algo hello, CPU scanner routing, GPU backend routing |
| `zion-cosmic-harmony` | `deeksha_lite.rs` module + `deeksha_lite.cl` OpenCL kernel |
| `gpu_backend.rs` | New `opencl_deeksha_lite` module with simplified OpenCL miner |

## Environment Variables

### Pool
```bash
# Default: uses consensus_profile() (cosmic_harmony_ekam_deeksha_v2)
ZION_POOL_ALGORITHM=deeksha_lite_v1
```

### Miner
```bash
# Default: "deeksha_lite_v1" (for SMOS rigs without env vars)
# Override for testing cosmic_harmony:
ZION_MINER_ALGORITHM=cosmic_harmony_ekam_deeksha_v2
```

## SMOS Deployment

### Step 1: Update miner URL
In SMOS dashboard, set custom miner URL to:
```
https://zionterranova.com/zion-miner/zion-sm3033.zip
```

### Step 2: Restart rig
SMOS will download the new zip and start the miner.

### Step 3: Set pool algorithm (when ready to test)
On Edge server:
```bash
ssh root@77.42.71.94
sed -i '/ZION_POOL_ALGORITHM/d' /etc/systemd/system/zion-edge-pool.service
echo 'Environment="ZION_POOL_ALGORITHM=deeksha_lite_v1"' >> /etc/systemd/system/zion-edge-pool.service
systemctl daemon-reload
systemctl restart zion-edge-pool.service
```

## Switching Back to Cosmic Harmony

### Pool
```bash
sed -i '/ZION_POOL_ALGORITHM/d' /etc/systemd/system/zion-edge-pool.service
systemctl daemon-reload
systemctl restart zion-edge-pool.service
```

### Miner (local dev)
```bash
ZION_MINER_ALGORITHM=cosmic_harmony_ekam_deeksha_v2 cargo run --release -p zion-miner
```

## Testing Locally

### Pool with DeekshaLite
```bash
ZION_POOL_ALGORITHM=deeksha_lite_v1 cargo run --release -p zion-pool --bin server
```

### Miner with DeekshaLite
```bash
ZION_MINER_ALGORITHM=deeksha_lite_v1 cargo run --release -p zion-miner
```

## OpenCL DeekshaLite Backend

The new `opencl_deeksha_lite` module provides:
- GCN-safe kernel (no pointer casts, no NPU buffers)
- 256 KiB scratchpad per thread
- AES-128 CTR mixing
- Automatic CPU fallback if OpenCL init fails

## Known Issues

1. **GLIBC mismatch**: Edge server builds with GLIBC 2.43. SMOS rigs may need older glibc.
   - Workaround: The miner is built statically where possible; wrapper script handles env vars.

2. **GPU vs CPU hash mismatch**: The DeekshaLite kernel is deterministic, so GPU and CPU hashes should match exactly.

## Files Changed

- `V3/L1/core/src/lib.rs`
- `V3/L1/cosmic-harmony/src/lib.rs`
- `V3/L1/cosmic-harmony/src/deeksha_lite.rs`
- `V3/L1/cosmic-harmony/src/gpu/kernels/deeksha_lite.cl`
- `V3/L1/cosmic-harmony/src/gpu/opencl_kernel.rs`
- `V3/L1/miner/src/main.rs`
- `V3/L1/miner/src/parallel.rs`
- `V3/L1/miner/src/gpu_backend.rs`
- `V3/L1/pool/src/bin/server.rs`
