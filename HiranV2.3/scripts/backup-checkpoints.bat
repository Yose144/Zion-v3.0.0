@echo off
setlocal enabledelayedexpansion
:: Hiran v2.3 Checkpoint Backup (Windows)
:: Runs in loop, downloads new checkpoints every 10 minutes
:: Run: backup-checkpoints.bat
:: Or start in background: start backup-checkpoints.bat

set SSH_PORT=31384
set SSH_KEY=%USERPROFILE%\.ssh\vast\hiran_v2.4_key
set SSH_HOST=ssh1.vast.ai
set REMOTE_DIR=/workspace/hiran-v2.3/checkpoints/stage1_factual
set REMOTE_LOG=/workspace/hiran-training.log
set LOCAL_DIR=%USERPROFILE%\HiranV2.3-Checkpoints
set LOG=%LOCAL_DIR%\backup.log
set SLEEP_SEC=600

if not exist "%LOCAL_DIR%" mkdir "%LOCAL_DIR%"

echo ======================================== >> "%LOG%"
echo   Hiran v2.3 Checkpoint Backup         >> "%LOG%"
echo   Started: %date% %time%                >> "%LOG%"
echo   Remote: %SSH_HOST%:%SSH_PORT%         >> "%LOG%"
echo   Local:  %LOCAL_DIR%                   >> "%LOG%"
echo   Check interval: %SLEEP_SEC% sec (10 min) >> "%LOG%"
echo ======================================== >> "%LOG%"

set CYCLE=0

:LOOP
set /a CYCLE+=1
set TIMESTAMP=%date% %time%
echo [%TIMESTAMP%] --- Backup cycle #%CYCLE% --- >> "%LOG%"

:: Always download latest training log (small, fast)
scp -P %SSH_PORT% -i "%SSH_KEY%" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 root@%SSH_HOST%:%REMOTE_LOG% "%LOCAL_DIR%\hiran-training.log.tmp" >nul 2>&1
if exist "%LOCAL_DIR%\hiran-training.log.tmp" (
    move /y "%LOCAL_DIR%\hiran-training.log.tmp" "%LOCAL_DIR%\hiran-training.log" >nul 2>&1
    echo [%TIMESTAMP%] Log downloaded (OK) >> "%LOG%"
) else (
    echo [%TIMESTAMP%] WARNING: Failed to download log >> "%LOG%"
)

:: Get list of remote checkpoints
ssh -p %SSH_PORT% -i "%SSH_KEY%" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 root@%SSH_HOST% "ls -1 %REMOTE_DIR%/ 2>/dev/null" > "%LOCAL_DIR%\remote_list.txt" 2>nul

set NEW_CHECKPOINTS=0
if exist "%LOCAL_DIR%\remote_list.txt" (
    for /f "tokens=*" %%D in (%LOCAL_DIR%\remote_list.txt) do (
        if "%%D" neq "" (
            if not exist "%LOCAL_DIR%\%%D" (
                echo [%TIMESTAMP%] DOWNLOADING: %%D >> "%LOG%"
                scp -r -P %SSH_PORT% -i "%SSH_KEY%" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=60 root@%SSH_HOST%:%REMOTE_DIR%/%%D "%LOCAL_DIR%\%%D" >> "%LOG%" 2>&1
                if !ERRORLEVEL! == 0 (
                    echo [%TIMESTAMP%] SUCCESS: %%D >> "%LOG%"
                    set /a NEW_CHECKPOINTS+=1
                ) else (
                    echo [%TIMESTAMP%] FAILED: %%D (exit !ERRORLEVEL!) >> "%LOG%"
                )
            ) else (
                echo [%TIMESTAMP%] SKIP (already have): %%D >> "%LOG%"
            )
        )
    )
) else (
    echo [%TIMESTAMP%] No checkpoints on remote yet. >> "%LOG%"
)

:: Report status
if %NEW_CHECKPOINTS% gtr 0 (
    echo [%TIMESTAMP%] === %NEW_CHECKPOINTS% new checkpoint(s) backed up === >> "%LOG%"
)

:: Show current step from log
type "%LOCAL_DIR%\hiran-training.log" 2>nul | findstr /r "[0-9]*/8901" > "%LOCAL_DIR%\last_step.txt" 2>nul
for /f %%i in (%LOCAL_DIR%\last_step.txt) do (
    echo [%TIMESTAMP%] Training step: %%i >> "%LOG%"
    goto :BREAK_STEP
)
:BREAK_STEP

echo [%TIMESTAMP%] Sleeping %SLEEP_SEC% seconds... >> "%LOG%"
timeout /t %SLEEP_SEC% /nobreak >nul
goto LOOP
