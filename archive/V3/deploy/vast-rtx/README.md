# vast.ai RTX GPU Mining Setup

## Quick Start

1. Find cheapest RTX 3090/4090:
```bash
vastai search offers 'gpu_name=RTX_3090 rentable=true' --order 'dph_total' --limit 5
```

2. Create instance:
```bash
vastai create instance <OFFER_ID> --image nvidia/cuda:12.4.0-runtime-ubuntu22.04 --disk 50 --ssh
```

3. SSH in and run setup:
```bash
ssh -i ~/.ssh/vast_hiran_key -p <PORT> root@sshN.vast.ai
```

4. Install deps + build:
```bash
apt-get update && apt-get install -y curl build-essential pkg-config \
    ocl-icd-opencl-dev opencl-headers ocl-icd-libopencl1 libssl-dev git
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source ~/.cargo/env
git clone https://github.com/Yose144/Zion-v3.0.0.git /root/repo
cd /root/repo/V3
cargo build --release -p zion-miner --features "gpu-opencl,native-randomx,native-kheavyhash,native-verushhash,native-hashers"
```

5. Install NVIDIA OpenCL ICD (if not present):
```bash
apt-get install -y nvidia-opencl-dev
mkdir -p /etc/OpenCL/vendors
echo "libnvidia-opencl.so.1" > /etc/OpenCL/vendors/nvidia.icd
```

6. Run trinity mining:
```bash
ZION_AUTOTUNE=0 ZION_GPU_WORK_SIZE=8192 ZION_GPU_MEM_BUDGET_MIB=4096 \
./target/release/zion-miner \
  --pool 62.171.141.136:8444 \
  --wallet zion1s6m204400290l660k622r3r0c6u040g5j6cu2x5 \
  --worker vast-rtx3090 \
  --algorithm deeksha_lite_fire \
  --gpu opencl \
  --loops 999 \
  --no-tui
```

## Benchmark Results

| GPU | Algorithm | Hashrate | Backend | Cost |
|-----|-----------|----------|---------|------|
| RTX 3090 (24GB) | deeksha_lite_fire | ~1.64 KH/s | OpenCL | $0.12/hr |
| RTX 4090 (24GB) | deeksha_lite_fire | ~2.0 KH/s (est) | OpenCL | $0.27/hr |
| Apple M1 (8GB) | deeksha_lite_fire | 2.74 KH/s | Metal | (local) |

## Notes

- NVIDIA RTX supports OpenCL 3.0 — use `--gpu opencl` (not `--gpu cuda`)
- CUDA backend only has `cosmic_harmony_deeksha` kernel (v2), not `deeksha_lite_fire`
- For CUDA `deeksha_lite_fire` support, port `deeksha_lite_fire.cl` → `.cu` (TODO)
- CPU fallback for external algos (kheavyhash, blake3) works on both Metal and CUDA
- Triple-stream: ZION GPU + KAS GPU (CPU fallback) + RTM CPU (GhostRider)
