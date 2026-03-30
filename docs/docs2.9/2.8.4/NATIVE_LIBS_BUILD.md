# ZION v2.8.4 - Native Libraries Build Guide

> 📋 **Optional Performance Optimization**  
> All algorithms work with **Python fallbacks** (SHA3-256, PBKDF2, Blake2b) by default.  
> Native libraries provide **10-100x speedup** for production mining.

---

## 🎯 Quick Summary

| Algorithm | Python Fallback | Native Library | Speedup | Build Difficulty |
|-----------|----------------|----------------|---------|------------------|
| **Cosmic Harmony** | ✅ Built-in | C++ (required) | 50-100x | ⭐⭐⭐ Medium |
| **RandomX** | SHA3-256 chain | pyrx / librandomx | 10-50x | ⭐⭐⭐⭐ Hard |
| **Yescrypt** | PBKDF2-HMAC | libyescrypt | 5-20x | ⭐⭐ Easy |
| **Autolykos v2** | Blake2b mixing | pyautolykos2 | 10-30x | ⭐⭐⭐ Medium |

---

## 1️⃣ Cosmic Harmony (Required for Production)

### Build Steps (Linux/macOS)

```bash
cd zion/mining/

# Compile C++ library with optimizations
g++ -shared -fPIC -O3 -march=native -fopenmp \
    cosmic_harmony.cpp \
    -o libcosmicharmony.so

# Verify library
python3 -c "from cosmic_harmony_wrapper import get_hasher; print('✅ Cosmic Harmony ready')"
```

### Build Steps (Windows)

```powershell
# Using MSVC
cl /LD /O2 /GL cosmic_harmony.cpp /link /OUT:libcosmicharmony.dll

# Or using MinGW
g++ -shared -O3 cosmic_harmony.cpp -o libcosmicharmony.dll
```

### Troubleshooting

- **Error: OpenMP not found**
  ```bash
  # Install on Ubuntu/Debian
  sudo apt-get install libomp-dev
  
  # Install on macOS
  brew install libomp
  export LDFLAGS="-L/opt/homebrew/opt/libomp/lib"
  export CPPFLAGS="-I/opt/homebrew/opt/libomp/include"
  ```

- **Performance Issues**
  - Use `-march=native` for CPU-specific optimizations
  - Enable `-O3` (not just `-O2`)
  - Check OpenMP thread count: `export OMP_NUM_THREADS=8`

---

## 2️⃣ RandomX (Optional - CPU Mining)

### Option A: Python Package (Recommended)

```bash
# Install pyrx (Python bindings)
pip install pyrx==0.2.0

# Verify
python3 -c "import pyrx; print('✅ pyrx installed')"
```

### Option B: Build from Source

```bash
# Clone RandomX repository
git clone https://github.com/tevador/RandomX.git
cd RandomX

# Build library
mkdir build && cd build
cmake -DARCH=native ..
make -j$(nproc)

# Install
sudo make install
sudo ldconfig  # Update library cache

# Create Python bindings (manual)
cd ../..
export LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH
```

### Verify RandomX Availability

```python
from src.core.algorithms import is_available

if is_available('randomx'):
    print("✅ Native RandomX ready")
else:
    print("⚠️ Using SHA3-256 fallback (10-50x slower)")
```

### Performance Tuning

- **Large Pages**: Reduce TLB misses
  ```bash
  # Linux: Enable huge pages
  sudo sysctl -w vm.nr_hugepages=1280
  
  # Verify
  cat /proc/meminfo | grep HugePages
  ```

- **Full Memory Mode**: 2GB dataset (slower init, faster hashing)
  ```python
  from src.core.algorithms import get_hash
  # Full mem mode auto-detected if available
  ```

---

## 3️⃣ Yescrypt (Optional - CPU Mining)

### Build from Source

```bash
# Clone Yescrypt repository
git clone https://github.com/openwall/yescrypt.git
cd yescrypt

# Build shared library
make
gcc -shared -fPIC -O3 yescrypt-best.c sha256.c -o libyescrypt.so

# Install
sudo cp libyescrypt.so /usr/local/lib/
sudo ldconfig
```

### Python Bindings (Optional)

```bash
# Create Python wrapper (if not exists)
cat > yescrypt_wrapper.py << 'EOF'
import ctypes
import os

lib = ctypes.CDLL('/usr/local/lib/libyescrypt.so')

def yescrypt_hash(data: bytes, salt: bytes) -> bytes:
    # Call C function (simplified)
    output = ctypes.create_string_buffer(32)
    lib.yescrypt(data, len(data), salt, len(salt), output)
    return output.raw
EOF
```

### Verify

```python
from src.core.algorithms import is_available

if is_available('yescrypt'):
    print("✅ Native Yescrypt ready")
else:
    print("⚠️ Using PBKDF2 fallback (5-20x slower)")
```

---

## 4️⃣ Autolykos v2 (Optional - GPU Mining)

### Option A: Python Package

```bash
# Install pyautolykos2 (if available)
pip install pyautolykos2
```

### Option B: Build from Source

```bash
# Clone Ergo Autolykos repository
git clone https://github.com/ergoplatform/Autolykos-GPU-miner.git
cd Autolykos-GPU-miner

# Build (requires CUDA for GPU support)
mkdir build && cd build
cmake -DCUDA_TOOLKIT_ROOT_DIR=/usr/local/cuda ..
make

# For CPU-only build
cmake -DUSE_CPU=ON ..
make
```

### Verify

```python
from src.core.algorithms import is_available

if is_available('autolykos_v2'):
    print("✅ Native Autolykos v2 ready")
else:
    print("⚠️ Using Blake2b fallback (10-30x slower)")
```

---

## 🧪 Testing After Build

### Quick Hash Test

```python
from src.core.algorithms import get_hash, is_available, list_supported

# Check all algorithms
supported = list_supported()
print("Supported algorithms:", supported)

# Test each algorithm
test_data = b"ZION_TEST_DATA"
test_nonce = 12345

for algo in ['cosmic_harmony', 'randomx', 'yescrypt', 'autolykos_v2']:
    try:
        hash_result = get_hash(algo, test_data, test_nonce)
        status = "NATIVE" if is_available(algo) else "FALLBACK"
        print(f"✅ {algo:15s}: {hash_result.hex()[:16]}... ({status})")
    except Exception as e:
        print(f"❌ {algo:15s}: {e}")
```

### Performance Benchmark

```python
import time
from src.core.algorithms import get_hash

test_data = b"X" * 76  # Block header size
iterations = 10000

for algo in ['cosmic_harmony', 'randomx', 'yescrypt', 'autolykos_v2']:
    start = time.time()
    for nonce in range(iterations):
        get_hash(algo, test_data, nonce)
    elapsed = time.time() - start
    hashrate = iterations / elapsed
    print(f"{algo:15s}: {hashrate:>10,.0f} H/s")
```

Expected results:
- **Cosmic Harmony (native)**: 100,000-500,000 H/s
- **Cosmic Harmony (Python)**: 1,000-5,000 H/s
- **RandomX (native)**: 2,000-10,000 H/s
- **RandomX (SHA3 fallback)**: 100-500 H/s

---

## 🔧 Production Configuration

### Environment Variables

```bash
# Force Python fallbacks (for debugging)
export ZION_FORCE_PYTHON_FALLBACKS=1

# Force native libraries (fail if unavailable)
export ZION_REQUIRE_NATIVE_LIBS=1

# Set algorithm preference
export ZION_DEFAULT_ALGO=cosmic_harmony

# Library search paths
export LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH
```

### Mining Pool Configuration

```python
# In pool config (zion_universal_pool_v2.py or similar)
POOL_CONFIG = {
    'algorithms': {
        'cosmic_harmony': {
            'enabled': True,
            'require_native': True,  # Reject Python fallback
            'difficulty': 1000000
        },
        'randomx': {
            'enabled': True,
            'require_native': False,  # Allow fallback
            'difficulty': 500000
        }
    }
}
```

---

## 🚨 Common Issues

### 1. Library Not Found

```bash
# Check library location
ldconfig -p | grep cosmic
ldconfig -p | grep randomx
ldconfig -p | grep yescrypt

# Add to library path
export LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH

# Make permanent (Linux)
echo '/usr/local/lib' | sudo tee /etc/ld.so.conf.d/zion.conf
sudo ldconfig
```

### 2. ImportError in Python

```python
# Debug import issues
import sys
sys.path.insert(0, '/path/to/zion/mining')

try:
    from cosmic_harmony_wrapper import get_hasher
    print("✅ Import successful")
except ImportError as e:
    print(f"❌ Import failed: {e}")
    import traceback
    traceback.print_exc()
```

### 3. Performance Lower Than Expected

- **Check CPU governor**: `cat /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor`
  - Should be `performance`, not `powersave`
  - Set: `sudo cpupower frequency-set -g performance`

- **Check compilation flags**: Rebuild with `-march=native -O3`

- **Monitor CPU usage**: `htop` should show 100% on all cores

---

## 📊 CI/CD Integration

### GitHub Actions Example

```yaml
name: Build Native Libs

on: [push, pull_request]

jobs:
  build-cosmic-harmony:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y g++ libomp-dev
      
      - name: Build Cosmic Harmony
        run: |
          cd zion/mining
          g++ -shared -fPIC -O3 -march=x86-64 -fopenmp \
              cosmic_harmony.cpp -o libcosmicharmony.so
      
      - name: Test
        run: |
          python3 -c "from cosmic_harmony_wrapper import get_hasher; print('✅')"
      
      - name: Upload Artifact
        uses: actions/upload-artifact@v3
        with:
          name: libcosmicharmony-linux
          path: zion/mining/libcosmicharmony.so
```

---

## 🔐 Security Considerations

1. **Verify Source Code**
   - Build from official repositories only
   - Check SHA256 checksums of downloaded tarballs

2. **Compiler Flags**
   - Use `-fPIC` for position-independent code
   - Enable `-D_FORTIFY_SOURCE=2` for buffer overflow protection
   - Add `-fstack-protector-strong`

3. **Library Permissions**
   ```bash
   sudo chown root:root /usr/local/lib/libcosmicharmony.so
   sudo chmod 755 /usr/local/lib/libcosmicharmony.so
   ```

---

## 📚 Additional Resources

- **Cosmic Harmony Spec**: `docs/algorithms/cosmic_harmony.md`
- **RandomX Documentation**: https://github.com/tevador/RandomX/blob/master/doc/specs.md
- **Yescrypt Paper**: https://www.openwall.com/presentations/Passwords14-Energy-Efficient-Cracking/
- **Autolykos v2 Spec**: https://docs.ergoplatform.com/mining/autolykos/

---

## ✅ Checklist

After building native libraries:

- [ ] `libcosmicharmony.so` compiled and tested
- [ ] RandomX library installed (or Python fallback accepted)
- [ ] Yescrypt library installed (or PBKDF2 fallback accepted)
- [ ] Autolykos v2 library installed (or Blake2b fallback accepted)
- [ ] Performance benchmark run (>100k H/s for Cosmic Harmony)
- [ ] All 4 algorithms return `True` in `list_supported()`
- [ ] Integration tests passed (`tests/integration/test_rpc_algorithms_v2_8_4.py`)
- [ ] Production pool config updated

---

**Status**: All algorithms work **without native libraries** (Python fallbacks).  
**Recommendation**: Build **Cosmic Harmony** for production (50-100x speedup).  
**Optional**: Build RandomX/Yescrypt/Autolykos v2 for additional performance.
