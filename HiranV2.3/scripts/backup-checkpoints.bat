@echo off
:: Hiran v2.3 Checkpoint Backup (Windows)
:: Runs in loop, downloads new checkpoints every 30 minutes
:: Run: backup-checkpoints.bat
:: Or start in background: start backup-checkpoints.bat

set SSH_PORT=31384
set SSH_KEY=%USERPROFILE%\.ssh\vast\hiran_v2.4_key
set SSH_HOST=ssh1.vast.ai
set REMOTE_DIR=/workspace/hiran-v2.3/checkpoints/stage1_factual
set LOCAL_DIR=%USERPROFILE%\HiranV2.3-Checkpoints
set LOG=%LOCAL_DIR%\backup.log
set SLEEP_SEC=1800

if not exist "%LOCAL_DIR%" mkdir "%LOCAL_DIR%"

echo ======================================== >> "%LOG%"
echo   Hiran v2.3 Checkpoint Backup         >> "%LOG%"
echo   Started: %date% %time%                >> "%LOG%"
echo   Remote: %SSH_HOST%:%SSH_PORT%         >> "%LOG%"
echo   Local:  %LOCAL_DIR%                   >> "%LOG%"
echo ======================================== >> "%LOG%"

:LOOP
set TIMESTAMP=%date% %time%
echo [%TIMESTAMP%] Checking for checkpoints... >> "%LOG%"

:: Get list of remote checkpoints
ssh -p %SSH_PORT% -i "%SSH_KEY%" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@%SSH_HOST% "ls -1 %REMOTE_DIR%/ 2>/dev/null" > "%LOCAL_DIR%\remote_list.txt" 2>nul

if exist "%LOCAL_DIR%\remote_list.txt" (
    for /f "tokens=*" %%D in (%LOCAL_DIR%\remote_list.txt) do (
        if "%%D" neq "" (
            if not exist "%LOCAL_DIR%\%%D" (
                echo [%TIMESTAMP%] DOWNLOADING: %%D >> "%LOG%"
                scp -r -P %SSH_PORT% -i "%SSH_KEY%" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@%SSH_HOST%:%REMOTE_DIR%/%%D "%LOCAL_DIR%\%%D" >> "%LOG%" 2>&1
                if %ERRORLEVEL% == 0 (
                    echo [%TIMESTAMP%] SUCCESS: %%D >> "%LOG%"
                ) else (
                    echo [%TIMESTAMP%] FAILED: %%D (exit %ERRORLEVEL%) >> "%LOG%"
                )
            ) else (
                echo [%TIMESTAMP%] SKIP (already have): %%D >> "%LOG%"
            )
        )
    )
) else (
    echo [%TIMESTAMP%] No checkpoints on remote yet. >> "%LOG%"
)

:: Also download training log
copy /y "%LOCAL_DIR%\hiran-training.log" "%LOCAL_DIR%\hiran-training.log.old" >nul 2>&1
scp -P %SSH_PORT% -i "%SSH_KEY%" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@%SSH_HOST%:/workspace/hiran-training.log "%LOCAL_DIR%\" >nul 2>&1

echo [%TIMESTAMP%] Sleeping %SLEEP_SEC% seconds... >> "%LOG%"
timeout /t %SLEEP_SEC% /nobreak >nul
goto LOOP
