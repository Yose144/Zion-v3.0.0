#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# deploy-miner-release.sh
# Build zion-miner (with OpenCL GPU) and deploy to public
# download directory on the Prague production server.
#
# Usage:
#   SSH into Prague server and run from the repo root:
#   ./scripts/deploy-miner-release.sh
#
# Or cross-compile locally and scp:
#   ./scripts/deploy-miner-release.sh --upload user@91.98.122.165
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
V3_DIR="${REPO_ROOT}/V3"

DOWNLOADS_DIR="/opt/zion/downloads"
VERSION="v3.0.0"
TARGET="x86_64-unknown-linux-gnu"
UPLOAD_HOST="${1:-}"

echo "=== ZION Miner Release Builder ==="
echo "Version: ${VERSION}"
echo "Target:  ${TARGET}"

# ── Build ──
cd "${V3_DIR}"

echo "Building zion-core, zion-pool, zion-miner (vanilla)..."
cargo build --release --target "${TARGET}" 2>&1 | tail -5

echo "Building zion-miner with GPU OpenCL..."
cargo build --release --target "${TARGET}" --features gpu-opencl -p zion-miner 2>&1 | tail -5

RELEASE_DIR="${V3_DIR}/target/${TARGET}/release"

# ── Package: full bundle ──
echo "Packaging full bundle..."
BUNDLE_DIR="$(mktemp -d)"
cp "${RELEASE_DIR}/zion-core"  "${BUNDLE_DIR}/" 2>/dev/null || true
cp "${RELEASE_DIR}/zion-pool"  "${BUNDLE_DIR}/" 2>/dev/null || true
cp "${RELEASE_DIR}/zion-miner" "${BUNDLE_DIR}/"
FULL_TAR="zion-${VERSION}-linux-x86_64.tar.gz"
tar czf "/tmp/${FULL_TAR}" -C "${BUNDLE_DIR}" .
sha256sum "/tmp/${FULL_TAR}" > "/tmp/${FULL_TAR}.sha256"

# ── Package: SMOS bundle ──
echo "Packaging SMOS bundle..."
SMOS_DIR="$(mktemp -d)"
cp "${RELEASE_DIR}/zion-miner" "${SMOS_DIR}/"
cp "${V3_DIR}/scripts/smos/start-zion-miner.sh" "${SMOS_DIR}/"
cp "${V3_DIR}/scripts/smos/smos.env.example" "${SMOS_DIR}/"
chmod +x "${SMOS_DIR}/start-zion-miner.sh"
SMOS_TAR="zion-miner-${VERSION}-smos-linux-x86_64.tar.gz"
tar czf "/tmp/${SMOS_TAR}" -C "${SMOS_DIR}" .
sha256sum "/tmp/${SMOS_TAR}" > "/tmp/${SMOS_TAR}.sha256"

# ── Package: standalone miner ──
echo "Packaging standalone miner..."
MINER_TAR="zion-miner-${VERSION}-linux-x86_64.tar.gz"
tar czf "/tmp/${MINER_TAR}" -C "${RELEASE_DIR}" zion-miner
sha256sum "/tmp/${MINER_TAR}" > "/tmp/${MINER_TAR}.sha256"

# ── Deploy ──
if [[ "${UPLOAD_HOST}" == --upload* ]]; then
  HOST="${2:?Usage: $0 --upload user@host}"
  echo "Uploading to ${HOST}:${DOWNLOADS_DIR}..."
  ssh "${HOST}" "mkdir -p ${DOWNLOADS_DIR}"
  scp /tmp/${FULL_TAR} /tmp/${FULL_TAR}.sha256 \
      /tmp/${SMOS_TAR} /tmp/${SMOS_TAR}.sha256 \
      /tmp/${MINER_TAR} /tmp/${MINER_TAR}.sha256 \
      "${HOST}:${DOWNLOADS_DIR}/"
  echo "Upload complete."
else
  echo "Installing to ${DOWNLOADS_DIR}..."
  sudo mkdir -p "${DOWNLOADS_DIR}"
  sudo cp /tmp/${FULL_TAR} /tmp/${FULL_TAR}.sha256 \
          /tmp/${SMOS_TAR} /tmp/${SMOS_TAR}.sha256 \
          /tmp/${MINER_TAR} /tmp/${MINER_TAR}.sha256 \
          "${DOWNLOADS_DIR}/"
  sudo chmod 644 "${DOWNLOADS_DIR}"/*
  echo "Installed to ${DOWNLOADS_DIR}/."
fi

# ── Verify ──
echo ""
echo "=== Artifacts ==="
ls -lh /tmp/zion-*${VERSION}* 2>/dev/null
echo ""
echo "=== SHA256 ==="
cat /tmp/${FULL_TAR}.sha256
cat /tmp/${SMOS_TAR}.sha256
cat /tmp/${MINER_TAR}.sha256
echo ""
echo "=== Public URLs (after website deploy) ==="
echo "Full:  https://zionterranova.com/api/downloads/${FULL_TAR}"
echo "SMOS:  https://zionterranova.com/api/downloads/${SMOS_TAR}"
echo "Miner: https://zionterranova.com/api/downloads/${MINER_TAR}"
echo ""
echo "Done."
