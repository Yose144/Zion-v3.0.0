# ZION Native 2.9 - GPU Autolykos v2 Mining

## 🚀 Quick Start

### 1. Check GPU Availability

```powershell
python zion_gpu_autolykos_miner.py --list-gpus
```

### 2. Run Benchmark

```powershell
# 30-second benchmark
python zion_gpu_autolykos_miner.py --benchmark --duration 30

# Use specific GPU
python zion_gpu_autolykos_miner.py --benchmark --gpu 0 --duration 60
```

### 3. Solo Mining (Test)

```powershell
python zion_gpu_autolykos_miner.py --solo --gpu 0 --target-bits 50
```

### 4. Pool Mining

```powershell
python zion_gpu_autolykos_miner.py --pool localhost:3333 --wallet YOUR_ZION_ADDRESS --gpu 0
```

## 📊 Expected Performance

### AMD GPUs
- **RX 5600 XT**: 1.5-2.5 MH/s @ 120W
- **RX 6600 XT**: 2.0-3.0 MH/s @ 130W
- **RX 7600**: 2.5-3.5 MH/s @ 140W

### NVIDIA GPUs
- **RTX 3060**: 2.0-3.5 MH/s @ 130W
- **RTX 3070**: 3.5-5.0 MH/s @ 150W
- **RTX 4060**: 3.0-4.5 MH/s @ 120W

## 🔧 Installation

### Prerequisites

```powershell
# Install Python 3.8+
# Download from https://www.python.org/

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate

# Install dependencies
pip install numpy pyopencl
```

### Optional: Native Libraries

For maximum performance, compile native C/C++ libraries:

```powershell
# See mining/native/BUILD.md for instructions
cd mining\native
gcc -O3 -march=native -shared -o autolykos.dll autolykos_v2_native.c
```

## 🎯 Architecture

```
zion_gpu_autolykos_miner.py          # Main entry point
│
├── mining/
│   ├── gpu_autolykos_v2_engine.py   # GPU mining engine (OpenCL/CUDA)
│   ├── native_autolykos_wrapper.py  # Python wrapper for native libs
│   │
│   └── native/
│       ├── autolykos_v2_native.c    # CPU implementation (C)
│       ├── autolykos_v2_cuda.cu     # CUDA kernel (NVIDIA)
│       ├── autolykos_v2_opencl.c    # OpenCL wrapper (AMD/NVIDIA)
│       └── BUILD.md                 # Build instructions
│
└── zion_native_miner_v2_9.py        # Unified CPU+GPU miner
```

## 💡 Features

### ✅ Implemented
- [x] OpenCL backend (AMD/NVIDIA/Intel)
- [x] CUDA backend (NVIDIA)
- [x] Multi-GPU detection
- [x] Native C/C++ acceleration
- [x] Auto-tuning
- [x] Real-time stats
- [x] Benchmark mode
- [x] Solo mining

### 🚧 In Progress
- [ ] Stratum pool protocol
- [ ] Multi-GPU concurrent mining
- [ ] Auto-overclock/undervolt
- [ ] Web dashboard

## 🛠️ Advanced Options

### Custom Batch Size

```powershell
# Smaller batch for low VRAM (< 4GB)
python zion_gpu_autolykos_miner.py --solo --batch-size 250000

# Larger batch for high VRAM (8GB+)
python zion_gpu_autolykos_miner.py --solo --batch-size 1000000
```

### Stats Interval

```powershell
# Update stats every 5 seconds
python zion_gpu_autolykos_miner.py --solo --stats-interval 5
```

### Disable Native Acceleration

```powershell
# Use pure Python (slower)
python zion_gpu_autolykos_miner.py --solo --no-native
```

## 🐛 Troubleshooting

### "PyOpenCL not available"

**AMD GPUs:**
```powershell
# Install AMD drivers
# Download from https://www.amd.com/en/support

# Install PyOpenCL
pip install pyopencl
```

**NVIDIA GPUs:**
```powershell
# Install NVIDIA drivers + CUDA Toolkit
# Download from https://developer.nvidia.com/cuda-downloads

# Install PyOpenCL
pip install pyopencl
```

### "No GPU devices found"

1. Verify GPU drivers installed: `nvidia-smi` or AMD Radeon Software
2. Check OpenCL installation: `python -c "import pyopencl as cl; print(cl.get_platforms())"`
3. Ensure GPU is not being used by another miner

### "CUDA not available"

CUDA is optional. OpenCL will be used automatically for AMD GPUs.

For NVIDIA GPUs, install CUDA Toolkit 11.0+ for best performance.

### Low Hashrate

1. Check GPU utilization (should be 95%+)
2. Increase batch size: `--batch-size 1000000`
3. Close other GPU applications
4. Update GPU drivers
5. Check GPU temperature (< 80°C)

## 📈 Optimization Tips

### Memory Optimization
- Autolykos v2 requires 2GB+ VRAM
- Reduce batch size if running out of memory
- Close GPU-heavy applications

### Power Efficiency
- Undervolt GPU for better efficiency
- Autolykos is memory-bound, not core-bound
- Target 70-80% power limit for best W/MH

### Multi-GPU
- Run separate process per GPU
- Use `--gpu 0`, `--gpu 1`, etc.
- Future: built-in multi-GPU support

## 📝 Example Session

```powershell
PS C:\Zion-2.9> python zion_gpu_autolykos_miner.py --list-gpus

================================================================================
Available GPU Devices:
================================================================================

GPU 0: AMD Radeon RX 5600 XT (6144MB, 36 CUs)
  Backend: opencl
  Platform: AMD Accelerated Parallel Processing
  Memory: 6144 MB
  Compute Units: 36
  Max Work Group: 256

================================================================================

PS C:\Zion-2.9> python zion_gpu_autolykos_miner.py --benchmark --duration 30

================================================================================
🏁 GPU Benchmark - 30.0s
================================================================================
  [30.0s] 2.35 MH/s

📊 Benchmark Results:
  Duration: 30.12s
  Total Hashes: 70,800,000
  Hashrate: 2.35 MH/s
  Batches: 142
  Backend: opencl
  Power (est.): 145W
  Efficiency: 16206 H/W
================================================================================
```

## 🤝 Support

For issues or questions:
- GitHub Issues: [project repository]
- Discord: [community server]
- Documentation: `/docs/GPU_MINING.md`

## ⚡ Performance Tuning

See [mining/native/BUILD.md](mining/native/BUILD.md) for:
- Native library compilation
- CUDA optimization flags
- OpenCL tuning parameters
