#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# MinerP3.0.6/build-windows.sh
# Cross-compile the public-facing ZION miner binary for Windows x86_64
# using the `x86_64-pc-windows-gnu` target (mingw-w64 linker).
#
# The miner is built with `public_build` (Trinity hidden in TUI) and
# `full` (OpenCL + CUDA + native-all + native-hashers).  Metal is
# target-gated to macOS and is a no-op on Windows.
#
# Prerequisites:
#   - Rust target:  rustup target add x86_64-pc-windows-gnu
#   - mingw-w64:    apt install mingw-w64
#
# Usage:  ./MinerP3.0.6/build-windows.sh
# Output: MinerP3.0.6/dist/zion-miner-windows-x86_64.zip
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}") && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
V3_DIR="${REPO_ROOT}/V3"
DIST_DIR="${SCRIPT_DIR}/dist"
VERSION="v3.0.6-beta"

echo "=== ZION Miner Windows Cross-Build ==="
echo "Version: ${VERSION}"
echo "Target:  x86_64-pc-windows-gnu"
echo "Feature: public_build + full (OpenCL + CUDA + native-all + native-hashers)"
echo ""

# ── Check prerequisites ──
if ! rustup target list --installed | grep -q 'x86_64-pc-windows-gnu'; then
    echo "ERROR: Rust target x86_64-pc-windows-gnu not installed."
    echo "  Run: rustup target add x86_64-pc-windows-gnu"
    exit 1
fi

if ! command -v x86_64-w64-mingw32-gcc &>/dev/null; then
    echo "ERROR: mingw-w64 not found."
    echo "  Run: sudo apt install mingw-w64"
    exit 1
fi

# ── Build ──
cd "${V3_DIR}"
echo "[1/3] Cross-compiling zion-miner for Windows x86_64..."
source ~/.cargo/env 2>/dev/null || true
ZION_CPU_TARGET=x86-64 ZION_DISABLE_OPENMP=1 \
    cargo build --release --target x86_64-pc-windows-gnu -p zion-miner \
        --bin zion-miner \
        --features public_build,full \
        2>&1 | tail -5

BINARY="${V3_DIR}/target/x86_64-pc-windows-gnu/release/zion-miner.exe"
if [[ ! -f "${BINARY}" ]]; then
    echo "ERROR: Binary not found at ${BINARY}"
    exit 1
fi

# ── Package ──
echo "[2/3] Packaging..."
mkdir -p "${DIST_DIR}"
rm -f "${DIST_DIR}/zion-miner-windows-x86_64.zip"

ZIPDIR="${DIST_DIR}/zion-miner-windows-x86_64"
mkdir -p "${ZIPDIR}"
cp "${BINARY}" "${ZIPDIR}/zion-miner.exe"
cp "${SCRIPT_DIR}/dist/start.bat" "${ZIPDIR}/start.bat"

cd "${DIST_DIR}"
rm -f zion-miner-windows-x86_64.zip
zip -r zion-miner-windows-x86_64.zip zion-miner-windows-x86_64/
rm -rf zion-miner-windows-x86_64/

# ── SHA256 ──
echo "[3/3] Computing SHA256..."
sha256sum zion-miner-windows-x86_64.zip > SHA256SUMS-windows.txt

echo ""
echo "=== Build complete ==="
echo "Binary:  ${DIST_DIR}/zion-miner-windows-x86_64.zip"
echo "Size:    $(du -h "${DIST_DIR}/zion-miner-windows-x86_64.zip" | cut -f1)"
echo "SHA256:  $(cat SHA256SUMS-windows.txt)"
echo ""
echo "Upload to GitHub release:"
echo "  gh release upload ${VERSION} --repo Zion-TerraNova/v3-Mainnet \\"
echo "    ${DIST_DIR}/zion-miner-windows-x86_64.zip ${DIST_DIR}/SHA256SUMS-windows.txt"
