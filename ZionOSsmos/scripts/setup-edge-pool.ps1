#Requires -Version 5.1
<#
.SYNOPSIS
    Configure a local ZionOS rig to mine on the Edge pool and verify payouts.

.PARAMETER RigUrl
    URL of the ZionOS dashboard on your local rig (e.g. http://192.168.1.50:8888)

.PARAMETER Wallet
    Your ZION payout wallet address (zion1...)

.PARAMETER Worker
    Worker/rig name (default: hostname)

.PARAMETER Threads
    CPU mining threads (default: auto)

.EXAMPLE
    .\setup-edge-pool.ps1 -RigUrl "http://192.168.1.50:8888" -Wallet "zion1abc..." -Worker "rx6800-01"
#>
param(
    [Parameter(Mandatory=$true)]
    [string]$RigUrl,

    [Parameter(Mandatory=$true)]
    [string]$Wallet,

    [string]$Worker = $env:COMPUTERNAME,

    [int]$Threads = 0
)

$EdgePool = "77.42.71.94:8444"
$EdgePoolVpn = "100.76.16.108:8444"

function Test-PoolConnection {
    param([string]$Addr)
    $parts = $Addr -split ':'
    try {
        $tcp = Test-NetConnection -ComputerName $parts[0] -Port $parts[1] -WarningAction SilentlyContinue
        return $tcp.TcpTestSucceeded
    } catch { return $false }
}

Write-Host "═══ ZionOS Edge Pool Setup ═══" -ForegroundColor Cyan
Write-Host ""

# 1. Check pool connectivity
Write-Host "[1/5] Testing Edge pool connectivity..." -ForegroundColor Yellow
$poolPublic = Test-PoolConnection $EdgePool
$poolVpn = Test-PoolConnection $EdgePoolVpn

if ($poolPublic) {
    Write-Host "      Public pool  $EdgePool  -> REACHABLE" -ForegroundColor Green
} else {
    Write-Host "      Public pool  $EdgePool  -> UNREACHABLE" -ForegroundColor Red
}
if ($poolVpn) {
    Write-Host "      VPN pool     $EdgePoolVpn  -> REACHABLE" -ForegroundColor Green
} else {
    Write-Host "      VPN pool     $EdgePoolVpn  -> UNREACHABLE" -ForegroundColor DarkGray
}

if (-not $poolPublic -and -not $poolVpn) {
    Write-Host "ERROR: Cannot reach Edge pool. Check network/firewall." -ForegroundColor Red
    exit 1
}

$SelectedPool = if ($poolPublic) { $EdgePool } else { $EdgePoolVpn }
Write-Host "      Using pool: $SelectedPool" -ForegroundColor Green
Write-Host ""

# 2. Register/update rig on dashboard
Write-Host "[2/5] Registering rig with dashboard..." -ForegroundColor Yellow
$rigPayload = @{
    id = "rig-$Worker"
    name = "ZionRig-$Worker"
    wallet = $Wallet
    worker = $Worker
    pool_addr = $SelectedPool
    status = "online"
    gpu = $null
    stats = @{
        hashrate = 0; hashrate_1h = 0; hashrate_24h = 0
        accepted = 0; rejected = 0; stale = 0
        uptime_s = 0; difficulty = 0; last_share_time = $null
        total_hashes = 0
    }
    config = @{
        threads = $Threads
        gpu_mode = "cpu"
        intensity = $null
    }
    last_seen = 0
} | ConvertTo-Json -Depth 5

try {
    $resp = Invoke-RestMethod -Uri "$RigUrl/api/rigs" -Method POST -Body $rigPayload -ContentType "application/json" -TimeoutSec 10
    Write-Host "      Rig registered: $($resp.id)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "      Rig already registered (updating config)" -ForegroundColor DarkYellow
        # Update existing rig
        $updatePayload = @{
            wallet = $Wallet
            pool_addr = $SelectedPool
            worker = $Worker
            config = @{ threads = $Threads; gpu_mode = "cpu"; intensity = $null }
        } | ConvertTo-Json -Depth 3
        try {
            Invoke-RestMethod -Uri "$RigUrl/api/rigs/rig-$Worker/action" -Method POST -Body (@{ action = "config"; params = ($updatePayload | ConvertFrom-Json) } | ConvertTo-Json -Depth 5) -ContentType "application/json" -TimeoutSec 10 | Out-Null
            Write-Host "      Rig config updated" -ForegroundColor Green
        } catch {
            Write-Host "      Update skipped: $_" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "      Registration warning: $_" -ForegroundColor DarkGray
    }
}
Write-Host ""

# 3. Create Edge pool flight sheet
Write-Host "[3/5] Creating Edge pool flight sheet..." -ForegroundColor Yellow
$fsPayload = @{
    id = "fs-edge-pool-$Worker"
    name = "ZION — Edge Pool ($Worker)"
    coin = "ZION"
    algo = "Ekam Deeksha v2"
    pool_addr = $SelectedPool
    wallet = $Wallet
    miner_args = if ($Threads -gt 0) { "--threads $Threads" } else { "" }
    gpu_mode = "cpu"
    threads = $Threads
    intensity = $null
    created_at = [int](Get-Date -UFormat %s)
} | ConvertTo-Json -Depth 3

try {
    $fsResp = Invoke-RestMethod -Uri "$RigUrl/api/flightsheets" -Method POST -Body $fsPayload -ContentType "application/json" -TimeoutSec 10
    Write-Host "      Flight sheet created: $($fsResp.id)" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 409) {
        Write-Host "      Flight sheet already exists" -ForegroundColor DarkYellow
    } else {
        Write-Host "      Flight sheet warning: $_" -ForegroundColor DarkGray
    }
}
Write-Host ""

# 4. Verify pool API access for payout checks
Write-Host "[4/5] Verifying pool API access..." -ForegroundColor Yellow
try {
    $poolStats = Invoke-RestMethod -Uri "http://$SelectedPool/stats" -TimeoutSec 10
    Write-Host "      Pool height: $($poolStats.height)" -ForegroundColor Green
    Write-Host "      Active miners: $($poolStats.miners.active)" -ForegroundColor Green
    Write-Host "      Pool hashrate: $($poolStats.hashrate.pool) H/s" -ForegroundColor Green
} catch {
    Write-Host "      Pool stats unavailable (stratum port may not expose HTTP from here)" -ForegroundColor DarkGray
    Write-Host "      This is OK — mining itself uses TCP stratum, not HTTP." -ForegroundColor DarkGray
}
Write-Host ""

# 5. Miner startup command
Write-Host "[5/5] Ready to start mining. Use this command on your rig:" -ForegroundColor Yellow
Write-Host ""
Write-Host "      # As standalone miner:" -ForegroundColor Cyan
Write-Host "      zionos-miner --pool $SelectedPool --wallet $Wallet --worker $Worker $(if($Threads -gt 0){"--threads $Threads"})" -ForegroundColor White
Write-Host ""
Write-Host "      # Via ZionOS Agent (recommended — auto-restart + telemetry):" -ForegroundColor Cyan
Write-Host "      zionos-agent --dashboard $RigUrl --miner zionos-miner --pool $SelectedPool --wallet $Wallet --worker $Worker $(if($Threads -gt 0){"--threads $Threads"})" -ForegroundColor White
Write-Host ""

Write-Host "═══ Payout Verification ═══" -ForegroundColor Cyan
Write-Host "Once mining starts, verify payouts via:"
Write-Host "      Pool miner stats: http://$SelectedPool/api/v1/miner/$Wallet/stats"
Write-Host "      Pool payouts:     http://$SelectedPool/api/v1/miner/$Wallet/payouts"
Write-Host ""
Write-Host "Or query from this PC once the rig is submitting shares:"
Write-Host "      Invoke-RestMethod -Uri 'http://$SelectedPool/api/v1/miner/$Wallet/stats' | ConvertTo-Json -Depth 5"
Write-Host ""
