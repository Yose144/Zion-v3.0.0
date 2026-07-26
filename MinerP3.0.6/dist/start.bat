@echo off
chcp 65001 >nul
REM ZION Miner v3.0.6 — easy desktop start script
REM Triple stream runs in the backend; this wrapper just asks for the basics.

setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "MINER=%SCRIPT_DIR%zion-miner.exe"

if not exist "%MINER%" (
    echo [ERROR] zion-miner.exe not found in %SCRIPT_DIR%
    exit /b 1
)

REM Non-interactive / headless: pass arguments straight through
if "%ZION_EASY_MENU%"=="0" (
    "%MINER%" %*
    exit /b %errorlevel%
)

echo ============================================================
echo   ZION Miner v3.0.6 — Desktop Quick Start
echo ============================================================
echo.

if not "%ZION_DETECT_HARDWARE%"=="0" (
    echo [INFO] Detecting hardware...
    "%MINER%" --detect-hardware 2>nul
    echo.
)

set "DEFAULT_POOL=62.171.141.136:8444"
set "DEFAULT_WORKER=desktop-rig"
set "DEFAULT_GPU=auto"
set "DEFAULT_THREADS=auto"
set "DEFAULT_ALGO=deeksha_lite_v1"
set "DEFAULT_PROFILE=pool"

set /p pool="Pool address [%DEFAULT_POOL%]: "
if "!pool!"=="" set "pool=%DEFAULT_POOL%"

set /p wallet="Wallet address (required): "
if "!wallet!"=="" (
    echo [ERROR] Wallet address is required.
    exit /b 1
)

set /p worker="Worker name [%DEFAULT_WORKER%]: "
if "!worker!"=="" set "worker=%DEFAULT_WORKER%"

set /p gpu="GPU backend (auto/cuda/cpu) [%DEFAULT_GPU%]: "
if "!gpu!"=="" set "gpu=%DEFAULT_GPU%"

set /p threads="CPU threads (auto or number) [%DEFAULT_THREADS%]: "
if "!threads!"=="" set "threads=%DEFAULT_THREADS%"

set /p algo="Algorithm [%DEFAULT_ALGO%]: "
if "!algo!"=="" set "algo=%DEFAULT_ALGO%"

set /p profile="Profile (pool/solo/benchmark) [%DEFAULT_PROFILE%]: "
if "!profile!"=="" set "profile=%DEFAULT_PROFILE%"

echo.
echo [INFO] Starting ZION miner...
echo   pool:    %pool%
echo   wallet:  %wallet%
echo   worker:  %worker%
echo   gpu:     %gpu%
echo   threads: %threads%
echo   algo:    %algo%
echo   profile: %profile%
echo.

set "GPU_ARG="
if not "!gpu!"=="auto" set "GPU_ARG=--gpu !gpu!"

set "THREADS_ARG="
if not "!threads!"=="auto" set "THREADS_ARG=--threads !threads!"

"%MINER%" --pool "%pool%" --wallet "%wallet%" --worker "%worker%" %GPU_ARG% %THREADS_ARG% --algorithm "%algo%" --profile "%profile%" %*
exit /b %errorlevel%
