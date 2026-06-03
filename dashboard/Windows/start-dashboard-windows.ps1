# ZION V3 — Mainnet Launch Dashboard Launcher (Windows)
# Opens the built-in Python HTTP dashboard in the background and provides access info.
# Zero dependencies: uses only Python stdlib (http.server).

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DashboardDir = Join-Path $ScriptDir ".."
$LogDir = Join-Path $DashboardDir "..\logs"
$Port = if ($args.Count -gt 0) { $args[0] } else { 8766 }

# Ensure logs directory exists
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Write-Host "Created/verified logs directory: $LogDir"

# Clean up orphaned python dashboard processes
Write-Host "Cleaning up orphaned dashboard processes..."
Get-Process | Where-Object { $_.ProcessName -eq "python" -and $_.CommandLine -like "*dashboard/app.py*" } | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Starting ZION Mainnet Launch Dashboard on port $Port ..."
Write-Host "Log directory: $LogDir"
Write-Host "Dashboard directory: $DashboardDir"

# Check Python availability
$PythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $PythonCmd = "python"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $PythonCmd = "py"
} else {
    # Check common Python installation paths
    $PythonPaths = @(
        "$env:LOCALAPPDATA\Programs\Python\Python3*\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python*\python.exe",
        "C:\Python3*\python.exe"
    )
    foreach ($Path in $PythonPaths) {
        $Resolved = Resolve-Path $Path -ErrorAction SilentlyContinue
        if ($Resolved) {
            $PythonCmd = $Resolved.Path
            break
        }
    }
}

if (-not $PythonCmd) {
    Write-Host "Error: Python 3 not found in PATH. Please install Python 3.10+ and try again."
    Write-Host "Install via: winget install Python.Python.3.12"
    exit 1
}

Write-Host "Using Python: $PythonCmd"
& $PythonCmd --version

# Start dashboard server in background
Set-Location $DashboardDir
$Process = Start-Process -FilePath $PythonCmd -ArgumentList "app.py" -WindowStyle Hidden -PassThru
$DashboardPID = $Process.Id

Write-Host "Dashboard PID: $DashboardPID"

# Wait for dashboard to start
Write-Host "Waiting for dashboard to start..."
Start-Sleep -Seconds 3

# Verify port is open
try {
    $Response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 5
    if ($Response.StatusCode -ne 200) {
        throw "Dashboard did not return 200"
    }
} catch {
    Write-Host "Warning: Dashboard did not start on port $Port. Check Python availability or port conflicts."
    Write-Host "Process status:"
    Get-Process -Id $DashboardPID -ErrorAction SilentlyContinue
    Stop-Process -Id $DashboardPID -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Host ""
Write-Host "✅ Dashboard running at http://127.0.0.1:$Port"
Write-Host "📊 Open your browser and navigate to: http://127.0.0.1:$Port"
Write-Host ""
Write-Host "Press Ctrl+C to stop the dashboard server."
Write-Host ""

# Wait for interrupt signal
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host "Stopping dashboard..."
    Stop-Process -Id $DashboardPID -Force -ErrorAction SilentlyContinue
    Write-Host "Dashboard stopped."
}
