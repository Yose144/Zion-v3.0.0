#!/usr/bin/env bash
# Build zion-pool-server inside Ubuntu 20.04 for glibc compatibility
set -euo pipefail
VERSION="${1:-v3.0.5-pool}"
REPO="/root/zion/2.9.6"
OUT_DIR="${2:-/tmp}"
CONTAINER="zion-pool-build-${VERSION}"

echo "=== Docker pool build ${VERSION} ==="
docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
docker run --name "${CONTAINER}" \
  -v "${REPO}:/src:ro" \
  ubuntu:20.04 bash -c '
    set -euo pipefail
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq curl build-essential pkg-config libssl-dev ca-certificates git
    curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    . "$HOME/.cargo/env"
    rustup default stable
    mkdir -p /build && cp -a /src/. /build/
    rm -rf /build/V3/target
    cd /build/V3
    cargo build --release -p zion-pool --bin server
    mkdir -p /out
    cp target/release/server /out/zion-pool-server
    chmod +x /out/zion-pool-server
    ls -la /out/zion-pool-server
  '

OUT="${OUT_DIR}/zion-pool-server-${VERSION}"
mkdir -p "${OUT_DIR}"
docker cp "${CONTAINER}:/out/zion-pool-server" "${OUT}"
docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true
ls -la "${OUT}"
echo "OUT=${OUT}"
