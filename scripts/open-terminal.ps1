# ZION V3 — Open a visible terminal with live log watcher
# This is meant to be launched from the dashboard so the operator
# can see all service output in a real console window.

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot  = Split-Path -Parent $ScriptDir
$LogDir    = Join-Path $RepoRoot "logs"

# Ensure logs exist so tail doesn't error immediately
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$files = @("node1.log", "node2.log", "pool.log", "miner.log")
foreach ($f in $files) {
    $p = Join-Path $LogDir $f
    if (-not (Test-Path $p)) { New-Item -ItemType File -Path $p -Force | Out-Null }
}

# Launch PowerShell in a NEW VISIBLE WINDOW running watch-logs.ps1
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "powershell.exe"
$psi.Arguments = "-ExecutionPolicy Bypass -File `"$ScriptDir\watch-logs.ps1`""
$psi.WorkingDirectory = $RepoRoot
$psi.UseShellExecute = $true        # required to show a window
$psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Normal

[System.Diagnostics.Process]::Start($psi) | Out-Null

Write-Host "[open-terminal] Launched visible console with live logs."
