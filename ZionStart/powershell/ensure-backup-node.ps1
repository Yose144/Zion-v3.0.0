# ZION Local Backup Node - Auto-restart & Backup Script
# Tento skript zajistuje, že local backup node:
# 1. Běží nepřetržitě (auto-restart při pádu)
# 2. Provádí pravidelné backupy databáze

$ErrorActionPreference = "Stop"
$REPO_ROOT = "C:\Users\yosef\Desktop\Zion\2.9.6-main"
$DATA_DIR = "$REPO_ROOT\V3\data"
$BACKUP_DIR = "$REPO_ROOT\V3\backups"
$LOG_FILE = "$REPO_ROOT\logs\backup-node-watchdog.log"

# Vytvořit adresáře
if (-not (Test-Path "$REPO_ROOT\logs")) { New-Item -ItemType Directory -Path "$REPO_ROOT\logs" -Force | Out-Null }
if (-not (Test-Path $BACKUP_DIR)) { New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null }

function Log-Message {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -FilePath $LOG_FILE -Append
    Write-Host "$timestamp - $Message"
}

function Start-BackupNode {
    Log-Message "Starting local backup node..."
    
    # Zabít pouze Zion node procesy (node.exe z V3/target/release/)
    Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
        $processPath = $_.Path
        if ($processPath -and $processPath -like "*V3\target\release\node.exe*") {
            try {
                Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
                Log-Message "Killed Zion node process $($_.Id)"
            } catch {}
        }
    }
    
    Start-Sleep -Seconds 2  # Počkat na uvolnění portů
    
    $env:ZION_NODE_ID = "local-backup-node"
    $env:ZION_P2P_BIND = "0.0.0.0:8333"
    $env:ZION_RPC_BIND = "0.0.0.0:8443"
    $env:ZION_WEBSOCKET_BIND = "0.0.0.0:8445"
    $env:ZION_NODE_STATE_PATH = "V3\data\zion-node-state.db"
    $env:ZION_SEED_PEERS = "100.76.16.108:8333"
    $env:ZION_MINER_ADDRESS = "zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604"
    $env:ZION_HUMANITARIAN_WALLET = "zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4"
    $env:ZION_ISSOBELLA_WALLET = "zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702"
    
    $process = Start-Process -FilePath "$REPO_ROOT\V3\target\release\node.exe" -WorkingDirectory $REPO_ROOT -PassThru -NoNewWindow
    Log-Message "Backup node started with PID: $($process.Id)"
    return $process
}

function Backup-Database {
    Log-Message "Starting database backup..."
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = "$BACKUP_DIR\zion-node-state_$timestamp.db"
    
    try {
        if (Test-Path "$DATA_DIR\zion-node-state.db") {
            Copy-Item "$DATA_DIR\zion-node-state.db" $backupFile -Force
            $fileSize = (Get-Item $backupFile).Length / 1KB
            Log-Message "Backup created: $backupFile ($([math]::Round($fileSize, 2)) KB)"
            
            # Udržet jen posledních 7 backupů
            $backups = Get-ChildItem $BACKUP_DIR -Filter "zion-node-state_*.db" | Sort-Object LastWriteTime -Descending
            if ($backups.Count -gt 7) {
                $backups | Select-Object -Skip 7 | Remove-Item -Force
                Log-Message "Cleaned up old backups, keeping last 7"
            }
        } else {
            Log-Message "WARNING: Database file not found, skipping backup"
        }
    } catch {
        Log-Message "ERROR: Backup failed - $_"
    }
}

function Test-NodeHealth {
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:8443/jsonrpc" -Method POST -ContentType "application/json" -Body '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":{}}' -TimeoutSec 5
        if ($response.result.chain_height -gt 0) {
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

# Hlavní smyčka
Log-Message "=== ZION Backup Node Watchdog Started ==="
$nodeProcess = $null
$lastBackup = Get-Date
$backupInterval = New-TimeSpan -Minutes 15

while ($true) {
    try {
        # Zkontrolovat, zda node běží
        if ($null -eq $nodeProcess -or $nodeProcess.HasExited) {
            Log-Message "ALERT: Backup node not running, starting..."
            $nodeProcess = Start-BackupNode
            Start-Sleep -Seconds 10  # Počkat na inicializaci
        }
        
        # Zkontrolovat zdraví node
        if (-not (Test-NodeHealth)) {
            Log-Message "WARNING: Node health check failed, restarting..."
            if ($null -ne $nodeProcess -and -not $nodeProcess.HasExited) {
                $nodeProcess.Kill()
            }
            $nodeProcess = Start-BackupNode
            Start-Sleep -Seconds 10
        }
        
        # Pravidelný backup (každých 15 minut)
        if ((Get-Date) - $lastBackup -gt $backupInterval) {
            Backup-Database
            $lastBackup = Get-Date
        }
        
    } catch {
        Log-Message "ERROR: Watchdog loop error - $_"
    }
    
    # Krátká pauza mezi kontrolami
    Start-Sleep -Seconds 30
}