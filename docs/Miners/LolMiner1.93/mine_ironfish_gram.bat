@echo off

setlocal enableDelayedExpansion

Rem #################################
Rem ## Begin of user-editable part ##
Rem #################################

set "POOL=de.ironfish.herominers.com:1145"
set "WALLET=406c14bac8709d75045c175bee21a13216107fcb6d5be66e5580a3a1d3a80035.lolMinerWorker"

set "DPOOL=ton.hashrate.to:4002"
set "DWALLET=UQCisLJnhNJKAdclhRu4pfFFuORZ9FLpCSRjrUfk2mDCr0FQ"

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
"%MyVariable%"  --algo FISHHASH --pool !POOL! --user !WALLET! --dualmode TONDUAL --dualpool !DPOOL! --dualuser !DUSER! --watchdog exit !EXTRAPARAMETERS!
if %ERRORLEVEL% == 42 (
	timeout 10
	goto W10
)
goto END

:OtherW
"%MyVariable%"  --algo FISHHASH --pool !POOL! --user !WALLET! --dualmode TONDUAL --dualpool !DPOOL! --dualuser !DUSER! --watchdog exit !EXTRAPARAMETERS! --nocolor
if %ERRORLEVEL% == 42 (
	timeout 10
	goto OtherW
)

:END
pause
