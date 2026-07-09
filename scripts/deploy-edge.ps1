# deploy-edge.ps1 — Deploy ZION Edge Node to remote server
# =========================================================
# Usage:
#   $env:ZION_EDGE_IP = "62.171.141.136"
#   $env:CORE_TS_IP  = "100.x.y.z"      # Core Tailscale IP
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-edge.ps1
#
# Steps:
#   1. Upload SSH key to server (via Hetzner Console first, or use password auth)
#   2. Upload scripts and binaries
#   3. Run edge-server-setup.sh on remote
#   4. Start edge node

param(
    [string]$EdgeIp = $env:ZION_EDGE_IP,
    [string]$CoreTsIp = $env:CORE_TS_IP,
    [string]$SshKey = "$(Get-Location)\ssh-key-zion-edge",
    [string]$RepoDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main"
)

if (-not $EdgeIp) {
    Write-Host "CHYBA: Nastav ZION_EDGE_IP" -ForegroundColor Red
    Write-Host "Príklad: `$env:ZION_EDGE_IP = '62.171.141.136'" -ForegroundColor Yellow
    exit 1
}

if (-not $CoreTsIp) {
    Write-Host "VAROVANIE: CORE_TS_IP nie je nastavené. Edge nebude vedieť syncovať s Core." -ForegroundColor Yellow
}

Write-Host "=== ZION Edge Deploy ===" -ForegroundColor Cyan
Write-Host "Edge IP : $EdgeIp"
Write-Host "Core TS : $CoreTsIp"
Write-Host "SSH Key : $SshKey"
Write-Host ""

# Check SSH key exists
if (-not (Test-Path $SshKey)) {
    Write-Host "CHYBA: SSH klúč neexistuje: $SshKey" -ForegroundColor Red
    Write-Host "Vygeneruj najprv: ssh-keygen -t ed25519 -f ssh-key-zion-edge -N ''" -ForegroundColor Yellow
    exit 1
}

# Test SSH connectivity
Write-Host "Testujem SSH pripojenie..." -ForegroundColor Yellow
$sshTest = ssh -o "BatchMode=yes" -o "ConnectTimeout=5" -i $SshKey "root@$EdgeIp" "echo OK" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "SSH zlyhalo. Musíš najprv pridať SSH klúč na server." -ForegroundColor Red
    Write-Host "Postup:" -ForegroundColor Yellow
    Write-Host "  1. Prihlás sa do Hetzner Console (web)" -ForegroundColor Yellow
    Write-Host "  2. Otvor console pre server $EdgeIp" -ForegroundColor Yellow
    Write-Host "  3. Spusti: mkdir -p /root/.ssh && chmod 700 /root/.ssh" -ForegroundColor Yellow
    Write-Host "  4. Vlož tento klúč do /root/.ssh/authorized_keys:" -ForegroundColor Yellow
    Write-Host ""
    Get-Content "$SshKey.pub"
    Write-Host ""
    Write-Host "  5. chmod 600 /root/.ssh/authorized_keys && systemctl restart sshd" -ForegroundColor Yellow
    exit 1
}

Write-Host "SSH OK — pripojenie funguje" -ForegroundColor Green

# Upload setup script
Write-Host "Nahrávam setup skript..." -ForegroundColor Yellow
scp -i $SshKey "$RepoDir\scripts\edge-server-setup.sh" "root@${EdgeIp}:/root/"

# Upload edge launcher
Write-Host "Nahrávam edge launcher..." -ForegroundColor Yellow
scp -i $SshKey "$RepoDir\scripts\launch-edge-node.sh" "root@${EdgeIp}:/root/"

# Upload SSH public key content
$pubKey = Get-Content "$SshKey.pub" -Raw

# Run setup on remote
Write-Host "Spúšťam setup na serveri..." -ForegroundColor Yellow
ssh -i $SshKey "root@$EdgeIp" "bash /root/edge-server-setup.sh"

# Upload repo (optional — if server should build)
# Alternatively, build locally and upload binary
Write-Host ""
Write-Host "=== Deploy hotový ===" -ForegroundColor Green
Write-Host ""
Write-Host "Pre spustenie Edge Node:" -ForegroundColor Cyan
Write-Host "  ssh -i $SshKey root@$EdgeIp" -ForegroundColor Yellow
Write-Host "  CORE_TS_IP=$CoreTsIp bash /root/launch-edge-node.sh" -ForegroundColor Yellow
Write-Host ""
Write-Host "Pre priamy build na serveri:" -ForegroundColor Cyan
Write-Host "  scp -r -i $SshKey V3 root@${EdgeIp}:/root/zion-2.9.6-main/" -ForegroundColor Yellow
Write-Host "  ssh -i $SshKey root@$EdgeIp 'cd /root/zion-2.9.6-main/V3 && cargo build --release --bin node'" -ForegroundColor Yellow
