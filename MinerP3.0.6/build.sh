#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# MinerP3.0.6/build.sh
# Build the public-facing ZION miner binary (v3.0.6-beta) with the
# `public_build` feature flag enabled.
#
# The public miner is locked to the ZION / Deeksha Lite v1 algorithm.
# Trinity (AuxPoW) backend support is still compiled in, but the TUI and
# logs show only the ZION stream — no ZANO, VRSC, or other external
# coin names are visible to the user.
#
# Usage:  ./MinerP3.0.6/build.sh
# Output: MinerP3.0.6/dist/zion-miner-linux-x86_64.tar.gz
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
V3_DIR="${REPO_ROOT}/V3"
DIST_DIR="${SCRIPT_DIR}/dist"
VERSION="v3.0.6-beta"

echo "=== ZION Miner Public Build ==="
echo "Version: ${VERSION}"
echo "Feature: public_build (Trinity hidden in TUI)"
echo ""

# ── Build ──
cd "${V3_DIR}"
echo "[1/3] Building zion-miner with public_build + OpenCL + CUDA + native hashers..."
cd "${V3_DIR}"
source ~/.cargo/env 2>/dev/null || true
ZION_CPU_TARGET=x86-64 ZION_DISABLE_OPENMP=1 \
    cargo build --release --target x86_64-unknown-linux-gnu -p zion-miner \
        --bin zion-miner \
        --features public_build,gpu-opencl,gpu-cuda,native-all,native-hashers \
        2>&1 | tail -5

BINARY="${V3_DIR}/target/x86_64-unknown-linux-gnu/release/zion-miner"
if [[ ! -x "${BINARY}" ]]; then
    echo "ERROR: Binary not found at ${BINARY}"
    exit 1
fi

# ── Package ──
echo "[2/3] Packaging..."
mkdir -p "${DIST_DIR}"
rm -f "${DIST_DIR}/zion-miner-linux-x86_64.tar.gz"

TARBALL="${DIST_DIR}/zion-miner-linux-x86_64.tar.gz"
tar czf "${TARBALL}" -C "$(dirname "${BINARY}")" "$(basename "${BINARY}")"

# ── SHA256 ──
echo "[3/3] Computing SHA256..."
cd "${DIST_DIR}"
sha256sum zion-miner-linux-x86_64.tar.gz > SHA256SUMS.txt

echo ""
echo "=== Build complete ==="
echo "Binary:  ${TARBALL}"
echo "Size:    $(du -h "${TARBALL}" | cut -f1)"
echo "SHA256:  $(cat SHA256SUMS.txt)"
echo ""
echo "Upload to GitHub release:"
echo "  gh release create ${VERSION} --repo Zion-TerraNova/v3-Mainnet \\"
echo "    --title 'ZION v3.0.6-beta — Public Miner' \\"
echo "    --notes-file ${SCRIPT_DIR}/RELEASE_NOTES.md \\"
echo "    --prerelease \\"
echo "    ${TARBALL} ${DIST_DIR}/SHA256SUMS.txt"
