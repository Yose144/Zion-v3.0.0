# ZION Local Core — Automated Database & State Backup (Windows)
# ============================================================================
# Backs up local node state, pool data, dashboard DBs, and config.
# Creates health.json for dashboard monitoring.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\local-core-backup.ps1
#
# Defaults:
#   - Backup destination: D:\Zion  (override with $env:ZION_BACKUP_DIR or -BackupRoot)
#   - Node data:          D:\Zion\V3\data  (override with $env:ZION_DATA_DIR or -DataDir)
#   - Config source:      parent of scripts/
# ============================================================================

param(
    [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$DataDir = $env:ZION_DATA_DIR,
    [string]$BackupRoot = $env:ZION_BACKUP_DIR
)

$BackupRoot = if (-not $BackupRoot) { "D:\Zion" } else { $BackupRoot }
$DataDir    = if (-not $DataDir) { Join-Path $BackupRoot "V3\data" } else { $DataDir }

$timestamp  = Get-Date -Format "yyyyMMdd-HHmmss"
$WorkDir    = Join-Path $BackupRoot "zion-local-$timestamp"
$logFile    = Join-Path $BackupRoot "backup.log"
$healthFile = Join-Path $BackupRoot "health.json"

function Log-Message($msg, $level="INFO") {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [$level] $msg"
    Write-Host $line
    Add-Content -Path $logFile -Value $line -ErrorAction SilentlyContinue
}

# Ensure directories exist
New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

Log-Message "=== ZION Local Core Backup Started ===" "INFO"
Log-Message "Repo : $RepoRoot" "INFO"
Log-Message "Data : $DataDir" "INFO"
Log-Message "Dest : $WorkDir" "INFO"

$itemsBackedUp = 0
$totalSizeMB   = 0
$status = "ok"

# ── 1. V3/data (node state, dashboard metrics, peers) ──────────────────────
if (Test-Path $DataDir) {
    $dataDest = Join-Path $WorkDir "V3-data"
    Copy-Item -Recurse -Force $DataDir $dataDest
    $sz = [math]::Round((Get-ChildItem $DataDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
    Log-Message "Backed up V3\data ($sz MB)" "OK"
    $itemsBackedUp++
    $totalSizeMB += $sz
} else {
    Log-Message "V3\data not found at $DataDir" "WARN"
}

# ── 2. Root data dir (if exists) ────────────────────────────────────────────
$rootData = Join-Path $RepoRoot "data"
if (Test-Path $rootData) {
    $rootDataDest = Join-Path $WorkDir "data"
    Copy-Item -Recurse -Force $rootData $rootDataDest
    $sz = [math]::Round((Get-ChildItem $rootData -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
    Log-Message "Backed up data\ ($sz MB)" "OK"
    $itemsBackedUp++
    $totalSizeMB += $sz
}

# ── 3. Find ALL .db files (exclude build/cache dirs) ───────────────────────
$excludePatterns = @('target*', 'node_modules', '__pycache__', '.git', 'backups', '*.tmp', 'ue5')
$searchRoots = @($RepoRoot)
if ($DataDir -and (Test-Path $DataDir)) {
    $searchRoots += $DataDir
}

$dbFiles = Get-ChildItem -Path $searchRoots -Recurse -Filter '*.db' -File -ErrorAction SilentlyContinue | Where-Object {
    $f = $_
    $skip = $false
    foreach ($pat in $excludePatterns) {
        if ($f.FullName -like "*$pat*") { $skip = $true; break }
    }
    -not $skip
}

if ($dbFiles) {
    $dbDest = Join-Path $WorkDir "databases"
    New-Item -ItemType Directory -Path $dbDest -Force | Out-Null
    foreach ($db in $dbFiles) {
        # Compute a safe relative path; prefix data-dir DBs with V3-data/
        $relative = $null
        if ($db.FullName.StartsWith($RepoRoot, [System.StringComparison]::InvariantCultureIgnoreCase)) {
            $relative = $db.FullName.Substring($RepoRoot.Length).TrimStart('\', '/')
        } elseif ($db.FullName.StartsWith($DataDir, [System.StringComparison]::InvariantCultureIgnoreCase)) {
            $relative = "V3-data" + $db.FullName.Substring($DataDir.Length).TrimStart('\', '/')
        } else {
            $relative = $db.Name
        }
        $destPath = Join-Path $dbDest $relative
        $destParent = Split-Path $destPath -Parent
        New-Item -ItemType Directory -Path $destParent -Force | Out-Null
        Copy-Item -Path $db.FullName -Destination $destPath -Force
        $sz = [math]::Round($db.Length / 1MB, 2)
        Log-Message "  DB: $relative ($sz MB)" "OK"
        $itemsBackedUp++
        $totalSizeMB += $sz
    }
    Log-Message "Backed up $($dbFiles.Count) database files" "OK"
} else {
    Log-Message "No .db files found" "WARN"
}

# ── 4. .env files ────────────────────────────────────────────────────────────
$envFiles = Get-ChildItem -Path $RepoRoot -Filter '.env*' -File -ErrorAction SilentlyContinue
if ($envFiles) {
    $envDest = Join-Path $WorkDir "env"
    New-Item -ItemType Directory -Path $envDest -Force | Out-Null
    foreach ($f in $envFiles) {
        Copy-Item -Path $f.FullName -Destination $envDest -Force
        Log-Message "Backed up $($f.Name)" "OK"
        $itemsBackedUp++
    }
} else {
    Log-Message "No .env files found" "WARN"
}

# ── 5. Key config / toml files ───────────────────────────────────────────────
$configPatterns = @(
    'AGENTS.md',
    'StatusV3.md',
    'V3\L2\bridge\config\*.toml',
    'V3\L2\dao\config\*.toml',
    'V3\L3\warp\config\*.toml',
    'V3\docker\docker-compose*.yml',
    'ZION_OS\dashboard\app.py'
)
$configDest = Join-Path $WorkDir "configs"
New-Item -ItemType Directory -Path $configDest -Force | Out-Null
foreach ($pat in $configPatterns) {
    $matches = Get-ChildItem -Path (Join-Path $RepoRoot $pat) -File -ErrorAction SilentlyContinue
    foreach ($m in $matches) {
        $rel = $m.FullName.Substring($RepoRoot.Length + 1)
        Copy-Item -Path $m.FullName -Destination (Join-Path $configDest ($rel -replace '\\','_')) -Force
        Log-Message "Backed up config: $rel" "OK"
        $itemsBackedUp++
    }
}

# ── 6. Git reference ───────────────────────────────────────────────────────
$gitInfo = Join-Path $WorkDir "git-info.txt"
try {
    $gitBranch = git -C $RepoRoot rev-parse --abbrev-ref HEAD 2>$null
    $gitCommit = git -C $RepoRoot rev-parse --short HEAD 2>$null
    $gitDate = git -C $RepoRoot log -1 --format="%ci" 2>$null
    @"
Branch: $gitBranch
Commit: $gitCommit
Date:   $gitDate
Backup: $timestamp
"@ | Out-File -FilePath $gitInfo -Encoding utf8
    Log-Message "Recorded git state: $gitBranch@$gitCommit" "OK"
    $itemsBackedUp++
} catch {
    Log-Message "Git info failed: $_" "WARN"
}

# ── 7. Compress ────────────────────────────────────────────────────────────
$zipFile = "$WorkDir.zip"
try {
    Compress-Archive -Path "$WorkDir\*" -DestinationPath $zipFile -Force
    $zipSize = [math]::Round((Get-Item $zipFile).Length / 1MB, 2)
    Log-Message "Compressed to: $zipFile ($zipSize MB)" "OK"
} catch {
    Log-Message "Compression failed: $_" "ERROR"
    $status = "error"
    exit 1
}

# ── 8. Rotation (keep last 30 daily + last 4 weekly) ─────────────────────
$allZips = Get-ChildItem -Path $BackupRoot -Filter "zion-local-*.zip" -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
$dailyKeep = 30
$weeklyKeep = 4

$sundays = @($allZips | Where-Object { $_.LastWriteTime.DayOfWeek -eq 'Sunday' } | Select-Object -First $weeklyKeep)
$daily = @($allZips | Select-Object -First $dailyKeep)
$protected = @($sundays + $daily | Sort-Object FullName -Unique)
$protectedNames = $protected | ForEach-Object { $_.FullName }
$toDelete = $allZips | Where-Object { $protectedNames -notcontains $_.FullName }

if ($toDelete) {
    foreach ($old in $toDelete) {
        Remove-Item -Path $old.FullName -Force
        Log-Message "Rotated old backup: $($old.Name)" "INFO"
    }
}

# Remove uncompressed
Remove-Item -Recurse -Force $WorkDir

# ── 9. Health status file for dashboard ────────────────────────────────────
$zipSizeBytes = (Get-Item $zipFile).Length
$disk = Get-PSDrive D | Select-Object Used, Free
$diskTotal = $disk.Used + $disk.Free
$diskPct = [math]::Round(($disk.Used / $diskTotal) * 100, 1)

$oldCulture = [System.Threading.Thread]::CurrentThread.CurrentCulture
[System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::InvariantCulture
$health = @{
    last_backup_timestamp = $timestamp
    last_backup_file = (Split-Path $zipFile -Leaf)
    last_backup_size_bytes = $zipSizeBytes
    files_backed = $itemsBackedUp
    total_size_mb = [math]::Round($totalSizeMB, 2)
    disk_usage_percent = $diskPct
    status = $status
    retention_days = 30
    host = $env:COMPUTERNAME
} | ConvertTo-Json -Depth 3
[System.Threading.Thread]::CurrentThread.CurrentCulture = $oldCulture

$health | Out-File -FilePath $healthFile -Encoding utf8 -NoNewline -Force
Log-Message "Health status written to $healthFile" "OK"

Log-Message "=== ZION Local Core Backup Complete ===" "OK"
Log-Message "Items: $itemsBackedUp | Total: $([math]::Round($totalSizeMB,2)) MB | Zip: $zipSize MB | Disk: $diskPct%" "OK"
Log-Message " " "INFO"
