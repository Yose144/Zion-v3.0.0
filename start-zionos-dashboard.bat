@echo off

:: ============================================================================
::  ZION OS - Node + Miner + Dashboard (Edge-Primary Windows 11 Launcher)
::
::  Algoritmus: deeksha_lite_fire (512 KiB scratchpad, vyssi teplo/vykon)
::  Pro zmenu: uprav ZION_MINER_ALGORITHM nize.
::
::  Spusteni: dvojklik nebo z prikazove radky
::    start-zionos-dashboard.bat
:: ============================================================================

title ZION OS Launcher

set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"

echo ===========================================================
echo  ZION OS - Edge-Primary Windows 11 Launcher
echo ===========================================================
echo.

:: -- Priprava adresaru ---------------------------------------------------------
if not exist "%REPO_ROOT%\logs"    mkdir "%REPO_ROOT%\logs"
if not exist "%REPO_ROOT%\V3\data" mkdir "%REPO_ROOT%\V3\data"

set "NODE_BIN=%REPO_ROOT%\V3\target\release\node.exe"
set "MINER_BIN=%REPO_ROOT%\V3\target\release\zion-miner.exe"

:: -- Auto-build pokud binarka chybi -------------------------------------------
if not exist "%NODE_BIN%" (
    echo [BUILD] Sestavuji node.exe...
    cargo build --release --manifest-path "%REPO_ROOT%\V3\Cargo.toml" -p zion-core --bin node
    if errorlevel 1 ( echo [CHYBA] Build node selhal. & pause & exit /b 1 )
    echo.
)
if not exist "%MINER_BIN%" (
    echo [BUILD] Sestavuji zion-miner.exe...
    cargo build --release --manifest-path "%REPO_ROOT%\V3\Cargo.toml" -p zion-miner
    if errorlevel 1 ( echo [CHYBA] Build miner selhal. & pause & exit /b 1 )
    echo.
)

:: -- Promenne - NODE -----------------------------------------------------------
set ZION_NODE_ID=local-backup-node
set ZION_P2P_BIND=0.0.0.0:8333
set ZION_RPC_BIND=0.0.0.0:8443
set ZION_WEBSOCKET_BIND=0.0.0.0:8445
set ZION_NODE_STATE_PATH=%REPO_ROOT%\V3\data\zion-node-state.db
set ZION_SEED_PEERS=77.42.71.94:8333
set ZION_MINER_ADDRESS=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790
set ZION_HUMANITARIAN_WALLET=zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4
set ZION_ISSOBELLA_WALLET=zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702

:: -- Promenne - MINER ----------------------------------------------------------
set ZION_POOL_ADDR=77.42.71.94:8444
set ZION_LOOP_COUNT=1000000
set ZION_WORKER_NAME=worker1
set ZION_MINER_ID=w11-amd-gpu-miner-01
set ZION_PAYOUT_ADDRESS=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790

:: -- Algoritmus ----------------------------------------------------------------
set ZION_MINER_ALGORITHM=deeksha_lite_fire

:: -- GPU (OpenCL AMD RX 5700 XT) ----------------------------------------------
set ZION_GPU_BACKEND=opencl
set ZION_MINER_THREADS=1
set ZION_GPU_WORK_SIZE=16384
set ZION_OCL_WORK_CAP=16384
set ZION_OCL_VRAM_PCT=35
set ZION_NONCE_COUNT_GPU=262144

cd /d "%REPO_ROOT%"

:: -- Dashboard -----------------------------------------------------------------
echo [1/3] Spoustim ZION Dashboard...
start "ZION Dashboard :: http://127.0.0.1:8766" cmd /k "cd /d %REPO_ROOT% && python ZION_OS\dashboard\app.py"
timeout /t 3 /nobreak >nul

:: -- Node (env se dedi z tohoto procesu pres set) ------------------------------
echo [2/3] Spoustim ZION Node...
start "ZION Node :: RPC 0.0.0.0:8443 P2P 0.0.0.0:8333" cmd /k "cd /d %REPO_ROOT% && V3\target\release\node.exe"
timeout /t 5 /nobreak >nul

:: -- Miner (env se dedi z tohoto procesu pres set) ----------------------------
echo [3/3] Spoustim ZION GPU Miner...
start "ZION GPU Miner :: %ZION_POOL_ADDR% [%ZION_MINER_ALGORITHM%]" cmd /k "cd /d %REPO_ROOT% && V3\target\release\zion-miner.exe"

:: -- Shrnuti -------------------------------------------------------------------
echo.
echo ===========================================================
echo  Stack spusten v samostatnych oknech:
echo ===========================================================
echo  Dashboard : http://127.0.0.1:8766
echo  Node      : P2P 0.0.0.0:8333  RPC 0.0.0.0:8443  WS 0.0.0.0:8445
echo  Miner     : Pool %ZION_POOL_ADDR%  Algo: %ZION_MINER_ALGORITHM%  Backend: %ZION_GPU_BACKEND%
echo ===========================================================
echo.
pause
