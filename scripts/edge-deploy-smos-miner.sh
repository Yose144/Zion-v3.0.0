#!/usr/bin/env bash
# Build zion-miner on Edge and publish SMOS zip to /var/www/zion-miner/
set -euo pipefail

VERSION="${1:-v3.0.32-gpu}"
REPO="${REPO:-/root/zion-2.9.6-main}"
OUT_DIR="/var/www/zion-miner"
PKG_NAME="zion-miner-${VERSION}"
WORK="/tmp/${PKG_NAME}"

echo "=== Edge SMOS miner deploy ${VERSION} ==="
cd "${REPO}"

echo ">> git pull"
git pull --ff-only origin main || true

echo ">> build zion-miner (gpu-opencl)"
export PATH="${HOME}/.cargo/bin:${PATH}"
cargo build --release --manifest-path V3/Cargo.toml -p zion-miner --features gpu-opencl

BIN="${REPO}/V3/target/release/zion-miner"
test -x "${BIN}"

echo ">> glibc check"
python3 - <<'PY'
import re, sys
data = open(sys.argv[1], "rb").read()
vs = sorted({int(x) for x in re.findall(rb"GLIBC_2\.(\d+)", data)})
print("GLIBC max:", f"2.{max(vs)}" if vs else "unknown")
if vs and max(vs) > 31:
    print("WARN: binary may not run on SMOS glibc 2.31")
PY
"${BIN}"

rm -rf "${WORK}"
mkdir -p "${WORK}"

cp "${BIN}" "${WORK}/miner.real"
cat > "${WORK}/miner" << 'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export ZION_GPU_BACKEND=opencl
export ZION_LOOP_COUNT=1000000
export ZION_OCL_BUILD_OPTS="-cl-std=CL1.2 -cl-mad-enable"
export ZION_IGNORE_GPU_SELF_TEST_FAIL=1
# Canonical Ekam Deeksha full GPU pipeline (no GCN s4 split unless needed)
unset ZION_GCN_S4_MODE
exec "${SCRIPT_DIR}/miner.real" "$@"
EOF
chmod +x "${WORK}/miner" "${WORK}/miner.real"

cd /tmp
rm -f "${OUT_DIR}/${PKG_NAME}.zip"
zip -r "${OUT_DIR}/${PKG_NAME}.zip" "$(basename "${WORK}")"
chmod 644 "${OUT_DIR}/${PKG_NAME}.zip"
ls -la "${OUT_DIR}/${PKG_NAME}.zip"

echo "URL: https://zionterranova.com/zion-miner/${PKG_NAME}.zip"
echo "DONE"
