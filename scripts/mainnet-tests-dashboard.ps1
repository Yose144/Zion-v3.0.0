param(
    [string]$HostIp = "91.98.122.165",
    [string]$User = "root",
    [string]$KeyPath = "$HOME/.ssh/zion_hetzner_key",
  [Alias("OutputPath")]
    [string]$OutFile = "scripts/mainnet-tests-dashboard.html",
  [switch]$Open,
  [switch]$Watch,
  [int]$IntervalSeconds = 30,
  [int]$Iterations = 0
)

$ErrorActionPreference = "Stop"

function Invoke-Remote {
  param([string]$ScriptText)

    $tmpKnown = Join-Path $env:TEMP "zion2_tmp_known_hosts"
    if (!(Test-Path $tmpKnown)) {
        New-Item -ItemType File -Path $tmpKnown | Out-Null
    }

    $normalized = $ScriptText -replace "`r", ""
    $normalized | ssh -F NUL -i $KeyPath -o BatchMode=yes -o ConnectTimeout=12 -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=$tmpKnown "$User@$HostIp" "tr -d '\r' | bash -s"
}

function Try-ParseJson {
    param([string]$Text)
    try {
        return ($Text | ConvertFrom-Json)
    } catch {
        return $null
    }
}

function Get-HealthStatus {
    param(
    [Nullable[double]]$Submits,
        [double]$AcceptRatePct,
        [double]$RejectTrendPct
    )

  if ($null -eq $Submits -or $Submits -le 0) {
    return @{ label = "IDLE"; css = "idle" }
  }

    if ($AcceptRatePct -ge 95 -and $RejectTrendPct -le 5) {
        return @{ label = "PASS"; css = "ok" }
    }
    if ($AcceptRatePct -ge 80 -and $RejectTrendPct -le 20) {
        return @{ label = "WARN"; css = "warn" }
    }
    return @{ label = "CRIT"; css = "crit" }
}

function Format-NumOrNa {
    param($Value, [string]$Format = "N2")
    if ($null -eq $Value -or $Value -is [string]) {
        return "n/a"
    }
    return ([double]$Value).ToString($Format)
}

function Update-Dashboard {
    param([bool]$OpenOnWrite = $false)

    Write-Host "[dashboard] Collecting data from $User@$HostIp ..."

    $utcNow = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $stateFile = [System.IO.Path]::ChangeExtension($OutFile, ".state.json")

    $prevState = $null
    if (Test-Path $stateFile) {
        $prevState = Try-ParseJson (Get-Content $stateFile -Raw)
    }

    $hostOverview = Invoke-Remote @'
printf 'hostname='; hostname
printf '\nuptime='; uptime -p
printf '\nload='; cat /proc/loadavg
'@
    $memory = Invoke-Remote @'
free -h
'@

    $dockerPs = Invoke-Remote @'
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
'@
    $dockerStats = Invoke-Remote @'
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}'
'@

    $poolStatsRaw = Invoke-Remote @'
curl -sf http://127.0.0.1:8080/stats || echo '{}'
'@
    $poolStats = Try-ParseJson $poolStatsRaw

    $canaryStatusRaw = Invoke-Remote @'
python3 -c 'import json,socket; s=socket.create_connection(("127.0.0.1",18332),5); s.sendall((json.dumps({"method":"get_status"})+"\n").encode()); print(s.recv(65536).decode().strip()); s.close()'
'@
    $canaryStatusEnvelope = Try-ParseJson $canaryStatusRaw
    $canaryStatus = $null
    if ($canaryStatusEnvelope -and $canaryStatusEnvelope.status) {
        $canaryStatus = $canaryStatusEnvelope.status
    }

    $canaryRoutingRaw = Invoke-Remote @'
python3 -c 'import socket; s=socket.create_connection(("127.0.0.1",19550),5); print(s.recv(65536).decode().strip()); s.close()'
'@
    $canaryRouting = Try-ParseJson $canaryRoutingRaw

    $poolActiveMiners = if ($poolStats -and $poolStats.active_miners -ne $null) { $poolStats.active_miners } else { "n/a" }
    $poolValidShares = if ($poolStats -and $poolStats.valid_shares -ne $null) { $poolStats.valid_shares } else { "n/a" }
    $poolInvalidShares = if ($poolStats -and $poolStats.invalid_shares -ne $null) { $poolStats.invalid_shares } else { "n/a" }
    $poolHashrate = if ($poolStats -and $poolStats.hashrate -ne $null) { $poolStats.hashrate } else { "n/a" }

    $canaryHeight = if ($canaryStatus -and $canaryStatus.chain_height -ne $null) { $canaryStatus.chain_height } else { "n/a" }
    $canaryAccepted = if ($canaryRouting -and $canaryRouting.accepted -ne $null) { [double]$canaryRouting.accepted } else { $null }
    $canaryRejected = if ($canaryRouting -and $canaryRouting.rejected -ne $null) { [double]$canaryRouting.rejected } else { $null }
    $canarySubmits = if ($canaryRouting -and $canaryRouting.submits -ne $null) { [double]$canaryRouting.submits } else { $null }
    $canaryAcceptRate = if ($canaryRouting -and $canaryRouting.accept_rate_pct -ne $null) { [double]$canaryRouting.accept_rate_pct } else { $null }

    $grpRevenueSubmits = if ($canaryRouting -and $canaryRouting.groups -and $canaryRouting.groups.revenue -and $canaryRouting.groups.revenue.submits -ne $null) { [double]$canaryRouting.groups.revenue.submits } else { $null }
    $grpRevenueAccepted = if ($canaryRouting -and $canaryRouting.groups -and $canaryRouting.groups.revenue -and $canaryRouting.groups.revenue.accepted -ne $null) { [double]$canaryRouting.groups.revenue.accepted } else { $null }
    $grpZionSubmits = if ($canaryRouting -and $canaryRouting.groups -and $canaryRouting.groups.zion -and $canaryRouting.groups.zion.submits -ne $null) { [double]$canaryRouting.groups.zion.submits } else { $null }
    $grpZionAccepted = if ($canaryRouting -and $canaryRouting.groups -and $canaryRouting.groups.zion -and $canaryRouting.groups.zion.accepted -ne $null) { [double]$canaryRouting.groups.zion.accepted } else { $null }
    $srcBlake3Submits = if ($canaryRouting -and $canaryRouting.sources -and $canaryRouting.sources.blake3 -and $canaryRouting.sources.blake3.submits -ne $null) { [double]$canaryRouting.sources.blake3.submits } else { $null }
    $srcBlake3Accepted = if ($canaryRouting -and $canaryRouting.sources -and $canaryRouting.sources.blake3 -and $canaryRouting.sources.blake3.accepted -ne $null) { [double]$canaryRouting.sources.blake3.accepted } else { $null }

    $deltaSubmits = 0.0
    $deltaRejected = 0.0
    $deltaAccepted = 0.0
    $windowSeconds = 0.0
    if ($prevState -and $canarySubmits -ne $null -and $canaryRejected -ne $null) {
        $deltaSubmits = [Math]::Max(0.0, $canarySubmits - [double]$prevState.submits)
        $deltaRejected = [Math]::Max(0.0, $canaryRejected - [double]$prevState.rejected)
      if ($canaryAccepted -ne $null -and $prevState.accepted -ne $null) {
        $deltaAccepted = [Math]::Max(0.0, $canaryAccepted - [double]$prevState.accepted)
      }
      if ($prevState.timestamp) {
        try {
          $prevTs = [DateTime]::Parse($prevState.timestamp).ToUniversalTime()
          $nowTs = [DateTime]::Parse($utcNow).ToUniversalTime()
          $windowSeconds = [Math]::Max(0.0, ($nowTs - $prevTs).TotalSeconds)
        } catch {
          $windowSeconds = 0.0
        }
      }
    }

    $rejectTrendPct = if ($deltaSubmits -gt 0) { ($deltaRejected / $deltaSubmits) * 100.0 } else { 0.0 }
    $acceptForHealth = if ($canaryAcceptRate -ne $null) { $canaryAcceptRate } else { 0.0 }
    $health = Get-HealthStatus -Submits $canarySubmits -AcceptRatePct $acceptForHealth -RejectTrendPct $rejectTrendPct

    $canaryAcceptedText = if ($canaryAccepted -ne $null) { $canaryAccepted.ToString("N0") } else { "n/a" }
    $canaryRejectedText = if ($canaryRejected -ne $null) { $canaryRejected.ToString("N0") } else { "n/a" }
    $canaryAcceptRateText = if ($canaryAcceptRate -ne $null) { $canaryAcceptRate.ToString("N2") } else { "n/a" }
    $rejectTrendText = $rejectTrendPct.ToString("N2")

    $grpRevenueText = if ($grpRevenueSubmits -ne $null -and $grpRevenueAccepted -ne $null) { "$($grpRevenueAccepted.ToString("N0"))/$($grpRevenueSubmits.ToString("N0"))" } else { "n/a" }
    $grpZionText = if ($grpZionSubmits -ne $null -and $grpZionAccepted -ne $null) { "$($grpZionAccepted.ToString("N0"))/$($grpZionSubmits.ToString("N0"))" } else { "n/a" }
    $srcBlake3Text = if ($srcBlake3Submits -ne $null -and $srcBlake3Accepted -ne $null) { "$($srcBlake3Accepted.ToString("N0"))/$($srcBlake3Submits.ToString("N0"))" } else { "n/a" }

    $submitRateText = if ($windowSeconds -gt 0) { (($deltaSubmits * 60.0) / $windowSeconds).ToString("N2") } else { "n/a" }
    $acceptRatePerMinText = if ($windowSeconds -gt 0) { (($deltaAccepted * 60.0) / $windowSeconds).ToString("N2") } else { "n/a" }

    $acceptPctBar = if ($canaryAcceptRate -ne $null) { [Math]::Max(0.0, [Math]::Min(100.0, $canaryAcceptRate)) } else { 0.0 }
    $rejectPctBar = if ($canarySubmits -ne $null -and $canarySubmits -gt 0 -and $canaryRejected -ne $null) {
      [Math]::Max(0.0, [Math]::Min(100.0, ($canaryRejected / $canarySubmits) * 100.0))
    } else {
      0.0
    }
    $revGrpPctBar = if ($grpRevenueSubmits -ne $null -and $grpRevenueSubmits -gt 0 -and $grpRevenueAccepted -ne $null) {
      [Math]::Max(0.0, [Math]::Min(100.0, ($grpRevenueAccepted / $grpRevenueSubmits) * 100.0))
    } else {
      0.0
    }
    $zionGrpPctBar = if ($grpZionSubmits -ne $null -and $grpZionSubmits -gt 0 -and $grpZionAccepted -ne $null) {
      [Math]::Max(0.0, [Math]::Min(100.0, ($grpZionAccepted / $grpZionSubmits) * 100.0))
    } else {
      0.0
    }
    $blake3PctBar = if ($srcBlake3Submits -ne $null -and $srcBlake3Submits -gt 0 -and $srcBlake3Accepted -ne $null) {
      [Math]::Max(0.0, [Math]::Min(100.0, ($srcBlake3Accepted / $srcBlake3Submits) * 100.0))
    } else {
      0.0
    }

    $acceptPctBarText = $acceptPctBar.ToString("N2")
    $rejectPctBarText = $rejectPctBar.ToString("N2")
    $revGrpPctBarText = $revGrpPctBar.ToString("N2")
    $zionGrpPctBarText = $zionGrpPctBar.ToString("N2")
    $blake3PctBarText = $blake3PctBar.ToString("N2")

    $inv = [System.Globalization.CultureInfo]::InvariantCulture
    $acceptPctBarCss = $acceptPctBar.ToString("0.##", $inv)
    $rejectPctBarCss = $rejectPctBar.ToString("0.##", $inv)
    $revGrpPctBarCss = $revGrpPctBar.ToString("0.##", $inv)
    $zionGrpPctBarCss = $zionGrpPctBar.ToString("0.##", $inv)
    $blake3PctBarCss = $blake3PctBar.ToString("0.##", $inv)

    $html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ZION Mainnet Test Dashboard</title>
  <style>
    :root {
      --bg: #060b14;
      --panel: #101826;
      --panel-2: #0b1220;
      --ink: #e5edf8;
      --muted: #8ea2c0;
      --accent: #22d3ee;
      --accent2: #38bdf8;
      --ok: #22c55e;
      --warn: #f59e0b;
      --crit: #ff2b2b;
      --crit-bg: #2b1114;
      --line: #233148;
    }
    body {
      margin: 0;
      font-family: "Segoe UI", "Trebuchet MS", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 10% -20%, #11335f 0%, transparent 34%),
        radial-gradient(circle at 90% -10%, #0f3f4a 0%, transparent 30%),
        linear-gradient(180deg, #050912 0%, #060b14 100%),
        var(--bg);
    }
    .wrap {
      max-width: 1180px;
      margin: 24px auto;
      padding: 0 16px 32px;
    }
    .hero {
      background: linear-gradient(135deg, #0b1322 0%, #0f1a2d 50%, #10233b 100%);
      color: var(--ink);
      border-radius: 16px;
      padding: 18px 20px;
      border: 1px solid var(--line);
      box-shadow: 0 14px 34px rgba(0, 0, 0, 0.35);
    }
    .hero h1 {
      margin: 0;
      font-size: 24px;
      letter-spacing: 0.3px;
    }
    .hero p {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: 13px;
    }
    .health-banner {
      margin-top: 12px;
      border-radius: 12px;
      padding: 10px 12px;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.02);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }
    .health-badge {
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.4px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid transparent;
    }
    .badge-ok { color: #06240f; background: #22c55e; border-color: #22c55e; }
    .badge-idle { color: #d7e5f7; background: #334155; border-color: #475569; }
    .badge-warn { color: #2f1800; background: #f59e0b; border-color: #f59e0b; }
    .badge-crit { color: #ffffff; background: var(--crit); border-color: #ff6b6b; box-shadow: 0 0 24px rgba(255, 43, 43, 0.35); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      margin-top: 14px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 12px 14px;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
    }
    .card.health-crit {
      background: var(--crit-bg);
      border-color: #8b2028;
      box-shadow: 0 0 0 2px rgba(255, 43, 43, 0.2);
    }
    .card.health-idle {
      background: #182234;
      border-color: #334155;
    }
    .k {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.7px;
    }
    .v {
      margin-top: 4px;
      font-weight: 700;
      font-size: 22px;
      color: var(--accent);
    }
    .split {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      margin-top: 12px;
    }
    @media (min-width: 980px) {
      .split {
        grid-template-columns: 1fr 1fr;
      }
    }
    .section-title {
      margin: 0 0 8px;
      font-size: 14px;
      color: var(--accent2);
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    pre {
      margin: 0;
      font-family: "Cascadia Mono", Consolas, monospace;
      font-size: 12px;
      line-height: 1.35;
      white-space: pre-wrap;
      color: #c6d5ec;
      background: var(--panel-2);
      border: 1px solid #1d2b42;
      border-radius: 10px;
      padding: 10px;
    }
    .ok { color: var(--ok); font-weight: 700; }
    .idle { color: #d7e5f7; font-weight: 700; }
    .warn { color: var(--warn); font-weight: 700; }
    .crit { color: var(--crit); font-weight: 800; }
    .viz-grid {
      display: grid;
      grid-template-columns: 1.1fr 1fr;
      gap: 12px;
      margin-top: 12px;
    }
    @media (max-width: 960px) {
      .viz-grid {
        grid-template-columns: 1fr;
      }
    }
    .gauge-wrap {
      display: flex;
      gap: 14px;
      align-items: center;
      flex-wrap: wrap;
    }
    .gauge {
      --pct: 0;
      width: 134px;
      height: 134px;
      border-radius: 50%;
      background: conic-gradient(#22c55e calc(var(--pct) * 1%), #233148 0);
      display: grid;
      place-items: center;
      box-shadow: inset 0 0 0 1px #2b3c59;
    }
    .gauge::after {
      content: "";
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: #0c1422;
      box-shadow: inset 0 0 0 1px #26354f;
    }
    .gauge-value {
      position: absolute;
      font-size: 24px;
      font-weight: 800;
      color: #dff7e6;
      text-shadow: 0 0 16px rgba(34, 197, 94, 0.35);
    }
    .meter-list {
      display: grid;
      gap: 10px;
      width: min(560px, 100%);
    }
    .meter-row {
      display: grid;
      gap: 6px;
    }
    .meter-head {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 12px;
      color: var(--muted);
    }
    .meter-track {
      height: 10px;
      border-radius: 999px;
      background: #16233a;
      border: 1px solid #233148;
      overflow: hidden;
    }
    .meter-fill {
      height: 100%;
      border-radius: 999px;
    }
    .fill-ok { background: linear-gradient(90deg, #16a34a 0%, #22c55e 100%); }
    .fill-warn { background: linear-gradient(90deg, #d97706 0%, #f59e0b 100%); }
    .fill-crit { background: linear-gradient(90deg, #c21515 0%, #ff2b2b 100%); }
    details { margin-top: 10px; }
    summary {
      cursor: pointer;
      color: var(--accent2);
      font-weight: 700;
      font-size: 13px;
      user-select: none;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>ZION Mainnet Test Dashboard</h1>
      <p>Primary host: $HostIp | Snapshot UTC: $utcNow</p>
      <p>Mode: Testnet live + V3 canary node/pool on same server, miner tested locally</p>
      <div class="health-banner">
        <div>
          <strong>Cluster health:</strong>
          <span class="health-badge badge-$($health.css)">$($health.label)</span>
        </div>
        <div><strong>Reject trend:</strong> $rejectTrendText%</div>
      </div>
    </div>

    <div class="grid">
      <div class="card health-$($health.css)"><div class="k">Health Status</div><div class="v $($health.css)">$($health.label)</div></div>
      <div class="card"><div class="k">Reject Trend (delta)</div><div class="v">$rejectTrendText%</div></div>
      <div class="card"><div class="k">Testnet Active Miners</div><div class="v">$poolActiveMiners</div></div>
      <div class="card"><div class="k">Testnet Hashrate</div><div class="v">$poolHashrate</div></div>
      <div class="card"><div class="k">Canary Height</div><div class="v">$canaryHeight</div></div>
      <div class="card"><div class="k">Canary Accept Rate</div><div class="v">$canaryAcceptRateText%</div></div>
      <div class="card"><div class="k">Canary Accepted</div><div class="v">$canaryAcceptedText</div></div>
      <div class="card"><div class="k">Canary Rejected</div><div class="v">$canaryRejectedText</div></div>
      <div class="card"><div class="k">Pool Valid Shares</div><div class="v">$poolValidShares</div></div>
      <div class="card"><div class="k">Pool Invalid Shares</div><div class="v">$poolInvalidShares</div></div>
    </div>

    <div class="viz-grid">
      <div class="card">
        <h3 class="section-title">Acceptance Gauge</h3>
        <div class="gauge-wrap">
          <div style="position:relative; display:grid; place-items:center;">
            <div class="gauge" style="--pct: $acceptPctBarCss"></div>
            <div class="gauge-value">$canaryAcceptRateText%</div>
          </div>
          <div style="color: var(--muted); max-width: 340px; font-size: 13px; line-height: 1.45;">
            Snapshot acceptance for canary pool. Health combines this value with reject trend delta and treats zero-submit snapshots as IDLE instead of CRIT.
          </div>
        </div>
      </div>
      <div class="card">
        <h3 class="section-title">Share Quality Bars</h3>
        <div class="meter-list">
          <div class="meter-row">
            <div class="meter-head"><span>Reject Share Ratio</span><span>$rejectPctBarText%</span></div>
            <div class="meter-track"><div class="meter-fill fill-crit" style="width: $rejectPctBarCss%"></div></div>
          </div>
          <div class="meter-row">
            <div class="meter-head"><span>Revenue Group Accept Ratio</span><span>$revGrpPctBarText%</span></div>
            <div class="meter-track"><div class="meter-fill fill-ok" style="width: $revGrpPctBarCss%"></div></div>
          </div>
          <div class="meter-row">
            <div class="meter-head"><span>Zion Group Accept Ratio</span><span>$zionGrpPctBarText%</span></div>
            <div class="meter-track"><div class="meter-fill fill-warn" style="width: $zionGrpPctBarCss%"></div></div>
          </div>
          <div class="meter-row">
            <div class="meter-head"><span>Blake3 Source Accept Ratio</span><span>$blake3PctBarText%</span></div>
            <div class="meter-track"><div class="meter-fill fill-ok" style="width: $blake3PctBarCss%"></div></div>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:12px;">
      <h3 class="section-title">Canary Pool Metrics</h3>
      <div class="grid" style="margin-top:0;">
        <div class="card"><div class="k">Submits / min (delta)</div><div class="v">$submitRateText</div></div>
        <div class="card"><div class="k">Accepted / min (delta)</div><div class="v">$acceptRatePerMinText</div></div>
        <div class="card"><div class="k">Revenue Group (acc/sub)</div><div class="v">$grpRevenueText</div></div>
        <div class="card"><div class="k">Zion Group (acc/sub)</div><div class="v">$grpZionText</div></div>
        <div class="card"><div class="k">Blake3 Source (acc/sub)</div><div class="v">$srcBlake3Text</div></div>
      </div>
    </div>

    <div class="split">
      <div class="card">
        <h3 class="section-title">Host Overview</h3>
        <pre>$hostOverview</pre>
        <br/>
        <h3 class="section-title">Memory</h3>
        <pre>$memory</pre>
      </div>
      <div class="card">
        <h3 class="section-title">Docker Containers</h3>
        <pre>$dockerPs</pre>
        <br/>
        <h3 class="section-title">Container Stats</h3>
        <pre>$dockerStats</pre>
      </div>
    </div>

    <div class="split">
      <div class="card">
        <h3 class="section-title">Canary Node RPC</h3>
        <details>
          <summary>Show raw payload</summary>
          <pre>$canaryStatusRaw</pre>
        </details>
      </div>
      <div class="card">
        <h3 class="section-title">Canary Routing Metrics</h3>
        <details>
          <summary>Show raw payload</summary>
          <pre>$canaryRoutingRaw</pre>
        </details>
      </div>
    </div>

    <div class="card" style="margin-top:12px;">
      <h3 class="section-title">Notes</h3>
      <pre>- Testnet public services remain on 3333/8080/8334/8444.
- V3 canary runs host-local on 18332/18334/13333/19550.
- Server-side canary miner is intentionally stopped to keep CPU headroom.
- Local miner tests can run through SSH tunnel: 127.0.0.1:13333.
- Health rule: IDLE if submits=0; PASS if accept>=95% and reject trend<=5%; WARN if accept>=80% and trend<=20%; else CRIT.</pre>
    </div>
  </div>
</body>
</html>
"@

    $targetDir = Split-Path -Parent $OutFile
    if ($targetDir -and !(Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    Set-Content -Path $OutFile -Value $html -Encoding UTF8
    @{ submits = $canarySubmits; accepted = $canaryAccepted; rejected = $canaryRejected; timestamp = $utcNow } | ConvertTo-Json | Set-Content -Path $stateFile -Encoding UTF8

    Write-Host "[dashboard] Generated $OutFile"
    if ($OpenOnWrite) {
        Start-Process $OutFile
    }
}

if ($Watch) {
    $round = 0
    while ($true) {
        $round++
        $shouldOpen = ($round -eq 1) -and $Open
        Update-Dashboard -OpenOnWrite:$shouldOpen
        if ($Iterations -gt 0 -and $round -ge $Iterations) {
            break
        }
        Start-Sleep -Seconds $IntervalSeconds
    }
    Write-Host "[dashboard] Watch finished after $round iteration(s)."
} else {
    Update-Dashboard -OpenOnWrite:$Open
}
