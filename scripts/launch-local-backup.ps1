# ZION V3 — Local Backup Node (Edge-Primary Topology)
#
# This script launches a local Windows backup node that syncs from the Edge primary.
# Data, logs, and PID files are placed under D:\Zion by default (override with
# $env:ZION_BACKUP_DIR). The script uses the repo tree only for binaries.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\launch-local-backup.ps1

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$BackupRoot = if ($env:ZION_BACKUP_DIR) { $env:ZION_BACKUP_DIR } else { "D:\Zion" }
$LogDir   = Join-Path $BackupRoot "logs"
$DataDir  = Join-Path $BackupRoot "V3\data"
$PidDir   = Join-Path $BackupRoot ".pids"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
New-Item -ItemType Directory -Path $PidDir -Force | Out-Null

$NodeExe  = Join-Path $RepoRoot "V3\target\release\node.exe"

if (-not (Test-Path $NodeExe)) {
    Write-Error "[ERROR] Node binary not found: $NodeExe`n        Run: cargo build --release --manifest-path V3/Cargo.toml -p zion-core --bin node"
    exit 1
}

function Stop-ByPidFile($name) {
    $f = Join-Path $PidDir "$name.pid"
    if (Test-Path $f) {
        $old = Get-Content $f -ErrorAction SilentlyContinue
        if ($old) {
            $proc = Get-Process -Id $old -ErrorAction SilentlyContinue
            if ($proc) { $proc | Stop-Process -Force; Start-Sleep -Seconds 1 }
        }
        Remove-Item $f -ErrorAction SilentlyContinue
    }
}

function Stop-ByBinaryPath($binaryPath) {
    # Fallback: kill any running process that matches this exact binary path
    # (useful when PID files are missing after a crash or manual start).
    Get-Process | Where-Object {
        try { $_.Path -and ($_.Path -eq (Resolve-Path $binaryPath).Path) } catch { $false }
    } | ForEach-Object {
        Write-Host "Stopping existing process PID=$($_.Id) for $binaryPath"
        $_ | Stop-Process -Force; Start-Sleep -Seconds 1
    }
}

# ── Backup Node (syncs from Edge primary and its follower) ──
Stop-ByPidFile "node1"
Stop-ByBinaryPath $NodeExe

[Environment]::SetEnvironmentVariable('ZION_NODE_ID', 'local-backup-node', 'Process')
[Environment]::SetEnvironmentVariable('ZION_NETWORK', 'Mainnet', 'Process')
[Environment]::SetEnvironmentVariable('ZION_P2P_BIND', '0.0.0.0:8333', 'Process')
[Environment]::SetEnvironmentVariable('ZION_RPC_BIND', '127.0.0.1:8446', 'Process')
[Environment]::SetEnvironmentVariable('ZION_WEBSOCKET_BIND', '127.0.0.1:8447', 'Process')
[Environment]::SetEnvironmentVariable('ZION_NODE_STATE_PATH', "$DataDir\zion-node-state.db", 'Process')
[Environment]::SetEnvironmentVariable('ZION_SEED_PEERS', '62.171.141.136:8333,62.171.141.136:8334', 'Process')

# Full-history backup node — no pruning
[Environment]::SetEnvironmentVariable('ZION_BLOCK_RETENTION', '0', 'Process')

# Consensus gate heights (same as Edge post-2026-07-06 hard reset)
[Environment]::SetEnvironmentVariable('ZION_MIGRATION_HEIGHT', '1', 'Process')
[Environment]::SetEnvironmentVariable('ZION_BALANCE_CHECK_HEIGHT', '0', 'Process')
[Environment]::SetEnvironmentVariable('ZION_MAX_TX_AMOUNT_HEIGHT', '1', 'Process')
[Environment]::SetEnvironmentVariable('ZION_ACCOUNT_TX_MEMO_V1_HEIGHT', '0', 'Process')

# Canonical fee split addresses (mirror edge-deploy/config/edge-environment.sh)
[Environment]::SetEnvironmentVariable('ZION_MINER_ADDRESS', 'zion1u4a82230m0a267r785m822u5a3g7n753d7eu5n0', 'Process')
[Environment]::SetEnvironmentVariable('ZION_HUMANITARIAN_WALLET', 'zion136m4u7f8s5w3l0e00342s7a4r282275442vm2w3', 'Process')
[Environment]::SetEnvironmentVariable('ZION_ISSOBELLA_WALLET', 'zion173g835z228z6u303z59603y236r5e854l36g604', 'Process')

# Bridge validator allowlist (same as Edge) — required for bridge-unlock validation
[Environment]::SetEnvironmentVariable('ZION_BRIDGE_VALIDATOR_PUBKEYS', '0x02d6406dab8cc71d88f55abca3fe8bae91c26a60162ad3dd1ee55a6aa9cfc96368,0x03e45622f0bad22e34bd1f331219f8d39ed20c4720ce70363b65560df408fc2081,0x025e4b708a7c6dacd484c4fb2a93e80c18f0288aa9b736d4251c6eb8f09d045611,0x02eb3f020ac5a4a647061ffc38b69013a7969c21241e7153a3b196186efd3b185e,0x02a6b18aa50814ac9e9e1f70a69e49ee9a61407a48f83ad2ae914e7676f440ca97', 'Process')
[Environment]::SetEnvironmentVariable('ZION_BRIDGE_VALIDATOR_THRESHOLD', '5', 'Process')

$p = Start-Process -FilePath $NodeExe -WorkingDirectory $RepoRoot -RedirectStandardOutput "$LogDir\node1.log" -RedirectStandardError "$LogDir\node1.err" -WindowStyle Hidden -PassThru
$p.Id | Out-File "$PidDir\node1.pid" -Encoding utf8
$P1 = $p.Id
Write-Host "Started Backup Node  PID=$P1 (seeding from 62.171.141.136:8333,62.171.141.136:8334)"
Start-Sleep -Seconds 3

# ── Backup beacon loop (reports to dashboard every 15s) ──
Stop-ByPidFile "backup-beacon-loop"
$beacon = Join-Path $PSScriptRoot "backup-beacon-loop.ps1"
$bp = Start-Process -FilePath powershell.exe -ArgumentList "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$beacon`"" -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput "$LogDir\backup-beacon.log" -RedirectStandardError "$LogDir\backup-beacon.err" -PassThru
$bp.Id | Out-File "$PidDir\backup-beacon-loop.pid" -Encoding utf8
Write-Host "Started Backup Beacon  PID=$($bp.Id)"

Write-Host ""
Write-Host "[launch] Backup node started. PID=$P1"
Write-Host "[launch] Logs : $LogDir\node1.log"
Write-Host "[launch] Data  : $DataDir"
Write-Host "[launch] RPC   : http://127.0.0.1:8446"
Write-Host "[launch] To stop: .\scripts\stop-stack.ps1"
Write-Host ""
Write-Host "[topology] Edge (62.171.141.136) = primary node + pool"
Write-Host "[topology] Local PC = backup node"
