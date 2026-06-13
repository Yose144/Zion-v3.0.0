# Hiran v2.3 Training Monitor
# Runs every hour, checks training status and reports to console + log
# Usage: .\monitor-training.ps1 (runs once)
#        while($true){ .\monitor-training.ps1; Start-Sleep -Seconds 3600 } (hourly loop)

param(
    [string]$SSHHost = "ssh1.vast.ai",
    [int]$SSHPort = 31384,
    [string]$SSHKey = "$env:USERPROFILE\.ssh\vast\hiran_v2.4_key",
    [string]$LogDir = "$env:USERPROFILE\HiranV2.3-Checkpoints"
)

$MonitorLog = "$LogDir\monitor.log"
$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

function Write-Log($msg) {
    $line = "[$Timestamp] $msg"
    Write-Host $line
    Add-Content -Path $MonitorLog -Value $line
}

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

Write-Log "========================================"
Write-Log "  Hiran v2.3 Training Monitor"
Write-Log "========================================"

# Check if training process is alive
$sshCmd = "ssh -p $SSHPort -i `"$SSHKey`" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=15 root@${SSHHost}"

# Get current step from log
$stepLine = & cmd /c "$sshCmd `"grep -oE '[0-9]+/8901' /workspace/hiran-training.log | tail -1`"" 2>$null
$stepLine = $stepLine.Trim()

# Get last loss
$lossLine = & cmd /c "$sshCmd \"grep -oE 'loss'\''.*[0-9.]+' /workspace/hiran-training.log | tail -1\"" 2>$null
$lossLine = $lossLine.Trim()

# Get GPU status
$gpuStatus = & cmd /c "$sshCmd \"nvidia-smi --query-gpu=memory.used,temperature.gpu,utilization.gpu --format=csv,noheader,nounits\"" 2>$null
$gpuStatus = $gpuStatus.Trim()

# Get disk usage
$diskUsage = & cmd /c "$sshCmd \"df -h /workspace | tail -1\"" 2>$null
$diskUsage = $diskUsage.Trim()

# Get uptime
$uptime = & cmd /c "$sshCmd \"uptime\"" 2>$null
$uptime = $uptime.Trim()

Write-Log "Training step : $stepLine"
Write-Log "Last loss     : $lossLine"
Write-Log "GPU status    : $gpuStatus"
Write-Log "Disk usage    : $diskUsage"
Write-Log "Uptime        : $uptime"

# Check for checkpoints
$chkpts = & cmd /c "$sshCmd \"ls -1 /workspace/hiran-v2.3/checkpoints/stage1_factual/ 2>/dev/null | wc -l\"" 2>$null
$chkpts = $chkpts.Trim()
if ($chkpts -and $chkpts -ne "0") {
    Write-Log "Checkpoints   : $chkpts saved on remote"
} else {
    Write-Log "Checkpoints   : None yet (next at step 500)"
}

# Check local backup status
$localCkptCount = if (Test-Path "$LogDir\checkpoint-*") { (Get-ChildItem "$LogDir\checkpoint-*" -Directory).Count } else { 0 }
Write-Log "Local backups : $localCkptCount checkpoint(s)"

# Alert conditions
if ($stepLine -eq "" -or $stepLine -eq "/8901") {
    Write-Log "ALERT: Could not detect training step!"
}
if ($gpuStatus -eq "") {
    Write-Log "ALERT: Could not reach GPU status!"
}

Write-Log "--- Monitor cycle complete ---"
