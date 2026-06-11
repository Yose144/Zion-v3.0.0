# ZION V3 Full Stack — Windows 11 Native with Log Files
# Launches node1 + node2 + pool + miner and redirects all output to logs/
#
# Topology modes:
#   LOCAL  (default) — seed_peers='none', standalone stack
#   CORE   — seed_peers=<EDGE_TAILSCALE_IP>:8333, Core node behind VPN
#
# Použitie CORE módu:
#   $env:ZION_TOPOLOGY = 'CORE'
#   $env:EDGE_TS_IP     = '100.x.y.z'    # Tailscale IP Edge Node
#   powershell -ExecutionPolicy Bypass -File scripts\launch-stack.ps1

$logDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

# Clean old logs
Remove-Item "$logDir\*.log","$logDir\*.err" -ErrorAction SilentlyContinue

# ── Stop any existing instances first ──
Write-Host "[launch] Stopping existing ZION processes..." -ForegroundColor Yellow
$names = @("node", "server", "zion-miner")
foreach ($n in $names) {
    Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq $n } | ForEach-Object {
        Write-Host "  Stopping $($_.ProcessName) PID=$($_.Id)" -ForegroundColor Gray
        $_.Kill()
    }
}
Start-Sleep -Seconds 2

# ── Topology config ──
$topology = $env:ZION_TOPOLOGY
if (-not $topology) { $topology = 'LOCAL' }

$seedPeers = 'none'
$node1P2p  = '0.0.0.0:8333'
if ($topology -eq 'CORE') {
    $edgeIp = $env:EDGE_TS_IP
    if (-not $edgeIp) {
        Write-Host "[launch] WARNING: ZION_TOPOLOGY=CORE ale EDGE_TS_IP nie je nastavené." -ForegroundColor Yellow
        Write-Host "[launch] Používam LOCAL mód. Pre Core+Edge topológiu nastav:" -ForegroundColor Yellow
        Write-Host "           `$env:EDGE_TS_IP = '100.x.y.z'" -ForegroundColor Yellow
        $topology = 'LOCAL'
    } else {
        $seedPeers = "$edgeIp`:8333"
        Write-Host "[launch] Topology: CORE (Edge peer=$seedPeers)" -ForegroundColor Cyan
    }
} else {
    Write-Host "[launch] Topology: LOCAL (standalone)" -ForegroundColor Cyan
}

$DataDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\data"
New-Item -ItemType Directory -Path $DataDir -Force | Out-Null

$nodeExe = "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\node.exe"
$poolExe = "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\server.exe"
$minerExe = "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\zion-miner.exe"

# ── Node 1 ──
$env:ZION_NODE_ID='w11-native-node'
$env:ZION_P2P_BIND='0.0.0.0:8333'
$env:ZION_RPC_BIND='0.0.0.0:8443'
$env:ZION_METRICS_BIND='0.0.0.0:9115'
$env:ZION_NODE_STATE_PATH="$DataDir\zion-node-state.db"
$env:ZION_SEED_PEERS=$seedPeers
$env:ZION_MINER_ADDRESS='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'
$env:ZION_HUMANITARIAN_WALLET='zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4'
$env:ZION_ISSOBELLA_WALLET='zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702'
# Note: 89/5/5/1 burn model — no pool fee wallet (1% is burned, never minted)
$p1 = Start-Process -FilePath $nodeExe -RedirectStandardOutput "$logDir\node1.log" -RedirectStandardError "$logDir\node1.err" -WindowStyle Hidden -PassThru
Write-Host "Started Node1  PID=$($p1.Id)"

Start-Sleep -Seconds 3

# ── Node 2 ──
$env:ZION_NODE_ID='w11-native-node2'
$env:ZION_P2P_BIND='0.0.0.0:8334'
$env:ZION_RPC_BIND='0.0.0.0:8446'
$env:ZION_METRICS_BIND='0.0.0.0:9116'
$env:ZION_NODE_STATE_PATH="$DataDir\zion-node2-state.db"
$env:ZION_SEED_PEERS='127.0.0.1:8333'
$env:ZION_MINER_ADDRESS='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'
$env:ZION_HUMANITARIAN_WALLET='zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4'
$env:ZION_ISSOBELLA_WALLET='zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702'
# Note: 89/5/5/1 burn model — no pool fee wallet (1% is burned, never minted)
$p2 = Start-Process -FilePath $nodeExe -RedirectStandardOutput "$logDir\node2.log" -RedirectStandardError "$logDir\node2.err" -WindowStyle Hidden -PassThru
Write-Host "Started Node2  PID=$($p2.Id)"

Start-Sleep -Seconds 2

# ── Pool ──
$env:ZION_POOL_BIND='0.0.0.0:8444'
$env:ZION_NODE_RPC_ADDR='127.0.0.1:8443'
$env:ZION_ROUTING_METRICS_BIND='0.0.0.0:9550'
$env:ZION_POOL_LOOP_COUNT='1000000'
$env:ZION_MAX_SESSIONS_PER_IP='10'
# WARNING: ZION_POOL_WALLET and ZION_POOL_PAYOUT_SK_HEX must be a matched pair.
# The SK_HEX below corresponds to the OLD pool wallet. If you change the wallet,
# you MUST also update the payout signing key.
$env:ZION_POOL_WALLET='zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604'
$env:ZION_POOL_PAYOUT_SK_HEX='[REDACTED — pool SK removed for security]'
$env:ZION_NONCE_COUNT='4096'
$env:ZION_VARDIFF_START_DIFF='1'
$env:ZION_VARDIFF_MAX_DIFF='1000000'
$pp = Start-Process -FilePath $poolExe -RedirectStandardOutput "$logDir\pool.log" -RedirectStandardError "$logDir\pool.err" -WindowStyle Hidden -PassThru
Write-Host "Started Pool   PID=$($pp.Id)"

Start-Sleep -Seconds 2

# ── Miner ──
$env:ZION_POOL_ADDR='127.0.0.1:8444'
$env:ZION_LOOP_COUNT='1000000'
$env:ZION_MINER_THREADS='2'
$env:ZION_WORKER_NAME='worker1'
$env:ZION_MINER_ID='w11-gpu-miner-01'
$env:ZION_GPU_BACKEND='opencl'
$env:ZION_GPU_WORK_SIZE='4096'
$pm = Start-Process -FilePath $minerExe -RedirectStandardOutput "$logDir\miner.log" -RedirectStandardError "$logDir\miner.err" -WindowStyle Hidden -PassThru
Write-Host "Started Miner  PID=$($pm.Id)"

Write-Host ""
Write-Host "[launch] All processes started. PIDs: node1=$($p1.Id) node2=$($p2.Id) pool=$($pp.Id) miner=$($pm.Id)"
Write-Host "[launch] Logs: $logDir"
Write-Host "[launch] To watch live:   powershell -ExecutionPolicy Bypass -File scripts\watch-logs.ps1"
Write-Host "[launch] Quick overview:  powershell -ExecutionPolicy Bypass -File scripts\live-logs.ps1"
Write-Host "[launch] To stop:         powershell -ExecutionPolicy Bypass -File scripts\stop-stack.ps1"
