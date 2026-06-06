#!/usr/bin/env bash
# Build ZionOS miner for SMOS (Linux x86_64, GLIBC ≤2.31)
# Uses Docker rust:bullseye (Debian 11, GLIBC 2.31)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== ZionOS SMOS Build ==="
echo "Repo root: $REPO_ROOT"

docker run --rm \
    -v "$REPO_ROOT:/src" \
    -w /src/ZionOS \
    rust:bullseye \
    bash -c '
        set -e
        echo "Building zionos-miner (CPU-only)..."
        cargo build --release -p zionos-miner 2>&1
        echo
        echo "Binary:"
        ls -lh /src/ZionOS/target/release/zionos-miner
        echo
        echo "GLIBC requirement:"
        objdump -T /src/ZionOS/target/release/zionos-miner | grep GLIBC | sed "s/.*GLIBC_/GLIBC_/" | sort -V | tail -1
    '

echo
echo "=== Build complete ==="
echo "Binary: ZionOS/target/release/zionos-miner"
