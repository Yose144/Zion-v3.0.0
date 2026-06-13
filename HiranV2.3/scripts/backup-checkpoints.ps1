# Hiran v2.3 Checkpoint Backup (PowerShell)
# Verifies completeness by checking key file sizes locally (avoids SSH banner parsing issues)

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

function Is-CheckpointComplete($path) {
    if (-not (Test-Path $path)) { return $false }
    $adapter = Join-Path $path "adapter_model.safetensors"
    $optimizer = Join-Path $path "optimizer.pt"
    if (-not (Test-Path $adapter)) { return $false }
    $adapterSize = (Get-Item $adapter).Length
    if ($adapterSize -lt 1500000000) { return $false } # < 1.5 GB = incomplete
    if (Test-Path $optimizer) {
        $optSize = (Get-Item $optimizer).Length
        if ($optSize -lt 3000000000) { return $false } # < 3 GB = incomplete
    }
    return $true
}

Write-Log "========================================"
Write-Log "  Hiran v2.3 Checkpoint Backup v3"
Write-Log "  Remote: ${SSHHost}:${SSHPort}"
Write-Log "  Local:  $LocalDir"
Write-Log "  Interval: ${SleepSeconds}s (10 min)"
Write-Log "========================================"

$cycle = 0
$sshArgs = @("-p", "$SSHPort", "-i", "$SSHKey", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null", "-o", "ConnectTimeout=15", "root@${SSHHost}")
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

    # Get list of remote checkpoints
    $remoteListRaw = & ssh @sshArgs "ls -1 $RemoteDir/ 2>/dev/null" 2>$null
    $remoteListRaw = $remoteListRaw | Where-Object { $_ -and ($_ -match 'checkpoint-\d+') }

    if ($remoteListRaw) {
        foreach ($dir in $remoteListRaw) {
            $dir = $dir.Trim()
            $localPath = "$LocalDir\$dir"

            if (Is-CheckpointComplete $localPath) {
                $adapterSize = (Get-Item (Join-Path $localPath "adapter_model.safetensors")).Length
                Write-Log "OK: $dir complete (adapter $([math]::Round($adapterSize/$mb,1)) MB)"
            } else {
                if (Test-Path $localPath) {
                    Write-Log "INCOMPLETE: $dir — re-downloading..."
                    Remove-Item -Path $localPath -Recurse -Force -ErrorAction SilentlyContinue
                } else {
                    Write-Log "DOWNLOADING: $dir"
                }

                & scp -r -P $SSHPort -i "$SSHKey" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=120 "root@${SSHHost}:${RemoteDir}/${dir}" "$localPath" 2>&1 | ForEach-Object { Write-Log "  $_" }

                # Verify after download
                if (Is-CheckpointComplete $localPath) {
                    $adapterSize = (Get-Item (Join-Path $localPath "adapter_model.safetensors")).Length
                    Write-Log "SUCCESS: $dir verified (adapter $([math]::Round($adapterSize/$mb,1)) MB)"
                } else {
                    Write-Log "FAILED: $dir still incomplete after download"
                }
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
