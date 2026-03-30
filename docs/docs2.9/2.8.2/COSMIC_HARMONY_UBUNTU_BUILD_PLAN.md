# 🚀 COSMIC HARMONY C++ BUILD & DEPLOYMENT PLAN - UBUNTU

**Status**: Ready for Ubuntu implementation  
**Platform**: Linux (Ubuntu 20.04+)  
**Goal**: Compile C++ Cosmic Harmony library for production mining

---

## 📋 PHASE 1: Environment Setup (Ubuntu)

### 1.1 System Dependencies
```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install build tools
sudo apt-get install -y \
    build-essential \
    cmake \
    git \
    curl \
    wget \
    pkg-config

# Install crypto libraries
sudo apt-get install -y \
    libssl-dev \
    libcrypto++-dev \
    openssl

# Install Python dev headers (for ctypes)
sudo apt-get install -y \
    python3-dev \
    python3-pip
```

### 1.2 Verify Installation
```bash
# Check compiler
gcc --version
g++ --version
cmake --version

# Check OpenSSL
openssl version
pkg-config --cflags --libs openssl
```

---

## 📋 PHASE 2: Blake3 Library Setup

### 2.1 Download BLAKE3 Reference Implementation
```bash
cd /tmp
git clone https://github.com/BLAKE3-team/BLAKE3.git blake3-src
cd blake3-src/c

# Build BLAKE3 static library
gcc -O3 -c blake3.c -o blake3.o
gcc -O3 -c blake3_dispatch.c -o blake3_dispatch.o
gcc -O3 -c blake3_portable.c -o blake3_portable.o
gcc -O3 -c blake3_sse2.c -o blake3_sse2.o
gcc -O3 -c blake3_sse41.c -o blake3_sse41.o
gcc -O3 -c blake3_avx2.c -o blake3_avx2.o
gcc -O3 -c blake3_avx512.c -o blake3_avx512.o

# Create static library
ar rcs libblake3.a blake3*.o

# Verify
file libblake3.a
nm libblake3.a | head -20
```

### 2.2 Copy to Project
```bash
# Copy to ZION project
cp /tmp/blake3-src/c/blake3.h /path/to/ZION/zion/mining/include/
cp /tmp/blake3-src/c/blake3_impl.h /path/to/ZION/zion/mining/include/
cp /tmp/blake3-src/c/libblake3.a /path/to/ZION/zion/mining/

# Verify
ls -la /path/to/ZION/zion/mining/include/blake3*
ls -la /path/to/ZION/zion/mining/libblake3.a
```

---

## 📋 PHASE 3: Cosmic Harmony C++ Compilation

### 3.1 Project Structure Check
```bash
cd /path/to/ZION/zion/mining

# Verify all sources exist
ls -la include/zion-cosmic-harmony.h   # ✅ Created
ls -la zion-cosmic-harmony.cpp         # ✅ Exists
ls -la libblake3.a                     # ✅ From BLAKE3

# Create build directory
mkdir -p build
cd build
```

### 3.2 Manual Compilation (Step by Step)
```bash
cd /path/to/ZION/zion/mining/build

# Compiler flags for Ubuntu/Linux
CXX="g++"
CXXFLAGS="-std=c++17 -O3 -fPIC -march=native -DNDEBUG"
INCLUDES="-I../include -I/tmp/blake3-src/c"
LIBS="-lssl -lcrypto -lpthread"

# Step 1: Compile Cosmic Harmony
echo "🔹 Compiling Cosmic Harmony..."
$CXX $CXXFLAGS $INCLUDES -c ../zion-cosmic-harmony.cpp -o cosmic_harmony.o
if [ $? -eq 0 ]; then
    echo "✅ Cosmic Harmony compiled"
else
    echo "❌ Compilation failed!"
    exit 1
fi

# Step 2: Create C wrapper
echo "🔹 Creating C wrapper..."
cat > cosmic_harmony_c_wrapper.cpp << 'EOF'
#include "../include/zion-cosmic-harmony.h"
#include <cstring>

extern "C" {

// C interface for Python ctypes
void cosmic_hash(const uint8_t* input, size_t input_len, uint32_t nonce, uint8_t* output) {
    zion::CosmicHarmonyHasher::cosmic_hash(input, input_len, nonce, output);
}

bool cosmic_harmony_initialize() {
    return zion::CosmicHarmonyHasher::initialize();
}

bool check_difficulty(const uint8_t* hash, uint64_t target_difficulty) {
    return zion::CosmicHarmonyHasher::check_difficulty(hash, target_difficulty);
}

}
EOF

$CXX $CXXFLAGS $INCLUDES -c cosmic_harmony_c_wrapper.cpp -o wrapper.o
if [ $? -eq 0 ]; then
    echo "✅ C wrapper compiled"
else
    echo "❌ Wrapper compilation failed!"
    exit 1
fi

# Step 3: Link shared library
echo "🔗 Linking shared library..."
$CXX -shared $CXXFLAGS -o libcosmicharmony.so cosmic_harmony.o wrapper.o ../libblake3.a $LIBS

if [ $? -eq 0 ]; then
    echo "✅ Shared library created: libcosmicharmony.so"
else
    echo "❌ Linking failed!"
    exit 1
fi
```

### 3.3 Verify Library
```bash
# Check library
file libcosmicharmony.so
ldd libcosmicharmony.so

# Try to load (optional Python test)
python3 << 'PYEOF'
import ctypes
lib = ctypes.CDLL('./libcosmicharmony.so')
print("✅ Library loaded successfully!")
print(f"cosmic_hash function: {lib.cosmic_hash}")
print(f"cosmic_harmony_initialize function: {lib.cosmic_harmony_initialize}")
print(f"check_difficulty function: {lib.check_difficulty}")
PYEOF
```

---

## 📋 PHASE 4: Automated Build Script for Ubuntu

### 4.1 Create `build_cosmic_harmony_ubuntu.sh`
```bash
#!/bin/bash
# Build ZION Cosmic Harmony - Ubuntu Edition

set -e

echo "🔨 Building ZION Cosmic Harmony Shared Library (Ubuntu)"
echo "========================================================"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 1. Check dependencies
echo ""
echo "🔍 Checking system dependencies..."
command -v g++ >/dev/null 2>&1 || { echo "❌ g++ not found"; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "❌ openssl not found"; exit 1; }
pkg-config --cflags --libs openssl >/dev/null 2>&1 || { echo "❌ pkg-config for openssl not found"; exit 1; }

echo "✅ g++: $(g++ --version | head -1)"
echo "✅ OpenSSL: $(openssl version)"

# 2. Build BLAKE3 if not present
if [ ! -f "libblake3.a" ]; then
    echo ""
    echo "🔨 Building BLAKE3..."
    
    if [ ! -d "/tmp/blake3-src" ]; then
        git clone --depth 1 https://github.com/BLAKE3-team/BLAKE3.git /tmp/blake3-src 2>/dev/null || true
    fi
    
    if [ -d "/tmp/blake3-src/c" ]; then
        cd /tmp/blake3-src/c
        gcc -O3 -c blake3.c -o blake3.o
        gcc -O3 -c blake3_dispatch.c -o blake3_dispatch.o
        gcc -O3 -c blake3_portable.c -o blake3_portable.o
        gcc -O3 -c blake3_sse2.c -o blake3_sse2.o 2>/dev/null || true
        gcc -O3 -c blake3_sse41.c -o blake3_sse41.o 2>/dev/null || true
        gcc -O3 -c blake3_avx2.c -o blake3_avx2.o 2>/dev/null || true
        gcc -O3 -c blake3_avx512.c -o blake3_avx512.o 2>/dev/null || true
        ar rcs libblake3.a blake3*.o
        cp libblake3.a "$SCRIPT_DIR/"
        echo "✅ BLAKE3 built"
    else
        echo "⚠️ BLAKE3 not available, will use system crypto only"
    fi
    cd "$SCRIPT_DIR"
fi

# 3. Create build directory
mkdir -p build
cd build

# 4. Compiler settings
CXX=${CXX:-g++}
CXXFLAGS="-std=c++17 -O3 -fPIC -march=native -DNDEBUG"
INCLUDES="-I../include"
LIBS="-lssl -lcrypto -lpthread"

echo ""
echo "🔧 Build settings:"
echo "   CXX: $CXX"
echo "   CXXFLAGS: $CXXFLAGS"
echo "   INCLUDES: $INCLUDES"
echo "   LIBS: $LIBS"

# 5. Compile Cosmic Harmony
echo ""
echo "🔨 Compiling Cosmic Harmony..."
$CXX $CXXFLAGS $INCLUDES -c ../zion-cosmic-harmony.cpp -o cosmic_harmony.o

# 6. Create C wrapper
echo "🔨 Creating C wrapper..."
cat > cosmic_harmony_c_wrapper.cpp << 'WRAPEOF'
#include "zion-cosmic-harmony.h"
#include <cstring>

extern "C" {

void cosmic_hash(const uint8_t* input, size_t input_len, uint32_t nonce, uint8_t* output) {
    zion::CosmicHarmonyHasher::cosmic_hash(input, input_len, nonce, output);
}

bool cosmic_harmony_initialize() {
    return zion::CosmicHarmonyHasher::initialize();
}

bool check_difficulty(const uint8_t* hash, uint64_t target_difficulty) {
    return zion::CosmicHarmonyHasher::check_difficulty(hash, target_difficulty);
}

}
WRAPEOF

$CXX $CXXFLAGS $INCLUDES -c cosmic_harmony_c_wrapper.cpp -o wrapper.o

# 7. Link shared library
echo "🔗 Linking shared library..."
LINK_CMD="$CXX -shared $CXXFLAGS -o libcosmicharmony.so cosmic_harmony.o wrapper.o"

# Add BLAKE3 if available
if [ -f "../libblake3.a" ]; then
    LINK_CMD="$LINK_CMD ../libblake3.a"
fi

LINK_CMD="$LINK_CMD $LIBS"
eval $LINK_CMD

# 8. Verify
echo ""
echo "✅ Build complete!"
echo ""
echo "📚 Library information:"
file libcosmicharmony.so
ldd libcosmicharmony.so | head -5

# 9. Copy to parent
cp libcosmicharmony.so ../
echo ""
echo "📦 Copied: ../libcosmicharmony.so"

echo ""
echo "🎯 Next: Copy library to mining directory and test with wrapper"
```

---

## 📋 PHASE 5: Python Integration & Testing

### 5.1 Update Wrapper to Find Ubuntu Library
```python
# In cosmic_harmony_wrapper.py

def _try_load_cpp_library(self):
    """Try to load compiled C++ Cosmic Harmony library"""
    lib_names = [
        'libcosmicharmony.so',      # Linux primary
        'libcosmicharmony.so.1',    # Linux versioned
        'libcosmicharmony.dylib',   # macOS fallback
        'cosmicharmony.dll',        # Windows fallback
    ]
    
    search_paths = [
        Path(__file__).parent,
        Path(__file__).parent / 'build',
        Path('/usr/local/lib'),
        Path('/usr/lib/x86_64-linux-gnu'),
        Path('/opt/zion/lib'),
    ]
    # ... rest of code
```

### 5.2 Test on Ubuntu
```bash
# Copy library
cp build/libcosmicharmony.so ../../../zion/mining/

# Test Python wrapper
cd ../../../
python3 << 'PYEOF'
import sys
sys.path.insert(0, 'zion/mining')
from cosmic_harmony_wrapper import get_hasher

hasher = get_hasher()
test_hash = hasher.hash(b"test_data")
print(f"✅ Hash: {test_hash.hex()[:32]}...")
PYEOF
```

---

## 📋 PHASE 6: Deployment

### 6.1 Production Paths (Ubuntu)
```bash
# Option 1: Local project
cp build/libcosmicharmony.so ./zion/mining/

# Option 2: System-wide
sudo cp build/libcosmicharmony.so /usr/local/lib/
sudo ldconfig
# Then use: ctypes.CDLL('libcosmicharmony.so')

# Option 3: Docker
# Include in Docker image build
COPY zion/mining/build/libcosmicharmony.so /usr/local/lib/
RUN ldconfig
```

### 6.2 Troubleshooting
```bash
# If library not found
ldd libcosmicharmony.so

# If symbol not found
nm libcosmicharmony.so | grep cosmic_hash

# If permission denied
chmod +x libcosmicharmony.so

# If dependency issues
ldd libcosmicharmony.so | grep "not found"
```

---

## 📋 PHASE 7: Testing & Validation

### 7.1 Unit Tests
```bash
cd /path/to/ZION

# Run debug check
python3 debug_cosmic_harmony.py

# Run quick mining test
python3 test_cosmic_harmony_quick.py

# Run full integration test
python3 test_cosmic_harmony_integration.py
```

### 7.2 Performance Benchmark
```bash
# Create benchmark script
python3 << 'PYEOF'
import time
from zion.mining.cosmic_harmony_wrapper import get_hasher

hasher = get_hasher()
print(f"Hasher: {type(hasher).__name__}")

# Benchmark 1000 hashes
start = time.time()
for i in range(1000):
    hasher.hash(f"bench_{i}".encode())
elapsed = time.time() - start

hashrate = 1000 / elapsed
print(f"Hashrate: {hashrate:.0f} H/s")
print(f"Time per hash: {elapsed/1000*1000:.2f} ms")

# Expected:
# - C++ optimized: 1000-5000 H/s
# - Pure Python: 50-200 H/s
PYEOF
```

---

## 📋 PHASE 8: GitHub Push Strategy

### 8.1 What to Commit
```bash
# Add header file
git add zion/mining/include/zion-cosmic-harmony.h

# Add build script
git add zion/mining/build_cosmic_harmony_ubuntu.sh

# Update wrapper with better error handling
git add zion/mining/cosmic_harmony_wrapper.py

# Add Ubuntu build documentation
git add COSMIC_HARMONY_UBUNTU_BUILD.md

# Add compiled library (if decision made)
# git add zion/mining/libcosmicharmony.so  # Optional

# Commit
git commit -m "🚀 Cosmic Harmony C++ Build System - Ubuntu Ready

- Added zion-cosmic-harmony.h header file
- Created build_cosmic_harmony_ubuntu.sh script
- Updated wrapper for Linux library detection
- Added Ubuntu compilation guide
- Ready for automated CI/CD pipeline

Next: Ubuntu server compilation for production deployment"

git push origin main
```

### 8.2 CI/CD Pipeline (GitHub Actions)
```yaml
name: Build Cosmic Harmony Ubuntu

on:
  push:
    paths:
      - 'zion/mining/**'

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Install dependencies
      run: |
        sudo apt-get update
        sudo apt-get install -y build-essential libssl-dev
    
    - name: Build BLAKE3
      run: |
        git clone --depth 1 https://github.com/BLAKE3-team/BLAKE3.git /tmp/blake3
        cd /tmp/blake3/c
        gcc -O3 -c blake3.c -o blake3.o
        ar rcs libblake3.a blake3.o
        cp libblake3.a ${{ github.workspace }}/zion/mining/
    
    - name: Build Cosmic Harmony
      run: |
        cd ${{ github.workspace }}/zion/mining
        bash build_cosmic_harmony_ubuntu.sh
    
    - name: Test library
      run: |
        python3 << 'PYEOF'
        import ctypes
        lib = ctypes.CDLL('./zion/mining/build/libcosmicharmony.so')
        print("✅ Library built and loaded successfully!")
        PYEOF
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v2
      with:
        name: libcosmicharmony
        path: zion/mining/build/libcosmicharmony.so
```

---

## ✅ SUMMARY - Action Plan

| Phase | Task | Platform | Status |
|-------|------|----------|--------|
| 1 | System setup | Ubuntu | 📋 Ready |
| 2 | BLAKE3 build | Ubuntu | 📋 Ready |
| 3 | C++ compilation | Ubuntu | 📋 Ready |
| 4 | Build automation | Ubuntu | 📋 Ready |
| 5 | Python integration | Ubuntu | 📋 Ready |
| 6 | Deployment | Ubuntu | 📋 Ready |
| 7 | Testing | Ubuntu | 📋 Ready |
| 8 | GitHub push | N/A | ⏳ Next |

---

## 🚀 Next Steps

1. **Now (macOS)**: Push current state to Git
2. **On Ubuntu server**: Run `bash build_cosmic_harmony_ubuntu.sh`
3. **Verify**: Run `python3 debug_cosmic_harmony.py`
4. **Test**: Run `python3 test_cosmic_harmony_mining.py`
5. **Push results**: Commit compiled library to Git

---

**Created**: October 23, 2025  
**Version**: 2.8.1  
**Target**: Ubuntu 20.04+ with gcc 9.0+
