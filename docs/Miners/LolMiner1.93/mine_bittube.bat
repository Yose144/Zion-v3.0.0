@echo off

setlocal enableDelayedExpansion

Rem #################################
Rem ## Begin of user-editable part ##
Rem #################################

set "POOL=mining.bittube.app:3400"
set "WALLET=Tubed6kEh3gfJbdLRXMt7jDjJmqhKYpyPE2prL1JcbXhMm4xR7t2oo6ibYKAbJRgGoQvG6TMWG52deFxhwASoS3dd2jrVgwPWbU.lolMinerWorker"										

set "EXTRAPARAMETERS=--apiport 8020"								

Rem #################################
Rem ##  End of user-editable part  ##
Rem #################################



cd /d %~dp0

set MyVariable=%CD%\lolMiner.exe


:WindowsVer
echo "Running lolMiner from %MyVariable%"
for /f "tokens=4-5 delims=. " %%i in ('ver') do set VERSION=%%i.%%j
if "%version%" == "10.0" goto W10
goto OtherW

:W10
"%MyVariable%" -a CR29-40 --pool !POOL! --user !WALLET!  --watchdog exit !EXTRAPARAMETERS!
if %ERRORLEVEL% == 42 (
	timeout 10
	goto W10
)
goto END

:OtherW
"%MyVariable%" -a CR29-40 --pool !POOL! --user !WALLET! --watchdog exit !EXTRAPARAMETERS! --nocolor
if %ERRORLEVEL% == 42 (
	timeout 10
	goto OtherW
)

:END
pause
