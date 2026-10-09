@echo off
:: ============================================================
:: Hiran v2.2 — Ollama inference server (Windows, AMD GPU)
:: Tento skript:
::   1. Zkontroluje Ollama instalaci
::   2. Vytvoří Modelfile z GGUF souboru
::   3. Spustí ollama serve na portu 8002
::
:: Prerekvizity:
::   - Ollama nainstalovaná: https://ollama.com/download
::   - GGUF model: HiranV2.2\models\gguf\hiran-v2.2-q4_k_m.gguf
::     (pokud nemáš: spusť HiranV2.2\quantization\convert_to_gguf.py)
:: ============================================================

setlocal EnableDelayedExpansion

:: ── Cesty ────────────────────────────────────────────────────────────────────
set REPO_ROOT=%~dp0..\..
set GGUF_PATH=%REPO_ROOT%\HiranV2.2\models\gguf\hiran-v2.2-q4_k_m.gguf
set MODELFILE=%REPO_ROOT%\HiranV2.2\inference\Modelfile
set MODEL_NAME=hiran-v2.2
set OLLAMA_PORT=11434
set HIRAN_PORT=8002
set HIRAN_PROXY=%REPO_ROOT%\HiranV2.2\inference\serve.py

echo.
echo ================================================================
echo   Hiran v2.2 — Ollama Local Inference (AMD GPU / DirectML)
echo ================================================================
echo.

:: ── Zkontroluj Ollama ────────────────────────────────────────────────────────
where ollama >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [CHYBA] Ollama neni nainstalována!
    echo.
    echo   Stáhni a nainstaluj z: https://ollama.com/download
    echo   Pak znovu spusť tento skript.
    echo.
    pause
    exit /b 1
)
echo [OK] Ollama nalezena: 
ollama --version

:: ── Zkontroluj GGUF model ────────────────────────────────────────────────────
if not exist "%GGUF_PATH%" (
    echo.
    echo [CHYBA] GGUF model nenalezen: %GGUF_PATH%
    echo.
    echo   Spusť nejprve konverzi:
    echo   uv run HiranV2.2\quantization\convert_to_gguf.py
    echo.
    echo   Nebo zkontroluj cestu k GGUF souboru a uprav GGUF_PATH v tomto skriptu.
    pause
    exit /b 1
)
echo [OK] GGUF model nalezen: %GGUF_PATH%

:: ── Vytvoř Modelfile ─────────────────────────────────────────────────────────
echo.
echo [INFO] Generuji Modelfile...
(
echo FROM %GGUF_PATH%
echo.
echo PARAMETER temperature 0.7
echo PARAMETER top_p 0.9
echo PARAMETER num_ctx 4096
echo PARAMETER stop "[INST]"
echo PARAMETER stop "[/INST]"
echo.
echo SYSTEM """Jsi Hiran v2.2, AI poradce projektu ZION TerraNova blockchain. \
echo Specializuješ se na ZION ekosystém: těžbu kryptoměny, DAO governance, \
echo humanitární fondy, vesmírný výzkum Issobella, a hru OASIS. \
echo Odpovídáš technicky přesně, v duchu ZION filosofie vědomého těžení."""
) > "%MODELFILE%"
echo [OK] Modelfile vytvořen: %MODELFILE%

:: ── Načti model do Ollama ────────────────────────────────────────────────────
echo.
echo [INFO] Načítám model do Ollama (může trvat 1-2 minuty)...
ollama create %MODEL_NAME% -f "%MODELFILE%"
if %ERRORLEVEL% neq 0 (
    echo [CHYBA] ollama create selhal!
    pause
    exit /b 1
)
echo [OK] Model %MODEL_NAME% připraven v Ollama.

:: ── Spusť proxy server na portu 8002 ─────────────────────────────────────────
:: Ollama bežně naslouchá na 11434, ale ZION stack očekává 8002.
:: serve.py funguje jako proxy (přeposílá na Ollama API).
echo.
echo [INFO] Spouštím Hiran inference proxy na portu %HIRAN_PORT%...
echo        (Ollama API: http://localhost:%OLLAMA_PORT%)
echo        (Hiran API:  http://localhost:%HIRAN_PORT%)
echo.

:: Nastav OLLAMA_HOST pro server binding
set OLLAMA_HOST=127.0.0.1:%OLLAMA_PORT%

:: Spusť Ollama serve na pozadí (pokud ještě neběží)
tasklist /FI "IMAGENAME eq ollama.exe" 2>nul | find /I "ollama.exe" >nul
if %ERRORLEVEL% neq 0 (
    echo [INFO] Startuju Ollama server...
    start "" /B ollama serve
    timeout /t 3 /nobreak >nul
)

:: Spusť Python proxy (serve.py v Ollama módu)
uv run python "%HIRAN_PROXY%" --model_path ollama:%MODEL_NAME% --port %HIRAN_PORT% --ollama_base http://localhost:%OLLAMA_PORT%
if %ERRORLEVEL% neq 0 (
    echo.
    echo [FALLBACK] Python proxy selhal, zkouším přímý llama.cpp server...
    echo            Zkontroluj HIRAN_LOCAL_SETUP.md pro instrukce.
    pause
)
