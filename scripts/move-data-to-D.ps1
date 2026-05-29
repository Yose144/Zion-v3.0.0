# ZION Data Migration — Move heavy directories from C: to D: and create Junctions
# Requires: PowerShell run as Administrator (for creating Junctions)
# What it does:
#   1. Creates D:\Zion-Data\ directory
#   2. Moves logs/, V3/data/, HiranV2.2/ to D:\Zion-Data\
#   3. Creates NTFS Junction points so old paths still work
#   4. No script changes needed — paths stay the same

$repoRoot = 'C:\Users\yosef\Desktop\Zion\2.9.6-main'
$targetBase = 'D:\Zion-Data'

function Move-WithJunction {
    param([string]$SourcePath, [string]$TargetPath)

    if (-not (Test-Path $SourcePath)) {
        Write-Host "[SKIP] Source not found: $SourcePath" -ForegroundColor Yellow
        return
    }

    if (Test-Path $TargetPath) {
        Write-Host "[SKIP] Target already exists: $TargetPath" -ForegroundColor Yellow
        return
    }

    $size = (Get-ChildItem $SourcePath -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    $sizeGB = [math]::Round($size / 1GB, 2)
    Write-Host "[MOVE] $SourcePath ($size GB) -> $TargetPath" -ForegroundColor Cyan

    # Create parent directory on D:
    New-Item -ItemType Directory -Path (Split-Path $TargetPath -Parent) -Force | Out-Null

    # Move the directory
    Move-Item -Path $SourcePath -Destination $TargetPath -Force
    Write-Host "  -> Moved OK" -ForegroundColor Green

    # Create Junction back at original location
    cmd /c mklink /J "$SourcePath" "$TargetPath" | Out-Null
    Write-Host "  -> Junction created: $SourcePath -> $TargetPath" -ForegroundColor Green
}

Write-Host "============================================"
Write-Host "ZION Data Migration to D:" -ForegroundColor Cyan
Write-Host "This will MOVE (not copy) heavy directories:" -ForegroundColor Yellow
Write-Host "  - logs/       (log files)"
Write-Host "  - V3/data/    (node state DBs)"
Write-Host "  - HiranV2.2/  (37+ GB AI models)"
Write-Host "Junctions will keep old paths functional."
Write-Host "============================================"

$freeD = (Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DeviceID -eq 'D:' }).FreeSpace
$freeDGB = [math]::Round($freeD / 1GB, 2)
Write-Host "D: free space: $freeDGB GB" -ForegroundColor Cyan

$confirm = Read-Host "Proceed? (type YES to continue)"
if ($confirm -ne 'YES') {
    Write-Host "Aborted." -ForegroundColor Red
    exit 1
}

# Ensure D: target base exists
New-Item -ItemType Directory -Path $targetBase -Force | Out-Null

# 1. logs/
Move-WithJunction -SourcePath "$repoRoot\logs" -TargetPath "$targetBase\logs"

# 2. V3/data/
Move-WithJunction -SourcePath "$repoRoot\V3\data" -TargetPath "$targetBase\V3-data"

# 3. HiranV2.2/
Move-WithJunction -SourcePath "$repoRoot\HiranV2.2" -TargetPath "$targetBase\HiranV2.2"

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "Migration complete. Junctions created:" -ForegroundColor Green
Get-Item "$repoRoot\logs", "$repoRoot\V3\data", "$repoRoot\HiranV2.2" -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Attributes -match 'ReparsePoint') {
        Write-Host "  $($_.FullName) -> Junction OK"
    }
}
Write-Host "============================================" -ForegroundColor Green
Write-Host "Disk space freed on C:" -ForegroundColor Green
