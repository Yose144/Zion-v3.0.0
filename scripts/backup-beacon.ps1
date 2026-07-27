# backup-beacon.ps1 — Report local backup node status to Edge dashboard
# Runs via Task Scheduler every 15s. Reads RPC from local node (127.0.0.1:8446)
# and POSTs the status to the Edge dashboard /api/backup-beacon endpoint.
param(
    [string]$RpcHost = $env:ZION_BACKUP_RPC_HOST,
    [string]$RpcPort = $env:ZION_BACKUP_RPC_PORT,
    [string]$DashboardUrl = $env:ZION_DASHBOARD_URL,
    [string]$DashboardUser = $env:ZION_DASHBOARD_USER,
    [string]$DashboardPass = $env:ZION_DASHBOARD_PASS
)

if (-not $RpcHost)     { $RpcHost = '127.0.0.1' }
if (-not $RpcPort)     { $RpcPort = '8446' }
if (-not $DashboardUrl){ $DashboardUrl = 'https://dashboard.zionterranova.com/api/backup-beacon' }
if (-not $DashboardUser){ $DashboardUser = 'Yose' }
if (-not $DashboardPass){ $DashboardPass = '3nityOne13' }

$rpcUri = "http://${RpcHost}:${RpcPort}/jsonrpc"
$hostnameLabel = $env:COMPUTERNAME

function Get-RpcResult($method) {
    $body = (@{ jsonrpc = '2.0'; method = $method; params = @(); id = 1 } | ConvertTo-Json -Compress)
    try {
        $resp = Invoke-RestMethod -Uri $rpcUri -Method POST -ContentType 'application/json' -Body $body -TimeoutSec 5
        return $resp.result
    } catch {
        return $null
    }
}

$chainInfo = Get-RpcResult 'getChainInfo'

if (-not $chainInfo) {
    $payload = @{
        running = $false
        host = $hostnameLabel
        node_id = 'local-backup-node'
    } | ConvertTo-Json -Compress
} else {
    $nodeInfo = Get-RpcResult 'getNodeInfo'
    $peerInfo = Get-RpcResult 'getPeerInfo'

    $payload = @{
        running = $true
        chain_height = $chainInfo.chain_height
        tip_hash = $chainInfo.tip_hash
        known_peers = if ($peerInfo.count) { $peerInfo.count } else { 0 }
        mempool_size = if ($chainInfo.mempool_transactions) { $chainInfo.mempool_transactions } else { 0 }
        network = $chainInfo.network
        protocol_version = $chainInfo.protocol_version
        consensus_profile = $chainInfo.consensus_profile
        accepted_blocks = $chainInfo.accepted_blocks
        node_id = if ($nodeInfo.node_id) { $nodeInfo.node_id } else { 'local-backup-node' }
        p2p_bind = if ($nodeInfo.p2p_bind) { $nodeInfo.p2p_bind } else { '0.0.0.0:8333' }
        rpc_bind = if ($nodeInfo.rpc_bind) { $nodeInfo.rpc_bind } else { '127.0.0.1:8446' }
        host = $hostnameLabel
    } | ConvertTo-Json -Compress
}

try {
    $pair = "${DashboardUser}:${DashboardPass}"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($pair)
    $b64 = [Convert]::ToBase64String($bytes)
    $headers = @{ Authorization = "Basic $b64"; 'Content-Type' = 'application/json' }
    $null = Invoke-RestMethod -Uri $DashboardUrl -Method POST -Headers $headers -Body $payload -TimeoutSec 10
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') beacon sent: $payload"
} catch {
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') beacon failed: $($_.Exception.Message)"
}
