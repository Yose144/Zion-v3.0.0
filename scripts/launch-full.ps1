# ZION V3 — Launch FULL stack (core + monitoring)
# Combines launch-stack.ps1 (Node1+Node2+Pool+Miner) with start-monitoring.ps1 (Prometheus+Grafana)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   ZION V3 — FULL MAINNET LAUNCH (CORE + MONITORING) ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Stop any existing ZION processes first
Write-Host "[0/2] Stopping existing ZION processes..." -ForegroundColor Yellow
$names = @("node", "server", "zion-miner")
foreach ($n in $names) {
    Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq $n } | ForEach-Object {
        Write-Host "  Stopping $($_.ProcessName) PID=$($_.Id)" -ForegroundColor Gray
        $_.Kill()
    }
}
Start-Sleep -Seconds 2

# 1. Launch core stack (Node1 + Node2 + Pool + Miner)
Write-Host "[1/2] Launching core stack..." -ForegroundColor Yellow
& "$ScriptDir\launch-stack.ps1"

Start-Sleep -Seconds 5

# 2. Launch monitoring (Prometheus + Grafana via Docker)
Write-Host ""
Write-Host "[2/2] Launching monitoring stack..." -ForegroundColor Yellow
& "$ScriptDir\start-monitoring.ps1"

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                 FULL STACK READY                  ║" -ForegroundColor Green
Write-Host "╚═══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Endpoints:" -ForegroundColor White
Write-Host "  Dashboard  : http://127.0.0.1:8765"  -ForegroundColor White
Write-Host "  Node 1 RPC : http://127.0.0.1:8443"  -ForegroundColor White
Write-Host "  Pool       : tcp://127.0.0.1:8444"   -ForegroundColor White
Write-Host "  Prometheus : http://127.0.0.1:9090"  -ForegroundColor White
Write-Host "  Grafana    : http://127.0.0.1:3000"  -ForegroundColor White
