# ZION Tailscale VPN Setup — Windows
# ==================================
# Jednorázová inštalácia a overenie Tailscale VPN tunela medzi Core a Edge.
#
# Použitie:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-tailscale.ps1

Write-Host "=== Tailscale Setup (Windows) ===" -ForegroundColor Cyan

# Kontrola, či je už nainštalovaný
$tsPath = (Get-Command tailscale -ErrorAction SilentlyContinue).Source
if (-not $tsPath) {
    $tsPath = "C:\Program Files\Tailscale\tailscale.exe"
}

if (Test-Path $tsPath) {
    Write-Host "Tailscale už je nainštalovaný: $tsPath" -ForegroundColor Green
} else {
    Write-Host "Tailscale nie je nainštalovaný. Inštalujem cez winget..." -ForegroundColor Yellow
    try {
        winget install --id Tailscale.Tailscale --accept-source-agreements --accept-package-agreements
    } catch {
        Write-Host "winget zlyhal. Stiahnite Tailscale manuálne z https://tailscale.com/download" -ForegroundColor Red
        exit 1
    }
    $tsPath = "C:\Program Files\Tailscale\tailscale.exe"
}

# Overenie verzie
& $tsPath version

# Login
Write-Host ""
Write-Host "Prihlasovanie do Tailscale..." -ForegroundColor Cyan
& $tsPath up --accept-routes
if ($LASTEXITCODE -ne 0) {
    Write-Host "Tailscale login zlyhal. Skúste: & '$tsPath' up" -ForegroundColor Red
    exit 1
}

# Zobrazenie IP
Write-Host ""
Write-Host "Vaša Tailscale IP:" -ForegroundColor Green
& $tsPath ip -4

Write-Host ""
Write-Host "=== Tailscale je aktívny ===" -ForegroundColor Green
Write-Host "Teraz nastavte CORE_TS_IP alebo EDGE_TS_IP podľa dokumentácie."
Write-Host "docs\ZION_NETWORK_TOPOLOGY.md"
