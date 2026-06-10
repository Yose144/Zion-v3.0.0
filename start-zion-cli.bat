@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

:: ============================================================================
::  ZION CLI Launcher — Windows 11
::  Spousti interaktivni menu. Okno zustane otevrene i po ukonceni menu.
:: ============================================================================

title ZION CLI

set "REPO_ROOT=%~dp0"
if "%REPO_ROOT:~-1%"=="\" set "REPO_ROOT=%REPO_ROOT:~0,-1%"

set "ZION_BIN=%REPO_ROOT%\V3\target\release\zion.exe"

echo ===========================================================
echo  ZION CLI Launcher
echo ===========================================================
echo.

:: ── 1. Zkontroluj existenci binarky ──────────────────────────────────────────
if not exist "%ZION_BIN%" (
    echo [BUILD] Binarka zion.exe nenalezena, sestavuji...
    echo         (prvni build muze trvat 2-5 minut)
    echo.

    :: Zkus najit cargo
    where cargo >nul 2>nul
    if errorlevel 1 (
        :: cargo neni v PATH — zkus Rustup standardni umisteni
        if exist "%USERPROFILE%\.cargo\bin\cargo.exe" (
            set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
        ) else (
            echo [CHYBA] Rust / cargo nebyl nalezen v PATH ani v %USERPROFILE%\.cargo\bin\
            echo         Nainstalujte Rust z https://rustup.rs
            pause
            exit /b 1
        )
    )

    cargo build --release --manifest-path "%REPO_ROOT%\V3\Cargo.toml" -p zion-cli
    if errorlevel 1 (
        echo.
        echo [CHYBA] Build zion-cli selhal. Zkontrolujte vystup nahore.
        pause
        exit /b 1
    )
    echo.
    echo [OK] Build dokoncen.
    echo.
) else (
    echo [OK] Binarka nalezena: %ZION_BIN%
    echo.
)

:: ── 2. Spusteni CLI v interaktivnim rezimu ────────────────────────────────────
echo  Prikazy:
echo    %ZION_BIN% --help
echo    %ZION_BIN% mine start
echo    %ZION_BIN% node status
echo    %ZION_BIN% doctor
echo.
echo ===========================================================
echo.

:loop
"%ZION_BIN%" menu
echo.
echo [INFO] Menu skoncilo (kod: %ERRORLEVEL%). Stiskni ENTER pro opetovne spusteni, nebo zavri okno.
echo.
pause >nul
goto loop
