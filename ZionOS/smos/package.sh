#!/usr/bin/env bash
# Package ZionOS miner into SMOS-compatible ZIP.
#
# SMOS custom miner ZIP format:
#   zionos-miner-vX.Y.Z/
#     miner          ← main executable (must be named "miner")
#
# Usage: ./package.sh [version]
#   e.g. ./package.sh v0.1.0
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ZIONOS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BINARY="$ZIONOS_ROOT/target/release/zionos-miner"

VERSION="${1:-v0.1.0}"
PKG_NAME="zionos-miner-${VERSION}"

if [ ! -f "$BINARY" ]; then
    echo "ERROR: Binary not found at $BINARY"
    echo "Run build.sh first."
    exit 1
fi

# Create staging directory
STAGING="/tmp/${PKG_NAME}"
rm -rf "$STAGING"
mkdir -p "$STAGING"

# Copy binary as "miner" (SMOS requirement)
cp "$BINARY" "$STAGING/miner"
chmod +x "$STAGING/miner"

# Create ZIP
OUTPUT="$ZIONOS_ROOT/dist/${PKG_NAME}.zip"
mkdir -p "$(dirname "$OUTPUT")"
cd /tmp
rm -f "$OUTPUT"
zip -r "$OUTPUT" "$PKG_NAME/"

echo
echo "=== Package ready ==="
echo "  File: $OUTPUT"
echo "  Size: $(du -h "$OUTPUT" | cut -f1)"
echo
echo "SMOS minerOptions format:"
echo "  http://<server>/downloads/${PKG_NAME}.zip --pool <host>:3333 --wallet <zion1…> --worker <name>"

# Cleanup
rm -rf "$STAGING"
