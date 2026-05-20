# ZION V3 — Mainnet Launch Dashboard Launcher
# Opens the built-in Python HTTP dashboard in a new window and launches the browser.
# Zero dependencies: uses only Python stdlib (http.server).

param(
    [int]$Port = 8765
)

$DashboardDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$LogDir = Join-Path $DashboardDir "..\logs"

# Ensure logs directory exists
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
    Write-Host "Created logs directory: $LogDir" -ForegroundColor Yellow
}

# Clean up orphaned python dashboard processes
$Existing = Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%dashboard/app.py%'" | Select-Object ProcessId
foreach ($p in $Existing) {
    if ($p.ProcessId) {
        try { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
    }
}

Write-Host "Starting ZION Mainnet Launch Dashboard on port $Port ..." -ForegroundColor Cyan
Write-Host "Log directory: $LogDir" -ForegroundColor Gray

# Start dashboard server in background
$PythonPath = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $PythonPath) {
    Write-Error "Python not found in PATH. Please install Python 3.10+ and try again."
    exit 1
}

$job = Start-Job -ScriptBlock {
    param($dd, $pp)
    & $pp "$dd\app.py"
} -ArgumentList $DashboardDir, $PythonPath

Start-Sleep -Seconds 3

# Verify port is open
$tcpTest = Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -WarningAction SilentlyContinue
if (-not $tcpTest.TcpTestSucceeded) {
    Write-Warning "Dashboard did not start on port $Port. Check Python availability or port conflicts."
    Write-Host "Job output:" -ForegroundColor Gray
    Receive-Job $job
    Stop-Job $job; Remove-Job $job
    exit 1
}

# Open browser
Start-Process "http://127.0.0.1:$Port"

Write-Host "Dashboard running at http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host "Press Enter to stop the dashboard server." -ForegroundColor Gray
Read-Host

Stop-Job $job
Remove-Job $job
Write-Host "Dashboard stopped." -ForegroundColor Cyan
