@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

cd /d "C:\Users\yosef\Desktop\Zion\2.9.6-main"

if not exist "logs" mkdir logs

set ZION_POOL_ADDR=127.0.0.1:8444
set ZION_LOOP_COUNT=1000000
set ZION_MINER_THREADS=1
set ZION_WORKER_NAME=worker1
set ZION_MINER_ID=w11-amd-gpu-miner-01
set ZION_PAYOUT_ADDRESS=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790
set ZION_GPU_BACKEND=opencl
set ZION_GPU_WORK_SIZE=16384
set ZION_OCL_WORK_CAP=16384
set ZION_OCL_VRAM_PCT=35

echo Starting ZION GPU Miner (OpenCL - AMD)...
V3\target\release\zion-miner.exe
