# 🖥️ ZION GPU Mining Setup - Windows 11 + AMD RX 5600

## 📋 Hardware Specs

| Komponenta | Specifikace |
|------------|-------------|
| **OS** | Windows 11 |
| **GPU** | AMD Radeon RX 5600 (XT) |
| **VRAM** | **6 GB GDDR6** |
| **Architecture** | RDNA 1 (Navi 10) |
| **Compute Units** | 36 CUs |
| **Stream Processors** | 2304 |

## ✅ DAG Compatibility

| Algorithm | DAG Size | RX 5600 (6GB) | Status |
|-----------|----------|---------------|--------|
| **KawPow (RVN)** | 5.38 GB | ✅ FITS! | Ready |
| **Ethash (ETC)** | ~5 GB | ✅ FITS! | Ready |
| **Etchash** | ~3 GB | ✅ FITS! | Ready |
| **kHeavyHash** | 256 KB | ✅ FITS! | Ready |
| **Cosmic Harmony** | 64 KB | ✅ FITS! | Ready |

---

## 🛠️ Setup Plan

### Phase 1: Environment Setup (30 min)

#### 1.1 Install Python 3.11+
```powershell
# Download from python.org or use winget
winget install Python.Python.3.11

# Verify
python --version
```

#### 1.2 Install AMD GPU Drivers + OpenCL
```powershell
# Download latest Adrenalin drivers from AMD.com
# Ensure OpenCL is enabled in driver settings

# Verify OpenCL
pip install pyopencl
python -c "import pyopencl as cl; print([d.name for p in cl.get_platforms() for d in p.get_devices()])"
```

#### 1.3 Clone ZION Repository
```powershell
cd C:\Dev
git clone https://github.com/Yose144/Zion-2.9.git
cd Zion-2.9

# Create virtual environment
python -m venv .venv
.\.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install pyopencl kawpow ethash
```

---

### Phase 2: KawPow GPU Mining (Primary Target)

#### 2.1 Option A: Use kawpowminer Binary (Fastest)
```powershell
# Download from releases
# https://github.com/RavenCommunity/kawpowminer/releases

# Extract to C:\miners\kawpowminer

# Test against RVN pool
kawpowminer.exe -P stratum+tcp://YOUR_WALLET.worker@stratum.ravenminer.com:3838
```

#### 2.2 Option B: ZION Native Miner with GPU
```powershell
# Run ZION miner with GPU backend
cd C:\Dev\Zion-2.9
python zion_native_miner_v2_9.py --pool rvn.2miners.com:6060 --wallet YOUR_RVN_ADDRESS --algo kawpow --gpu
```

#### 2.3 Option C: Build kawpowminer from Source
```powershell
# Install prerequisites
winget install Kitware.CMake
winget install Microsoft.VisualStudio.2022.BuildTools

# Clone and build
git clone https://github.com/RavenCommunity/kawpowminer.git
cd kawpowminer
mkdir build && cd build
cmake .. -G "Visual Studio 17 2022" -A x64 -DETHASHCUDA=OFF -DETHASHCL=ON
cmake --build . --config Release
```

---

### Phase 3: DAG Generation on GPU

#### 3.1 Create DAG Generator Script
```python
# File: src/miner/dag_generator_gpu.py

import pyopencl as cl
import numpy as np
from pathlib import Path

class DAGGeneratorGPU:
    """Generate Ethash/KawPow DAG on AMD GPU"""
    
    EPOCH_LENGTH = 7500  # KawPow
    DAG_INIT_SIZE = 1 << 30  # 1 GB
    DAG_GROWTH = 1 << 23  # 8 MB per epoch
    
    def __init__(self):
        # Find AMD GPU
        for platform in cl.get_platforms():
            if 'AMD' in platform.name:
                devices = platform.get_devices(device_type=cl.device_type.GPU)
                if devices:
                    self.device = devices[0]
                    self.ctx = cl.Context([self.device])
                    self.queue = cl.CommandQueue(self.ctx)
                    print(f"✅ Using: {self.device.name}")
                    print(f"   VRAM: {self.device.global_mem_size / 1024**3:.1f} GB")
                    return
        raise RuntimeError("No AMD GPU found!")
    
    def calculate_dag_size(self, epoch: int) -> int:
        """Calculate DAG size for epoch"""
        return self.DAG_INIT_SIZE + self.DAG_GROWTH * epoch
    
    def generate_dag(self, epoch: int, seed_hash: bytes) -> np.ndarray:
        """Generate full DAG on GPU"""
        dag_size = self.calculate_dag_size(epoch)
        print(f"Generating DAG for epoch {epoch}")
        print(f"  Size: {dag_size / 1024**3:.2f} GB")
        
        # 1. Generate light cache (CPU)
        light_cache = self._generate_light_cache(epoch, seed_hash)
        
        # 2. Upload light cache to GPU
        light_buffer = cl.Buffer(
            self.ctx, cl.mem_flags.READ_ONLY | cl.mem_flags.COPY_HOST_PTR,
            hostbuf=light_cache
        )
        
        # 3. Allocate DAG on GPU
        dag_buffer = cl.Buffer(
            self.ctx, cl.mem_flags.READ_WRITE,
            size=dag_size
        )
        
        # 4. Run DAG generation kernel
        # (Use kernel from kawpowminer/ethminer)
        
        return dag_buffer
```

#### 3.2 Pre-generated DAG Cache
```python
# Cache DAGs locally for faster startup
DAG_CACHE_DIR = Path("C:/ZionDAGs")

def get_or_generate_dag(epoch: int) -> Path:
    dag_path = DAG_CACHE_DIR / f"dag_epoch_{epoch}.bin"
    if dag_path.exists():
        print(f"Loading cached DAG: {dag_path}")
        return dag_path
    
    # Generate and save
    generator = DAGGeneratorGPU()
    dag = generator.generate_dag(epoch, calculate_seed_hash(epoch))
    
    dag_path.parent.mkdir(parents=True, exist_ok=True)
    with open(dag_path, 'wb') as f:
        f.write(dag)
    
    return dag_path
```

---

### Phase 4: Integration with ZION Pool

#### 4.1 Pool Connection
```python
# Connect to ZION pool or external RVN pool
POOLS = {
    'zion': 'stratum+tcp://pool.zionterranova.com:3333',
    'rvn_2miners': 'stratum+tcp://rvn.2miners.com:6060',
    'rvn_flypool': 'stratum+tcp://stratum-ravencoin.flypool.org:3333',
}
```

#### 4.2 Benchmark Script
```python
# File: benchmark_gpu_kawpow.py

import time
from dag_generator_gpu import DAGGeneratorGPU

def benchmark():
    gen = DAGGeneratorGPU()
    
    # Current RVN epoch
    epoch = 560
    
    print(f"=== KawPow GPU Benchmark (RX 5600) ===")
    print(f"Epoch: {epoch}")
    print(f"DAG Size: {gen.calculate_dag_size(epoch) / 1024**3:.2f} GB")
    
    # Generate DAG
    start = time.time()
    dag = gen.generate_dag(epoch, bytes(32))
    dag_time = time.time() - start
    print(f"DAG Generation: {dag_time:.1f}s")
    
    # Mining benchmark
    # ... hash rate test ...

if __name__ == "__main__":
    benchmark()
```

---

## 📊 Expected Performance

| Algorithm | RX 5600 Expected | Notes |
|-----------|------------------|-------|
| **KawPow** | 12-14 MH/s | Typical for RDNA 1 |
| **Ethash** | 28-32 MH/s | Memory limited |
| **kHeavyHash** | 400-500 MH/s | Compute bound |

---

## 🔧 Troubleshooting

### OpenCL Not Found
```powershell
# Install AMD OpenCL SDK
# Or ensure Adrenalin drivers include OpenCL

# Check with clinfo
winget install GPUOpen.clinfo
clinfo
```

### DAG Won't Fit
```
Error: DAG allocation failed

Solution: Close other GPU apps, reduce Windows GPU memory usage
Settings > System > Display > Graphics > Change default graphics settings
→ Disable Hardware-accelerated GPU scheduling (temporarily)
```

### Low Hashrate
```
1. Update AMD drivers to latest
2. Enable Compute Mode in Adrenalin
3. Increase Power Limit to +10-20%
4. Tune memory timings (careful!)
```

---

## 📁 File Structure for W11

```
C:\Dev\Zion-2.9\
├── .venv\                      # Python virtual environment
├── src\miner\
│   ├── kawpow_hybrid_miner.py  # Existing
│   ├── dag_generator_gpu.py    # NEW - GPU DAG generation
│   └── benchmark_gpu.py        # NEW - Benchmarking
├── config\
│   └── miner_config_w11.json   # Windows-specific config
└── external\gpu-miners\        # Reference miners (gitignored)
    └── kawpowminer\
```

---

## 🚀 Quick Start Commands (Copy-Paste)

```powershell
# === ONE-TIME SETUP ===
cd C:\Dev
git clone https://github.com/Yose144/Zion-2.9.git
cd Zion-2.9
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
pip install pyopencl kawpow

# === DAILY MINING ===
cd C:\Dev\Zion-2.9
.\.venv\Scripts\activate
python zion_native_miner_v2_9.py --algo kawpow --gpu --pool rvn.2miners.com:6060 --wallet YOUR_RVN_ADDRESS
```

---

## ✅ Checklist

- [ ] Install Python 3.11+
- [ ] Install AMD Adrenalin drivers (latest)
- [ ] Verify OpenCL works (`pyopencl` test)
- [ ] Clone ZION repository
- [ ] Install dependencies
- [ ] Test with kawpowminer binary first
- [ ] Run ZION native miner with GPU
- [ ] Benchmark and optimize

---

**Created**: 20. ledna 2026  
**Target Hardware**: Windows 11 + AMD RX 5600 (6GB)  
**Primary Algorithm**: KawPow (Ravencoin)
