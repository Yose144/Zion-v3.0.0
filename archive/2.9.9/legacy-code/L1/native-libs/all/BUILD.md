# ZION Native Autolykos v2 Build Instructions

## Cosmic Harmony v2 (ZION Native Algorithm)

### macOS (Intel & Apple Silicon)

```bash
# Quick build (auto-detects architecture)
cd mining/native
./build_macos.sh

# Or build Universal Binary (both Intel + Apple Silicon)
./build_macos.sh universal

# Manual build (Apple Silicon with NEON)
clang -O3 -shared -fPIC cosmic_harmony_v2_native.c -o libcosmic_harmony_v2.dylib

# Manual build (Intel with AVX2)
clang -O3 -mavx2 -shared -fPIC cosmic_harmony_v2_native.c -o libcosmic_harmony_v2.dylib
```

**Performance:**
- Apple M1: ~1,250 H/s (NEON optimized)
- Intel i7: ~500-2,000 H/s (AVX2 optimized)

### Windows

```powershell
# MSVC
cl /O2 /arch:AVX2 cosmic_harmony_v2_native.c /LD /Fe:cosmic_harmony_v2.dll

# MinGW
gcc -O3 -mavx2 -shared cosmic_harmony_v2_native.c -o cosmic_harmony_v2.dll
```

### Linux

```bash
# With AVX2
gcc -O3 -mavx2 -shared -fPIC cosmic_harmony_v2_native.c -o libcosmic_harmony_v2.so

# Without AVX2 (older CPUs)
gcc -O3 -shared -fPIC cosmic_harmony_v2_native.c -o libcosmic_harmony_v2.so
```

---

## Autolykos v2 (Ergo Algorithm)

### Build Native Libraries

### Windows (MSVC)

```powershell
# CPU Library
cd mining\native
cl /O2 /LD autolykos_v2_native.c /link /OUT:autolykos.dll

# CUDA Library (requires NVIDIA CUDA Toolkit)
nvcc -O3 -arch=sm_75 -shared autolykos_v2_cuda.cu -o autolykos_cuda.dll

# OpenCL Library (requires OpenCL SDK)
cl /O2 /LD autolykos_v2_opencl.c /I"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.0\include" /link /LIBPATH:"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.0\lib\x64" OpenCL.lib /OUT:autolykos_opencl.dll
```

### Windows (MinGW)

```bash
# CPU Library
cd mining/native
gcc -O3 -march=native -shared -o autolykos.dll autolykos_v2_native.c

# OpenCL Library
gcc -O3 -march=native -shared -o autolykos_opencl.dll autolykos_v2_opencl.c -lOpenCL
```

### Linux

```bash
# CPU Library
cd mining/native
gcc -O3 -march=native -fPIC -shared -o libautolykos.so autolykos_v2_native.c

# CUDA Library
nvcc -O3 -arch=sm_75 -shared -Xcompiler -fPIC -o libautolykos_cuda.so autolykos_v2_cuda.cu

# OpenCL Library
gcc -O3 -march=native -fPIC -shared -o libautolykos_opencl.so autolykos_v2_opencl.c -lOpenCL
```

## Architecture Flags

### NVIDIA GPUs (CUDA)

- **RTX 40 series**: `-arch=sm_89`
- **RTX 30 series**: `-arch=sm_86`
- **RTX 20 series**: `-arch=sm_75`
- **GTX 16 series**: `-arch=sm_75`
- **GTX 10 series**: `-arch=sm_61`

### AMD GPUs (OpenCL)

OpenCL works automatically with AMD drivers. Ensure AMD Radeon Software is installed.

## Dependencies

### Windows

1. **MSVC**: Visual Studio 2019+ with C++ tools
2. **CUDA** (optional): NVIDIA CUDA Toolkit 11.0+
3. **OpenCL** (optional): Included with GPU drivers

### Linux

```bash
# Ubuntu/Debian
sudo apt install build-essential

# CUDA (optional)
sudo apt install nvidia-cuda-toolkit

# OpenCL (optional)
sudo apt install ocl-icd-opencl-dev
```

## Testing

```powershell
# Test CPU library
python mining\native_autolykos_wrapper.py

# Test full GPU engine
python mining\gpu_autolykos_v2_engine.py
```

## Performance Expectations

### CPU (Native C)
- **Intel i7-10700**: ~15-20 kH/s
- **AMD Ryzen 7 5800X**: ~20-25 kH/s

### GPU (OpenCL/CUDA)
- **AMD RX 5600 XT**: 1.5-2.5 MH/s @ 120W
- **AMD RX 6600 XT**: 2.0-3.0 MH/s @ 130W
- **NVIDIA RTX 3060**: 2.0-3.5 MH/s @ 130W
- **NVIDIA RTX 3070**: 3.5-5.0 MH/s @ 150W

## Troubleshooting

### "Cannot find library"
- Ensure DLL/SO is in `mining/native/` directory
- Check if library was built successfully
- On Windows, may need to install Visual C++ Redistributable

### "CUDA not available"
- Install NVIDIA CUDA Toolkit
- Verify GPU supports CUDA (GTX 10 series+)
- Check `nvidia-smi` shows correct driver

### "OpenCL not available"
- Install GPU drivers (AMD/NVIDIA)
- On Linux: `sudo apt install ocl-icd-opencl-dev`
- Verify: `clinfo` command
