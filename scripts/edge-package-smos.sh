#!/usr/bin/env bash
set -euo pipefail

# Package zion-miner for SimpleMining OS (SMOS) custom miner.
# Run from the repo root: ./scripts/edge-package-smos.sh [VERSION]

VERSION="${1:-v3.0.5-gpu}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="${2:-${REPO_ROOT}/target/release/zion-miner}"
OUT_DIR="${3:-/var/www/zion-miner}"
WORK="/tmp/zion-miner-${VERSION}"
OUT="${OUT_DIR}/zion-miner-${VERSION}.zip"

if [[ ! -f "${BIN}" ]]; then
    echo "ERROR: miner binary not found at ${BIN}"
    echo "Build it first: cargo build --release -p zion-miner --features 'gpu-opencl native-hashers'"
    exit 1
fi

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
cp "${BIN}" "${WORK}/zion-miner"

# SMOS custom miner entry point — keep the conventional name "miner".
cat > "${WORK}/miner" <<'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Defaults for SMOS / SimpleMining OS
export ZION_GPU_BACKEND="${ZION_GPU_BACKEND:-opencl}"
export ZION_PROFILE="${ZION_PROFILE:-pool}"
export ZION_LOOP_COUNT="${ZION_LOOP_COUNT:-1000000}"
export ZION_NONCE_AUTOTUNE="${ZION_NONCE_AUTOTUNE:-true}"
export ZION_METRICS_REPORT_SECS="${ZION_METRICS_REPORT_SECS:-30}"
export ZION_OCL_BUILD_OPTS="${ZION_OCL_BUILD_OPTS:--cl-std=CL1.2 -cl-mad-enable}"
export ZION_IGNORE_GPU_SELF_TEST_FAIL="${ZION_IGNORE_GPU_SELF_TEST_FAIL:-1}"
export ZION_VERBOSE=1
export ZION_INTERACTIVE=0
export ZION_MINER_ALGORITHM=deeksha_lite_v1

# Allow overriding the miner binary path
MINER_BIN="${MINER_BIN:-${SCRIPT_DIR}/zion-miner}"

exec "${MINER_BIN}" --pool "${ZION_POOL_ADDR:-62.171.141.136:8444}" \
  --wallet "${ZION_MINER_ID:-${WALLET:-}}" \
  --worker "${ZION_WORKER_NAME:-${WORKER:-smos-rig}}" \
  --profile "${ZION_PROFILE}" \
  ${ZION_THREADS:+--threads "${ZION_THREADS}"} \
  "$@"
EOF
chmod +x "${WORK}/miner" "${WORK}/zion-miner"

# Optional env file example
cat > "${WORK}/smos.env.example" <<'EOF'
# Optional SMOS env overrides
ZION_POOL_ADDR=62.171.141.136:8444
ZION_MINER_ID=zion1...
ZION_WORKER_NAME=vega-smos
ZION_GPU_BACKEND=opencl
ZION_PROFILE=pool
EOF

cd /tmp
rm -f "${OUT}"
zip -r "${OUT}" "$(basename "${WORK}")"
chmod 644 "${OUT}"
ls -la "${OUT}"
unzip -l "${OUT}"
echo "URL=https://zionterranova.com/zion-miner/zion-miner-${VERSION}.zip"
