@echo off


setlocal enableDelayedExpansion


Rem #################################

Rem ## Begin of user-editable part ##

Rem #################################


set "POOL=ton.hashrate.to:4002"
set "WALLET=UQCisLJnhNJKAdclhRu4pfFFuORZ9FLpCSRjrUfk2mDCr0FQ"

set "PASS=x"

set "EXTRAPARAMETERS=--apiport 8020"


Rem #################################
Rem ##  End of user-editable part  ##
Rem #################################




set "PARAMS=--profile %PROFILE%"
setx GPU_FORCE_64BIT_PTR 1
setx GPU_MAX_HEAP_SIZE 100
setx GPU_USE_SYNC_OBJECTS 1
setx GPU_MAX_ALLOC_PERCENT 100
setx GPU_SINGLE_ALLOC_PERCENT 100


cd /d %~dp0

set MyVariable=%CD%\lolMiner.exe

:WindowsVer
echo "Running lolMiner from %MyVariable%"
for /f "tokens=4-5 delims=. " %%i in ('ver') do set VERSION=%%i.%%j
if "%version%" == "10.0" goto W10
goto OtherW

:W10
"%MyVariable%"  -a GRAM --pool !POOL! --user !WALLET! --pass !PASS! --watchdog exit !EXTRAPARAMETERS!
if %ERRORLEVEL% == 42 (
	timeout 10
	goto W10
)
goto END

:OtherW
"%MyVariable%"  -a GRAM --pool !POOL! --user !WALLET! --pass !PASS! --watchdog exit !EXTRAPARAMETERS! --nocolor
if %ERRORLEVEL% == 42 (
	timeout 10
	goto OtherW
)

:END
pause
