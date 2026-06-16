#!/bin/bash
################################################################################
# ZION 2.8.3 Phase 3.2: Quick PyInstaller Build
# Simplified version that uses project venv
################################################################################

set -e

cd /home/zion/ZION

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║     ZION 2.8.3 Phase 3.2: Binary Build (Quick)                    ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# Activate venv
source .venv/bin/activate

echo "[1/5] Creating build directory..."
mkdir -p build_zion/binaries
cd build_zion/binaries

echo "[2/5] Building zion-cli (simple test)..."
pyinstaller --onefile \
    --name zion-cli \
    --clean \
    ../../zion_cli.py 2>&1 | grep -E "(Building|Completed|Analysis|EXE)" || true

echo ""
echo "[3/5] Checking build output..."
if [ -f "dist/zion-cli" ]; then
    SIZE=$(du -h dist/zion-cli | cut -f1)
    echo "✅ zion-cli built successfully: $SIZE"
    
    echo ""
    echo "[4/5] Testing binary..."
    ./dist/zion-cli --help 2>&1 | head -20 || echo "  (Needs runtime testing)"
else
    echo "❌ zion-cli build failed"
    exit 1
fi

echo ""
echo "[5/5] Creating release package..."
mkdir -p ../../releases/v2.8.3
cd dist
tar -czf ../../../releases/v2.8.3/zion-cli-2.8.3-linux-amd64.tar.gz zion-cli
cd ../../..

PACKAGE_SIZE=$(du -h releases/v2.8.3/zion-cli-2.8.3-linux-amd64.tar.gz | cut -f1)
echo "✅ Package created: $PACKAGE_SIZE"

echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                    BUILD COMPLETE                                  ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📦 Binary: build_zion/binaries/dist/zion-cli"
echo "📦 Package: releases/v2.8.3/zion-cli-2.8.3-linux-amd64.tar.gz"
echo ""
