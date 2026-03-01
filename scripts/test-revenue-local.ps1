# ZION v2.9.6 — Revenue System Local Test Runner
# Usage: .\scripts\test-revenue-local.ps1 [--build] [--timeout <sec>] [--skip-miner]
#
# Krok 1: (volitelně) zbuilduje miner
# Krok 2: spustí revenue_local_test.py
# Krok 3: zobrazí výsledky

param(
    [switch]$Build,
    [int]$Timeout = 30,
    [switch]$SkipMiner
)

$Root = Split-Path $PSScriptRoot -Parent
$MinerExe = Join-Path $Root "target\release\zion-miner.exe"
$TestScript = Join-Path $Root "tests\revenue_local_test.py"

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ZION v2.9.6 — Revenue System Local Test Runner"    -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Build miner if requested or missing ──────────────
if ($Build -or -not (Test-Path $MinerExe)) {
    Write-Host "[BUILD] Building zion-miner (release)..." -ForegroundColor Yellow
    Push-Location $Root
    cargo build -p zion-miner --release
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Build failed!" -ForegroundColor Red
        exit 1
    }
    Pop-Location
    Write-Host "[BUILD] Done: $MinerExe" -ForegroundColor Green
} else {
    $size = (Get-Item $MinerExe).Length / 1MB
    Write-Host "[OK]   Miner binary found: $MinerExe ($([math]::Round($size,1)) MB)" -ForegroundColor Green
}

# ── Step 2: Check Python ──────────────────────────────────────
$python = $null
foreach ($cmd in @("python", "python3", ".venv\Scripts\python.exe")) {
    try {
        $ver = & $cmd --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $python = $cmd
            Write-Host "[OK]   Python: $ver ($cmd)" -ForegroundColor Green
            break
        }
    } catch {}
}

if (-not $python) {
    Write-Host "[ERROR] Python not found. Install Python 3.8+." -ForegroundColor Red
    exit 1
}

# ── Step 3: Run local test ────────────────────────────────────
Write-Host ""
Write-Host "[RUN]  Starting revenue_local_test.py (miner timeout=${Timeout}s)..." -ForegroundColor Cyan
Write-Host ""

$pyArgs = @($TestScript, "--timeout", $Timeout, "--miner-exe", $MinerExe)
if ($SkipMiner) { $pyArgs += "--skip-miner" }

& $python @pyArgs
$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  LOCAL TEST PASSED — ready for server deployment!"  -ForegroundColor Green
    Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Deploy to testnet server:"
    Write-Host "     ssh user@77.42.31.72 'cd /opt/zion && git pull && docker compose -f docker/docker-compose.testnet.yml up -d'"
    Write-Host "  2. Watch pool logs:"
    Write-Host "     ssh user@77.42.31.72 'docker logs -f zion-pool'"
    Write-Host "  3. Check revenue dashboard:"
    Write-Host "     http://77.42.31.72:8080/revenue"
} else {
    Write-Host "════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "  LOCAL TEST FAILED — do not deploy!"               -ForegroundColor Red
    Write-Host "════════════════════════════════════════════════════" -ForegroundColor Red
}

exit $exitCode
