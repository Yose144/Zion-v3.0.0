# ZION V3 — Local Backup Node + Miners (Edge-Primary Topology)
#
# This script is for the LOCAL PC (Windows 11) acting as backup + miner host.
# Edge (Hetzner VPS, 62.171.141.136) runs the primary node + pool 24/7.
# Local PC runs:
#   - 1 node (backup, syncing from Edge via Tailscale VPN)
#   - 1+ miners (connecting to Edge pool via Tailscale VPN)
#
# Prerequisites:
#   - Tailscale VPN active on both Edge and local PC
#   - Edge node is running and accessible at 62.171.141.136:8333
#   - Edge pool is running and accessible at 62.171.141.136:8444
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\launch-local-backup.ps1

$ErrorActionPreference = "Stop"

$RepoRoot = "C:\Users\yosef\Desktop\Zion\2.9.6-main"
$LogDir   = "$RepoRoot\logs"
$DataDir  = "$RepoRoot\V3\data"
$PidDir   = "$RepoRoot\.pids"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
New-Item -ItemType Directory -Path $PidDir -Force | Out-Null

# Clean old logs
Remove-Item -Path "$LogDir\*.log" -ErrorAction SilentlyContinue
Remove-Item -Path "$LogDir\*.err" -ErrorAction SilentlyContinue

$NodeExe  = "$RepoRoot\V3\target\release\node.exe"
$MinerExe = "$RepoRoot\V3\target\release\zion-miner.exe"

foreach ($exe in @($NodeExe, $MinerExe)) {
    if (-not (Test-Path $exe)) {
        Write-Error "[ERROR] Binary not found: $exe`n        Run: cargo build --release --manifest-path V3/Cargo.toml --workspace"
        exit 1
    }
}

function Stop-ByPidFile($name) {
    $f = "$PidDir\$name.pid"
    if (Test-Path $f) {
        $old = Get-Content $f -ErrorAction SilentlyContinue
        if ($old) {
            $proc = Get-Process -Id $old -ErrorAction SilentlyContinue
            if ($proc) { $proc | Stop-Process -Force; Start-Sleep -Seconds 1 }
        }
    }
}

# ── Backup Node (syncs from Edge primary) ──
Stop-ByPidFile "node1"
[Environment]::SetEnvironmentVariable('ZION_NODE_ID', 'local-backup-node', 'Process')
[Environment]::SetEnvironmentVariable('ZION_P2P_BIND', '0.0.0.0:8333', 'Process')
[Environment]::SetEnvironmentVariable('ZION_RPC_BIND', '0.0.0.0:8443', 'Process')
[Environment]::SetEnvironmentVariable('ZION_NODE_STATE_PATH', "$DataDir\zion-node-state.db", 'Process')
# Connect to Edge primary via Tailscale VPN
[Environment]::SetEnvironmentVariable('ZION_SEED_PEERS', '62.171.141.136:8333', 'Process')
# Burn model: 89/5/5, no pool fee wallet
[Environment]::SetEnvironmentVariable('ZION_MINER_ADDRESS', 'zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604', 'Process')
[Environment]::SetEnvironmentVariable('ZION_HUMANITARIAN_WALLET', 'zion1c245e7f5d8h427r4p4s2s607d7v4c255z7x96t3', 'Process')
[Environment]::SetEnvironmentVariable('ZION_ISSOBELLA_WALLET', 'zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702', 'Process')

$p = Start-Process -FilePath $NodeExe -WorkingDirectory $RepoRoot -RedirectStandardOutput "$LogDir\node1.log" -RedirectStandardError "$LogDir\node1.err" -WindowStyle Hidden -PassThru
$p.Id | Out-File "$PidDir\node1.pid" -Encoding utf8
$P1 = $p.Id
Write-Host "Started Backup Node  PID=$P1 (seeding from 62.171.141.136:8333)"
Start-Sleep -Seconds 3

# ── Miner: GPU (OpenCL) ──
Stop-ByPidFile "miner"
# Connects to Edge pool via Tailscale VPN
[Environment]::SetEnvironmentVariable('ZION_POOL_ADDR', '62.171.141.136:8444', 'Process')
[Environment]::SetEnvironmentVariable('ZION_LOOP_COUNT', '1000000', 'Process')
[Environment]::SetEnvironmentVariable('ZION_MINER_THREADS', '2', 'Process')
[Environment]::SetEnvironmentVariable('ZION_WORKER_NAME', 'gpu-worker-local', 'Process')
[Environment]::SetEnvironmentVariable('ZION_MINER_ID', 'gpu-miner-local-01', 'Process')
[Environment]::SetEnvironmentVariable('ZION_GPU_BACKEND', 'opencl', 'Process')
[Environment]::SetEnvironmentVariable('ZION_GPU_WORK_SIZE', '4096', 'Process')

$p = Start-Process -FilePath $MinerExe -WorkingDirectory $RepoRoot -RedirectStandardOutput "$LogDir\miner.log" -RedirectStandardError "$LogDir\miner.err" -WindowStyle Hidden -PassThru
$p.Id | Out-File "$PidDir\miner.pid" -Encoding utf8
$PM = $p.Id
Write-Host "Started Miner GPU (OpenCL)  PID=$PM -> Edge pool 62.171.141.136:8444"

Write-Host ""
Write-Host "[launch] All processes started. PIDs: backup-node=$P1 gpu-miner=$PM"
Write-Host "[launch] Logs: $LogDir"
Write-Host "[launch] To watch live:   Get-Content $LogDir\node1.log -Tail 20 -Wait"
Write-Host "[launch] To stop:         .\scripts\stop-stack.ps1"
Write-Host ""
Write-Host "[topology] Edge (62.171.141.136) = primary node + pool"
Write-Host "[topology] Local PC       = backup node + miners"
