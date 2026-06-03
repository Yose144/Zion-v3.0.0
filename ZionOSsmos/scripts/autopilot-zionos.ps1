param(
  [switch]$RunChecks = $true
)

$ErrorActionPreference = 'Stop'

Write-Host '=== ZionOS Autopilot Bootstrap ===' -ForegroundColor Cyan

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

try {
  if ($RunChecks) {
    Write-Host '[1/4] Dashboard check' -ForegroundColor Yellow
    cargo check --manifest-path dashboard/Cargo.toml

    Write-Host '[2/4] Agent check' -ForegroundColor Yellow
    cargo check --manifest-path agent/Cargo.toml

    Write-Host '[3/4] Miner check' -ForegroundColor Yellow
    cargo check --manifest-path miner/Cargo.toml

    Write-Host '[4/4] Dashboard frontend syntax' -ForegroundColor Yellow
    node --check dashboard/static/app.js
  }

  Write-Host 'Autopilot baseline complete.' -ForegroundColor Green
  Write-Host 'Next: command history filters + retry/lease integration test + startup policy hardening.' -ForegroundColor Green
}
finally {
  Pop-Location
}
