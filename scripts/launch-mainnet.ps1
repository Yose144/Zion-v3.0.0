# ZION V3 Mainnet Launch Script
# Updated: 2026-05-22 - Ready for mainnet launch

Write-Host "=== ZION V3 MAINNET LAUNCH ===" -ForegroundColor Green
Write-Host "Date: $(Get-Date)" -ForegroundColor Yellow
Write-Host ""

# Step 1: Stop existing services
Write-Host "[1/5] Stopping existing services..." -ForegroundColor Yellow
powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\stop-stack.ps1"
ssh -i ssh-key-zion-edge root@62.171.141.136 "systemctl stop zion-edge zion-edge-pool" 2>$null
Start-Sleep -Seconds 3

# Step 2: Clean data directories (for clean genesis start)
Write-Host "[2/5] Cleaning data directories..." -ForegroundColor Yellow
Remove-Item -Path "V3\data\*" -Recurse -Force -ErrorAction SilentlyContinue
ssh -i ssh-key-zion-edge root@62.171.141.136 "rm -f /root/zion-2.9.6-main/data/*" 2>$null
Write-Host "Data directories cleaned" -ForegroundColor Green

# Step 3: Start Core server
Write-Host "[3/5] Starting Core server..." -ForegroundColor Yellow
$env:ZION_TOPOLOGY='CORE'
$env:EDGE_TS_IP='62.171.141.136'
powershell -ExecutionPolicy Bypass -File "$PSScriptRoot\_launch-core.ps1"
Start-Sleep -Seconds 5

# Step 4: Start Edge server
Write-Host "[4/5] Starting Edge server..." -ForegroundColor Yellow
ssh -i ssh-key-zion-edge root@62.171.141.136 "systemctl start zion-edge zion-edge-pool"
Start-Sleep -Seconds 5

# Step 5: Verify launch
Write-Host "[5/5] Verifying launch..." -ForegroundColor Yellow
$coreProcesses = Get-Process node,server,zion-miner -ErrorAction SilentlyContinue
if ($coreProcesses) {
    Write-Host "Core processes running:" -ForegroundColor Green
    $coreProcesses | Select-Object Id,ProcessName
} else {
    Write-Host "WARNING: Core processes not found" -ForegroundColor Red
}

$edgeStatus = ssh -i ssh-key-zion-edge root@62.171.141.136 "systemctl is-active zion-edge zion-edge-pool" 2>$null
if ($edgeStatus) {
    Write-Host "Edge services running:" -ForegroundColor Green
    Write-Host $edgeStatus
} else {
    Write-Host "WARNING: Edge services not running" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== MAINNET LAUNCH COMPLETE ===" -ForegroundColor Green
Write-Host "Core Dashboard: http://127.0.0.1:8766" -ForegroundColor Cyan
Write-Host "Edge Public Pool: 62.171.141.136:8444" -ForegroundColor Cyan
Write-Host ""
Write-Host "Monitor logs:" -ForegroundColor Yellow
Write-Host "  Core: tail -f logs/node1.log" -ForegroundColor Gray
Write-Host "  Edge: ssh -i ssh-key-zion-edge root@62.171.141.136 'journalctl -u zion-edge -f'" -ForegroundColor Gray