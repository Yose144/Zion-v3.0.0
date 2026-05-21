# ZION V3 — Chain State Backup
# Creates a timestamped ZIP of V3/data/ (chain state + LMDB + pool DBs)
# Also optionally backs up env files and logs.

param(
    [string]$Name = "",
    [switch]$IncludeLogs,
    [switch]$IncludeEnv
)

$RepoRoot = "C:\Users\yosef\Desktop\Zion\2.9.6-main"
$DataDir  = "$RepoRoot\V3\data"
$BackupDir = "$RepoRoot\backups"
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"

if (-not (Test-Path $DataDir)) {
    Write-Error "[backup] Data directory not found: $DataDir"
    exit 1
}

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

$BackupName = if ($Name) { "backup_$Name`_$Timestamp" } else { "backup_$Timestamp" }
$ZipPath = "$BackupDir\$BackupName.zip"

Write-Host "[backup] Creating $ZipPath ..." -ForegroundColor Cyan

# Build list of items to backup
$Items = @($DataDir)
if ($IncludeLogs) {
    $Items += "$RepoRoot\logs"
}
if ($IncludeEnv) {
    $envFiles = Get-ChildItem "$RepoRoot\.env*" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
    if ($envFiles) { $Items += $envFiles }
}

# Compress
Compress-Archive -Path $Items -DestinationPath $ZipPath -Force

$Size = (Get-Item $ZipPath).Length
Write-Host "[backup] Done. Size: $([math]::Round($Size/1MB,2)) MB" -ForegroundColor Green
Write-Host "[backup] Path: $ZipPath" -ForegroundColor White

# Keep only last 20 backups (auto-cleanup)
$Old = Get-ChildItem "$BackupDir\backup_*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 20
if ($Old) {
    Write-Host "[backup] Cleaning up $($Old.Count) old backup(s)..." -ForegroundColor Gray
    $Old | Remove-Item -Force
}

exit 0
