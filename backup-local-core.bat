@echo off

:: ============================================================================
::  ZION OS - Local Core Backup (visible window)
::  Backs up: node state, dashboard DBs, configs, git ref
::  Output:   C:\ZION-AutoBackups\
:: ============================================================================

cd /d "C:\Users\yosef\Desktop\Zion\2.9.6-main"

echo ===========================================================
echo  ZION OS - Local Core Database Backup
echo ===========================================================
echo  Source:  C:\Users\yosef\Desktop\Zion\2.9.6-main
echo  Target:  C:\ZION-AutoBackups\
echo ===========================================================
echo.

powershell -ExecutionPolicy Bypass -File "scripts\local-core-backup.ps1"

echo.
echo ===========================================================
echo  Backup script finished. Check C:\ZION-AutoBackups\
echo ===========================================================
echo.
pause
