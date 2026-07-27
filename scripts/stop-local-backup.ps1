# ZION V3 — Stop Local Backup Node + Beacon (Edge-Primary Topology)
# Stops processes started by launch-local-backup.ps1

$RepoRoot = Split-Path -Parent $PSScriptRoot
$BackupRoot = if ($env:ZION_BACKUP_DIR) { $env:ZION_BACKUP_DIR } else { "D:\Zion" }
$PidDir = Join-Path $BackupRoot ".pids"

function Stop-ByPidFile($name) {
    $f = Join-Path $PidDir "$name.pid"
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

function Stop-ByBinaryPath($binaryPath) {
    $target = (Resolve-Path $binaryPath -ErrorAction SilentlyContinue).Path
    if (-not $target) { return }
    Get-Process | Where-Object {
        try { $_.Path -and ($_.Path -eq $target) } catch { $false }
    } | ForEach-Object {
        Write-Host "Stopping process $($_.Path) PID=$($_.Id)"
        $_ | Stop-Process -Force
        Start-Sleep -Seconds 1
    }
}

Stop-ByPidFile "node1"
Stop-ByPidFile "backup-beacon-loop"
Stop-ByPidFile "miner"

# Fallback for any stray repo binary instances
$NodeExe = Join-Path $RepoRoot "V3\target\release\node.exe"
Stop-ByBinaryPath $NodeExe

Write-Host "[stop-local-backup] Local backup node, beacon and miner stopped."
