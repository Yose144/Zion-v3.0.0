Write-Output "=== Windows Startup Folder ==="
$startup = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
Get-ChildItem $startup -ErrorAction SilentlyContinue | Select-Object Name, FullName | Format-Table -AutoSize

Write-Output "`n=== Scheduled Tasks with ZION/Hiran ==="
try {
    Get-ScheduledTask | Where-Object { $_.TaskName -match 'zion|hiran|dashboard|node|pool|miner' } | Select-Object TaskName, State, Author | Format-Table -AutoSize
} catch { Write-Output "ScheduledTask error: $_" }

Write-Output "`n=== Running processes (ZION/Hiran related) ==="
Get-Process | Where-Object { $_.ProcessName -match 'node|server|miner|zion|llama|python|hiran' } | Select-Object ProcessName, Id, @{N='MB';E={[math]::Round($_.WorkingSet/1MB,1)}} | Format-Table -AutoSize

Write-Output "`n=== Services with ZION/Hiran ==="
try {
    Get-Service | Where-Object { $_.Name -match 'zion|hiran|llama|docker' } | Select-Object Name, Status, StartType | Format-Table -AutoSize
} catch { Write-Output "Service error: $_" }

Write-Output "`n=== Docker containers ==="
try { docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>$null } catch { Write-Output "Docker not available or error" }
