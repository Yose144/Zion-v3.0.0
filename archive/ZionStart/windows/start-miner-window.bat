@echo off

:: ============================================================================
::  ZION GPU Miner - okno pro start-all / start-all-visible
::  (Algoritmus: deeksha_lite_fire - zmen ZION_MINER_ALGORITHM podle potreby)
:: ============================================================================

cd /d "C:\Users\yosef\Desktop\Zion\2.9.6-main"
if not exist "logs" mkdir logs

:: -- Sit -----------------------------------------------------------------------
set ZION_POOL_ADDR=62.171.141.136:8444
:: Fallback (Tailscale VPN): set ZION_POOL_ADDR=62.171.141.136:8444
set ZION_LOOP_COUNT=1000000

:: -- Identita ------------------------------------------------------------------
set ZION_WORKER_NAME=worker1
set ZION_MINER_ID=w11-amd-gpu-miner-01
set ZION_PAYOUT_ADDRESS=zion1n0s6e756p7r360a0e47582n7r5t2e3t4e2wq5c8

:: -- Algoritmus ----------------------------------------------------------------
set ZION_MINER_ALGORITHM=deeksha_lite_fire

:: -- GPU (OpenCL AMD RX 5700 XT = RDNA1 gfx1010) ------------------------------
:: RDNA1 auto-tune: work_size=8192, local_ws=128, vram_pct=85
:: ZION_OCL_WORK_CAP a ZION_OCL_VRAM_PCT NEJSOU nastaveny - auto-tune rozhodne
set ZION_GPU_BACKEND=opencl
set ZION_MINER_THREADS=1
set ZION_NONCE_COUNT_GPU=262144

echo ===========================================================
echo  ZION GPU Miner :: %ZION_POOL_ADDR%
echo  Algoritmus : %ZION_MINER_ALGORITHM%
echo  Backend    : %ZION_GPU_BACKEND%   (RDNA1 auto-tune)
echo  Payout     : %ZION_PAYOUT_ADDRESS%
echo ===========================================================
echo.

V3\target\release\zion-miner.exe
echo [EXIT] Miner skoncil s kodem %ERRORLEVEL% v %TIME%
pause
