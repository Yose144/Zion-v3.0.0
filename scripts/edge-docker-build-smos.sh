#!/usr/bin/env bash
# Build zion-miner inside Ubuntu 20.04 for SMOS glibc compatibility
set -euo pipefail
VERSION="${1:-v3.0.32-gpu}"
REPO="/root/zion-2.9.6-main"
OUT="/var/www/zion-miner/zion-miner-${VERSION}.zip"
WORK="/tmp/zion-miner-${VERSION}"

echo "=== Docker SMOS build ${VERSION} ==="
docker run --rm \
  -v "${REPO}:/src:ro" \
  -v /tmp/zion-docker-out:/out \
  ubuntu:20.04 bash -c '
    set -euo pipefail
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq curl build-essential pkg-config libssl-dev ocl-icd-opencl-dev ca-certificates git
    curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    . "$HOME/.cargo/env"
    rustup default stable
    cp -a /src /build
    rm -rf /build/V3/target
    # Do not link bundled libOpenCL.so (needs glibc 2.34); use system ICD on SMOS
    rm -f /build/V3/L1/native-libs/libOpenCL.so /build/V3/L1/native-libs/libOpenCL.so.1
    cd /build/V3
    cargo build --release -p zion-miner --features gpu-opencl --bin zion-miner
    cp target/release/zion-miner /out/zion-miner
    chmod +x /out/zion-miner
  '

BIN="/tmp/zion-docker-out/zion-miner"
python3 /root/check-glibc.py "${BIN}"

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
python3 /root/check-glibc.py "${OUT}"
ls -la "${OUT}"
echo "URL=https://zionterranova.com/zion-miner/zion-miner-${VERSION}.zip"
