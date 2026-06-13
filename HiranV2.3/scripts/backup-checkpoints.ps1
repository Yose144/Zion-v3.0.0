# Hiran v2.3 Checkpoint Backup Script
# Runs on LOCAL PC, downloads checkpoints from Vast.ai instance
# Usage: PowerShell -File backup-checkpoints.ps1
# Or: Start-Process PowerShell -ArgumentList "-File backup-checkpoints.ps1" -WindowStyle Hidden

$ErrorActionPreference = "Continue"

# Config
$SSH_PORT = 31384
$SSH_KEY = "$env:USERPROFILE\.ssh\vast\hiran_v2.4_key"
$SSH_HOST = "ssh1.vast.ai"
$REMOTE_CHECKPOINT_DIR = "/workspace/hiran-v2.3/checkpoints/stage1_factual"
$LOCAL_BACKUP_DIR = "$env:USERPROFILE\HiranV2.3-Checkpoints"
$LOG_FILE = "$LOCAL_BACKUP_DIR\backup.log"
$SLEEP_MINUTES = 30

function Write-Log {
    param([string]$msg)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$ts  $msg" | Tee-Object -FilePath $LOG_FILE -Append | Write-Host
}

# Ensure directories exist
if (!(Test-Path $LOCAL_BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $LOCAL_BACKUP_DIR -Force | Out-Null
}
if (!(Test-Path $SSH_KEY)) {
    Write-Log "ERROR: SSH key not found: $SSH_KEY"
    Write-Log "Please ensure the key exists."
    exit 1
}

Write-Log "========================================"
Write-Log "  Hiran v2.3 Checkpoint Backup"
Write-Log "  Remote: ${SSH_HOST}:${SSH_PORT}"
Write-Log "  Local:  $LOCAL_BACKUP_DIR"
Write-Log "  Interval: ${SLEEP_MINUTES} minutes"
Write-Log "========================================"

# Get initial checkpoint list
Write-Log "Fetching initial checkpoint list..."
try {
    $initialList = ssh -p $SSH_PORT -i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "root@${SSH_HOST}" "ls -1 $REMOTE_CHECKPOINT_DIR/ 2>/dev/null" 2>$null
    Write-Log "Initial checkpoints found: $($initialList.Count)"
} catch {
    Write-Log "WARNING: Could not fetch initial list. Will retry."
}

$iteration = 0
while ($true) {
    $iteration++
    Write-Log "--- Backup cycle #$iteration ---"

    # Check remote checkpoints
    try {
        $remoteItems = ssh -p $SSH_PORT -i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "root@${SSH_HOST}" "ls -1 $REMOTE_CHECKPOINT_DIR/ 2>/dev/null" 2>$null
        if ($remoteItems) {
            $remoteDirs = $remoteItems | Where-Object { $_ -match "checkpoint-" -or $_ -eq "final" }
            Write-Log "Remote checkpoints: $($remoteDirs.Count)"

            foreach ($dir in $remoteDirs) {
                $localPath = Join-Path $LOCAL_BACKUP_DIR $dir
                if (Test-Path $localPath) {
                    Write-Log "  Already backed up: $dir"
                } else {
                    Write-Log "  DOWNLOADING: $dir ..."
                    $remoteFullPath = "${REMOTE_CHECKPOINT_DIR}/${dir}"
                    $scpCmd = "scp -r -P $SSH_PORT -i `"$SSH_KEY`" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null `"root@${SSH_HOST}:${remoteFullPath}`" `"$localPath`""
                    Invoke-Expression $scpCmd
                    if ($LASTEXITCODE -eq 0) {
                        Write-Log "  SUCCESS: $dir downloaded"
                    } else {
                        Write-Log "  FAILED: $dir (exit code $LASTEXITCODE)"
                    }
                }
            }
        } else {
            Write-Log "No checkpoints found on remote yet."
        }
    } catch {
        Write-Log "ERROR: SSH/SCP failed: $_"
    }

    # Also backup training log
    try {
        $logLocal = Join-Path $LOCAL_BACKUP_DIR "hiran-training.log"
        scp -P $SSH_PORT -i "$SSH_KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "root@${SSH_HOST}:/workspace/hiran-training.log" "$logLocal" 2>$null
    } catch { }

    Write-Log "Sleeping for $SLEEP_MINUTES minutes..."
    Start-Sleep -Seconds ($SLEEP_MINUTES * 60)
}
