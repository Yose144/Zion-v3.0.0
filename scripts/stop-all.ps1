# ZION V3 — Stop ALL services (core + monitoring)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "Stopping ALL ZION services..." -ForegroundColor Cyan

& "$ScriptDir\stop-stack.ps1"
& "$ScriptDir\stop-monitoring.ps1"

Write-Host "All services stopped." -ForegroundColor Green
