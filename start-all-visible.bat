@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

cd /d "C:\Users\yosef\Desktop\Zion\2.9.6-main"

if not exist "logs" mkdir logs
if not exist "V3\data" mkdir V3\data

echo ===========================================================
echo  ZION OS - Complete Stack Launcher (visible windows)
echo ===========================================================
echo.
echo  1. ZION Dashboard  :: http://127.0.0.1:8766
echo  2. ZION Node       :: P2P 8333  RPC 8443
echo  3. ZION GPU Miner  :: Pool 77.42.71.94:8444
echo ===========================================================
echo.

start "ZION Dashboard :: http://127.0.0.1:8766" cmd /k "cd /d C:\Users\yosef\Desktop\Zion\2.9.6-main && python ZION_OS\dashboard\app.py"
timeout /t 3 /nobreak >nul

start "ZION Node :: P2P 8333 RPC 8443" cmd /k start-node-window.bat
timeout /t 5 /nobreak >nul

start "ZION GPU Miner :: Pool 77.42.71.94:8444" cmd /k start-miner-window.bat

echo.
echo ===========================================================
echo  Vse spusteno v samostatnych oknech!
echo ===========================================================
echo.
echo  Dashboard: http://127.0.0.1:8766
echo.
pause
