# ZION V3 — Stop Prometheus + Grafana

$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Definition)
$ComposeFile = Join-Path $RepoRoot "V3\docker\docker-compose.yml"

Write-Host "Stopping ZION monitoring stack..." -ForegroundColor Cyan

Push-Location (Split-Path $ComposeFile -Parent)
try {
    docker compose -f $ComposeFile --profile monitoring down
} finally {
    Pop-Location
}

Write-Host "Monitoring stack stopped." -ForegroundColor Green
