# ZION Miner Diagnosis — CPU mode + difficulty=1 (all hashes valid)
# This isolates whether the issue is GPU-kernel specific or hash-algorithm wide.

$logDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$nodeExe = "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\node.exe"
$poolExe = "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\server.exe"
$minerExe = "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release\zion-miner.exe"

# Kill existing
$names = @("node", "server", "zion-miner")
foreach ($n in $names) {
    Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq $n } | ForEach-Object {
        Write-Host "  Stopping $($_.ProcessName) PID=$($_.Id)" -ForegroundColor Gray
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 1

# Local Backup Node (syncs from Edge primary)
$env:ZION_NODE_ID='w11-native-node'
$env:ZION_P2P_BIND='0.0.0.0:8333'
$env:ZION_RPC_BIND='0.0.0.0:8443'
$env:ZION_POOL_BIND='0.0.0.0:8444'
$env:ZION_NODE_STATE_PATH='C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\data\zion-node-state.db'
$env:ZION_SEED_PEERS='none'
$env:ZION_MINER_ADDRESS='zion1e2z646u403s6c7k8m6m8m4q0a6r2a5h5j8534d8'
$env:ZION_HUMANITARIAN_WALLET='zion1t4w447d7k4c600h3x893m5r55645w4p057yf4d7'
$env:ZION_ISSOBELLA_WALLET='zion1e4t5a390m2r427a8f3s39885v4f2v6n8u3mj3f5'
$env:ZION_POOL_FEE_WALLET='zion1f3d840y886x6r658j3t0f583j347l2e2h84z402'
$p1 = Start-Process -FilePath $nodeExe -RedirectStandardOutput "$logDir\diag-node1.log" -RedirectStandardError "$logDir\diag-node1.err" -WindowStyle Hidden -PassThru
Write-Host "Started Node1  PID=$($p1.Id)"

Start-Sleep -Seconds 2

# Node 2 (peer)
$env:ZION_NODE_ID='w11-native-node2'
$env:ZION_P2P_BIND='0.0.0.0:8334'
$env:ZION_RPC_BIND='0.0.0.0:8445'
$env:ZION_NODE_STATE_PATH='C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\data\zion-node-state2.db'
$env:ZION_SEED_PEERS='127.0.0.1:8333'
$p2 = Start-Process -FilePath $nodeExe -RedirectStandardOutput "$logDir\diag-node2.log" -RedirectStandardError "$logDir\diag-node2.err" -WindowStyle Hidden -PassThru
Write-Host "Started Node2  PID=$($p2.Id)"

Start-Sleep -Seconds 3

# Pool with difficulty=1 (target=MAX) so every hash is accepted
$env:ZION_POOL_BIND='0.0.0.0:8444'
$env:ZION_NODE_RPC_ADDR='127.0.0.1:8443'
$env:ZION_POOL_LOOP_COUNT='1000000'
$env:ZION_MAX_SESSIONS_PER_IP='10'
$env:ZION_POOL_WALLET='zion182e2v4x4r3u2j5r5t305k0d5y643q6l3n6je5f8'
$env:ZION_POOL_PAYOUT_SK_HEX='[REDACTED — pool SK removed for security]'
$env:ZION_NONCE_COUNT='4096'
$env:ZION_VARDIFF_START_DIFF='1'
$env:ZION_VARDIFF_MIN_DIFF='1'
$env:ZION_VARDIFF_MAX_DIFF='1'
$pp = Start-Process -FilePath $poolExe -RedirectStandardOutput "$logDir\diag-pool.log" -RedirectStandardError "$logDir\diag-pool.err" -WindowStyle Hidden -PassThru
Write-Host "Started Pool   PID=$($pp.Id)  (difficulty=1, all hashes valid)"

Start-Sleep -Seconds 2

# Miner in CPU mode (no GPU)
$env:ZION_POOL_ADDR='127.0.0.1:8444'
$env:ZION_WORKER_NAME='diag-worker'
$env:ZION_MINER_ID='diag-miner-01'
$env:ZION_LOOP_COUNT='1000000'
$env:ZION_BACKEND='cpu'
$env:ZION_MINER_VERBOSE='1'
$pm = Start-Process -FilePath $minerExe -RedirectStandardOutput "$logDir\diag-miner.log" -RedirectStandardError "$logDir\diag-miner.err" -WindowStyle Hidden -PassThru
Write-Host "Started Miner  PID=$($pm.Id)  (CPU mode)"

Write-Host ""
Write-Host "[diag] Stack running. PIDs: node1=$($p1.Id) node2=$($p2.Id) pool=$($pp.Id) miner=$($pm.Id)"
Write-Host "[diag] Logs: $logDir\diag-*.log"
Write-Host "[diag] Waiting 15s for first shares..."
Start-Sleep -Seconds 15

Write-Host ""
Write-Host "--- Pool log tail ---"
Get-Content "$logDir\diag-pool.log" -Tail 10
Write-Host ""
Write-Host "--- Miner log tail ---"
Get-Content "$logDir\diag-miner.log" -Tail 10
Write-Host ""

$accepted = Select-String -Path "$logDir\diag-pool.log" -Pattern "share_status=Accepted" -Quiet
if ($accepted) {
    Write-Host "RESULT: CPU miner FOUND shares with difficulty=1 -> algorithm is OK, bug is in GPU kernel" -ForegroundColor Green
} else {
    $noSol = Select-String -Path "$logDir\diag-pool.log" -Pattern "share_status=NoSolution" -Quiet
    if ($noSol) {
        Write-Host "RESULT: CPU miner still NoSolution with difficulty=1 -> hash algorithm bug or target mismatch" -ForegroundColor Red
    } else {
        Write-Host "RESULT: No share activity yet. Check logs manually." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "[diag] Stopping processes..."
Stop-Process -Id $pm.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $pp.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $p2.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $p1.Id -Force -ErrorAction SilentlyContinue
Write-Host "[diag] Done."
