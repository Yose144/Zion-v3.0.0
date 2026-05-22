@echo off
REM Instalace dashboardu do Windows Startup
REM Spusť jako administrátor

set SCRIPT_DIR=%~dp0
set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT=%STARTUP_FOLDER%\ZION-Dashboard.lnk

echo Creating dashboard auto-start shortcut...
echo Script location: %SCRIPT_DIR%
echo Startup folder: %STARTUP_FOLDER%

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%SCRIPT_DIR%start-dashboard.bat'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.Description = 'ZION Mainnet Dashboard'; $s.Save()"

if exist "%SHORTCUT%" (
    echo ✅ Dashboard shortcut created in Startup folder
    echo 🚀 Dashboard will start automatically after PC restart
    echo 📍 Location: %SHORTCUT%
) else (
    echo ❌ Failed to create shortcut
    echo Try running as Administrator
)

pause