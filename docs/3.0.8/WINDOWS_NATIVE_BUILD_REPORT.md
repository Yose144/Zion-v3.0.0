# Windows Native MSVC Build Report — 2026-08-03

## Problem

The `v3.1.0-desktop` and `v3.1.0-cli` GitHub releases contained Windows
binaries that were cross-compiled from an Apple Silicon Mac using the
`x86_64-pc-windows-gnu` target (MinGW-w64). These binaries crashed on
clean Windows 10/11 machines with `STATUS_DLL_NOT_FOUND (0xC0000135)`
because the MinGW runtime DLLs (`libgcc_s_seh-1.dll`, `libstdc++-6.dll`,
`libwinpthread-1.dll`) were not bundled.

After bundling the MinGW DLLs, a second crash occurred due to missing
NVRTC DLLs (`nvrtc64_*.dll`) required by the CUDA backend.

## Solution

Rebuilt all Windows binaries **natively on Windows 11** using the MSVC
toolchain (Visual Studio 2026, `x86_64-pc-windows-msvc` target). This
eliminates the MinGW dependency entirely and produces binaries that link
against the standard MSVC C runtime (`VCRUNTIME140.dll`), which is
present on most Windows machines.

## Build configuration

| Setting | Value |
|---------|-------|
| Platform | Windows 11 x86_64 |
| Toolchain | `x86_64-pc-windows-msvc` (MSVC 14.51.36231) |
| Features | `public_build,full,gpu-cuda` |
| `full` expands to | `gpu-opencl` + `native-all` + `native-hashers` |
| `native-all` includes | etchash, kawpow, autolykos, kheavyhash, blake3, cosmic-harmony, verushash, randomx, ghostrider |
| `gpu-cuda` | NVIDIA CUDA via `cudarc` (JIT-compiled through NVRTC) |
| `gpu-opencl` | OpenCL for AMD/Intel/NVIDIA |
| `public_build` | Hides Trinity/AuxPoW coin names (VRSC, ZANO, etc.) |
| `ZION_DISABLE_OPENMP` | `1` (no libomp dependency) |

## cl.exe crash workaround

MSVC's `cl.exe` (VS 2026, v14.51) crashes with `STATUS_ACCESS_VIOLATION`
when compiling `autolykos_native.c` — even after replacing all non-ASCII
characters and adding the `/utf-8` flag. The crash occurs during the
compiler backend (preprocessor succeeds, optimization level is
irrelevant).

**Fix:** `autolykos_native.c` is now conditionally excluded on Windows
MSVC builds via a `has_autolykos_c` cfg flag set in `build.rs`. The
pure-Rust Autolykos v2 hasher in `external_hashers.rs` is used instead.
On non-Windows platforms (Linux, macOS) the C implementation is still
compiled and used.

### Files modified for the workaround

- `AuXpow/build.rs` — skip `autolykos_native.c` on Windows MSVC; emit
  `cargo:rustc-cfg=has_autolykos_c` when the C file is compiled
- `AuXpow/src/native_ffi.rs` — `#[cfg(has_autolykos_c)]` on all
  `autolykos_*` extern "C" declarations and wrapper functions
- `AuXpow/src/external_hashers.rs` — `#[cfg(has_autolykos_c)]` guard
  for the native C dispatch in `hash_autolykos()`
- `V3/L1/native-ffi/build.rs` — same skip + cfg flag for the
  `native-ffi` crate's copy of `autolykos_native.c`
- `V3/L1/native-ffi/src/lib.rs` — `#[cfg(all(feature =
  "native-autolykos", has_autolykos_c))]` on the `autolykos` module and
  all test functions referencing it
- `V3/L1/miner/src/parallel.rs` — `#[cfg(all(feature =
  "native-autolykos", has_autolykos_c))]` for the FFI dispatch

### Non-ASCII cleanup

All C source files in `AuXpow/csrc/` and `V3/L1/native-ffi/csrc/` were
cleaned of non-ASCII characters (UTF-8 em-dashes, arrows, accented
letters in comments) and replaced with ASCII equivalents. The `/utf-8`
flag was added to `cc::Build` for MSVC targets in both `build.rs` files.

## Bundled DLLs

The following DLLs are bundled in both the Desktop App and Terminal
Miner Windows packages:

| DLL | Purpose | Size |
|-----|---------|------|
| `OpenCL.dll` | OpenCL ICD loader (AMD/Intel/NVIDIA GPU) | 0.46 MB |
| `VCRUNTIME140.dll` | MSVC C runtime | 0.17 MB |
| `VCRUNTIME140_1.dll` | MSVC C runtime (EH continuation) | 0.05 MB |
| `nvrtc64_120_0.dll` | CUDA NVRTC JIT compiler (NVIDIA) | 42.67 MB |
| `nvrtc-builtins64_124.dll` | NVRTC builtins | 5.12 MB |

## Built binaries

| Binary | Size | Features |
|--------|------|----------|
| `zion-miner.exe` | 8.76 MB | `public_build,full,gpu-cuda` |
| `node.exe` | 2.85 MB | default |
| `zion.exe` | 7.02 MB | default |

## Release artifacts uploaded

### v3.1.0-desktop (Desktop App)

| File | Size | SHA256 |
|------|------|--------|
| `zion-public-miner-v3.1.0-windows-x64.exe` | 124.52 MB | `2f9cacad...` |
| `zion-public-miner-v3.1.0-windows-x64.zip` | 168.26 MB | `5a80a302...` |

### v3.1.0-cli (Terminal Miner)

| File | Size | SHA256 |
|------|------|--------|
| `zion-miner-windows-x86_64.zip` | 22.33 MB | `8fbf45b4...` |

## Verification

- `zion-miner.exe --version` exits 0 and prints hardware autotune info
- `node.exe` and `zion.exe` built successfully
- Electron app builds via `electron-builder --win nsis zip --x64`
- All artifacts uploaded to GitHub releases with updated SHA256SUMS
