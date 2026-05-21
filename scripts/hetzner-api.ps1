# hetzner-api.ps1 — Hetzner Cloud API helper for ZION Edge Server
# ================================================================
# API Token: 0bCJHqNcf4CeHblcHwm8XX0Enpek8aPPsKrsdyCKaZCKO45qJ0CdqIsry7VtINx7
#
# Usage:
#   $env:HCLOUD_TOKEN = '0bCJHqNcf4CeHblcHwm8XX0Enpek8aPPsKrsdyCKaZCKO45qJ0CdqIsry7VtINx7'
#   powershell -ExecutionPolicy Bypass -File scripts\hetzner-api.ps1

param(
    [string]$Token = $env:HCLOUD_TOKEN
)

$HETZNER_API = "https://api.hetzner.cloud/v1"

function Invoke-Hcloud {
    param($Method, $Uri, $Body)
    $hdr = @{ "Authorization" = "Bearer $Token"; "Content-Type" = "application/json" }
    if ($Body) {
        Invoke-RestMethod -Method $Method -Uri $Uri -Headers $hdr -Body ($Body | ConvertTo-Json -Depth 5)
    } else {
        Invoke-RestMethod -Method $Method -Uri $Uri -Headers $hdr
    }
}

if (-not $Token) {
    Write-Host "CHYBA: Nastav HCLOUD_TOKEN" -ForegroundColor Red
    exit 1
}

Write-Host "=== Hetzner Cloud API ===" -ForegroundColor Cyan

# --- List servers ---
Write-Host ""
Write-Host "Servers:" -ForegroundColor Yellow
try {
    $servers = Invoke-Hcloud -Method GET -Uri "$HETZNER_API/servers"
    foreach ($s in $servers.servers) {
        $pubIp = $s.public_net.ipv4.ip
        Write-Host "  ID=$($s.id) Name=$($s.name) IP=$pubIp Status=$($s.status)"
    }
} catch {
    Write-Host "  Chyba: $_" -ForegroundColor Red
}

# --- List SSH keys ---
Write-Host ""
Write-Host "SSH Keys:" -ForegroundColor Yellow
try {
    $keys = Invoke-Hcloud -Method GET -Uri "$HETZNER_API/ssh_keys"
    foreach ($k in $keys.ssh_keys) {
        Write-Host "  ID=$($k.id) Name=$($k.name) Fingerprint=$($k.fingerprint)"
    }
} catch {
    Write-Host "  Chyba: $_" -ForegroundColor Red
}

# --- Upload our SSH key ---
$pubKeyFile = "$(Get-Location)\ssh-key-zion-edge.pub"
if (Test-Path $pubKeyFile) {
    $pubKey = Get-Content $pubKeyFile -Raw
    Write-Host ""
    Write-Host "Nahrávam SSH klúč..." -ForegroundColor Yellow
    try {
        $resp = Invoke-Hcloud -Method POST -Uri "$HETZNER_API/ssh_keys" -Body @{
            name = "zion-edge-$(Get-Date -Format 'yyyyMMdd')"
            public_key = $pubKey.Trim()
        }
        Write-Host "  SSH Key uploaded: ID=$($resp.ssh_key.id)" -ForegroundColor Green
    } catch {
        if ($_ -match "already exists") {
            Write-Host "  SSH Key už existuje." -ForegroundColor Yellow
        } else {
            Write-Host "  Chyba: $_" -ForegroundColor Red
        }
    }
} else {
    Write-Host ""
    Write-Host "SSH klúč nenájdený: $pubKeyFile" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Hotovo. Teraz môžeš:" -ForegroundColor Cyan
Write-Host "  1. Priradiť SSH klúč k serveru cez Hetzner web console" -ForegroundColor Yellow
Write-Host "  2. Alebo použiť deploy skript: .\scripts\deploy-edge.ps1" -ForegroundColor Yellow
