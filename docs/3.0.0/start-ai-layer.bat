@echo off
:: ============================================================
::  ZION AI Layer Startup Script
::
::  Spustí v pořadí:
::    1. Hiran inference proxy  — port 8002  (serve.py → LM Studio)
::    2. Hiranyagarbha API      — port 8001  (Rust binary)
::
::  Prerekvizity:
::    - LM Studio spuštěno s načteným modelem a Developer Serverem
::      (LM Studio → Developer → Start Server — port 1234)
::    - Python + uv nainstalováno
::    - Rust binary zbuilděno:
::      cargo build --release --manifest-path V3/Cargo.toml -p zion-ai-native
::
::  Volitelné env proměnné (nastav před spuštěním):
::    set LMSTUDIO_BASE_URL=http://localhost:1234   (default)
::    set HIRANYAGARBHA_BIND=0.0.0.0:8001          (default)
::    set HIRANYAGARBHA_MAX_AGENTS=100             (default)
::    set ZION_NODE_RPC_ADDR=127.0.0.1:8443       (default)
:: ============================================================

setlocal EnableDelayedExpansion

set REPO_ROOT=%~dp0
set BINARY=%REPO_ROOT%V3\target\release\zion-ai-native-api.exe
set SERVE_PY=%REPO_ROOT%HiranV2.2\inference\serve.py
set LMSTUDIO_BASE_URL=http://localhost:1234
set HIRAN_PORT=8002
set HIRANYAGARBHA_BIND=0.0.0.0:8001

echo.
echo ================================================================
echo   ZION AI Layer — Startup
echo ================================================================
echo   Hiran inference  -^> http://localhost:%HIRAN_PORT%
echo   Hiranyagarbha    -^> http://localhost:8001
echo   LM Studio API    -^> %LMSTUDIO_BASE_URL%
echo ================================================================
echo.

:: ── 1. Zkontroluj LM Studio server ──────────────────────────────────────────
echo [1/3] Kontroluji LM Studio server na %LMSTUDIO_BASE_URL%...
curl -s --max-time 3 "%LMSTUDIO_BASE_URL%/v1/models" > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo [CHYBA] LM Studio server neodpovida na %LMSTUDIO_BASE_URL%
    echo.
    echo   Kroky k oprave:
    echo     1. Otevri LM Studio
    echo     2. Nac ti model  ^(napr. Qwen3.5-9B-Q4_K_M^)
    echo     3. Jdi na Developer tab
    echo     4. Klikni "Start Server"  ^(port 1234^)
    echo     5. Znovu spust tento skript
    echo.
    pause
    exit /b 1
)
echo [OK] LM Studio server je dostupny.
echo.

:: ── 2. Zkontroluj Hiranyagarbha binary ───────────────────────────────────────
echo [2/3] Kontroluji Rust binary...
if not exist "%BINARY%" (
    echo [WARN] Binary nenalezeno: %BINARY%
    echo        Buildim ted ^(muze trvat 3-5 minut^)...
    echo.
    cargo build --release --manifest-path "%REPO_ROOT%V3\Cargo.toml" -p zion-ai-native --bin zion-ai-native-api
    if %ERRORLEVEL% neq 0 (
        echo [CHYBA] Build selhal!
        pause
        exit /b 1
    )
)
echo [OK] Binary nalezeno: %BINARY%
echo.

:: ── 3. Spusť Hiran inference server (okno #1) ────────────────────────────────
echo [3/3] Spoustim Hiran inference server na portu %HIRAN_PORT%...
start "Hiran Inference [port %HIRAN_PORT%]" cmd /k "cd /d "%REPO_ROOT%" && uv run python "%SERVE_PY%" --model_path lmstudio:hiran-v2.2 --port %HIRAN_PORT%"

:: Počkej 3 sekundy než spustíme Hiranyagarbha
timeout /t 3 /nobreak > nul

:: ── 4. Spusť Hiranyagarbha API (okno #2) ─────────────────────────────────────
echo [4/4] Spoustim Hiranyagarbha API na portu 8001...
start "Hiranyagarbha API [port 8001]" cmd /k "cd /d "%REPO_ROOT%" && set HIRANYAGARBHA_BIND=%HIRANYAGARBHA_BIND% && set HIRANYAGARBHA_BACKEND=echo && set ZION_NODE_RPC_ADDR=%ZION_NODE_RPC_ADDR% && "%BINARY%""

echo.
echo ================================================================
echo   AI Layer nastartovan!
echo.
echo   Hiran inference:   http://localhost:%HIRAN_PORT%/health
echo   Hiran status:      http://localhost:%HIRAN_PORT%/status
echo   Hiran metrics:     http://localhost:%HIRAN_PORT%/metrics
echo   Hiranyagarbha:     http://localhost:8001/health
echo   Orchestrator:      http://localhost:8001/orchestrator/status
echo   Agenti:            http://localhost:8001/agents
echo   Dashboard:         http://localhost:8766
echo ================================================================
echo.
echo   Pro zastaveni zavri okna "Hiran Inference" a "Hiranyagarbha API"
echo   nebo spust: taskkill /F /IM zion-ai-native-api.exe
echo.
pause
