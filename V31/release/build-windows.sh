#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# V31/release/build-windows.sh
# Cross-compile the public-facing ZION miner binary for Windows x86_64
# using the `x86_64-pc-windows-gnu` target (mingw-w64 linker) with the
# `public_build` feature (public Boost release).
#
# Prerequisites:
#   - Rust target:  rustup target add x86_64-pc-windows-gnu
#   - mingw-w64:    apt install mingw-w64 (Linux host) / brew (macOS host)
#
# Not run automatically by this session — reference script only, adapted
# from `archive/MinerP3.0.6/build-windows.sh` for the V31 workspace.
#
# Usage:  ./V31/release/build-windows.sh
# Output: V31/release/dist/windows-x86_64/zion-miner-windows-x86_64.zip
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V31_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${SCRIPT_DIR}/dist"
VERSION="v3.2.0"
FEATURES="public_build,auxpow,gpu-opencl,gpu-cuda,native-all,tui"

echo "=== ZION V31 Miner — Windows Public Boost Cross-Build ==="
echo "Version:  ${VERSION}"
echo "Target:   x86_64-pc-windows-gnu"
echo "Features: ${FEATURES}"
echo ""

if ! rustup target list --installed | grep -q 'x86_64-pc-windows-gnu'; then
    echo "ERROR: Rust target x86_64-pc-windows-gnu not installed."
    echo "  Run: rustup target add x86_64-pc-windows-gnu"
    exit 1
fi

if ! command -v x86_64-w64-mingw32-gcc &>/dev/null; then
    echo "ERROR: mingw-w64 not found (needed for the Windows linker)."
    exit 1
fi

cd "${V31_DIR}"
source "${HOME}/.cargo/env" 2>/dev/null || true

echo "[1/3] Cross-compiling zion-miner for Windows x86_64..."
ZION_CPU_TARGET=x86-64 ZION_DISABLE_OPENMP=1 \
    cargo build --release --target x86_64-pc-windows-gnu -p zion-miner \
        --bin zion-miner --features "${FEATURES}"

BINARY="${V31_DIR}/target/x86_64-pc-windows-gnu/release/zion-miner.exe"
if [[ ! -f "${BINARY}" ]]; then
    echo "ERROR: Binary not found at ${BINARY}"
    exit 1
fi

echo "[2/3] Packaging..."
ZIPDIR="${DIST_DIR}/windows-x86_64"
mkdir -p "${ZIPDIR}"
cp "${BINARY}" "${ZIPDIR}/zion-miner.exe"

cd "${DIST_DIR}"
rm -f windows-x86_64/zion-miner-windows-x86_64.zip
( cd windows-x86_64 && zip -r zion-miner-windows-x86_64.zip zion-miner.exe )

echo "[3/3] Computing SHA256..."
( cd windows-x86_64 && shasum -a 256 zion-miner-windows-x86_64.zip > SHA256SUMS.txt )

echo ""
echo "=== Build complete ==="
cat "${DIST_DIR}/windows-x86_64/SHA256SUMS.txt"
