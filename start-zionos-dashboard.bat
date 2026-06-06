@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

:: ============================================================================
::  ZION Node + Miner — Edge-Primary Windows 11 Launcher
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
    echo         Nainstalujte Rust z https://rustup.rs a spustte tento skript znovu.
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

:: ── 4. Vytvoření helper .bat souborů (kvůli quoting) ────────────────────
echo [PREP] Vytvarim helper bat soubory ...

(
echo @echo off
echo chcp 65001 ^>nul
echo title ZION Node
echo cd /d "%REPO_ROOT%"
echo set ZION_NODE_ID=local-backup-node
echo set ZION_P2P_BIND=0.0.0.0:8333
echo set ZION_RPC_BIND=0.0.0.0:8443
echo set ZION_NODE_STATE_PATH=V3/data/zion-node-state.db
echo set ZION_SEED_PEERS=77.42.71.94:8333
echo set ZION_MINER_ADDRESS=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790
echo set ZION_HUMANITARIAN_WALLET=zion165a527w5d0n085t775x3w8n8q20742a6w7xr0z3
echo set ZION_ISSOBELLA_WALLET=zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702
echo echo [Node] Spoustim ...
echo V3\target\release\node.exe
echo echo.
echo echo [Node] Ukoncen.
echo pause
) > "%REPO_ROOT%\logs\_run_node.bat"

(
echo @echo off
echo chcp 65001 ^>nul
echo title ZION CPU Miner
echo cd /d "%REPO_ROOT%"
echo set ZION_POOL_ADDR=77.42.71.94:8444
echo set ZION_LOOP_COUNT=1000000
echo set ZION_MINER_THREADS=2
echo set ZION_WORKER_NAME=worker1
echo set ZION_MINER_ID=w11-cpu-miner-01
echo set ZION_GPU_BACKEND=cpu
echo echo [Miner] Spoustim ...
echo V3\target\release\zion-miner.exe
echo echo.
echo echo [Miner] Ukoncen.
echo pause
) > "%REPO_ROOT%\logs\_run_miner.bat"

:: ── 5. Spuštění lokálního backup node ──────────────────────────────────
echo [START] Spouštím ZION Node (backup, sync z Edge) ...
start "ZION Node" cmd /k "%REPO_ROOT%\logs\_run_node.bat"

timeout /t 5 /nobreak >nul

:: ── 6. Spuštění CPU miner ──────────────────────────────────────────────
echo [START] Spouštím ZION CPU Miner (Edge pool) ...
start "ZION CPU Miner" cmd /k "%REPO_ROOT%\logs\_run_miner.bat"

:: ── 7. Shrnutí ─────────────────────────────────────────────────────────
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
