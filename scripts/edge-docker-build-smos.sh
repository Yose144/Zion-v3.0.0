#!/usr/bin/env bash
# Build zion-miner inside Debian bullseye for SMOS glibc 2.31/2.30 compatibility
set -euo pipefail
VERSION="${1:-v3.0.34-parallel-stream}"
REPO="/opt/zion"
OUT_DIR="${OUT_DIR:-/var/www/zion-miner}"
CONTAINER="zion-miner-build-${VERSION}"

echo "=== Docker SMOS build ${VERSION} ==="
docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
docker run --name "${CONTAINER}" \
  -v "${REPO}:/src:ro" \
  rust:1.97.0-bullseye bash -c '
    set -euo pipefail
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq \
      build-essential pkg-config libssl-dev ca-certificates git rsync \
      ocl-icd-opencl-dev libdrm-dev libdrm-amdgpu1 mesa-opencl-icd kmod
    mkdir -p /build && rsync -a \
      --exclude=".venv" --exclude="target" --exclude="node_modules" \
      --exclude=".git" --exclude="__pycache__" --exclude="*.pyc" \
      --exclude="APP&WEB" --exclude="ZionDex" --exclude="PoC-lab" \
      --exclude="HiranV2.x" --exclude="edge-deploy" --exclude="docs" \
      --exclude="archive" --exclude="ZION_OS" --exclude="ZionStart" \
      --exclude="public" --exclude="*.db" --exclude="*.db-wal" \
      --exclude="*.db-shm" --exclude="edge-state.db*" \
      /src/ /build/
    # Do not link bundled libOpenCL.so (needs glibc 2.34); use system ICD on SMOS
    rm -f /build/V3/L1/native-libs/libOpenCL.so /build/V3/L1/native-libs/libOpenCL.so.1
    cd /build/V3
    cargo build --release -j 2 -p zion-miner --features '"'"'gpu-opencl,native-hashers,native-cosmic-harmony,native-randomx,native-verushash'"'"' --bin zion-miner
    mkdir -p /out
    cp target/release/zion-miner /out/zion-miner
    chmod +x /out/zion-miner
    ls -la /out/zion-miner
  '

mkdir -p /tmp/zion-docker-out
docker cp "${CONTAINER}:/out/zion-miner" /tmp/zion-docker-out/zion-miner
docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true

# Package using edge-package-smos.sh so the SMOS wrapper matches production.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
bash "${SCRIPT_DIR}/edge-package-smos.sh" "${VERSION}" /tmp/zion-docker-out/zion-miner "${OUT_DIR}"
