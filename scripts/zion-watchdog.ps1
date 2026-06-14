# ZION V3 — Watchdog (Windows 11)
# Sleduje node1 + miner procesy a restartuje je pri padu.
# Spusti se automaticky po startu stacku (start-all-visible.bat nebo zion-autostart.vbs).
#
# Pouziti:
#   powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File scripts\zion-watchdog.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\zion-watchdog.ps1  (interaktivni, viditelny)

param(
    [int]$CheckIntervalSec = 30,       # Jak casto kontrolovat (default 30s)
    [int]$RestartCooldownSec = 120,    # Min. pauza mezi restarty stejne sluzby
    [switch]$Verbose                   # Podrobne logovani
)

$RepoRoot  = "C:\Users\yosef\Desktop\Zion\2.9.6-main"
$PidDir    = "$RepoRoot\.pids"
$LogDir    = "$RepoRoot\logs"
$ScriptsDir = "$RepoRoot\scripts"
$WatchdogLog = "$LogDir\watchdog.log"

New-Item -ItemType Directory -Path $PidDir  -Force | Out-Null
New-Item -ItemType Directory -Path $LogDir  -Force | Out-Null

function Write-WLog([string]$msg, [string]$level = "INFO") {
    $ts  = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] [$level] $msg"
    Write-Host $line
    Add-Content -Path $WatchdogLog -Value $line -Encoding UTF8
}

function Get-PidFromFile([string]$name) {
    $f = "$PidDir\$name.pid"
    if (Test-Path $f) {
        $raw = Get-Content $f -ErrorAction SilentlyContinue
        if ($raw -and $raw -match '^\d+$') { return [int]$raw }
    }
    return $null
}

function Is-ProcessAlive([int]$pid) {
    try {
        $p = Get-Process -Id $pid -ErrorAction SilentlyContinue
        return ($null -ne $p -and -not $p.HasExited)
    } catch { return $false }
}

function Find-ProcessByName([string]$exeName) {
    try {
        $procs = Get-Process -Name ($exeName -replace '\.exe$','') -ErrorAction SilentlyContinue
        if ($procs) { return $procs[0].Id }
    } catch {}
    return $null
}

# Popis sluzeb ktere sledujeme
$Services = @(
    @{
        Name       = "node1"
        ExeName    = "node.exe"
        StartScript = "$ScriptsDir\start-node.ps1"
        Critical   = $true
    },
    @{
        Name       = "miner"
        ExeName    = "zion-miner.exe"
        StartScript = "$ScriptsDir\start-miner.ps1"
        Critical   = $false
    }
)

# Cas posledniho restartu kazde sluzby
$LastRestart = @{}
foreach ($svc in $Services) { $LastRestart[$svc.Name] = 0 }

Write-WLog "Watchdog spusten. CheckInterval=${CheckIntervalSec}s  Cooldown=${RestartCooldownSec}s"
Write-WLog "Sledovane sluzby: $(($Services | ForEach-Object { $_.Name }) -join ', ')"

while ($true) {
    foreach ($svc in $Services) {
        $name = $svc.Name
        $pid  = Get-PidFromFile $name

        # Zjisti zda proces bezi
        $alive = $false
        if ($pid) {
            $alive = Is-ProcessAlive $pid
        }

        # Fallback: hledame podle jmena exekutabilky
        if (-not $alive) {
            $foundPid = Find-ProcessByName $svc.ExeName
            if ($foundPid) {
                $alive = $true
                # Aktualizujeme pid soubor
                $foundPid | Out-File "$PidDir\$name.pid" -Encoding utf8
                if ($Verbose) { Write-WLog "[$name] PID soubor obnoven -> $foundPid (nalezeno podle jmena)" }
            }
        }

        if ($alive) {
            if ($Verbose) { Write-WLog "[$name] OK (PID=$pid)" }
            continue
        }

        # Sluzba neni alive — zkontroluj cooldown
        $now      = [int][double]::Parse((Get-Date -UFormat %s))
        $lastRst  = $LastRestart[$name]
        $elapsed  = $now - $lastRst

        if ($elapsed -lt $RestartCooldownSec) {
            $remaining = $RestartCooldownSec - $elapsed
            Write-WLog "[$name] Down — cooldown $remaining s zbyvajici. Cekam." "WARN"
            continue
        }

        Write-WLog "[$name] Down! Restartuji..." "WARN"
        $LastRestart[$name] = $now

        # Spust start skript
        $script = $svc.StartScript
        if (-not (Test-Path $script)) {
            Write-WLog "[$name] Startovaci skript nenalezen: $script" "ERROR"
            continue
        }

        try {
            $p = Start-Process -FilePath "powershell.exe" `
                -ArgumentList "-ExecutionPolicy", "Bypass", "-File", $script `
                -WorkingDirectory $RepoRoot `
                -WindowStyle Hidden `
                -PassThru
            Write-WLog "[$name] Restart spusten (launcher PID=$($p.Id))" "WARN"
        } catch {
            Write-WLog "[$name] Chyba pri restartu: $_" "ERROR"
        }
    }

    Start-Sleep -Seconds $CheckIntervalSec
}
