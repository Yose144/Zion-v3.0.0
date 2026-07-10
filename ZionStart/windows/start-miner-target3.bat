@echo off

:: ============================================================================
::  ZION GPU Miner - alternativni build (target3)
::  Pouzij kdyz V3\target\release neni dostupny nebo testuje novy build.
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

:: RDNA1 auto-tune - neprepisovat work_size ani vram_pct
set ZION_GPU_BACKEND=opencl
set ZION_NONCE_COUNT_GPU=262144

echo ===========================================================
echo  ZION GPU Miner (rdna) :: %ZION_POOL_ADDR%
echo  Algo: %ZION_MINER_ALGORITHM%  Backend: %ZION_GPU_BACKEND%  (RDNA1 auto-tune)
echo ===========================================================
echo.

V3\target\release\zion-miner.exe
echo [EXIT] Miner skoncil s kodem %ERRORLEVEL% v %TIME%
pause
