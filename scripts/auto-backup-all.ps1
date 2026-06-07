# ZION — Automated Full-Stack Database & Config Backup (Windows)
# ============================================================================
# Backs up ALL SQLite/LMDB databases across the entire repo, plus:
#   - .env files
#   - node state / chain data (V3/data/)
#   - Service config files (bridge, dao, warp, oasis, free-world, issobella)
#   - SSH public keys (never private keys)
#   - Git branch+commit reference
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\auto-backup-all.ps1
#
# Override backup path:
#   $env:ZION_BACKUP_DIR = "D:\ZION-AutoBackups"
#
# Cron / Task Scheduler:
#   Daily at 03:00 — runs silently, logs to backup_dir\backup.log
# ============================================================================

param(
    [string]$RepoRoot = "C:\Users\yosef\Desktop\Zion\2.9.6-main",
    [string]$BackupDir = $env:ZION_BACKUP_DIR
)

if (-not $BackupDir) { $BackupDir = "C:\ZION-AutoBackups" }

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dateOnly  = Get-Date -Format "yyyy-MM-dd"
$backupDir = Join-Path $BackupDir "zion-auto-$timestamp"
$logFile   = Join-Path $BackupDir "backup.log"

function Log-Message($msg, $level="INFO") {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [$level] $msg"
    Write-Host $line
    Add-Content -Path $logFile -Value $line -ErrorAction SilentlyContinue
}

# Ensure backup directory exists
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

Log-Message "=== ZION Auto-Backup Started ===" "INFO"
Log-Message "Repo : $RepoRoot" "INFO"
Log-Message "Dest : $backupDir" "INFO"

$itemsBackedUp = 0
$totalSizeMB   = 0

# ── 1. Find ALL .db files (exclude build/cache dirs) ─────────────────────────
$excludePatterns = @('target*', 'node_modules', '__pycache__', '.git', 'backups', '*.tmp', 'ue5')
$dbFiles = Get-ChildItem -Path $RepoRoot -Recurse -Filter '*.db' -File -ErrorAction SilentlyContinue | Where-Object {
    $f = $_
    $skip = $false
    foreach ($pat in $excludePatterns) {
        if ($f.FullName -like "*$pat*") { $skip = $true; break }
    }
    -not $skip
}

if ($dbFiles) {
    $dbDest = Join-Path $backupDir "databases"
    New-Item -ItemType Directory -Path $dbDest -Force | Out-Null
    foreach ($db in $dbFiles) {
        $relative = $db.FullName.Substring($RepoRoot.Length + 1)
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

# ── 2. V3/data directory (node state, pool state, etc.) ──────────────────────
$dataSource = Join-Path $RepoRoot "V3\data"
if (Test-Path $dataSource) {
    $dataDest = Join-Path $backupDir "V3-data"
    Copy-Item -Recurse -Force $dataSource $dataDest
    $sz = [math]::Round((Get-ChildItem $dataSource -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
    Log-Message "Backed up V3\data ($sz MB)" "OK"
    $itemsBackedUp++
    $totalSizeMB += $sz
} else {
    Log-Message "V3\data not found" "WARN"
}

# ── 3. .env files ───────────────────────────────────────────────────────────
$envFiles = Get-ChildItem -Path $RepoRoot -Filter '.env*' -File -ErrorAction SilentlyContinue
if ($envFiles) {
    $envDest = Join-Path $backupDir "env"
    New-Item -ItemType Directory -Path $envDest -Force | Out-Null
    foreach ($f in $envFiles) {
        Copy-Item -Path $f.FullName -Destination $envDest -Force
        Log-Message "Backed up $($f.Name)" "OK"
        $itemsBackedUp++
    }
} else {
    Log-Message "No .env files found" "WARN"
}

# ── 4. Key config / toml files ────────────────────────────────────────────────
$configPatterns = @(
    'Servers.md',
    'AGENTS.md',
    'StatusV3.md',
    'STATUS_REPORT_*.md',
    'V3\L2\bridge\config\*.toml',
    'V3\L2\dao\config\*.toml',
    'V3\L3\warp\config\*.toml',
    'V3\docker\docker-compose*.yml',
    'ZION_OS\dashboard\app.py'
)
$configDest = Join-Path $backupDir "configs"
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

# ── 5. SSH public keys ────────────────────────────────────────────────────────
$sshDir = Join-Path $RepoRoot '.ssh'
if (Test-Path $sshDir) {
    $pubKeys = Get-ChildItem -Path $sshDir -Filter '*.pub' -File -ErrorAction SilentlyContinue
    if ($pubKeys) {
        $sshDest = Join-Path $backupDir 'ssh-pub'
        New-Item -ItemType Directory -Path $sshDest -Force | Out-Null
        foreach ($k in $pubKeys) {
            Copy-Item -Path $k.FullName -Destination $sshDest -Force
            Log-Message "Backed up SSH pub: $($k.Name)" "OK"
            $itemsBackedUp++
        }
    }
}

# ── 6. Git reference ─────────────────────────────────────────────────────────
$gitInfo = Join-Path $backupDir "git-info.txt"
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

# ── 7. Compress ───────────────────────────────────────────────────────────────
$zipFile = "$backupDir.zip"
try {
    Compress-Archive -Path "$backupDir\*" -DestinationPath $zipFile -Force
    $zipSize = [math]::Round((Get-Item $zipFile).Length / 1MB, 2)
    Log-Message "Compressed to: $zipFile ($zipSize MB)" "OK"
} catch {
    Log-Message "Compression failed: $_" "ERROR"
    exit 1
}

# Remove uncompressed
Remove-Item -Recurse -Force $backupDir

# ── 8. Rotation (keep last 30 daily + last 4 weekly) ──────────────────────────
$allZips = Get-ChildItem -Path $BackupDir -Filter "zion-auto-*.zip" -File | Sort-Object LastWriteTime -Descending
$dailyKeep = 30
$weeklyKeep = 4

# Mark weekly (Sunday backups) — never delete them until we have >4
$sundays = $allZips | Where-Object { $_.LastWriteTime.DayOfWeek -eq 'Sunday' } | Select-Object -First $weeklyKeep
$daily = $allZips | Select-Object -First $dailyKeep
$protected = ($sundays + $daily | Sort-Object FullName -Unique)
$toDelete = $allZips | Where-Object { $protected -notcontains $_ }

if ($toDelete) {
    foreach ($old in $toDelete) {
        Remove-Item -Path $old.FullName -Force
        Log-Message "Rotated old backup: $($old.Name)" "INFO"
    }
}

Log-Message "=== ZION Auto-Backup Complete ===" "OK"
Log-Message "Items: $itemsBackedUp | Total DB+Data: $([math]::Round($totalSizeMB,2)) MB | Zip: $zipSize MB" "OK"
Log-Message " " "INFO"
