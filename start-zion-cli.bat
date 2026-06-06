@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

:: ============================================================================
::  ZION CLI Launcher — Windows 11
:: ============================================================================

title ZION CLI Launcher

echo ╔═══════════════════════════════════════════════════════════════════════╗
echo ║  ZION CLI Launcher                                                   ║
echo ╚═══════════════════════════════════════════════════════════════════════╝
echo.

set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"

:: ── 1. Detekce Rust / cargo ─────────────────────────────────────────────
where cargo >nul 2>nul
if errorlevel 1 (
    echo [CHYBA] Rust / cargo nebyl nalezen.
    echo         Nainstalujte Rust z https://rustup.rs a spustte znovu.
    pause
    exit /b 1
)
echo [OK] Cargo nalezen:
cargo --version
echo.

:: ── 2. Build pokud chybi ───────────────────────────────────────────────
set "ZION_BIN=%REPO_ROOT%\V3\target\release\zion.exe"

if not exist "%ZION_BIN%" (
    echo [BUILD] Sestavuji zion-cli (prvni spusteni muze trvat 2-5 min)...
    cd /d "%REPO_ROOT%\V3"
    cargo build --release --manifest-path Cargo.toml -p zion-cli
    if errorlevel 1 (
        echo [CHYBA] Build zion-cli selhal.
        pause
        exit /b 1
    )
    echo.
) else (
    echo [OK] Release binarka zion.exe existuje
)

:: ── 3. Spusteni CLI ───────────────────────────────────────────────────
echo [START] Spoustim ZION CLI (interaktivni menu)...
echo         Pro standardni CLI prikazy pouzijte: V3\target\release\zion.exe --help
echo.

cd /d "%REPO_ROOT%"
cmd /k "V3\target\release\zion.exe menu"

endlocal
