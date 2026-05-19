# Quick live overview: last 20 lines from all 4 logs, refreshed every 3 seconds
$logDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\logs"
$logs = @(
    @{Name="NODE1"; File="$logDir\node1.log"; Color="Cyan"},
    @{Name="NODE2"; File="$logDir\node2.log"; Color="Green"},
    @{Name="POOL "; File="$logDir\pool.log"; Color="Yellow"},
    @{Name="MINER"; File="$logDir\miner.log"; Color="Magenta"}
)

while ($true) {
    Clear-Host
    Write-Host "=== ZION Live Log Viewer (Ctrl+C to quit) ===" -ForegroundColor White
    Write-Host ""
    foreach ($log in $logs) {
        Write-Host "--- $($log.Name) ---" -ForegroundColor $log.Color
        if (Test-Path $log.File) {
            Get-Content $log.File -Tail 20 | ForEach-Object { Write-Host $_ -ForegroundColor $log.Color }
        } else {
            Write-Host "(no log yet)" -ForegroundColor DarkGray
        }
        Write-Host ""
    }
    Start-Sleep -Seconds 3
}
