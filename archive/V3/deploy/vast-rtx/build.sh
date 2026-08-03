#!/bin/bash
set -e

cd /workspace/V3

echo "=== Building zion-miner for Linux x86_64 with OpenCL ==="
cargo build --release -p zion-miner --features "gpu-opencl,native-randomx,native-kheavyhash,native-verushash,native-hashers" 2>&1 | tail -20

echo "=== Build complete ==="
ls -la target/release/zion-miner

echo "=== Checking OpenCL availability ==="
nvidia-smi 2>/dev/null | head -5 || echo "no nvidia-smi"
ls /etc/OpenCL/vendors/ 2>/dev/null || echo "no OpenCL vendors"

echo "=== Running benchmark ==="
ZION_AUTOTUNE=0 \
ZION_GPU_WORK_SIZE=8192 \
./target/release/zion-miner \
  --pool 62.171.141.136:8444 \
  --wallet zion1s6m204400290l660k622r3r0c6u040g5j6cu2x5 \
  --worker vast-rtx4090 \
  --algorithm deeksha_lite_fire \
  --gpu opencl \
  --loops 60 \
  --no-tui 2>&1
