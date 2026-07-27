# ZION Core Backup Script (Windows)
# ================================
# Backs up V3/data, .env files, and node state to external storage.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\backup-core.ps1
#
# Defaults:
#   - Backup path: D:\Zion  (override with $env:ZION_BACKUP_PATH or -BackupPath)
#   - Source path: parent of scripts/  (override with -SourcePath)
#
# Set ZION_DATA_DIR env var to back up a non-default node data directory.

param(
    [string]$BackupPath = $env:ZION_BACKUP_PATH,
    [string]$SourcePath = (Split-Path -Parent $PSScriptRoot),
    [string]$DataPath = $env:ZION_DATA_DIR
)

if (-not $BackupPath) {
    $BackupPath = "D:\Zion"
}

if (-not $DataPath) {
    $DataPath = Join-Path $SourcePath "V3\data"
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $BackupPath "zion-backup-$timestamp"

Write-Host "=== ZION Core Backup ===" -ForegroundColor Cyan
Write-Host "Source : $SourcePath"
Write-Host "Data   : $DataPath"
Write-Host "Backup : $backupDir"
Write-Host ""

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

# Data directory
if (Test-Path $DataPath) {
    Write-Host "Backing up V3\data ..." -ForegroundColor Yellow
    Copy-Item -Recurse -Force $DataPath "$backupDir\data"
    Write-Host "  OK" -ForegroundColor Green
} else {
    Write-Host "  WARNING: V3\data not found at $DataPath" -ForegroundColor Yellow
}

# .env files
$envFiles = @(".env", ".env.w11-test", ".env.windows-native", ".env.zion-native")
foreach ($f in $envFiles) {
    $src = Join-Path $SourcePath $f
    if (Test-Path $src) {
        Write-Host "Backing up $f ..." -ForegroundColor Yellow
        Copy-Item -Force $src "$backupDir\$f"
        Write-Host "  OK" -ForegroundColor Green
    }
}

# SSH keys (public only)
$sshKeys = @("ssh-key-zion-edge.pub")
foreach ($k in $sshKeys) {
    $src = Join-Path $SourcePath $k
    if (Test-Path $src) {
        Write-Host "Backing up $k ..." -ForegroundColor Yellow
        Copy-Item -Force $src "$backupDir\$k"
        Write-Host "  OK" -ForegroundColor Green
    }
}

# Servers.md (infrastructure doc)
$serversMd = Join-Path $SourcePath "Servers.md"
if (Test-Path $serversMd) {
    Write-Host "Backing up Servers.md ..." -ForegroundColor Yellow
    Copy-Item -Force $serversMd "$backupDir\Servers.md"
    Write-Host "  OK" -ForegroundColor Green
}

# Git info for reference
Write-Host "Recording git state ..." -ForegroundColor Yellow
$gitInfo = Join-Path $backupDir "git-info.txt"
$gitBranch = git -C $SourcePath rev-parse --abbrev-ref HEAD 2>$null
$gitCommit = git -C $SourcePath rev-parse --short HEAD 2>$null
$gitDate = git -C $SourcePath log -1 --format="%ci" 2>$null
@"
Branch: $gitBranch
Commit: $gitCommit
Date:   $gitDate
Backup: $timestamp
"@ | Out-File -FilePath $gitInfo -Encoding utf8
Write-Host "  OK" -ForegroundColor Green

# Compress
$zipFile = "$backupDir.zip"
Write-Host "Compressing to zip ..." -ForegroundColor Yellow
Compress-Archive -Path "$backupDir\*" -DestinationPath $zipFile -Force
Write-Host "  OK: $zipFile" -ForegroundColor Green

# Clean up uncompressed
Remove-Item -Recurse -Force $backupDir

# Keep only last 10 backups
Write-Host "Rotating old backups ..." -ForegroundColor Yellow
Get-ChildItem -Path $BackupPath -Filter "zion-backup-*.zip" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 10 |
    Remove-Item -Force

Write-Host ""
Write-Host "=== Backup Complete ===" -ForegroundColor Green
Write-Host "File: $zipFile"
Write-Host "Size: $([math]::Round((Get-Item $zipFile).Length / 1MB, 2)) MB"
Write-Host ""
Write-Host "Schedule this script via Task Scheduler for automatic daily backups."
