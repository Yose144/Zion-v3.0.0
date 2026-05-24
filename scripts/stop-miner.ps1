# ZION V3 — Stop Miner
# Kills zion-miner process by name
Get-Process | Where-Object { $_.ProcessName -eq "zion-miner" } | ForEach-Object {
    Write-Host "Stopping zion-miner PID=$($_.Id)"
    $_.Kill()
}
Write-Host "[stop-miner] Miner stopped."
