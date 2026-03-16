param(
    [string]$HostIp = "91.98.122.165",
    [string]$User = "root",
    [string]$KeyPath = "$HOME/.ssh/zion_hetzner_key",
    [string]$OutFile = "scripts/mainnet-tests-dashboard.html",
    [switch]$Open
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

Write-Host "[dashboard] Collecting data from $User@$HostIp ..."

$utcNow = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

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
$canaryAccepted = if ($canaryRouting -and $canaryRouting.accepted -ne $null) { $canaryRouting.accepted } else { "n/a" }
$canaryRejected = if ($canaryRouting -and $canaryRouting.rejected -ne $null) { $canaryRouting.rejected } else { "n/a" }
$canaryAcceptRate = if ($canaryRouting -and $canaryRouting.accept_rate_pct -ne $null) { $canaryRouting.accept_rate_pct } else { "n/a" }

$html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ZION Mainnet Test Dashboard</title>
  <style>
    :root {
      --bg: #f4f1ea;
      --panel: #fffaf2;
      --ink: #1c1a18;
      --muted: #6a635a;
      --accent: #15616d;
      --accent2: #ff7d00;
      --ok: #2b9348;
      --warn: #d00000;
      --line: #d9d0c2;
    }
    body {
      margin: 0;
      font-family: "Segoe UI", "Trebuchet MS", sans-serif;
      color: var(--ink);
      background: radial-gradient(circle at 15% 20%, #ffe8d6 0%, #f4f1ea 45%),
                  radial-gradient(circle at 85% 10%, #e0fbfc 0%, transparent 40%),
                  var(--bg);
    }
    .wrap {
      max-width: 1180px;
      margin: 24px auto;
      padding: 0 16px 32px;
    }
    .hero {
      background: linear-gradient(120deg, #1c1a18 0%, #2f2a24 65%, #15616d 100%);
      color: #fff;
      border-radius: 16px;
      padding: 18px 20px;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
    }
    .hero h1 {
      margin: 0;
      font-size: 24px;
      letter-spacing: 0.3px;
    }
    .hero p {
      margin: 8px 0 0;
      color: #d6d0c7;
      font-size: 13px;
    }
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
      box-shadow: 0 6px 16px rgba(24, 18, 8, 0.06);
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
      color: #2b2926;
    }
    .ok { color: var(--ok); font-weight: 700; }
    .warn { color: var(--warn); font-weight: 700; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <h1>ZION Mainnet Test Dashboard</h1>
      <p>Primary host: $HostIp | Snapshot UTC: $utcNow</p>
      <p>Mode: Testnet live + V3 canary node/pool on same server, miner tested locally</p>
    </div>

    <div class="grid">
      <div class="card"><div class="k">Testnet Active Miners</div><div class="v">$poolActiveMiners</div></div>
      <div class="card"><div class="k">Testnet Hashrate</div><div class="v">$poolHashrate</div></div>
      <div class="card"><div class="k">Canary Height</div><div class="v">$canaryHeight</div></div>
      <div class="card"><div class="k">Canary Accept Rate</div><div class="v">$canaryAcceptRate%</div></div>
      <div class="card"><div class="k">Canary Accepted</div><div class="v">$canaryAccepted</div></div>
      <div class="card"><div class="k">Canary Rejected</div><div class="v">$canaryRejected</div></div>
      <div class="card"><div class="k">Pool Valid Shares</div><div class="v">$poolValidShares</div></div>
      <div class="card"><div class="k">Pool Invalid Shares</div><div class="v">$poolInvalidShares</div></div>
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
        <h3 class="section-title">Canary Node RPC Raw</h3>
        <pre>$canaryStatusRaw</pre>
      </div>
      <div class="card">
        <h3 class="section-title">Canary Routing Metrics Raw</h3>
        <pre>$canaryRoutingRaw</pre>
      </div>
    </div>

    <div class="card" style="margin-top:12px;">
      <h3 class="section-title">Notes</h3>
      <pre>- Testnet public services remain on 3333/8080/8334/8444.
- V3 canary runs host-local on 18332/18334/13333/19550.
- Server-side canary miner is intentionally stopped to keep CPU headroom.
- Local miner tests can run through SSH tunnel: 127.0.0.1:13333.</pre>
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
Write-Host "[dashboard] Generated $OutFile"

if ($Open) {
    Start-Process $OutFile
}
