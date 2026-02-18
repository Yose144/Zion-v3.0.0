# Launch 5 ZION Testnet Seed Nodes
# This script starts 5 independent blockchain nodes on localhost to form a stable Testnet cluster.

$ErrorActionPreference = "Stop"

# Create data directories
$DataDir = "data/testnet_seeds"
if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir | Out-Null
}

# Kill existing python processes (optional, be careful)
# Stop-Process -Name "python" -ErrorAction SilentlyContinue

Write-Host "🚀 Launching ZION Testnet Seed Cluster (5 Nodes)..." -ForegroundColor Cyan

# Node 1 (Primary Seed - Port 8334/8545)
# This matches the hardcoded TESTNET_SEEDS in seednodes.py
Start-Process -FilePath "python" -ArgumentList "src/core/new_zion_blockchain.py --testnet --p2p-port 8334 --rpc-port 8545 --db-file $DataDir/node1.db" -WindowStyle Minimized
Write-Host "✅ Node 1 started (P2P: 8334, RPC: 8545)" -ForegroundColor Green
Start-Sleep -Seconds 2

# Node 2
Start-Process -FilePath "python" -ArgumentList "src/core/new_zion_blockchain.py --testnet --p2p-port 8335 --rpc-port 8546 --db-file $DataDir/node2.db" -WindowStyle Minimized
Write-Host "✅ Node 2 started (P2P: 8335, RPC: 8546)" -ForegroundColor Green
Start-Sleep -Seconds 2

# Node 3
Start-Process -FilePath "python" -ArgumentList "src/core/new_zion_blockchain.py --testnet --p2p-port 8336 --rpc-port 8547 --db-file $DataDir/node3.db" -WindowStyle Minimized
Write-Host "✅ Node 3 started (P2P: 8336, RPC: 8547)" -ForegroundColor Green
Start-Sleep -Seconds 2

# Node 4
Start-Process -FilePath "python" -ArgumentList "src/core/new_zion_blockchain.py --testnet --p2p-port 8337 --rpc-port 8548 --db-file $DataDir/node4.db" -WindowStyle Minimized
Write-Host "✅ Node 4 started (P2P: 8337, RPC: 8548)" -ForegroundColor Green
Start-Sleep -Seconds 2

# Node 5
Start-Process -FilePath "python" -ArgumentList "src/core/new_zion_blockchain.py --testnet --p2p-port 8338 --rpc-port 8549 --db-file $DataDir/node5.db" -WindowStyle Minimized
Write-Host "✅ Node 5 started (P2P: 8338, RPC: 8549)" -ForegroundColor Green

Write-Host "`n🌟 Testnet Cluster is ACTIVE!" -ForegroundColor Yellow
Write-Host "Monitor the nodes in the opened windows."
