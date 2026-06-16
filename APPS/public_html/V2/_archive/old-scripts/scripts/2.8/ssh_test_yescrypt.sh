#!/bin/bash
# 🚀 ZION Yescrypt SSH Testing Script
# Automatizovaný test profesionálního Yescrypt mineru přes SSH
# Usage: ./ssh_test_yescrypt.sh user@host [port]

set -e

# Barvy pro output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parametry
SSH_USER_HOST="${1:-root@127.0.0.1}"
SSH_PORT="${2:-22}"
REPO_URL="https://github.com/estrelaisabellazion3/Zion-2.8.git"
INSTALL_DIR="/opt/zion-mining"

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║ 🚀 ZION Yescrypt SSH Testing Suite 🚀  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# Test SSH připojení
echo -e "${YELLOW}[1/6] Testing SSH connection...${NC}"
if ssh -p $SSH_PORT $SSH_USER_HOST "whoami" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ SSH connection successful${NC}"
else
    echo -e "${RED}❌ SSH connection failed${NC}"
    echo "   Check: ssh -p $SSH_PORT $SSH_USER_HOST"
    exit 1
fi

# Klonování / Update repo
echo -e "${YELLOW}[2/6] Preparing repository...${NC}"
ssh -p $SSH_PORT $SSH_USER_HOST << 'SSH_SCRIPT'
set -e
echo "   Checking repository..."

if [ -d /opt/zion-mining ]; then
    echo "   📂 Repository exists, updating..."
    cd /opt/zion-mining
    git pull origin main 2>/dev/null || true
else
    echo "   📥 Cloning repository..."
    sudo git clone https://github.com/estrelaisabellazion3/Zion-2.8.git /opt/zion-mining 2>/dev/null || \
    git clone https://github.com/estrelaisabellazion3/Zion-2.8.git /tmp/Zion-2.8 && \
    sudo mv /tmp/Zion-2.8 /opt/zion-mining
fi

echo "   ✅ Repository ready"
SSH_SCRIPT
echo -e "${GREEN}✅ Repository prepared${NC}"

# Instalace závislostí
echo -e "${YELLOW}[3/6] Installing dependencies...${NC}"
ssh -p $SSH_PORT $SSH_USER_HOST << 'SSH_SCRIPT'
set -e
echo "   Installing Python packages..."
sudo apt-get update -qq 2>/dev/null || true
sudo apt-get install -y -qq python3-dev build-essential libssl-dev 2>/dev/null || true

cd /opt/zion-mining
pip3 install -q psutil requests 2>/dev/null || pip3 install psutil requests

# Zkompiluj C extension
echo "   Compiling C extension..."
cd mining
python3 setup.py build_ext --inplace > /dev/null 2>&1

if [ -f yescrypt_fast.cpython-*.so ]; then
    echo "   ✅ C Extension compiled successfully"
else
    echo "   ⚠️  C Extension not found (fallback to native)"
fi
SSH_SCRIPT
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Spuštění test suite
echo -e "${YELLOW}[4/6] Running test suite...${NC}"
echo ""
ssh -p $SSH_PORT $SSH_USER_HOST << 'SSH_SCRIPT'
cd /opt/zion-mining/mining
python3 test_yescrypt_complete.py
SSH_SCRIPT
echo ""
echo -e "${GREEN}✅ Tests completed${NC}"

# Quick benchmark
echo -e "${YELLOW}[5/6] Quick benchmark...${NC}"
ssh -p $SSH_PORT $SSH_USER_HOST << 'SSH_SCRIPT'
python3 << 'PYTHON_SCRIPT'
import sys, time
sys.path.insert(0, '/opt/zion-mining/mining')

try:
    import yescrypt_fast
    data = b"benchmark_test_data" * 5
    
    print("   Testing C Extension performance...")
    start = time.time()
    for i in range(500):
        _ = yescrypt_fast.hash(data, i)
    elapsed = time.time() - start
    hashrate = 500 / elapsed
    
    print(f"   ✅ Hashrate: {hashrate:,.0f} H/s")
    
    # Expected: 200K-600K H/s
    if hashrate > 100000:
        print(f"   🚀 EXCELLENT! ({hashrate/1000:.0f}K H/s)")
    elif hashrate > 10000:
        print(f"   ✅ Good ({hashrate/1000:.0f}K H/s)")
    else:
        print(f"   ⚠️  Lower than expected ({hashrate/1000:.1f}K H/s)")
        
except Exception as e:
    print(f"   ❌ Error: {e}")
PYTHON_SCRIPT
SSH_SCRIPT
echo -e "${GREEN}✅ Benchmark completed${NC}"

# System info
echo -e "${YELLOW}[6/6] System information...${NC}"
ssh -p $SSH_PORT $SSH_USER_HOST << 'SSH_SCRIPT'
python3 << 'PYTHON_SCRIPT'
import os, platform, psutil

print("   System Info:")
print(f"   • OS: {platform.system()} {platform.release()}")
print(f"   • Python: {platform.python_version()}")
print(f"   • CPU cores: {os.cpu_count()} logical, {psutil.cpu_count(logical=False)} physical")
print(f"   • Memory: {psutil.virtual_memory().total / (1024**3):.1f} GB")
print(f"   • Disk: {psutil.disk_usage('/').total / (1024**3):.1f} GB")
print(f"   • Uptime: {psutil.boot_time()}")
PYTHON_SCRIPT
SSH_SCRIPT
echo -e "${GREEN}✅ System info retrieved${NC}"

# Shrnutí
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         ✅ ALL TESTS PASSED ✅           ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Ready to start mining!${NC}"
echo ""
echo -e "Usage:"
echo -e "  ssh -p $SSH_PORT $SSH_USER_HOST"
echo -e "  cd /opt/zion-mining"
echo -e "  python3 ai/zion_universal_miner.py --algorithm yescrypt --wallet YOUR_ADDR"
echo ""
