#!/usr/bin/env bash
set -euo pipefail

# Build ZION Public Miner desktop packages locally for all three target
# platforms (macOS, Linux x86_64, Windows x86_64).
#
# This script is designed to run on an Apple Silicon Mac or a Linux build host
# with cross-compilation tooling installed.
#
# Usage:
#   scripts/build-release-local.sh --mac
#   scripts/build-release-local.sh --linux
#   scripts/build-release-local.sh --win
#   scripts/build-release-local.sh --win-native
#   scripts/build-release-local.sh --all

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$DESKTOP_DIR/.." && pwd)"
RESOURCES_DIR="$DESKTOP_DIR/resources"

# AuXpow's native-hashers C code links libomp by default.  Homebrew libomp
# is not available on a clean end-user machine, so disable OpenMP for DAG
# generation.  This makes DAG generation single-threaded but removes the
# libomp runtime dependency for all shipped packages.
export ZION_DISABLE_OPENMP=1

LLVM_AR="${LLVM_AR:-/opt/homebrew/opt/llvm/bin/llvm-ar}"
MINGW_CC="${MINGW_CC:-x86_64-w64-mingw32-gcc}"

# Ensure tools are available
if ! command -v cargo-zigbuild >/dev/null 2>&1; then
  echo "[build-release-local] ERROR: cargo-zigbuild is required for Linux cross-compile." >&2
  echo "  install: cargo install cargo-zigbuild" >&2
  exit 1
fi

if ! command -v makensis >/dev/null 2>&1; then
  echo "[build-release-local] WARNING: makensis is not installed; Windows NSIS build may fail." >&2
  echo "  install: brew install makensis" >&2
fi

function usage() {
  echo "Usage: $0 [--mac] [--linux] [--win] [--win-native] [--all]" >&2
  echo "" >&2
  echo "  --mac         Build macOS DMG (native, Apple Silicon)" >&2
  echo "  --linux       Build Linux AppImage + DEB (cross-compile)" >&2
  echo "  --win         Build Windows NSIS + ZIP (MinGW cross-compile from Mac)" >&2
  echo "  --win-native  Build Windows NSIS + ZIP (native MSVC, run on Windows)" >&2
  echo "  --all         Build all platforms (Mac + Linux + MinGW Windows)" >&2
  exit 1
}

BUILD_MAC=false
BUILD_LINUX=false
BUILD_WIN=false
BUILD_WIN_NATIVE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mac) BUILD_MAC=true ;;
    --linux) BUILD_LINUX=true ;;
    --win) BUILD_WIN=true ;;
    --win-native) BUILD_WIN_NATIVE=true ;;
    --all) BUILD_MAC=true; BUILD_LINUX=true; BUILD_WIN=true ;;
    *) usage ;;
  esac
  shift
done

if ! $BUILD_MAC && ! $BUILD_LINUX && ! $BUILD_WIN && ! $BUILD_WIN_NATIVE; then
  usage
fi

# ---------------------------------------------------------------------------
# Clean previous resources so we don't bundle binaries from another platform
# ---------------------------------------------------------------------------
function clean_resources() {
  rm -rf "$RESOURCES_DIR"
  mkdir -p "$RESOURCES_DIR"
}

# ---------------------------------------------------------------------------
# Detect whether the build host has an NVIDIA GPU + NVRTC runtime.
# This is used to decide whether to add the gpu-cuda feature.
# Use ZION_FORCE_CUDA=1 to override and always include gpu-cuda.
# ---------------------------------------------------------------------------
function detect_cuda_runtime() {
  if [[ "${ZION_FORCE_CUDA:-}" == "1" ]]; then
    echo "[build-release-local] ZION_FORCE_CUDA=1 -> forcing gpu-cuda"
    return 0
  fi

  if ! command -v nvidia-smi >/dev/null 2>&1; then
    return 1
  fi

  local gpu_count
  gpu_count=$(nvidia-smi --query-gpu=count --format=csv,noheader,nounits 2>/dev/null | head -n 1 | tr -d '[:space:]')
  if [[ -z "$gpu_count" ]] || [[ "$gpu_count" -eq 0 ]]; then
    return 1
  fi

  # NVRTC (runtime JIT compiler) is required by the gpu-cuda feature.
  # It may already be in the V31 target dir, in the CUDA toolkit, or in
  # DesktopAgentP3.0.6/native-libs/ for Windows.
  local search_dirs=(
    "$REPO_ROOT/V31/target/release"
    "$REPO_ROOT/V31/target/x86_64-unknown-linux-gnu/release"
    "$REPO_ROOT/V31/target/x86_64-pc-windows-msvc/release"
    "$REPO_ROOT/V31/target/x86_64-pc-windows-gnu/release"
    "/usr/lib/x86_64-linux-gnu"
    "/usr/local/cuda/lib64"
    "/usr/lib"
    "/c/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v12.0/bin"
    "/c/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v12.4/bin"
    "/c/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v12.6/bin"
    "$DESKTOP_DIR/native-libs"
  )

  for dir in "${search_dirs[@]}"; do
    if [[ -d "$dir" ]]; then
      for f in "$dir"/libnvrtc.so* "$dir"/libnvrtc-builtins.so* "$dir"/nvrtc64_*.dll "$dir"/nvrtc-builtins*.dll; do
        if [[ -f "$f" ]]; then
          echo "[build-release-local] NVIDIA GPU with NVRTC found: $(basename "$f") in $dir"
          return 0
        fi
      done
    fi
  done

  return 1
}

# ---------------------------------------------------------------------------
# macOS (native, Apple Silicon / Intel)
# ---------------------------------------------------------------------------
function build_mac() {
  echo "[build-release-local] Building macOS binaries..."
  clean_resources

  local features="public_build,gpu-opencl,gpu-metal,native-all"

  local cargo_args=(
    cargo build --release
    --manifest-path "$REPO_ROOT/V31/Cargo.toml"
  )

  # zion-miner + zion-universal-miner with Metal + OpenCL + all native hashers
  "${cargo_args[@]}" -p zion-miner \
    --bin zion-miner --bin zion-universal-miner \
    --features "$features"

  # node (zion-core binary)
  "${cargo_args[@]}" -p zion-core --bin zion-node

  # zion CLI
  "${cargo_args[@]}" -p zion-cli

  # Copy
  local target_dir="$REPO_ROOT/V31/target/release"
  cp "$target_dir/zion-miner" "$RESOURCES_DIR/"
  cp "$target_dir/zion-miner" "$RESOURCES_DIR/zion-universal-miner"
  cp "$target_dir/zion" "$RESOURCES_DIR/"
  cp "$target_dir/zion-node" "$RESOURCES_DIR/"
  cp "$target_dir/zion-node" "$RESOURCES_DIR/node"

  echo "[build-release-local] Building macOS DMG..."
  cd "$DESKTOP_DIR"
  npx electron-builder --mac --publish never
}

# ---------------------------------------------------------------------------
# Linux x86_64 (cross-compile via cargo-zigbuild, glibc, OpenCL + optional CUDA)
# ---------------------------------------------------------------------------
function build_linux() {
  echo "[build-release-local] Building Linux x86_64 binaries..."
  clean_resources

  local target=x86_64-unknown-linux-gnu
  local features="public_build,gpu-opencl,native-all"
  detect_cuda_runtime && features="$features,gpu-cuda"

  # Find the x86_64 system OpenCL loader for link time.  The resulting
  # binary dynamically loads the target machine's libOpenCL.so.1 at runtime,
  # so we do NOT bundle the loader with the package.
  local opencl_lib_dir=""
  for d in /usr/lib/x86_64-linux-gnu /usr/lib64 /lib/x86_64-linux-gnu /usr/lib; do
    if [[ -f "$d/libOpenCL.so" ]]; then
      opencl_lib_dir="$d"
      break
    fi
  done

  if [[ -z "$opencl_lib_dir" ]]; then
    echo "[build-release-local] WARNING: no x86_64 libOpenCL.so found; Linux OpenCL build may fail." >&2
    echo "  install: sudo apt install ocl-icd-opencl-dev" >&2
  else
    echo "[build-release-local] Using OpenCL loader from $opencl_lib_dir"
  fi

  export AR_x86_64_unknown_linux_gnu="$LLVM_AR"
  if [[ -n "$opencl_lib_dir" ]]; then
    export CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_RUSTFLAGS="-L $opencl_lib_dir -Clink-arg=-Wl,--allow-shlib-undefined"
  else
    export CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_RUSTFLAGS="-Clink-arg=-Wl,--allow-shlib-undefined"
  fi

  cargo zigbuild --release \
    --manifest-path "$REPO_ROOT/V31/Cargo.toml" \
    --target "$target" \
    -p zion-miner \
    --bin zion-miner --bin zion-universal-miner \
    --features "$features"

  cargo zigbuild --release \
    --manifest-path "$REPO_ROOT/V31/Cargo.toml" \
    --target "$target" \
    -p zion-core --bin zion-node

  cargo zigbuild --release \
    --manifest-path "$REPO_ROOT/V31/Cargo.toml" \
    --target "$target" \
    -p zion-cli

  local target_dir="$REPO_ROOT/V31/target/$target/release"
  cp "$target_dir/zion-miner" "$RESOURCES_DIR/"
  cp "$target_dir/zion-miner" "$RESOURCES_DIR/zion-universal-miner"
  cp "$target_dir/zion" "$RESOURCES_DIR/"
  cp "$target_dir/zion-node" "$RESOURCES_DIR/"
  cp "$target_dir/zion-node" "$RESOURCES_DIR/node"

  echo "[build-release-local] Building Linux AppImage..."
  cd "$DESKTOP_DIR"
  npx electron-builder --linux AppImage --x64 --publish never
}

# ---------------------------------------------------------------------------
# Windows x86_64 (cross-compile with MinGW-w64 — legacy, requires bundling
# MinGW runtime DLLs).  Prefer build_win_native on a Windows machine.
# ---------------------------------------------------------------------------
function build_win() {
  echo "[build-release-local] Building Windows x86_64 binaries (MinGW cross-compile)..."
  clean_resources

  local target=x86_64-pc-windows-gnu
  local features="public_build,gpu-opencl,native-all"
  detect_cuda_runtime && features="$features,gpu-cuda"

  export AR_x86_64_pc_windows_gnu="$LLVM_AR"
  export CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER="$MINGW_CC"
  # Statically link MinGW runtime so the binary doesn't depend on
  # libstdc++-6.dll / libgcc_s_seh-1.dll / libwinpthread-1.dll at runtime.
  export CARGO_TARGET_X86_64_PC_WINDOWS_GNU_RUSTFLAGS="-C link-arg=-static -C link-arg=-static-libgcc -C link-arg=-static-libstdc++"

  cargo build --release \
    --manifest-path "$REPO_ROOT/V31/Cargo.toml" \
    --target "$target" \
    -p zion-miner \
    --bin zion-miner --bin zion-universal-miner \
    --features "$features"

  cargo build --release \
    --manifest-path "$REPO_ROOT/V31/Cargo.toml" \
    --target "$target" \
    -p zion-core --bin zion-node

  cargo build --release \
    --manifest-path "$REPO_ROOT/V31/Cargo.toml" \
    --target "$target" \
    -p zion-cli

  local target_dir="$REPO_ROOT/V31/target/$target/release"
  cp "$target_dir/zion-miner.exe" "$RESOURCES_DIR/"
  cp "$target_dir/zion-miner.exe" "$RESOURCES_DIR/zion-universal-miner.exe"
  cp "$target_dir/zion.exe" "$RESOURCES_DIR/"
  cp "$target_dir/zion-node.exe" "$RESOURCES_DIR/"
  cp "$target_dir/zion-node.exe" "$RESOURCES_DIR/node.exe"

  # Bundle runtime DLLs that the MinGW cross-compile needs at runtime.
  # NVRTC (CUDA JIT compiler) is required by the gpu-cuda feature.
  # OpenCL.dll is the ICD loader required by gpu-opencl.
  bundle_windows_dlls "$RESOURCES_DIR"

  echo "[build-release-local] Building Windows NSIS + ZIP..."
  cd "$DESKTOP_DIR"
  npx electron-builder --win --x64 --publish never
}

# ---------------------------------------------------------------------------
# Windows x86_64 (native MSVC build — run on a Windows 10/11 machine)
#
# This is the preferred build path for Windows releases.  MSVC binaries
# depend only on VCRUNTIME140.dll (pre-installed on Windows 10/11 via
# Visual C++ Redistributable) and system DLLs — no MinGW runtime needed.
#
# Usage (on a Windows machine with Rust MSVC toolchain + CUDA toolkit):
#   bash scripts/build-release-local.sh --win-native
# ---------------------------------------------------------------------------
function build_win_native() {
  echo "[build-release-local] Building Windows x86_64 binaries (native MSVC)..."
  clean_resources

  local features="public_build,gpu-opencl,native-all"
  detect_cuda_runtime && features="$features,gpu-cuda"

  # MSVC build — no cross-compile target needed, uses default host (x86_64-pc-windows-msvc)
  # ZION_DISABLE_OPENMP=1 avoids dependency on libomp (not available on clean user machines)
  export ZION_DISABLE_OPENMP=1

  cargo build --release \
    --manifest-path "$REPO_ROOT/V31/Cargo.toml" \
    -p zion-miner \
    --bin zion-miner --bin zion-universal-miner \
    --features "$features"

  cargo build --release \
    --manifest-path "$REPO_ROOT/V31/Cargo.toml" \
    -p zion-core --bin zion-node

  cargo build --release \
    --manifest-path "$REPO_ROOT/V31/Cargo.toml" \
    -p zion-cli

  local target_dir="$REPO_ROOT/V31/target/release"
  cp "$target_dir/zion-miner.exe" "$RESOURCES_DIR/"
  cp "$target_dir/zion-miner.exe" "$RESOURCES_DIR/zion-universal-miner.exe"
  cp "$target_dir/zion.exe" "$RESOURCES_DIR/"
  cp "$target_dir/zion-node.exe" "$RESOURCES_DIR/"
  cp "$target_dir/zion-node.exe" "$RESOURCES_DIR/node.exe"

  # Bundle runtime DLLs: VCRUNTIME140, OpenCL, NVRTC
  bundle_windows_dlls "$RESOURCES_DIR"

  # Also copy VCRUNTIME140.dll (MSVC runtime) — usually present on Win10/11
  # but bundle it to be safe for clean installations.
  local vc_dir="/c/Windows/System32"
  for dll in VCRUNTIME140.dll VCRUNTIME140_1.dll; do
    if [[ -f "$vc_dir/$dll" ]]; then
      cp "$vc_dir/$dll" "$RESOURCES_DIR/"
      echo "[build-release-local] Copied $dll"
    fi
  done

  echo "[build-release-local] Building Windows NSIS + ZIP..."
  cd "$DESKTOP_DIR"
  npx electron-builder --win --x64 --publish never
}

# ---------------------------------------------------------------------------
# Bundle Windows runtime DLLs needed by the miner into resources/
# (NVRTC for CUDA JIT, OpenCL ICD loader)
# ---------------------------------------------------------------------------
function bundle_windows_dlls() {
  local res_dir="$1"
  echo "[build-release-local] Bundling Windows runtime DLLs..."

  # OpenCL.dll — ICD loader required by gpu-opencl at load time.
  # The ICD loader is a thin shim that dispatches to the GPU vendor's
  # driver at runtime; bundling it avoids "OpenCL.dll not found" on
  # machines without an SDK installed.
  local opencl_src="/c/Windows/System32/OpenCL.dll"
  if [[ -f "$opencl_src" ]]; then
    cp "$opencl_src" "$res_dir/"
    echo "[build-release-local] Copied OpenCL.dll"
  fi

  # NVRTC (NVIDIA Runtime Compilation) — required by the gpu-cuda feature
  # for JIT-compiling CUDA kernels at runtime.  These DLLs are NOT part of
  # the standard NVIDIA driver; they ship with the CUDA Toolkit or as a
  # standalone redistributable (~50 MB).
  #
  # Search order:
  #   1. V31/target/release/ (if CUDA toolkit is installed, cargo may have linked/copied them)
  #   2. V31/target/<target-triple>/release/
  #   3. CUDA Toolkit install dirs
  #   4. DesktopAgentP3.0.6/native-libs/ (pre-bundled copies)
  local nvrtc_search_dirs=(
    "$REPO_ROOT/V31/target/release"
    "$REPO_ROOT/V31/target/x86_64-pc-windows-msvc/release"
    "$REPO_ROOT/V31/target/x86_64-pc-windows-gnu/release"
    "/c/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v12.0/bin"
    "/c/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v12.4/bin"
    "/c/Program Files/NVIDIA GPU Computing Toolkit/CUDA/v12.6/bin"
    "$DESKTOP_DIR/native-libs"
  )
  local nvrtc_found=false
  for dir in "${nvrtc_search_dirs[@]}"; do
    if [[ -d "$dir" ]]; then
      for f in "$dir"/nvrtc64_*.dll "$dir"/nvrtc-builtins*.dll; do
        if [[ -f "$f" ]]; then
          cp "$f" "$res_dir/"
          echo "[build-release-local] Copied $(basename "$f")"
          nvrtc_found=true
        fi
      done
    fi
    if $nvrtc_found; then break; fi
  done
  if ! $nvrtc_found; then
    echo "[build-release-local] WARNING: NVRTC DLLs not found. CUDA backend will fail at runtime." >&2
    echo "[build-release-local]   Install CUDA Toolkit or place nvrtc64_*.dll in DesktopAgentP3.0.6/native-libs/" >&2
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
$BUILD_MAC && build_mac
$BUILD_LINUX && build_linux
$BUILD_WIN && build_win
$BUILD_WIN_NATIVE && build_win_native

echo "[build-release-local] Done. Artifacts are in $DESKTOP_DIR/dist/"
