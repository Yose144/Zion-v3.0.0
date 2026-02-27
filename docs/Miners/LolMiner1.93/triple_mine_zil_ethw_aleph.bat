@echo off

setlocal enableDelayedExpansion

Rem #################################
Rem ## Begin of user-editable part ##
Rem #################################

set "ZILPOOL=eu1-zil.shardpool.io:3333"
set "ZILWALLET=zil12kfcrls87pzqnneratejhk8xa3wdzlhrdl7w5g"

set "ETHPOOL=ethw.2miners.com:2020"
set "ETHWALLET=0x155da78b788ab54bea1340c10a5422a8ae88142f"

set "ALEPHPOOL=fi.alephium.herominers.com:1199"
set "ALEPHWALLET=1mmHfNEEWgDLbEUqqxkSjzgJjDt7AqgkutD64AnBUeXz"	

set "WORKER=lolMinerWorker"		
set "EXTRAPARAMETERS="							

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
"%MyVariable%" --algo ETHASH --pool !ZILPOOL! --user !ETHWALLET!.!WORKER! --pass !ZILWALLET!@!ETHPOOL! --enablezilcache --dualmode ALEPHDUAL --dualpool !ALEPHPOOL! --dualuser !ALEPHWALLET! --watchdog exit !EXTRAPARAMETERS!
if %ERRORLEVEL% == 42 (
	timeout 10
	goto W10
)
goto END

:OtherW
"%MyVariable%" --algo ETHASH --pool !ZILPOOL! --user !ETHWALLET!.!WORKER! --pass !ZILWALLET!@!ETHPOOL! --enablezilcache --dualmode ALEPHDUAL --dualpool !ALEPHPOOL! --dualuser !ALEPHWALLET!  --watchdog exit !EXTRAPARAMETERS! --nocolor
if %ERRORLEVEL% == 42 (
	timeout 10
	goto OtherW
)

:END
pause


