#!/usr/bin/env bash
# Build zion-miner for Linux (AMD64) on the Edge server
# Run this on Edge (77.42.71.94) after SSH login

set -euo pipefail

REPO_DIR="${REPO_DIR:-/root/zion-2.9.6-main}"
BUILD_DIR="${REPO_DIR}/V3"
TARGET_DIR="${REPO_DIR}/ZionOS/dist"

echo "═══ Building zion-miner for Linux ═══"
cd "$BUILD_DIR"

# Build miner with release profile
cargo build --manifest-path Cargo.toml -p zion-miner --release

mkdir -p "$TARGET_DIR"
cp target/release/zion-miner "$TARGET_DIR/zion-miner-linux-amd64"
cp target/release/zion-miner "$TARGET_DIR/zion-miner"

echo "Built: $TARGET_DIR/zion-miner-linux-amd64"
echo "Size: $(du -h $TARGET_DIR/zion-miner-linux-amd64 | cut -f1)"
