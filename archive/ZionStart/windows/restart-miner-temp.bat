@echo off

:: ============================================================================
::  ZION GPU Miner - RESTART s logem (pro watchdog / automaticky restart)
:: ============================================================================

cd /d "C:\Users\yosef\Desktop\Zion\2.9.6-main"
if not exist "logs" mkdir logs

set ZION_POOL_ADDR=62.171.141.136:8444
:: Fallback (Tailscale VPN): set ZION_POOL_ADDR=62.171.141.136:8444
set ZION_LOOP_COUNT=1000000
set ZION_WORKER_NAME=worker1
set ZION_MINER_ID=w11-amd-gpu-miner-01
set ZION_PAYOUT_ADDRESS=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790

:: -- Algoritmus ----------------------------------------------------------------
set ZION_MINER_ALGORITHM=deeksha_lite_fire

set ZION_GPU_BACKEND=opencl
set ZION_MINER_THREADS=1
:: RDNA1 auto-tune (gfx1010): work_size=8192, vram_pct=85 -- NEPREPISOVAT
:: Stare hodnoty (16384/35%) snizovaly hashrate 3x, odstranovano 2026-06-10
set ZION_NONCE_COUNT_GPU=262144

V3\target\release\zion-miner.exe > logs\miner-restart.log 2>&1
