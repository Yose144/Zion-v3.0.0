#!/bin/bash
set -e
cd /opt/zion/downloads

# Create package directory
mkdir -p zion-miner-v3.0.4

# Copy new binary
cp /root/zion-2.9.6/V3/target/release/zion-miner zion-miner-v3.0.4/zion-miner-bin
chmod +x zion-miner-v3.0.4/zion-miner-bin

# Copy wrapper (uploaded via scp)
cp /tmp/miner_wrapper_v304.sh zion-miner-v3.0.4/miner
chmod +x zion-miner-v3.0.4/miner

# Package
rm -f zion-miner-v3.0.4.zip
zip -r zion-miner-v3.0.4.zip zion-miner-v3.0.4/
ls -la zion-miner-v3.0.4.zip
echo "Package ready"
