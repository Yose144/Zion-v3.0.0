# ZION Edge Relay Node — Windows
# ==============================
# Spustiť na verejnom serveri (Edge Node). Tento uzol:
#   - Binduje P2P na 0.0.0.0:8333 (verejne dostupné)
#   - Syncuje sa s Core Node cez Tailscale VPN
#   - Nemá pool, nemá miner — čistý relay
#
# Použitie:
#   $env:CORE_TS_IP = "100.x.y.z"
#   powershell -ExecutionPolicy Bypass -File scripts\launch-edge-node.ps1

param(
    [string]$CoreTsIp = $env:CORE_TS_IP,
    [string]$NodeId = "zion-edge-relay",
    [string]$P2pBind = "0.0.0.0:8333",
    [string]$RpcBind = "127.0.0.1:8443",
    [string]$DataDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\data-edge",
    [string]$LogDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\logs"
)

if (-not $CoreTsIp) {
    Write-Host "CHYBA: Nastav CORE_TS_IP — Tailscale IP Core Node." -ForegroundColor Red
    Write-Host "Príklad: `$env:CORE_TS_IP = '100.64.1.2'" -ForegroundColor Yellow
    exit 1
}

$nodeExe = "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\node.exe"
if (-not (Test-Path $nodeExe)) {
    Write-Host "CHYBA: Node binary neexistuje: $nodeExe" -ForegroundColor Red
    Write-Host "Skompiluj najprv: cargo build --release --bin node" -ForegroundColor Yellow
    exit 1
}

New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

$env:ZION_NODE_ID = $NodeId
$env:ZION_P2P_BIND = $P2pBind
$env:ZION_RPC_BIND = $RpcBind
$env:ZION_SEED_PEERS = "$CoreTsIp`:8333"
$env:ZION_NODE_STATE_PATH = "$DataDir\edge-state.db"

$logFile = "$LogDir\edge-node-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

Write-Host "=== ZION Edge Relay Node ===" -ForegroundColor Cyan
Write-Host "Node ID : $NodeId"
Write-Host "P2P bind: $P2pBind"
Write-Host "RPC bind: $RpcBind"
Write-Host "Seed    : $CoreTsIp`:8333 (Core via Tailscale)"
Write-Host "Data dir: $DataDir"
Write-Host "Log file: $logFile"
Write-Host ""

$p = Start-Process -FilePath $nodeExe `
    -RedirectStandardOutput $logFile `
    -RedirectStandardError "$LogDir\edge-node.err" `
    -WindowStyle Hidden -PassThru

Write-Host "Edge Node spustený (PID $($p.Id))" -ForegroundColor Green
Write-Host "Log: $logFile"
Write-Host ""
Write-Host "Kontrola:" -ForegroundColor Yellow
Write-Host "  Get-Content $logFile -Wait"
Write-Host "  tailscale ping $CoreTsIp"
