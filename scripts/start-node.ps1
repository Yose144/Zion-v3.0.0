# ZION V3 — Start Local Backup Node (syncs from Edge primary)
$RepoRoot = "C:\Users\yosef\Desktop\Zion\2.9.6-main"
$logDir   = "$RepoRoot\logs"
$pidDir   = "$RepoRoot\.pids"
$DataDir  = "$RepoRoot\V3\data"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
New-Item -ItemType Directory -Path $pidDir -Force | Out-Null
New-Item -ItemType Directory -Path $DataDir -Force | Out-Null

[Environment]::SetEnvironmentVariable('ZION_NODE_ID', 'local-backup-node', 'Process')
[Environment]::SetEnvironmentVariable('ZION_P2P_BIND', '0.0.0.0:8333', 'Process')
[Environment]::SetEnvironmentVariable('ZION_RPC_BIND', '0.0.0.0:8443', 'Process')
[Environment]::SetEnvironmentVariable('ZION_NODE_STATE_PATH', "$DataDir\zion-node-state.db", 'Process')
# Edge-primary topology: sync from Edge primary via Tailscale VPN
[Environment]::SetEnvironmentVariable('ZION_SEED_PEERS', '100.76.16.108:8333', 'Process')
[Environment]::SetEnvironmentVariable('ZION_MINER_ADDRESS', 'zion1w523a76830x2t5m7f3j023w265e8g5c400a4790', 'Process')
[Environment]::SetEnvironmentVariable('ZION_HUMANITARIAN_WALLET', 'zion165a527w5d0n085t775x3w8n8q20742a6w7xr0z3', 'Process')
[Environment]::SetEnvironmentVariable('ZION_ISSOBELLA_WALLET', 'zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702', 'Process')

# Clean old Temp files if they exist (migration from previous runs)
Remove-Item -Path 'C:\Users\yosef\AppData\Local\Temp\peers.json' -ErrorAction SilentlyContinue
Remove-Item -Path 'C:\Users\yosef\AppData\Local\Temp\zion-node-state.db*' -ErrorAction SilentlyContinue
Remove-Item -Recurse -Path 'C:\Users\yosef\AppData\Local\Temp\zion-node-state.db' -ErrorAction SilentlyContinue

$nodeExe = "$RepoRoot\V3\target\release\node.exe"
if (-not (Test-Path $nodeExe)) {
    Write-Error "[ERROR] Binary not found: $nodeExe`n        Run: cargo build --release --manifest-path V3/Cargo.toml -p zion-core"
    exit 1
}

# Kill existing node1 process if running (by PID file)
$pidFile = "$pidDir\node1.pid"
if (Test-Path $pidFile) {
    $oldPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($oldPid) {
        $proc = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "[stop] Stopping existing node1 PID=$oldPid"
            $proc | Stop-Process -Force
            Start-Sleep -Seconds 1
        }
    }
}

$ts = [int][double]::Parse((Get-Date -UFormat %s))
$logFile = "$logDir\node1_${ts}.log"
$errFile = "$logDir\node1_${ts}.err"
$p = Start-Process -FilePath $nodeExe -WorkingDirectory $RepoRoot -RedirectStandardOutput $logFile -RedirectStandardError $errFile -WindowStyle Hidden -PassThru
$p.Id | Out-File $pidFile -Encoding utf8
# Keep node1.log pointing at the latest log (copy on first write doesn't work on Windows, use symlink attempt or just write path)
Write-Host "Started Node1  PID=$($p.Id)  log=$logFile"

# Quick health check: wait up to 10s for log to show activity
$started = $false
for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $logFile) {
        $log = Get-Content $logFile -Raw -ErrorAction SilentlyContinue
        if ($log -and ($log -match 'node_id|chain_height|listening')) {
            $started = $true
            break
        }
    }
}
if (-not $started) {
    Write-Warning "[warn] Node1 may have failed to start. Check $errFile"
} else {
    Write-Host "[ok] Node1 appears healthy."
}
