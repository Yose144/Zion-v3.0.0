# Hiran v2.3 Checkpoint Backup (PowerShell)
# Runs in loop, downloads new checkpoints every 10 minutes
# Usage: Start-Job -FilePath .\backup-checkpoints.ps1
# Or run directly: .\backup-checkpoints.ps1

param(
    [string]$SSHHost = "ssh1.vast.ai",
    [int]$SSHPort = 31384,
    [string]$SSHKey = "$env:USERPROFILE\.ssh\vast\hiran_v2.4_key",
    [string]$RemoteDir = "/workspace/hiran-v2.3/checkpoints/stage1_factual",
    [string]$RemoteLog = "/workspace/hiran-training.log",
    [string]$LocalDir = "$env:USERPROFILE\HiranV2.3-Checkpoints",
    [int]$SleepSeconds = 600
)

$LogFile = "$LocalDir\backup.log"
if (-not (Test-Path $LocalDir)) { New-Item -ItemType Directory -Path $LocalDir -Force | Out-Null }

function Write-Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $msg"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

Write-Log "========================================"
Write-Log "  Hiran v2.3 Checkpoint Backup (PS)"
Write-Log "  Remote: ${SSHHost}:${SSHPort}"
Write-Log "  Local:  $LocalDir"
Write-Log "  Interval: ${SleepSeconds}s (10 min)"
Write-Log "========================================"

$cycle = 0
$sshBase = "ssh -p $SSHPort -i `"$SSHKey`" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=15 root@${SSHHost}"

while ($true) {
    $cycle++
    Write-Log "--- Backup cycle #$cycle ---"

    # Always download training log (small, fast)
    $logDest = "$LocalDir\hiran-training.log"
    $logTmp  = "$LocalDir\hiran-training.log.tmp"
    & scp -P $SSHPort -i "$SSHKey" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 "root@${SSHHost}:${RemoteLog}" "$logTmp" 2>$null
    if (Test-Path $logTmp) {
        Move-Item -Path $logTmp -Destination $logDest -Force
        Write-Log "Log downloaded (OK)"
    } else {
        Write-Log "WARNING: Failed to download log"
    }

    # Get list of remote checkpoints
    $remoteList = & cmd /c "$sshBase `"ls -1 $RemoteDir/ 2>nul`"" 2>$null
    $remoteList = $remoteList | Where-Object { $_ -and $_.Trim() -ne "" }

    $newCount = 0
    if ($remoteList) {
        foreach ($dir in $remoteList) {
            $dir = $dir.Trim()
            $localPath = "$LocalDir\$dir"
            if (-not (Test-Path $localPath)) {
                Write-Log "DOWNLOADING: $dir"
                & scp -r -P $SSHPort -i "$SSHKey" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=120 "root@${SSHHost}:${RemoteDir}/${dir}" "$localPath" 2>&1 | ForEach-Object { Write-Log "  $_" }
                if (Test-Path $localPath) {
                    Write-Log "SUCCESS: $dir"
                    $newCount++
                } else {
                    Write-Log "FAILED: $dir"
                }
            } else {
                Write-Log "SKIP (already have): $dir"
            }
        }
    } else {
        Write-Log "No checkpoints on remote yet."
    }

    if ($newCount -gt 0) {
        Write-Log "=== $newCount new checkpoint(s) backed up ==="
    }

    # Show current step from log
    if (Test-Path $logDest) {
        $step = Get-Content $logDest | Select-String -Pattern "[0-9]+/8901" | Select-Object -Last 1
        if ($step) {
            Write-Log "Training step: $($step.Matches[0].Value)"
        }
    }

    Write-Log "Sleeping ${SleepSeconds}s..."
    Start-Sleep -Seconds $SleepSeconds
}
