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
  echo "Usage: $0 [--mac] [--linux] [--win] [--all]" >&2
  exit 1
}

BUILD_MAC=false
BUILD_LINUX=false
BUILD_WIN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mac) BUILD_MAC=true ;;
    --linux) BUILD_LINUX=true ;;
    --win) BUILD_WIN=true ;;
    --all) BUILD_MAC=true; BUILD_LINUX=true; BUILD_WIN=true ;;
    *) usage ;;
  esac
  shift
done

if ! $BUILD_MAC && ! $BUILD_LINUX && ! $BUILD_WIN; then
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
# Linux x86_64 (cross-compile via cargo-zigbuild, musl, CPU-only)
# ---------------------------------------------------------------------------
function build_linux() {
  echo "[build-release-local] Building Linux x86_64 binaries..."
  clean_resources

  local target=x86_64-unknown-linux-musl
  local features=public_build,native-all
  export AR_x86_64_unknown_linux_musl="$LLVM_AR"

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
# Windows x86_64 (cross-compile with MinGW-w64)
# ---------------------------------------------------------------------------
function build_win() {
  echo "[build-release-local] Building Windows x86_64 binaries..."
  clean_resources

  local target=x86_64-pc-windows-gnu
  local features=public_build,full
  export AR_x86_64_pc_windows_gnu="$LLVM_AR"
  export CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER="$MINGW_CC"

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

  echo "[build-release-local] Building Windows NSIS + ZIP..."
  cd "$DESKTOP_DIR"
  npx electron-builder --win --x64 --publish never
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
$BUILD_MAC && build_mac
$BUILD_LINUX && build_linux
$BUILD_WIN && build_win

echo "[build-release-local] Done. Artifacts are in $DESKTOP_DIR/dist/"
