#!/bin/bash
# Build native libraries for Linux
# ZION TerraNova v2.9.5
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_DIR="$SCRIPT_DIR/all"
OUT_DIR="$SCRIPT_DIR"

echo '=== Building Linux .so libraries ==='
echo "Source: $SRC_DIR"
echo "Output: $OUT_DIR"
echo ''

# Common flags
CFLAGS='-O3 -fPIC -shared -march=native -DLINUX'

cd "$SRC_DIR"

# Build each algorithm
build_lib() {
    local name=$1
    local src=$2
    local extra=$3
    
    echo -n "Building $name... "
    if gcc $CFLAGS -o "$OUT_DIR/lib${name}_zion.so" "$src" $extra -lm 2>/dev/null; then
        echo "✓"
        return 0
    else
        echo "✗ (trying without -march=native)"
        if gcc -O3 -fPIC -shared -DLINUX -o "$OUT_DIR/lib${name}_zion.so" "$src" $extra -lm 2>/dev/null; then
            echo "  ✓ (fallback)"
            return 0
        fi
        echo "  ✗ FAILED"
        return 1
    fi
}

# Build all algorithms
build_lib "cosmic_harmony_v2" "cosmic_harmony_v2_native.c"
build_lib "argon2d" "argon2d_native.c"
build_lib "autolykos" "autolykos_v2_native.c"
build_lib "blake3" "blake3_native.c"
build_lib "equihash" "equihash_native.c"
build_lib "ethash" "ethash_native.c"
build_lib "kawpow" "kawpow_native.c"
build_lib "progpow" "progpow_native.c"
build_lib "kheavyhash" "kheavyhash_native.c"

echo ''
echo '=== Build Summary ==='
echo "Linux .so libraries in $OUT_DIR:"
ls -la "$OUT_DIR"/*.so 2>/dev/null | grep -v '.so.' | wc -l
ls -la "$OUT_DIR"/*.so 2>/dev/null | grep -v '.so.'

echo ''
echo 'Build complete!'
