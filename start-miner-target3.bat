@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

:: ============================================================================
::  ZION GPU Miner — alternativni build (target3)
::  Pouzij kdyz V3\target\release neni dostupny nebo testuje novy build.
:: ============================================================================

cd /d "C:\Users\yosef\Desktop\Zion\2.9.6-main"
if not exist "logs" mkdir logs

set ZION_POOL_ADDR=77.42.71.94:8444
set ZION_LOOP_COUNT=1000000
set ZION_WORKER_NAME=worker1
set ZION_MINER_ID=w11-amd-gpu-miner-01
set ZION_PAYOUT_ADDRESS=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790

:: ── Algoritmus ────────────────────────────────────────────────────────────────
set ZION_MINER_ALGORITHM=deeksha_lite_fire

set ZION_GPU_BACKEND=opencl
set ZION_MINER_THREADS=1
set ZION_GPU_WORK_SIZE=16384
set ZION_OCL_WORK_CAP=16384
set ZION_OCL_VRAM_PCT=35
set ZION_NONCE_COUNT_GPU=262144

echo ===========================================================
echo  ZION GPU Miner (target3) :: %ZION_POOL_ADDR%
echo  Algo: %ZION_MINER_ALGORITHM%  Backend: %ZION_GPU_BACKEND%
echo  Build: V3\target3\release
echo ===========================================================
echo.

V3\target3\release\zion-miner.exe
echo [EXIT] Miner skoncil s kodem %ERRORLEVEL% v %TIME%
pause
endlocal
