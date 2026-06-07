# Zion Miner Setup (GPU)

## W11 Local AMD GPU Miner

Pre-built binary: `V3/target/release/zion-miner.exe` (compile with `--features gpu-opencl`)

Quick-start scripts located at: `V3/deploy/local-miner/`

### PowerShell (recommended)
```powershell
 cd V3\deploy\local-miner
 .\start-w11-gpu-miner.ps1
```

### Command Prompt
```batch
 cd V3\deploy\local-miner
 start-w11-gpu-miner.bat
```

### Manual
```
set ZION_POOL_ADDR=77.42.71.94:8444
set ZION_MINER_ID=w11-amd-gpu-miner-01
set ZION_WORKER_NAME=worker1
set ZION_LOOP_COUNT=1000000
set ZION_GPU_BACKEND=opencl
set ZION_PAYOUT_ADDRESS=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790

zion-miner.exe --gpu opencl --pool 77.42.71.94:8444 --wallet zion1w523a76830x2t5m7f3j023w265e8g5c400a4790 --worker worker1 --loops 1000000
```

---

## SMOS (SimpleMining OS) Vega 64 GPU Miner

### Download URL
```
https://zionterranova.com/zion-miner/zion-miner-v3.0.18-gpu.zip
```

### Contents
- `miner` — Linux AMD64 binary with OpenCL support
- `zion-wrapper.sh` — wrapper script that sets `ZION_GPU_BACKEND=opencl`

### SMOS Dashboard Setup
1. Go to **Rig Config** → **Custom Miner**
2. Upload `zion-miner-v3.0.18-gpu.zip`
3. Set **Miner Path**: `/home/miner/zion-miner/zion-wrapper.sh`
4. Set **Miner Options**:
   ```
   --pool 77.42.71.94:8444 --wallet zion1w2z3l0q2x5e3q752d3v8k5k3u366j5j3t79n5w3 --worker vega-smos --gpu opencl --loops 1000000
   ```
5. Save and reload miner

### Environment variables (optional, can be set in wrapper)
- `ZION_GPU_BACKEND=opencl`
- `ZION_LOOP_COUNT=1000000`
- `ZION_IGNORE_S4_MEMHARD_MISMATCH=1`

---

## Pool Settings (Edge)

| Variable | Value |
|----------|-------|
| Pool Address | `77.42.71.94:8444` |
| Algorithm | `deeksha_lite_v1` |
| NONCE_COUNT | `262144` |
| NONCE_STRIDE | `262144` |
| LOOP_COUNT | `1000000` |

---

## Build from source (if needed)

### Linux (Edge server)
```bash
cd /root/zion-2.9.6-main
cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl
```

### Windows (local)
```powershell
cd V3
cargo build --release -p zion-miner --features gpu-opencl
```
