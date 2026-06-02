# ZION V3 — Stop Local Backup Node + Miner (Edge-Primary Topology)
# Uses PID files created by launch-local-backup.ps1

$RepoRoot = "C:\Users\yosef\Desktop\Zion\2.9.6-main"
$PidDir   = "$RepoRoot\.pids"

function Stop-ByPidFile($name) {
    $f = "$PidDir\$name.pid"
    if (Test-Path $f) {
        $pidVal = Get-Content $f -ErrorAction SilentlyContinue
        if ($pidVal) {
            $proc = Get-Process -Id $pidVal -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "Stopping $name PID=$pidVal"
                $proc | Stop-Process -Force
                Start-Sleep -Seconds 1
            }
        }
        Remove-Item $f -ErrorAction SilentlyContinue
    }
}

Stop-ByPidFile "node1"
Stop-ByPidFile "miner"

Write-Host "[stop-local-backup] Local backup node and miner stopped."
