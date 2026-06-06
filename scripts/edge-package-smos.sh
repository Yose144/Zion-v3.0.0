#!/usr/bin/env bash
set -euo pipefail
VERSION="${1:-v3.0.32-gpu}"
BIN="/root/zion-2.9.6-main/V3/target/release/zion-miner"
WORK="/tmp/zion-miner-${VERSION}"
OUT="/var/www/zion-miner/zion-miner-${VERSION}.zip"

python3 <<PY
import re
d=open("${BIN}","rb").read()
vs=sorted({int(x) for x in re.findall(rb"GLIBC_2\.(\d+)", d)})
print("GLIBC max:", f"2.{max(vs)}" if vs else "unknown")
if vs and max(vs)>31:
    print("WARNING: may break SMOS glibc 2.31")
PY

rm -rf "${WORK}"
mkdir -p "${WORK}"
cp "${BIN}" "${WORK}/miner.real"
cat > "${WORK}/miner" <<'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export ZION_GPU_BACKEND=opencl
export ZION_LOOP_COUNT=1000000
export ZION_OCL_BUILD_OPTS="-cl-std=CL1.2 -cl-mad-enable"
export ZION_IGNORE_GPU_SELF_TEST_FAIL=1
unset ZION_GCN_S4_MODE
exec "${SCRIPT_DIR}/miner.real" "$@"
EOF
chmod +x "${WORK}/miner" "${WORK}/miner.real"
cd /tmp
rm -f "${OUT}"
zip -r "${OUT}" "$(basename "${WORK}")"
chmod 644 "${OUT}"
ls -la "${OUT}"
unzip -l "${OUT}"
echo "URL=https://zionterranova.com/zion-miner/zion-miner-${VERSION}.zip"
