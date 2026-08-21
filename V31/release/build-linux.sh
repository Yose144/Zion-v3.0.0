#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# V31/release/build-linux.sh
# Cross/native-compile the public-facing ZION miner binary for Linux
# x86_64 with the `public_build` feature (public Boost release).
#
# Requires a Linux host or cross toolchain for x86_64-unknown-linux-gnu.
# Not run automatically by this session — reference script only, adapted
# from `archive/MinerP3.0.6/build.sh` for the V31 workspace/feature set.
#
# Usage:  ./V31/release/build-linux.sh
# Output: V31/release/dist/linux-x86_64/zion-miner-linux-x86_64.tar.gz
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V31_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${SCRIPT_DIR}/dist"
VERSION="v3.2.0"
FEATURES="public_build,auxpow,gpu-opencl,gpu-cuda,native-all,tui"

echo "=== ZION V31 Miner — Linux Public Boost Build ==="
echo "Version:  ${VERSION}"
echo "Features: ${FEATURES}"
echo ""

cd "${V31_DIR}"
source "${HOME}/.cargo/env" 2>/dev/null || true

echo "[1/3] Building linux-x86_64..."
ZION_CPU_TARGET=x86-64 ZION_DISABLE_OPENMP=1 \
    cargo build --release --target x86_64-unknown-linux-gnu -p zion-miner \
        --bin zion-miner --features "${FEATURES}"

BINARY="${V31_DIR}/target/x86_64-unknown-linux-gnu/release/zion-miner"
if [[ ! -x "${BINARY}" ]]; then
    echo "ERROR: Binary not found at ${BINARY}"
    exit 1
fi

echo "[2/3] Packaging..."
dest="${DIST_DIR}/linux-x86_64"
mkdir -p "${dest}"
cp "${BINARY}" "${dest}/zion-miner"
chmod +x "${dest}/zion-miner"
tar czf "${dest}/zion-miner-linux-x86_64.tar.gz" -C "${dest}" zion-miner

echo "[3/3] Computing SHA256..."
( cd "${dest}" && shasum -a 256 "zion-miner-linux-x86_64.tar.gz" > SHA256SUMS.txt )

echo ""
echo "=== Build complete ==="
cat "${dest}/SHA256SUMS.txt"
