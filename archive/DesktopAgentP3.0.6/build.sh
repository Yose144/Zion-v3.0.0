#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# DesktopAgentP3.0.6/build.sh
# Build the public ZION Desktop Miner for Linux (x86_64).
#
# This packages the Electron desktop agent with a zion-miner compiled
# with the `public_build` feature. The UI shows only the ZION/Deeksha
# stream, but the miner still runs Trinity streams 2/3 in the background.
#
# Usage:  ./DesktopAgentP3.0.6/build.sh
# Output: DesktopAgentP3.0.6/dist/zion-public-miner-v3.1.0-linux-x86_64.AppImage
#         DesktopAgentP3.0.6/dist/zion-public-miner-v3.1.0-linux-amd64.deb
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="v3.1.0"

# Public release uses the generic x86-64 target by default for maximum
# compatibility. Override with ZION_CPU_TARGET=x86-64-v3 for the AVX2/BMI2 build.
export ZION_CPU_TARGET="${ZION_CPU_TARGET:-x86-64}"

echo "=== ZION Public Desktop Miner Build ==="
echo "Version:     ${VERSION}"
echo "CPU target:  ${ZION_CPU_TARGET}"
echo ""

cd "${SCRIPT_DIR}"

# Ensure dependencies are installed (do not copy parent node_modules).
if [[ ! -d "node_modules" ]]; then
  echo "[1/3] Installing Node dependencies..."
  npm ci
else
  echo "[1/3] node_modules already present, skipping npm ci"
fi

# build:linux automatically calls prepare:rust-miner, which compiles
# zion/zion-miner with the public_build feature and the chosen CPU target.
echo "[2/3] Packaging with electron-builder..."
ZION_CPU_TARGET="${ZION_CPU_TARGET}" npm run build:linux

echo "[3/3] Computing SHA256..."
cd "${SCRIPT_DIR}/dist"
sha256sum \
  zion-public-miner-${VERSION}-linux-x86_64.AppImage \
  zion-public-miner-${VERSION}-linux-amd64.deb \
  > SHA256SUMS.txt

echo ""
echo "=== Build complete ==="
echo "AppImage: $(du -h zion-public-miner-${VERSION}-linux-x86_64.AppImage | cut -f1)"
echo "DEB:      $(du -h zion-public-miner-${VERSION}-linux-amd64.deb | cut -f1)"
cat SHA256SUMS.txt
echo ""
echo "Upload to GitHub release:"
echo "  gh release create ${VERSION} --repo Zion-TerraNova/v3-Mainnet \\"
echo "    --title 'ZION Public Desktop Miner ${VERSION}' \\"
echo "    --notes-file ${SCRIPT_DIR}/RELEASE_NOTES.md \\"
echo "    --prerelease \\"
echo "    zion-public-miner-${VERSION}-linux-x86_64.AppImage \\"
echo "    zion-public-miner-${VERSION}-linux-amd64.deb \\"
echo "    SHA256SUMS.txt"
