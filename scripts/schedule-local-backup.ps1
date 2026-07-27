# ZION V3 — Schedule Local Backup Node to start at Windows logon
# Registers a Task Scheduler task that runs launch-local-backup.ps1 at login.
# Run as Administrator if you need the task to start regardless of UAC prompts.

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$LaunchScript = Join-Path $RepoRoot "scripts\launch-local-backup.ps1"
$TaskName = "zion-local-backup"

if (-not (Test-Path $LaunchScript)) {
    Write-Error "[ERROR] launch-local-backup.ps1 not found at $LaunchScript"
    exit 1
}

# Remove any existing task with the same name
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed existing scheduled task '$TaskName'"
}

$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$LaunchScript`""
$Trigger = New-ScheduledTaskTrigger -AtLogon
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType S4U -RunLevel Limited
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null

Write-Host "[OK] Scheduled task '$TaskName' created. It will run at every logon."
Write-Host "     To start now:      powershell -ExecutionPolicy Bypass -File \"$LaunchScript\""
Write-Host "     To stop:           powershell -ExecutionPolicy Bypass -File \"$PSScriptRoot\stop-local-backup.ps1\""
Write-Host "     To remove task:    Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
