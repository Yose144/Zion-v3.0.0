@echo off
:: ============================================================
:: Hiran v2.2 — llama.cpp server (Windows, AMD GPU / CPU fallback)
:: Spouští llama-server přímo na portu 8002 s OpenAI-compatible API.
::
:: Prerekvizity:
::   - llama.cpp nainstalovaný (llama-server.exe v PATH nebo C:\llama.cpp\)
::   - GGUF model: HiranV2.2\models\gguf\hiran-v2.2-q4_k_m.gguf
::
:: AMD GPU: llama.cpp podporuje AMD přes Vulkan nebo CLBlast.
::   Doporučený build: https://github.com/ggerganov/llama.cpp/releases
::   Hledej: llama-<version>-bin-win-vulkan-x64.zip
:: ============================================================

setlocal EnableDelayedExpansion

:: ── Konfigurace ───────────────────────────────────────────────────────────────
set REPO_ROOT=%~dp0..\..
set GGUF_PATH=%REPO_ROOT%\HiranV2.2\models\gguf\hiran-v2.2-q4_k_m.gguf
set PORT=8002
set CTX=4096
set THREADS=8
:: GPU vrstvy — pro AMD 5600 XT (8 GB VRAM) s Q4_K_M (~4.5 GB) dej 33 (all layers)
:: Pokud nemáš GPU podporu, nastav na 0 pro CPU only
set GPU_LAYERS=33

:: ── Hledej llama-server ────────────────────────────────────────────────────────
set LLAMA_SERVER=
where llama-server.exe >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set LLAMA_SERVER=llama-server.exe
    goto :found_server
)
where llama-server >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set LLAMA_SERVER=llama-server
    goto :found_server
)
if exist "C:\llama.cpp\llama-server.exe" (
    set LLAMA_SERVER=C:\llama.cpp\llama-server.exe
    goto :found_server
)
if exist "C:\tools\llama.cpp\llama-server.exe" (
    set LLAMA_SERVER=C:\tools\llama.cpp\llama-server.exe
    goto :found_server
)

echo.
echo [CHYBA] llama-server nenalezen!
echo.
echo   Stáhni pre-built llama.cpp pro Windows (Vulkan pro AMD GPU):
echo   https://github.com/ggerganov/llama.cpp/releases
echo   Hledej: llama-*-bin-win-vulkan-x64.zip
echo.
echo   Rozbal a přidej do PATH nebo ulož do C:\llama.cpp\
echo.
pause
exit /b 1

:found_server
echo.
echo ================================================================
echo   Hiran v2.2 — llama.cpp Server
echo ================================================================
echo   Model:      %GGUF_PATH%
echo   Port:       %PORT%
echo   GPU vrstvy: %GPU_LAYERS% (0 = CPU only)
echo   Kontext:    %CTX% tokenů
echo   Vlákna:     %THREADS%
echo ================================================================
echo.

:: ── Zkontroluj model ─────────────────────────────────────────────────────────
if not exist "%GGUF_PATH%" (
    echo [CHYBA] GGUF model nenalezen: %GGUF_PATH%
    echo.
    echo   Spusť: uv run HiranV2.2\quantization\convert_to_gguf.py
    pause
    exit /b 1
)

echo [OK] Model nalezen.
echo [INFO] Spouštím llama-server...
echo        API: http://localhost:%PORT%/v1/chat/completions
echo        Health: http://localhost:%PORT%/health
echo.
echo [Ctrl+C pro zastavení]
echo.

:: ── Spusť server ──────────────────────────────────────────────────────────────
"%LLAMA_SERVER%" ^
    --model "%GGUF_PATH%" ^
    --port %PORT% ^
    --ctx-size %CTX% ^
    --threads %THREADS% ^
    --n-gpu-layers %GPU_LAYERS% ^
    --host 127.0.0.1 ^
    --alias hiran-v2.2 ^
    --log-prefix

if %ERRORLEVEL% neq 0 (
    echo.
    echo [!] Server skončil s chybou.
    echo     Zkus GPU_LAYERS=0 (CPU only) nebo zkontroluj HIRAN_LOCAL_SETUP.md
    pause
)
