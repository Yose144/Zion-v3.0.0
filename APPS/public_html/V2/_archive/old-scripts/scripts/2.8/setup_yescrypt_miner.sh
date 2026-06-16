#!/bin/bash
#
# 📥 ZION Yescrypt Miner Setup Script
# Downloads and installs cpuminer-opt for real Yescrypt mining
#

set -e

echo "=============================================="
echo "🚀 ZION Yescrypt Miner Setup"
echo "=============================================="
echo ""
echo "Installing cpuminer-opt by JayDDee"
echo "Repository: https://github.com/JayDDee/cpuminer-opt"
echo ""

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    echo "❌ Unsupported OS: $OSTYPE"
    exit 1
fi

# Create miners directory
MINERS_DIR="$PWD/miners"
mkdir -p "$MINERS_DIR"
cd "$MINERS_DIR"

echo "📂 Working directory: $MINERS_DIR"
echo ""

if [ "$OS" == "linux" ]; then
    echo "🐧 Linux detected"
    echo ""
    
    # Check dependencies
    echo "📦 Checking dependencies..."
    
    if ! command -v gcc &> /dev/null; then
        echo "⚠️  gcc not found. Installing build tools..."
        sudo apt-get update
        sudo apt-get install -y build-essential
    fi
    
    if ! dpkg -l | grep -q libcurl4-openssl-dev; then
        echo "⚠️  libcurl-dev not found. Installing..."
        sudo apt-get install -y libcurl4-openssl-dev libssl-dev
    fi
    
    if ! command -v automake &> /dev/null; then
        echo "⚠️  automake not found. Installing..."
        sudo apt-get install -y automake autoconf pkg-config libtool
    fi
    
    echo "✅ Dependencies OK"
    echo ""
    
    # Clone cpuminer-opt
    if [ -d "cpuminer-opt" ]; then
        echo "📁 cpuminer-opt directory exists, pulling latest..."
        cd cpuminer-opt
        git pull
    else
        echo "📥 Cloning cpuminer-opt..."
        git clone https://github.com/JayDDee/cpuminer-opt
        cd cpuminer-opt
    fi
    
    echo ""
    echo "🔨 Building cpuminer-opt..."
    echo "   This may take 5-10 minutes..."
    echo ""
    
    # Build
    ./autogen.sh
    
    # Detect CPU and optimize
    if grep -q avx2 /proc/cpuinfo; then
        echo "✅ AVX2 detected - building optimized version"
        CFLAGS="-O3 -march=native -mavx2" ./configure --with-curl
    elif grep -q sse2 /proc/cpuinfo; then
        echo "✅ SSE2 detected - building standard version"
        CFLAGS="-O3 -march=native" ./configure --with-curl
    else
        echo "⚠️  Building generic version"
        ./configure --with-curl
    fi
    
    make -j$(nproc)
    
    # Strip binary
    strip cpuminer
    
    echo ""
    echo "✅ Build complete!"
    echo ""
    echo "📍 Binary location: $PWD/cpuminer"
    
    # Create symlink
    ln -sf "$PWD/cpuminer" "$MINERS_DIR/../cpuminer"
    
    echo "🔗 Symlink created: $MINERS_DIR/../cpuminer"
    
elif [ "$OS" == "macos" ]; then
    echo "🍎 macOS detected"
    echo ""
    
    # Check for Homebrew
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew not found. Please install:"
        echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
    
    echo "📦 Installing dependencies..."
    brew install automake autoconf pkg-config curl openssl
    
    # Clone cpuminer-opt
    if [ -d "cpuminer-opt" ]; then
        echo "📁 cpuminer-opt directory exists, pulling latest..."
        cd cpuminer-opt
        git pull
    else
        echo "📥 Cloning cpuminer-opt..."
        git clone https://github.com/JayDDee/cpuminer-opt
        cd cpuminer-opt
    fi
    
    echo ""
    echo "🔨 Building cpuminer-opt..."
    echo ""
    
    # Build for macOS
    ./autogen.sh
    CFLAGS="-O3 -march=native" ./configure --with-curl
    make -j$(sysctl -n hw.ncpu)
    
    echo ""
    echo "✅ Build complete!"
    echo ""
    echo "📍 Binary location: $PWD/cpuminer"
    
    # Create symlink
    ln -sf "$PWD/cpuminer" "$MINERS_DIR/../cpuminer"
    
    echo "🔗 Symlink created: $MINERS_DIR/../cpuminer"
fi

echo ""
echo "=============================================="
echo "✅ Installation Complete!"
echo "=============================================="
echo ""
echo "📊 Testing binary..."
echo ""

cd "$MINERS_DIR/.."

if [ -f "./cpuminer" ]; then
    ./cpuminer --version | head -5
    echo ""
    echo "✅ cpuminer is working!"
    echo ""
    echo "🚀 Ready to mine!"
    echo ""
    echo "Usage:"
    echo "  python3 ai/zion_yescrypt_real.py"
    echo ""
else
    echo "❌ Binary not found at ./cpuminer"
    exit 1
fi

echo "📝 Supported Yescrypt variants:"
echo "   - yescrypt       (standard)"
echo "   - yescryptr8     (BitZeny)"
echo "   - yescryptr16    (Eli)"
echo "   - yescryptr32    (WAVI)"
echo ""
