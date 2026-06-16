#!/bin/bash
# ZION Startup Script for Server

cd /root

# Clean old processes and data
pkill -9 -f python
pkill -9 -f zion
rm -f *.db
mkdir -p logs

echo "Starting ZION Blockchain..."
python3 new_zion_blockchain.py > logs/blockchain.log 2>&1 &
sleep 3

echo "Starting ZION Mining Pool..."
python3 zion_universal_pool_v2.py > logs/pool.log 2>&1 &
sleep 3

echo "ZION Services Started"
ps aux | grep python