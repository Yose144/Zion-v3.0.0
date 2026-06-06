#!/bin/bash
set -euo pipefail

# ZION Agent Build Script
# Pouziti:
#   ./build.sh                    # Linux x86_64
#   ./build.sh --target aarch64-unknown-linux-gnu  # Cross-compile ARM
#   ./build.sh --release          # Release build

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET=""
PROFILE=""
FEATURES=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --target)
            TARGET="--target $2"
            shift 2
            ;;
        --release)
            PROFILE="--release"
            shift
            ;;
        --features)
            FEATURES="--features $2"
            shift 2
            ;;
        *)
            echo "Neznamy argument: $1"
            exit 1
            ;;
    esac
done

echo "=== ZION Agent Build ==="
echo "Target: ${TARGET:-host}"
echo "Profile: ${PROFILE:-dev}"
echo "Features: ${FEATURES:-default}"

cd "$SCRIPT_DIR"

# Check rustup target
if [[ -n "$TARGET" ]]; then
    rustup target add ${TARGET#--target } || true
fi

# Build
cargo build $PROFILE $TARGET $FEATURES

# Vystup
if [[ -n "$PROFILE" ]]; then
    BINARY="target${TARGET:+/${TARGET#--target }}/release/zion-agent"
else
    BINARY="target${TARGET:+/${TARGET#--target }}/debug/zion-agent"
fi

echo ""
echo "=== Build hotovo ==="
echo "Binary: $SCRIPT_DIR/$BINARY"
ls -lh "$BINARY"

# Volitelne: vytvorit .deb (pokud je cargo-deb nainstalovany)
if command -v cargo-deb &> /dev/null && [[ -n "$PROFILE" ]]; then
    echo ""
    echo "Vytvarim .deb balicek..."
    cargo deb $TARGET $FEATURES
fi
