@echo off
REM ZION Dashboard Auto-Start
REM Spusti dashboard po PC restartu nebo manualne
REM Port je 8766 (shodny s dashboard/config.json)

cd /d "C:\Users\yosef\Desktop\Zion\2.9.6-main\dashboard"
echo Starting ZION Dashboard on port 8766...
powershell.exe -ExecutionPolicy Bypass -File "start-dashboard.ps1" -Port 8766
