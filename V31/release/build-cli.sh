#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# V31/release/build-cli.sh
# Build the public-facing ZION unified CLI binary (`zion`) from the V31
# workspace. The CLI bundles wallet, node status, pool, mining status and
# Multichain commands in a single portable binary with no GPU dependencies.
#
# Usage:  ./V31/release/build-cli.sh
#         ZION_TARGET=x86_64-unknown-linux-gnu ./V31/release/build-cli.sh
# Output: V31/release/dist/cli/zion-cli-v3.2.0-<target>.tar.gz (or .zip)
# ──────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V31_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${SCRIPT_DIR}/dist/cli"
VERSION="v3.2.0"

# Detect host triple unless overridden
DEFAULT_TARGET="$(rustc -vV | sed -n 's/^host: //p')"
TARGET="${ZION_TARGET:-${DEFAULT_TARGET}}"

case "${TARGET}" in
  x86_64-unknown-linux-gnu|aarch64-unknown-linux-gnu)
    PACKAGE_EXT="tar.gz"
    ;;
  x86_64-apple-darwin|aarch64-apple-darwin)
    PACKAGE_EXT="tar.gz"
    ;;
  x86_64-pc-windows-gnu|x86_64-pc-windows-msvc)
    PACKAGE_EXT="zip"
    ;;
  *)
    echo "WARNING: Unknown target '${TARGET}', defaulting to tar.gz"
    PACKAGE_EXT="tar.gz"
    ;;
esac

ASSET_NAME="zion-cli-${VERSION}-${TARGET}.${PACKAGE_EXT}"

echo "=== ZION V31 Public CLI Build ==="
echo "Version:  ${VERSION}"
echo "Target:   ${TARGET}"
echo "Output:   ${DIST_DIR}/${ASSET_NAME}"
echo ""

cd "${V31_DIR}"
source "${HOME}/.cargo/env" 2>/dev/null || true

echo "[1/2] Building zion-cli..."
cargo build --release -p zion-cli --target "${TARGET}"

echo "[2/2] Packaging..."
mkdir -p "${DIST_DIR}"

BIN_EXT=""
[[ "${TARGET}" == *windows* ]] && BIN_EXT=".exe"

SRC="${V31_DIR}/target/${TARGET}/release/zion${BIN_EXT}"
if [[ ! -x "${SRC}" && ! -f "${SRC}" ]]; then
  echo "ERROR: Binary not found at ${SRC}"
  exit 1
fi

TMPDIR="$(mktemp -d)"
cp "${SRC}" "${TMPDIR}/zion${BIN_EXT}"
chmod +x "${TMPDIR}/zion${BIN_EXT}" 2>/dev/null || true

cd "${TMPDIR}"
if [[ "${PACKAGE_EXT}" == "zip" ]]; then
  rm -f "${DIST_DIR}/${ASSET_NAME}"
  zip -r "${DIST_DIR}/${ASSET_NAME}" "zion${BIN_EXT}"
else
  tar czf "${DIST_DIR}/${ASSET_NAME}" "zion${BIN_EXT}"
fi
rm -rf "${TMPDIR}"

cd "${DIST_DIR}"
sha256sum "${ASSET_NAME}" > SHA256SUMS.txt

echo ""
echo "=== Build complete ==="
ls -lh "${ASSET_NAME}"
cat SHA256SUMS.txt
