@echo off

:: ============================================================================
::  ZION OS - Kompletni stack (viditelna okna, zadny /min)
::  Pouzij pro ladeni - vsechna okna zustanou na popredi.
:: ============================================================================

cd /d "C:\Users\yosef\Desktop\Zion\2.9.6-main"
if not exist "logs"         mkdir logs
if not exist "V3\data"      mkdir V3\data
if not exist "V3\target\release" mkdir "V3\target\release"

:: ── Auto-sync node.exe + zion-miner.exe z desktop-agent resources ──────────
:: Zdrojove binarky (canonical, aktualizovane s kazdym releaesem)
set RESOURCES_DIR=APP&WEB\desktop-agent\resources
set RELEASE_DIR=V3\target\release

:: node.exe
if exist "%RESOURCES_DIR%\node.exe" (
    xcopy /Y /D /Q "%RESOURCES_DIR%\node.exe" "%RELEASE_DIR%\" >nul 2>&1
    if errorlevel 1 (
        echo [WARN] Nelze zkopirovat node.exe - pravdepodobne bezi proces. Pokracuji s existujicim.
    ) else (
        echo [sync] node.exe aktualizovan z resources.
    )
) else (
    echo [WARN] Zdrojovy node.exe nenalezen v %RESOURCES_DIR% - pouzivam existujici binary.
)

:: zion-miner.exe
if exist "%RESOURCES_DIR%\zion-miner.exe" (
    xcopy /Y /D /Q "%RESOURCES_DIR%\zion-miner.exe" "%RELEASE_DIR%\" >nul 2>&1
    if errorlevel 1 (
        echo [WARN] Nelze zkopirovat zion-miner.exe - pravdepodobne bezi proces. Pokracuji s existujicim.
    ) else (
        echo [sync] zion-miner.exe aktualizovan z resources.
    )
) else (
    echo [WARN] Zdrojovy zion-miner.exe nenalezen v %RESOURCES_DIR% - pouzivam existujici binary.
)

:: Kontrola - node.exe musi existovat
if not exist "%RELEASE_DIR%\node.exe" (
    echo [ERROR] node.exe nenalezen ani v resources ani v release dir!
    echo         Zkopiruj rucne: copy APP&WEB\desktop-agent\resources\node.exe V3\target\release\
    pause
    exit /b 1
)

echo ===========================================================
echo  ZION OS - Complete Stack Launcher (visible windows)
echo ===========================================================
echo  1. ZION Dashboard  :: http://127.0.0.1:8766
echo  2. ZION Node       :: P2P 8333  RPC 8443  WS 8445
echo  3. ZION GPU Miner  :: Pool 62.171.141.136:8444  (deeksha_lite_fire)
echo ===========================================================
echo.

start "ZION Dashboard :: http://127.0.0.1:8766" cmd /k "cd /d C:\Users\yosef\Desktop\Zion\2.9.6-main && python ZION_OS\dashboard\app.py"
timeout /t 3 /nobreak >nul

start "ZION Backup :: C:\ZION-AutoBackups" cmd /k "C:\Users\yosef\Desktop\Zion\2.9.6-main\ZionStart\windows\backup-local-core.bat"
timeout /t 2 /nobreak >nul

start "ZION Node :: P2P 8333 RPC 8443" cmd /k "C:\Users\yosef\Desktop\Zion\2.9.6-main\ZionStart\windows\start-node-window.bat"
timeout /t 5 /nobreak >nul

start "ZION GPU Miner :: 62.171.141.136:8444 [deeksha_lite_fire]" cmd /k "C:\Users\yosef\Desktop\Zion\2.9.6-main\ZionStart\windows\start-miner-window.bat"
timeout /t 8 /nobreak >nul

:: ── Watchdog (pozadi, bezeslovne) ──────────────────────────────────────────
:: Sleduje node1 + miner, restartuje pri padu. Log: logs\watchdog.log
powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\Users\yosef\Desktop\Zion\2.9.6-main\scripts\zion-watchdog.ps1" -CheckIntervalSec 30 -RestartCooldownSec 120

echo.
echo ===========================================================
echo  Vse spusteno v samostatnych oknech!
echo ===========================================================
echo  Dashboard  : http://127.0.0.1:8766
echo  Watchdog   : logs\watchdog.log (node1 + miner auto-restart)
echo ===========================================================
echo.
pause
