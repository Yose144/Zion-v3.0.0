# ZION V3 — Chain State Restore
# Restores V3/data/ from a backup ZIP. WARNING: stops all services first.

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupName
)

$RepoRoot = "C:\Users\yosef\Desktop\Zion\2.9.6-main"
$BackupDir = "$RepoRoot\backups"
$DataDir  = "$RepoRoot\V3\data"

$ZipPath = "$BackupDir\$BackupName"
if (-not (Test-Path $ZipPath)) {
    # Try with .zip extension
    $ZipPath = "$BackupDir\$BackupName.zip"
}
if (-not (Test-Path $ZipPath)) {
    Write-Error "[restore] Backup not found: $ZipPath"
    exit 1
}

Write-Host "[restore] WARNING: This will replace current chain state." -ForegroundColor Red
Write-Host "[restore] Stopping all ZION processes first..." -ForegroundColor Yellow

$names = @("node", "server", "zion-miner")
foreach ($n in $names) {
    Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq $n } | ForEach-Object {
        Write-Host "  Stopping $($_.ProcessName) PID=$($_.Id)" -ForegroundColor Gray
        $_.Kill()
    }
}
Start-Sleep -Seconds 2

# Backup current state just in case (emergency rollback)
$EmergencyName = "emergency_$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')"
$EmergencyZip = "$BackupDir\$EmergencyName.zip"
if (Test-Path $DataDir) {
    Write-Host "[restore] Creating emergency backup of current state: $EmergencyName.zip" -ForegroundColor Yellow
    Compress-Archive -Path $DataDir -DestinationPath $EmergencyZip -Force
    Write-Host "[restore] Emergency backup size: $([math]::Round((Get-Item $EmergencyZip).Length/1MB,2)) MB" -ForegroundColor Gray
}

# Remove current data and restore
Write-Host "[restore] Removing current data..." -ForegroundColor Yellow
if (Test-Path $DataDir) {
    Remove-Item -Recurse -Force $DataDir
}
New-Item -ItemType Directory -Path $DataDir -Force | Out-Null

Write-Host "[restore] Extracting $ZipPath ..." -ForegroundColor Cyan
Expand-Archive -Path $ZipPath -DestinationPath $RepoRoot -Force

Write-Host "[restore] Done. Chain state restored from $BackupName" -ForegroundColor Green
Write-Host "[restore] You can now restart the stack from the dashboard." -ForegroundColor White
exit 0
