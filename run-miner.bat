@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

cd /d "C:\Users\yosef\Desktop\Zion\2.9.6-main"

set ZION_POOL_ADDR=77.42.71.94:8444
set ZION_LOOP_COUNT=1000000
set ZION_MINER_THREADS=2
set ZION_WORKER_NAME=worker1
set ZION_MINER_ID=w11-cpu-miner-01
set ZION_PAYOUT_ADDRESS=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790
set ZION_GPU_BACKEND=cpu

echo Starting ZION CPU Miner...
V3\target\release\zion-miner.exe
