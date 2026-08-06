#!/usr/bin/env bash
set -euo pipefail

# Build ZION Public Miner desktop packages locally on an Apple Silicon Mac
# for all three target platforms (macOS, Linux x86_64, Windows x86_64).
#
# Usage:
#   scripts/build-release-local.sh --mac
#   scripts/build-release-local.sh --linux
#   scripts/build-release-local.sh --win
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
# macOS (native, Apple Silicon)
# ---------------------------------------------------------------------------
function build_mac() {
  echo "[build-release-local] Building macOS binaries..."
  clean_resources

  local cargo_args=(
    cargo build --release
    --manifest-path "$REPO_ROOT/V3/Cargo.toml"
  )

  # zion-miner with Metal + full native stack
  "${cargo_args[@]}" -p zion-miner --features public_build,full,gpu-metal

  # node (zion-core binary)
  "${cargo_args[@]}" -p zion-core --bin node

  # zion CLI
  "${cargo_args[@]}" -p zion-cli

  # Copy
  cp "$REPO_ROOT/V3/target/release/zion-miner" "$RESOURCES_DIR/"
  cp "$REPO_ROOT/V3/target/release/zion" "$RESOURCES_DIR/"
  cp "$REPO_ROOT/V3/target/release/node" "$RESOURCES_DIR/"
  cp "$REPO_ROOT/V3/target/release/zion-miner" "$RESOURCES_DIR/zion-universal-miner"

  echo "[build-release-local] Building macOS DMG..."
  cd "$DESKTOP_DIR"
  npx electron-builder --mac --publish never
}

# ---------------------------------------------------------------------------
# Linux x86_64 (cross-compile via cargo-zigbuild, glibc, OpenCL + CUDA)
# ---------------------------------------------------------------------------
function build_linux() {
  echo "[build-release-local] Building Linux x86_64 binaries..."
  clean_resources

  local target=x86_64-unknown-linux-gnu
  local features=public_build,full,gpu-cuda

  # Ensure the link-time OpenCL loader is the real x86_64 .so, not the old stub.
  # The .incompatible file is the real loader; the target machine uses its own ocl-icd at runtime.
  local opencl_dir="$REPO_ROOT/V3/L1/native-libs"
  [[ -f "$opencl_dir/libOpenCL.so.incompatible" ]] && cp "$opencl_dir/libOpenCL.so.incompatible" "$opencl_dir/libOpenCL.so"

  export AR_x86_64_unknown_linux_gnu="$LLVM_AR"
  export CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_RUSTFLAGS="-L $opencl_dir -Clink-arg=-Wl,--allow-shlib-undefined"

  cargo zigbuild --release \
    --manifest-path "$REPO_ROOT/V3/Cargo.toml" \
    --target "$target" \
    -p zion-miner --features "$features"

  cargo zigbuild --release \
    --manifest-path "$REPO_ROOT/V3/Cargo.toml" \
    --target "$target" \
    -p zion-core --bin node

  cargo zigbuild --release \
    --manifest-path "$REPO_ROOT/V3/Cargo.toml" \
    --target "$target" \
    -p zion-cli

  local target_dir="$REPO_ROOT/V3/target/$target/release"
  cp "$target_dir/zion-miner" "$RESOURCES_DIR/"
  cp "$target_dir/zion" "$RESOURCES_DIR/"
  cp "$target_dir/node" "$RESOURCES_DIR/"
  cp "$target_dir/zion-miner" "$RESOURCES_DIR/zion-universal-miner"

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
  local features=public_build,full,gpu-cuda
  export AR_x86_64_pc_windows_gnu="$LLVM_AR"
  export CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER="$MINGW_CC"
  # Statically link MinGW runtime so the binary doesn't depend on
  # libstdc++-6.dll / libgcc_s_seh-1.dll / libwinpthread-1.dll at runtime.
  export CARGO_TARGET_X86_64_PC_WINDOWS_GNU_RUSTFLAGS="-C link-arg=-static -C link-arg=-static-libgcc -C link-arg=-static-libstdc++"

  cargo build --release \
    --manifest-path "$REPO_ROOT/V3/Cargo.toml" \
    --target "$target" \
    -p zion-miner --features "$features"

  cargo build --release \
    --manifest-path "$REPO_ROOT/V3/Cargo.toml" \
    --target "$target" \
    -p zion-core --bin node

  cargo build --release \
    --manifest-path "$REPO_ROOT/V3/Cargo.toml" \
    --target "$target" \
    -p zion-cli

  local target_dir="$REPO_ROOT/V3/target/$target/release"
  cp "$target_dir/zion-miner.exe" "$RESOURCES_DIR/"
  cp "$target_dir/zion.exe" "$RESOURCES_DIR/"
  cp "$target_dir/node.exe" "$RESOURCES_DIR/"
  cp "$target_dir/zion-miner.exe" "$RESOURCES_DIR/zion-universal-miner.exe"

  # Bundle runtime DLLs that the MinGW cross-compile needs at runtime.
  # NVRTC (CUDA JIT compiler) is required by the gpu-cuda feature.
  # OpenCL.dll is the ICD loader required by the `full` feature.
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

  local features=public_build,full,gpu-cuda
  # MSVC build — no cross-compile target needed, uses default host (x86_64-pc-windows-msvc)
  # ZION_DISABLE_OPENMP=1 avoids dependency on libomp (not available on clean user machines)
  export ZION_DISABLE_OPENMP=1

  cargo build --release \
    --manifest-path "$REPO_ROOT/V3/Cargo.toml" \
    -p zion-miner --features "$features"

  cargo build --release \
    --manifest-path "$REPO_ROOT/V3/Cargo.toml" \
    -p zion-core --bin node

  cargo build --release \
    --manifest-path "$REPO_ROOT/V3/Cargo.toml" \
    -p zion-cli

  local target_dir="$REPO_ROOT/V3/target/release"
  cp "$target_dir/zion-miner.exe" "$RESOURCES_DIR/"
  cp "$target_dir/zion.exe" "$RESOURCES_DIR/"
  cp "$target_dir/node.exe" "$RESOURCES_DIR/"
  cp "$target_dir/zion-miner.exe" "$RESOURCES_DIR/zion-universal-miner.exe"

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

  # OpenCL.dll — ICD loader required by the `full` feature at load time.
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
  #   1. V3/target/release/ (if CUDA toolkit is installed, cargo links them)
  #   2. CUDA Toolkit install dirs
  #   3. DesktopAgentP3.0.6/native-libs/ (pre-bundled copies)
  local nvrtc_search_dirs=(
    "$REPO_ROOT/V3/target/release"
    "$REPO_ROOT/V3/target/x86_64-pc-windows-msvc/release"
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
