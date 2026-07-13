#!/usr/bin/env bash
# Build zion-miner inside Ubuntu 20.04 for SMOS glibc compatibility
set -euo pipefail
VERSION="${1:-v3.0.32-gpu}"
REPO="/home/zionserver/2.9.6-main"
OUT_DIR="/var/www/zion-miner"
CONTAINER="zion-miner-build-${VERSION}"

echo "=== Docker SMOS build ${VERSION} ==="
docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
docker run --name "${CONTAINER}" \
  -v "${REPO}:/src:ro" \
  ubuntu:20.04 bash -c '
    set -euo pipefail
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq curl build-essential pkg-config libssl-dev ocl-icd-opencl-dev ca-certificates git
    curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    . "$HOME/.cargo/env"
    rustup default stable
    mkdir -p /build && cp -a /src/. /build/
    rm -rf /build/V3/target
    # Do not link bundled libOpenCL.so (needs glibc 2.34); use system ICD on SMOS
    rm -f /build/V3/L1/native-libs/libOpenCL.so /build/V3/L1/native-libs/libOpenCL.so.1
    cd /build/V3
    cargo build --release -p zion-miner --features '"'"'gpu-opencl native-hashers'"'"' --bin zion-miner
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
