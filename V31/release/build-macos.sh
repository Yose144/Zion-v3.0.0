#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# V31/release/build-macos.sh
# Build the public-facing ZION miner binaries for macOS
# (Apple Silicon aarch64 + Intel x86_64) with the `public_build` feature.
#
# The public miner runs the canonical ZION / Ekam Deeksha v3.2 PoW.
# Stream 2/3 AuxPoW ("Boost") still run in the background to optimize
# revenue, but their coin names (ZANO, VRSC, etc.) are never shown in the
# TUI, banner, or logs — see `V31/L1/miner/src/ext_log.rs` and the
# `#[cfg(feature = "public_build")]` gates in `ui.rs` / `interactive.rs` /
# `banner.rs` / `auto_detect.rs`.
#
# Usage:  ./V31/release/build-macos.sh
# Output: V31/release/dist/macos-{aarch64,x86_64}/zion-miner-macos-*.tar.gz
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V31_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${SCRIPT_DIR}/dist"
VERSION="v3.2.0"
FEATURES="public_build,auxpow,gpu-opencl,gpu-metal,native-all,tui"

echo "=== ZION V31 Miner — macOS Public Boost Build ==="
echo "Version:  ${VERSION}"
echo "Features: ${FEATURES}"
echo ""

cd "${V31_DIR}"
source "${HOME}/.cargo/env" 2>/dev/null || true

echo "[1/3] Building macOS aarch64 (native)..."
cargo build --release -p zion-miner --bin zion-miner --features "${FEATURES}"

echo "[2/3] Building macOS x86_64 (cross-compile)..."
cargo build --release --target x86_64-apple-darwin -p zion-miner --bin zion-miner --features "${FEATURES}"

echo "[3/3] Packaging..."
for arch in aarch64 x86_64; do
    dest="${DIST_DIR}/macos-${arch}"
    mkdir -p "${dest}"
    if [[ "${arch}" == "aarch64" ]]; then
        src="${V31_DIR}/target/release/zion-miner"
    else
        src="${V31_DIR}/target/x86_64-apple-darwin/release/zion-miner"
    fi
    cp "${src}" "${dest}/zion-miner"
    chmod +x "${dest}/zion-miner"
    tar czf "${dest}/zion-miner-macos-${arch}.tar.gz" -C "${dest}" zion-miner
    ( cd "${dest}" && shasum -a 256 "zion-miner-macos-${arch}.tar.gz" > SHA256SUMS.txt )
done

cd "${DIST_DIR}"
shasum -a 256 macos-aarch64/zion-miner-macos-aarch64.tar.gz macos-x86_64/zion-miner-macos-x86_64.tar.gz > SHA256SUMS.txt

echo ""
echo "=== Build complete ==="
cat SHA256SUMS.txt
