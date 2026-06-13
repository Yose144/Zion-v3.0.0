# Hiran v2.3 Checkpoint Backup (PowerShell) — with completeness verification
# Runs in loop, downloads new checkpoints every 10 minutes
# Verifies file count + total size against remote to catch partial transfers
# Usage: Start-Process powershell -ArgumentList '-ExecutionPolicy','Bypass','-File','.\backup-checkpoints.ps1' -WindowStyle Hidden

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

function Get-LocalDirSize($path) {
    if (-not (Test-Path $path)) { return @(0, 0) }
    $files = Get-ChildItem $path -Recurse -File -ErrorAction SilentlyContinue
    if (-not $files) { return @(0, 0) }
    $size = ($files | Measure-Object -Property Length -Sum).Sum
    $count = $files.Count
    return @($size, $count)
}

Write-Log "========================================"
Write-Log "  Hiran v2.3 Checkpoint Backup v2"
Write-Log "  Remote: ${SSHHost}:${SSHPort}"
Write-Log "  Local:  $LocalDir"
Write-Log "  Interval: ${SleepSeconds}s (10 min)"
Write-Log "========================================"

$cycle = 0
$sshBase = "ssh -p $SSHPort -i `"$SSHKey`" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=15 root@${SSHHost}"
$mb = 1048576

while ($true) {
    $cycle++
    Write-Log "--- Backup cycle #$cycle ---"

    # Always download latest training log (small, fast)
    $logDest = "$LocalDir\hiran-training.log"
    $logTmp  = "$LocalDir\hiran-training.log.tmp"
    & scp -P $SSHPort -i "$SSHKey" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 "root@${SSHHost}:${RemoteLog}" "$logTmp" 2>$null
    if (Test-Path $logTmp) {
        Move-Item -Path $logTmp -Destination $logDest -Force
        Write-Log "Log downloaded (OK)"
    } else {
        Write-Log "WARNING: Failed to download log"
    }

    # Get list of remote checkpoints + their sizes
    $remoteListRaw = & cmd /c "$sshBase `"ls -1 $RemoteDir/ 2>nul`""
    $remoteListRaw = $remoteListRaw | Where-Object { $_ -and ($_ -match 'checkpoint-\d+') }

    if ($remoteListRaw) {
        foreach ($dir in $remoteListRaw) {
            $dir = $dir.Trim()
            $localPath = "$LocalDir\$dir"

            # Get remote size + file count
            $remoteSizeStr = (& cmd /c "$sshBase \"du -sb $RemoteDir/$dir 2>/dev/null\"")
            $remoteSizeStr = $remoteSizeStr.Trim().Split()[0]
            $remoteFilesStr = (& cmd /c "$sshBase \"find $RemoteDir/$dir -type f 2>/dev/null | wc -l\"")
            $remoteFilesStr = $remoteFilesStr.Trim()

            $remoteSize = 0
            [int]::TryParse($remoteSizeStr, [ref]$remoteSize) | Out-Null
            $remoteFiles = 0
            [int]::TryParse($remoteFilesStr, [ref]$remoteFiles) | Out-Null

            $localInfo = Get-LocalDirSize $localPath
            $localSize = $localInfo[0]
            $localFiles = $localInfo[1]

            $sizeDiffPct = if ($remoteSize -gt 0) { [math]::Abs($localSize - $remoteSize) / $remoteSize * 100 } else { 0 }
            $isComplete = ($localFiles -eq $remoteFiles) -and ($sizeDiffPct -lt 5)

            if (-not $isComplete) {
                if ($localFiles -gt 0) {
                    Write-Log "INCOMPLETE: $dir local=${localFiles}f $([math]::Round($localSize/$mb,1))MB remote=${remoteFiles}f $([math]::Round($remoteSize/$mb,1))MB. Re-downloading..."
                    Remove-Item -Path $localPath -Recurse -Force -ErrorAction SilentlyContinue
                } else {
                    Write-Log "DOWNLOADING: $dir ${remoteFiles}f $([math]::Round($remoteSize/$mb,1))MB"
                }

                & scp -r -P $SSHPort -i "$SSHKey" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=120 "root@${SSHHost}:${RemoteDir}/${dir}" "$localPath" 2>&1 | ForEach-Object { Write-Log "  $_" }

                # Verify after download
                $localInfo2 = Get-LocalDirSize $localPath
                $localSize2 = $localInfo2[0]
                $localFiles2 = $localInfo2[1]
                $sizeDiffPct2 = if ($remoteSize -gt 0) { [math]::Abs($localSize2 - $remoteSize) / $remoteSize * 100 } else { 0 }
                $isComplete2 = ($localFiles2 -eq $remoteFiles) -and ($sizeDiffPct2 -lt 5)

                if ($isComplete2) {
                    Write-Log "SUCCESS: $dir verified ${localFiles2}f $([math]::Round($localSize2/$mb,1))MB"
                } else {
                    Write-Log "FAILED: $dir still incomplete local=${localFiles2}f $([math]::Round($localSize2/$mb,1))MB remote=${remoteFiles}f $([math]::Round($remoteSize/$mb,1))MB"
                }
            } else {
                Write-Log "OK: $dir already complete ${localFiles}f $([math]::Round($localSize/$mb,1))MB"
            }
        }
    } else {
        Write-Log "No checkpoints on remote yet."
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
