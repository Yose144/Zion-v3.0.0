@echo off

setlocal enableDelayedExpansion

Rem #################################
Rem ## Begin of user-editable part ##
Rem #################################

set "POOL=tls://pool.woolypooly.com:3124"
set "WALLET=nexa:nqtsq5g5galktrng3lfa3u9p7yv9d0dzzkv400vgaz23m77e"
set "EXTRAPARAMETERS=--apiport 8020"
set "LOCKCORE=1450"
set "LOCKMEM=5001"
set "COREOFFSET=150"

Rem #################################
Rem ##  End of user-editable part  ##
Rem #################################

<!-- : --- Self-Elevating Batch Script ---------------------------
@whoami /groups | find "S-1-16-12288" > nul && goto :admin
set "ELEVATE_CMDLINE=cd /d "%~dp0" & call "%~f0" %*"
cscript //nologo "%~f0?.wsf" //job:Elevate & exit /b

-->
<job id="Elevate"><script language="VBScript">
  Set objShell = CreateObject("Shell.Application")
  Set objWshShell = WScript.CreateObject("WScript.Shell")
  Set objWshProcessEnv = objWshShell.Environment("PROCESS")
  strCommandLine = Trim(objWshProcessEnv("ELEVATE_CMDLINE"))
  objShell.ShellExecute "cmd", "/c " & strCommandLine, "", "runas"
</script></job>
:admin -----------------------------------------------------------

cd /d %~dp0

set MyVariable=%CD%\lolMiner.exe

:WindowsVer
echo "Running lolMiner from %MyVariable%"
for /f "tokens=4-5 delims=. " %%i in ('ver') do set VERSION=%%i.%%j
if "%version%" == "10.0" goto W10
if "%version%" == "11.0" goto W10
goto OtherW

:W10
"%MyVariable%"  --algo NEXA --pool !POOL! --user !WALLET! --cclk !LOCKCORE! --mclk !LOCKMEM! --coff !COREOFFSET! --watchdog exit !EXTRAPARAMETERS!
if %ERRORLEVEL% == 42 (
	timeout 10
	goto W10
)
goto END

:OtherW
"%MyVariable%"  --algo NEXA --pool !POOL! --user !WALLET! --cclk !LOCKCORE! --mclk !LOCKMEM! --coff !COREOFFSET! --watchdog exit !EXTRAPARAMETERS! --nocolor
if %ERRORLEVEL% == 42 (
	timeout 10
	goto OtherW
)

:END
pause
