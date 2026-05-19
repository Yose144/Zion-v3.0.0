# Stop all ZION processes by image name
$names = @("node", "server", "zion-miner")
foreach ($n in $names) {
    Get-Process | Where-Object { $_.ProcessName -eq $n } | ForEach-Object {
        Write-Host "Stopping $($_.ProcessName) PID=$($_.Id)"
        $_.Kill()
    }
}
Write-Host "[stop] All ZION processes stopped."
