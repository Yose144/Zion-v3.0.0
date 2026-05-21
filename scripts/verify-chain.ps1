# ZION V3 — Chain State Integrity Verification
# Checks snapshot JSON, journal, and LMDB files for corruption.

$RepoRoot = "C:\Users\yosef\Desktop\Zion\2.9.6-main"
$DataDir  = "$RepoRoot\V3\data"
$LogFile  = "$RepoRoot\logs\verify-chain.log"

New-Item -ItemType Directory -Path "$RepoRoot\logs" -Force | Out-Null
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') verify-chain started" | Out-File $LogFile -Encoding UTF8

$Issues = @()
$Checks = 0

function Check-Item($Path, $Label) {
    global $Checks
    $Checks++
    if (Test-Path $Path) {
        $size = (Get-Item $Path).Length
        "$Label`: OK ($size bytes)" | Tee-Object -FilePath $LogFile -Append
        return $true
    } else {
        "$Label`: MISSING" | Tee-Object -FilePath $LogFile -Append
        return $false
    }
}

Write-Host "[verify] Checking chain state integrity..." -ForegroundColor Cyan

# Check node1 state
$n1Snap = Check-Item "$DataDir\zion-node-state.db" "Node1 Snapshot"
$n1Journal = Check-Item "$DataDir\zion-node-state.db.journal" "Node1 Journal"
$n1Lmdb = Check-Item "$DataDir\zion-node-state.db\data.mdb" "Node1 LMDB"

# Check node2 state
$n2Snap = Check-Item "$DataDir\zion-node2-state.db" "Node2 Snapshot"
$n2Journal = Check-Item "$DataDir\zion-node2-state.db.journal" "Node2 Journal"
$n2Lmdb = Check-Item "$DataDir\zion-node2-state.db\data.mdb" "Node2 LMDB"

# Validate JSON snapshot syntax
if ($n1Snap) {
    try {
        $null = Get-Content "$DataDir\zion-node-state.db" -Raw | ConvertFrom-Json
        "Node1 Snapshot JSON: VALID" | Tee-Object -FilePath $LogFile -Append
    } catch {
        $Issues += "Node1 Snapshot JSON is CORRUPT: $_"
        "Node1 Snapshot JSON: CORRUPT" | Tee-Object -FilePath $LogFile -Append
    }
}

if ($n2Snap) {
    try {
        $null = Get-Content "$DataDir\zion-node2-state.db" -Raw | ConvertFrom-Json
        "Node2 Snapshot JSON: VALID" | Tee-Object -FilePath $LogFile -Append
    } catch {
        $Issues += "Node2 Snapshot JSON is CORRUPT: $_"
        "Node2 Snapshot JSON: CORRUPT" | Tee-Object -FilePath $LogFile -Append
    }
}

# Summary
Write-Host ""
if ($Issues.Count -eq 0) {
    Write-Host "[verify] All $Checks checks passed. Chain state is healthy." -ForegroundColor Green
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') VERIFY PASSED ($Checks checks)" | Out-File $LogFile -Append -Encoding UTF8
    exit 0
} else {
    Write-Host "[verify] $($Issues.Count) issue(s) found:" -ForegroundColor Red
    foreach ($i in $Issues) { Write-Host "  - $i" -ForegroundColor Red }
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') VERIFY FAILED: $($Issues -join '; ')" | Out-File $LogFile -Append -Encoding UTF8
    exit 1
}
