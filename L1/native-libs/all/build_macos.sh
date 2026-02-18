#!/bin/bash
# ============================================================================
# ZION Cosmic Harmony v2 - macOS Build Script
# ============================================================================
# 
# This script builds the native library for macOS (Intel & Apple Silicon)
#
# Usage:
#   ./build_macos.sh           # Build for current architecture
#   ./build_macos.sh universal # Build Universal Binary (both architectures)
#
# Author: ZION AI Native Team
# Version: 2.9.5
# Date: January 2026
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔨 Building ZION Native Multi-Chain Libraries for macOS"
echo "======================================================="
echo

# Detect architecture
ARCH=$(uname -m)
echo "📍 Architecture: $ARCH"

# Build flags
COMMON_FLAGS="-O3 -shared -fPIC -DNDEBUG"

if [ "$1" == "universal" ]; then
    echo "🏗️  Building Universal Binary (arm64 + x86_64)..."
    
    # Build for ARM64 (Apple Silicon)
    echo "   → Building arm64..."
    clang $COMMON_FLAGS -arch arm64 cosmic_harmony_v2_native.c -o libcosmic_harmony_v2_arm64.dylib
    
    # Build for x86_64 (Intel) with AVX2
    echo "   → Building x86_64 (with AVX2)..."
    clang $COMMON_FLAGS -arch x86_64 -mavx2 cosmic_harmony_v2_native.c -o libcosmic_harmony_v2_x86_64.dylib
    
    # Create Universal Binary
    echo "   → Creating Universal Binary..."
    lipo -create libcosmic_harmony_v2_arm64.dylib libcosmic_harmony_v2_x86_64.dylib -output libcosmic_harmony_v2.dylib
    
    # Cleanup
    rm -f libcosmic_harmony_v2_arm64.dylib libcosmic_harmony_v2_x86_64.dylib
    
    echo "✅ Universal Binary created!"
    
elif [ "$ARCH" == "arm64" ]; then
    echo "🏗️  Building for Apple Silicon (ARM64 + NEON)..."
    clang $COMMON_FLAGS cosmic_harmony_v2_native.c -o libcosmic_harmony_v2.dylib
    echo "✅ ARM64 library created with NEON optimizations!"
    
else
    echo "🏗️  Building for Intel (x86_64 + AVX2)..."
    clang $COMMON_FLAGS -mavx2 cosmic_harmony_v2_native.c -o libcosmic_harmony_v2.dylib
    echo "✅ x86_64 library created with AVX2 optimizations!"
fi

echo
echo "📦 Output:"
ls -lh libcosmic_harmony_v2.dylib

echo
echo "🔍 Library info:"
file libcosmic_harmony_v2.dylib

echo
echo "📋 Exported symbols:"
nm -gU libcosmic_harmony_v2.dylib | grep cosmic

# Copy to mining directory
echo
echo "📁 Copying to parent directory..."
cp libcosmic_harmony_v2.dylib ../
echo "✅ Done!"

# ============================================================================
# BUILD COSMIC HARMONY v3
# ============================================================================

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔨 Building Cosmic Harmony v3 (Multi-Chain CHv3 Pipeline)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f cosmic_harmony_v3_native.c ]; then
    if [ "$ARCH" == "arm64" ]; then
        echo "🏗️  Building CHv3 for Apple Silicon (ARM64 + NEON)..."
        clang $COMMON_FLAGS cosmic_harmony_v3_native.c -o libcosmic_harmony_v3.dylib
    else
        echo "🏗️  Building CHv3 for Intel (x86_64)..."
        clang $COMMON_FLAGS cosmic_harmony_v3_native.c -o libcosmic_harmony_v3.dylib
    fi
    
    echo "✅ CHv3 library created!"
    ls -lh libcosmic_harmony_v3.dylib
    nm -gU libcosmic_harmony_v3.dylib | grep cosmic | head -5
    cp libcosmic_harmony_v3.dylib ../
    echo "✅ Copied to parent directory!"

    # Build Metal shader if Metal compiler available
    if xcrun --find metal > /dev/null 2>&1; then
        echo "🏗️  Compiling CHv3 Metal GPU shader..."
        xcrun -sdk macosx metal -c cosmic_harmony_v3_metal.metal -o cosmic_harmony_v3_metal.air
        xcrun -sdk macosx metallib cosmic_harmony_v3_metal.air -o cosmic_harmony_v3.metallib
        rm -f cosmic_harmony_v3_metal.air
        cp cosmic_harmony_v3.metallib ../
        echo "✅ CHv3 Metal shader compiled!"
    fi
else
    echo "⚠️  cosmic_harmony_v3_native.c not found, skipping CHv3"
fi

echo
echo "🧪 Quick test:"
python3 -c "
import ctypes
lib = ctypes.CDLL('$SCRIPT_DIR/libcosmic_harmony_v2.dylib')
lib.cosmic_v2_get_info.restype = ctypes.c_char_p
print(f'   CH v2: {lib.cosmic_v2_get_info().decode()}')
print('   ✅ CH v2 loads correctly!')
" 2>/dev/null || echo "   ⚠️  CH v2 Python test skipped"

python3 -c "
import ctypes
lib = ctypes.CDLL('$SCRIPT_DIR/libcosmic_harmony_v3.dylib')
lib.cosmic_harmony_v3_get_info.restype = ctypes.c_char_p
print(f'   CH v3: {lib.cosmic_harmony_v3_get_info().decode()}')
print('   ✅ CH v3 loads correctly!')
" 2>/dev/null || echo "   ⚠️  CH v3 Python test skipped"

echo
echo "🎉 Build complete!"
