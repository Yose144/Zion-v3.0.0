# ZION V3 — Local Node Backup (Windows)
# Backs up V3\data\ (SQLite DBs, JSON state, revenue_journal) and optionally logs/env files.
# Keeps the last 20 backups.
# Recommended schedule: every 4 hours via Task Scheduler.
param(
    [string]$Name = "",
    [switch]$IncludeLogs,
    [switch]$IncludeEnv
)

$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$DataDir  = "$RepoRoot\V3\data"
$BackupDir = "$RepoRoot\backups\node"
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"

if (-not (Test-Path $DataDir)) {
    Write-Error "[backup-node] Data directory not found: $DataDir"
    exit 1
}

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

$BackupName = if ($Name) { "backup_node_${Name}_$Timestamp" } else { "backup_node_$Timestamp" }
$ZipPath = "$BackupDir\$BackupName.zip"

$Items = @($DataDir)
if ($IncludeLogs) {
    $Items += "$RepoRoot\logs"
}
if ($IncludeEnv) {
    $envFiles = Get-ChildItem "$RepoRoot\.env*" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
    if ($envFiles) { $Items += $envFiles }
}

Write-Host "[backup-node] Creating $ZipPath ..." -ForegroundColor Cyan
Compress-Archive -Path $Items -DestinationPath $ZipPath -Force

$Size = (Get-Item $ZipPath).Length
Write-Host "[backup-node] Done. Size: $([math]::Round($Size/1MB,2)) MB" -ForegroundColor Green

# Keep only last 20 backups
$Old = Get-ChildItem "$BackupDir\backup_node_*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 20
if ($Old) {
    Write-Host "[backup-node] Cleaning up $($Old.Count) old backup(s)..." -ForegroundColor Gray
    $Old | Remove-Item -Force
}

exit 0
