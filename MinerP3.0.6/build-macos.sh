#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# MinerP3.0.6/build-macos.sh
# Build the public-facing ZION miner binaries for macOS
# (Apple Silicon aarch64 + Intel x86_64) with the public_build feature.
#
# The miner is locked to the ZION / Deeksha Lite v1 algorithm:
# external Trinity / AuxPoW streams run only in the backend.
#
# Usage:  ./MinerP3.0.6/build-macos.sh
# Output: public/release-artifacts/v3.0.6-beta/macos-{aarch64,x86_64}/
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
V3_DIR="${REPO_ROOT}/V3"
ARTIFACT_DIR="${REPO_ROOT}/public/release-artifacts/v3.0.6-beta"
VERSION="v3.0.6-beta"
FEATURES="public_build,gpu-metal,native-all"

echo "=== ZION Miner macOS Public Build ==="
echo "Version: ${VERSION}"
echo "Features: ${FEATURES}"
echo ""

# Build Apple Silicon binary
# (native target)
echo "[1/4] Building macOS aarch64..."
cd "${V3_DIR}"
cargo build --release -p zion-miner --features "${FEATURES}"

# Build Intel binary
# (cross-compile when running on Apple Silicon)
echo "[2/4] Building macOS x86_64..."
cargo build --release --target x86_64-apple-darwin -p zion-miner --features "${FEATURES}"

# Package
echo "[3/4] Packaging..."
for arch in aarch64 x86_64; do
    dest="${ARTIFACT_DIR}/macos-${arch}"
    mkdir -p "${dest}"
    if [[ "${arch}" == "aarch64" ]]; then
        cp "${V3_DIR}/target/release/zion-miner" "${dest}/zion-miner"
    else
        cp "${V3_DIR}/target/x86_64-apple-darwin/release/zion-miner" "${dest}/zion-miner"
    fi
    chmod +x "${dest}/zion-miner"
    tar czf "${dest}/zion-miner-macos-${arch}.tar.gz" -C "${dest}" zion-miner
    shasum -a 256 "${dest}/zion-miner-macos-${arch}.tar.gz" > "${dest}/SHA256SUMS.txt"
done

# Update combined checksums
echo "[4/4] Updating SHA256SUMS..."
cd "${ARTIFACT_DIR}"
shasum -a 256 \
    linux-x86_64/zion-miner-linux-x86_64.tar.gz \
    linux-aarch64/zion-miner-linux-aarch64.tar.gz \
    macos-aarch64/zion-miner-macos-aarch64.tar.gz \
    macos-x86_64/zion-miner-macos-x86_64.tar.gz \
    windows-x86_64/zion-miner-windows-x86_64.zip \
    > SHA256SUMS.txt

echo ""
echo "=== Build complete ==="
cat SHA256SUMS.txt
