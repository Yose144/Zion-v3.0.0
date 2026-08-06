#!/bin/bash
set -euo pipefail

VERSION="v3.1.9-vega-complete-62"
REPO="/home/zionserver/zion-build-local"
OUT_BIN="/var/www/zion-miner/zion-miner"
CONTAINER="zion-miner-build-${VERSION}"

echo "=== Docker SMOS build ${VERSION} (from local repo) ==="
docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true

docker run --name "${CONTAINER}" \
  -v "${REPO}:/src:ro" \
  rust:1.97.0-bullseye bash -c "
    set -euo pipefail
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq \
      build-essential pkg-config libssl-dev ca-certificates git rsync \
      ocl-icd-opencl-dev libdrm-dev libdrm-amdgpu1 mesa-opencl-icd kmod
    mkdir -p /build && rsync -a \
      --exclude=\".git\" --exclude=\"target\" --exclude=\"node_modules\" \
      --exclude=\"*.db\" --exclude=\"*.db-wal\" --exclude=\"*.db-shm\" \
      /src/ /build/
    rm -f /build/V3/L1/native-libs/libOpenCL.so /build/V3/L1/native-libs/libOpenCL.so.1
    cd /build/V3
    export RUSTFLAGS=\"-C target-cpu=x86-64\"
    cargo build --release -j 2 -p zion-miner \
      --features gpu-opencl,native-hashers,native-verushash,native-randomx \
      --bin zion-miner
    mkdir -p /out
    cp target/release/zion-miner /out/zion-miner
    chmod +x /out/zion-miner
    ls -la /out/zion-miner
  "

docker cp "${CONTAINER}:/out/zion-miner" "${OUT_BIN}.new"
docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true

echo "=== Verify GLIBC ==="
objdump -T "${OUT_BIN}.new" | grep -E "GLIBC_[0-9]" | sort -t_ -k2 -V | tail -5

echo "=== Install binary ==="
cp "${OUT_BIN}.new" "${OUT_BIN}"
chmod +x "${OUT_BIN}"
ls -la "${OUT_BIN}"
