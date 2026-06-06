# Deploy CPU Miner on Edge Server (manual SSH instructions)
# This script provides step-by-step instructions for deploying a CPU miner on Edge

Write-Host "═══ Edge CPU Miner Deployment Instructions ═══" -ForegroundColor Cyan
Write-Host ""
Write-Host "Step 1: SSH to Edge server" -ForegroundColor Yellow
Write-Host "  ssh root@77.42.71.94"
Write-Host "  # or via Tailscale VPN:"
Write-Host "  ssh root@100.76.16.108"
Write-Host ""

Write-Host "Step 2: Build the miner" -ForegroundColor Yellow
Write-Host "  cd /root/zion-2.9.6-main/V3"
Write-Host "  cargo build --manifest-path Cargo.toml -p zion-miner --release"
Write-Host ""

Write-Host "Step 3: Copy service file to Edge" -ForegroundColor Yellow
Write-Host "  # On your local PC:"
Write-Host "  scp ZionOS/scripts/edge-cpu-miner.service root@77.42.71.94:/tmp/"
Write-Host ""

Write-Host "Step 4: Install and start the service" -ForegroundColor Yellow
Write-Host "  # On Edge server:"
Write-Host "  sudo mv /tmp/edge-cpu-miner.service /etc/systemd/system/"
Write-Host "  sudo systemctl daemon-reload"
Write-Host "  sudo systemctl enable edge-cpu-miner.service"
Write-Host "  sudo systemctl start edge-cpu-miner.service"
Write-Host ""

Write-Host "Step 5: Check status" -ForegroundColor Yellow
Write-Host "  sudo systemctl status edge-cpu-miner.service"
Write-Host "  sudo journalctl -u edge-cpu-miner.service -f"
Write-Host ""

Write-Host "═══ Configuration ═══" -ForegroundColor Cyan
Write-Host "Pool: 127.0.0.1:8444 (local pool on Edge)"
Write-Host "Wallet: zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3"
Write-Host "Worker: edge-cpu-miner"
Write-Host "Threads: 2"
Write-Host "Loop count: 1000000 (sustained mining)"
Write-Host ""

Write-Host "═══ Alternative: Run miner manually ═══" -ForegroundColor Cyan
Write-Host "If you don't want to use systemd, run manually:"
Write-Host ""
Write-Host "  cd /root/zion-2.9.6-main/V3"
Write-Host "  ZION_POOL_ADDR=127.0.0.1:8444 \\"
Write-Host "  ZION_MINER_ID=zion1f8m55606u500z8l7f8p7n85588s3x70048c66j3 \\"
Write-Host "  ZION_WORKER_NAME=edge-cpu-miner \\"
Write-Host "  ZION_MINER_THREADS=2 \\"
Write-Host "  ZION_LOOP_COUNT=1000000 \\"
Write-Host "  ZION_GPU_BACKEND=cpu \\"
Write-Host "  ./target/release/zion-miner"
Write-Host ""
