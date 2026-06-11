# ZION Auto-Startup + Backup Tasks Setup
Write-Host "=== ZION Task Scheduler Setup ==="

$tasks = Get-ScheduledTask | Where-Object { $_.TaskName -like 'ZION*' }
foreach ($t in $tasks) {
    Write-Host "Removing old task: $($t.TaskName)"
    Unregister-ScheduledTask -TaskName $t.TaskName -Confirm:$false
}

Write-Host ""
Write-Host "=== Creating ZION-Start-Visible-Stack (on logon) ==="
$action1 = New-ScheduledTaskAction -Execute "cmd" -Argument '/c start /d "C:\Users\yosef\Desktop\Zion\2.9.6-main" start-all-visible.bat'
$trigger1 = New-ScheduledTaskTrigger -AtLogon
$principal1 = New-ScheduledTaskPrincipal -UserId "yosef" -LogonType Interactive -RunLevel Highest
$settings1 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "ZION-Start-Visible-Stack" -Action $action1 -Trigger $trigger1 -Principal $principal1 -Settings $settings1 -Description "Auto-start ZION visible stack at logon" -Force

Write-Host ""
Write-Host "=== Creating ZION-AutoBackup-15min (every 15 minutes) ==="
$action2 = New-ScheduledTaskAction -Execute "cmd" -Argument '/c start /d "C:\Users\yosef\Desktop\Zion\2.9.6-main" backup-local-core.bat'
$trigger2 = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration ([System.TimeSpan]::MaxValue)
$principal2 = New-ScheduledTaskPrincipal -UserId "yosef" -LogonType Interactive -RunLevel Highest
$settings2 = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "ZION-AutoBackup-15min" -Action $action2 -Trigger $trigger2 -Principal $principal2 -Settings $settings2 -Description "ZION local backup every 15 minutes" -Force

Write-Host ""
Write-Host "=== Verifying ==="
Get-ScheduledTask | Where-Object { $_.TaskName -like 'ZION*' } | Select-Object TaskName,State | Format-Table -AutoSize

Write-Host ""
Write-Host "Setup complete. Tasks will run on next logon (stack) and immediately (backup)."
