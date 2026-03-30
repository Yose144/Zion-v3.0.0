# ZION GPU Mining Setup
# RandomX GPU mining pro NVIDIA a AMD karty

## GPU Miner Options pro ZION RandomX

### 1. XMRig-CUDA (NVIDIA)
```bash
# Download: https://github.com/xmrig/xmrig-cuda/releases
# Build with RandomX support

git clone https://github.com/xmrig/xmrig-cuda.git
cd xmrig-cuda
mkdir build && cd build
cmake .. -DCUDA_ARCH="60;61;70;75;80;86"
make -j$(nproc)

# Usage:
./xmrig-cuda --url stratum+tcp://localhost:3333 \
  --user Z321nirFfsdGcAE8Loe1vzcZS9ztUvsTCYsYKYsncA63QqjqQyMnLiedvZSnniUsfE93Zdvu5tpkvC2qNVpDf4ot9q1UJUBMap \
  --pass gpu-cuda \
  --algo rx/0 \
  --cuda-devices=0,1,2,3 \
  --cuda-launch=32x128 \
  --cuda-affinity=0
```

### 2. XMRig-AMD (OpenCL)  
```bash
# AMD GPU support through OpenCL
xmrig --config=xmrig-zion-amd-gpu.json
```

### 3. SRBMiner-MULTI (AMD/NVIDIA)
```bash
# Download: https://github.com/doktor83/SRBMiner-Multi/releases
# Supports RandomX on AMD/NVIDIA

./SRBMiner-MULTI.exe --algorithm randomx \
  --pool localhost:3333 \
  --wallet Z321nirFfsdGcAE8Loe1vzcZS9ztUvsTCYsYKYsncA63QqjqQyMnLiedvZSnniUsfE93Zdvu5tpkvC2qNVpDf4ot9q1UJUBMap \
  --password gpu-srb \
  --gpu-boost 3 \
  --gpu-target-temperature 75 \
  --api-enable --api-port 21555
```

### 4. T-Rex Miner (NVIDIA - pokud podporuje RandomX)
```bash
./t-rex -a randomx \
  -o stratum+tcp://localhost:3333 \
  -u Z321nirFfsdGcAE8Loe1vzcZS9ztUvsTCYsYKYsncA63QqjqQyMnLiedvZSnniUsfE93Zdvu5tpkvC2qNVpDf4ot9q1UJUBMap \
  -p gpu-trex \
  --api-bind-http 0.0.0.0:4067
```

## Doporučené GPU nastavení pro RandomX:

### NVIDIA:
- GTX 1060+: 2-4 GB VRAM minimum
- RTX 20xx/30xx/40xx: Optimální pro RandomX
- Memory clock: +500-1000 MHz
- Core clock: Stabilní boost
- Power limit: 80-90%

### AMD:
- RX 580+: 4+ GB VRAM
- RX 6000/7000 series: Výborný výkon
- Memory timing: Tight timings
- Core voltage: Undervolt pro efektivitu

## Performance očekávání:
- CPU (8-core): ~2-8 KH/s
- NVIDIA RTX 3080: ~5-15 KH/s  
- AMD RX 6700 XT: ~4-12 KH/s
- Pool hashrate: Kombinovaný CPU+GPU

## Monitoring:
```bash
# Pool stats
curl localhost:8117/stats | jq

# XMRig API
curl localhost:16000/2/summary | jq

# GPU temperatures
nvidia-smi  # NVIDIA
rocm-smi    # AMD
```