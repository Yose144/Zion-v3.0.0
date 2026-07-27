# backup-beacon-loop.ps1 — Continuously report local backup node status to Edge dashboard
# Runs the one-shot backup-beacon.ps1 every 15 seconds.
param(
    [int]$IntervalSeconds = 15
)

$script = Join-Path $PSScriptRoot 'backup-beacon.ps1'
if (-not (Test-Path $script)) {
    Write-Error "backup-beacon.ps1 not found at $script"
    exit 1
}

Write-Host "Starting backup beacon loop (interval ${IntervalSeconds}s). Press Ctrl+C to stop."
while ($true) {
    & $script @args
    Start-Sleep -Seconds $IntervalSeconds
}
