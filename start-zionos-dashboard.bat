@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

:: ============================================================================
::  ZION Node + Miner — Edge-Primary Windows 11 Launcher
:: ============================================================================
::  Spustí lokální backup node a miner synchronizované s Edge (Hetzner):
::    - Node  : lokální backup, P2P sync z Edge 77.42.71.94:8333
::    - Miner : GPU miner připojený na Edge pool 77.42.71.94:8444
::
::  Požadavky:
::    - Rust + cargo (nebo prebuildnuté binárky v V3\target\release)
::
::  Pokud release binárky neexistují, skript je automaticky sestaví.
:: ============================================================================

title ZION Node + Miner (Edge-Primary) Launcher
echo ╔═══════════════════════════════════════════════════════════════════════╗
echo ║  ZION Node + Miner — Edge-Primary Windows 11 Launcher                ║
echo ╚═══════════════════════════════════════════════════════════════════════╝
echo.

set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"

:: ── 1. Detekce Rust / cargo ─────────────────────────────────────────────
where cargo >nul 2>nul
if errorlevel 1 (
    echo [CHYBA] Rust / cargo nebyl nalezen.
    echo         Nainstalujte Rust z https://rustup.rs a spusťte tento skript znovu.
    pause
    exit /b 1
)
echo [OK] Cargo nalezen:
cargo --version
echo.

:: ── 2. Příprava logovacího adresáře ────────────────────────────────────
if not exist "%REPO_ROOT%\logs" (
    mkdir "%REPO_ROOT%\logs"
    echo [OK] Vytvořen adresář logs
) else (
    echo [OK] Adresář logs existuje
)

:: ── 3. Kontrola / build release binárek ───────────────────────────────
set "NODE_BIN=%REPO_ROOT%\V3\target\release\node.exe"
set "MINER_BIN=%REPO_ROOT%\V3\target\release\zion-miner.exe"
set "BUILT_ANY=0"

if not exist "%NODE_BIN%" (
    echo [BUILD] Sestavuji zion-core (node) ...
    cd /d "%REPO_ROOT%\V3"
    cargo build --release --manifest-path Cargo.toml -p zion-core --bin node
    if errorlevel 1 (
        echo [CHYBA] Build node selhal.
        pause
        exit /b 1
    )
    set "BUILT_ANY=1"
) else (
    echo [OK] Release binarka node existuje
)

if not exist "%MINER_BIN%" (
    echo [BUILD] Sestavuji zion-miner ...
    cd /d "%REPO_ROOT%\V3"
    cargo build --release --manifest-path Cargo.toml -p zion-miner
    if errorlevel 1 (
        echo [CHYBA] Build miner selhal.
        pause
        exit /b 1
    )
    set "BUILT_ANY=1"
) else (
    echo [OK] Release binarka miner existuje
)

if "%BUILT_ANY%"=="1" echo.

:: ── 4. Spuštění lokálního backup node (edge-primary sync) ───────────────
echo [START] Spouštím ZION Node (backup, sync z Edge) ...
start "ZION Node  ::  RPC http://127.0.0.1:8443" cmd /k "cd /d "%REPO_ROOT%" && set ZION_NODE_ID=local-backup-node&& set ZION_P2P_BIND=0.0.0.0:8333&& set ZION_RPC_BIND=0.0.0.0:8443&& set ZION_NODE_STATE_PATH=V3/data/zion-node-state.db&& set ZION_SEED_PEERS=77.42.71.94:8333&& set ZION_MINER_ADDRESS=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790&& set ZION_HUMANITARIAN_WALLET=zion165a527w5d0n085t775x3w8n8q20742a6w7xr0z3&& set ZION_ISSOBELLA_WALLET=zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702&& V3\target\release\node.exe"

timeout /t 5 /nobreak >nul

:: ── 5. Spuštění GPU miner (připojený na Edge pool) ────────────────────────
echo [START] Spouštím ZION GPU Miner (Edge pool) ...
start "ZION CPU Miner  ::  Edge 77.42.71.94:8444" cmd /k "cd /d "%REPO_ROOT%" && set ZION_POOL_ADDR=77.42.71.94:8444&& set ZION_LOOP_COUNT=1000000&& set ZION_MINER_THREADS=2&& set ZION_WORKER_NAME=worker1&& set ZION_MINER_ID=w11-cpu-miner-01&& set ZION_GPU_BACKEND=cpu&& V3\target\release\zion-miner.exe"

:: ── 6. Shrnutí ─────────────────────────────────────────────────────────
echo.
echo ╔═══════════════════════════════════════════════════════════════════════╗
echo ║  Stack spuštěn v samostatných oknech:                                ║
echo ╠═══════════════════════════════════════════════════════════════════════╣
echo ║  Node  : P2P 0.0.0.0:8333  ^|^>  Seed 77.42.71.94:8333 (Edge)       ║
echo ║          RPC http://127.0.0.1:8443                                   ║
echo ║  Miner : Pool 77.42.71.94:8444  (CPU)                               ║
echo ╚═══════════════════════════════════════════════════════════════════════╝
echo.
echo Pro ukončení zavřete jednotlivá okna nebo stiskněte Ctrl+C uvnitř nich.
echo.
pause
endlocal
