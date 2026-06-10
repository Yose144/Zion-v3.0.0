@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

:: ============================================================================
::  ZION GPU Miner — hlavni spoustec (Edge pool, OpenCL AMD)
::
::  Algoritmy:
::    deeksha_lite_v1           (default)  256 KiB scratchpad
::    deeksha_lite_fire                    512 KiB scratchpad, vyssi vykon/teplo
::    cosmic_harmony_ekam_deeksha_v2       original multi-phase hash
::
::  Pro zmenu algoritmu uprav ZION_MINER_ALGORITHM nize.
:: ============================================================================

cd /d "C:\Users\yosef\Desktop\Zion\2.9.6-main"
if not exist "logs" mkdir logs

:: ── Sit ──────────────────────────────────────────────────────────────────────
set ZION_POOL_ADDR=77.42.71.94:8444
set ZION_LOOP_COUNT=1000000

:: ── Identita mineru ───────────────────────────────────────────────────────────
set ZION_WORKER_NAME=worker1
set ZION_MINER_ID=w11-amd-gpu-miner-01
set ZION_PAYOUT_ADDRESS=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790

:: ── Algoritmus ────────────────────────────────────────────────────────────────
set ZION_MINER_ALGORITHM=deeksha_lite_fire

:: ── GPU (OpenCL AMD RX 5700 XT = RDNA1 gfx1010) ──────────────────────────────
:: Auto-tune: work_size=8192, local_ws=128, vram_pct=85 — neprepisovat!
set ZION_GPU_BACKEND=opencl
set ZION_NONCE_COUNT_GPU=262144

echo ===========================================================
echo  ZION GPU Miner :: %ZION_POOL_ADDR%
echo  Algoritmus : %ZION_MINER_ALGORITHM%
echo  Backend    : %ZION_GPU_BACKEND%  (RDNA1 auto-tune ws=8192)
echo  Payout     : %ZION_PAYOUT_ADDRESS%
echo ===========================================================
echo.

V3\target\release\zion-miner.exe >> logs\miner.log 2>&1
echo [EXIT] Miner skoncil s kodem %ERRORLEVEL% v %TIME%
pause
endlocal
