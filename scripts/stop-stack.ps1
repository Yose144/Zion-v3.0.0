# ZION V3 — Stop ALL local services (safe, path-matched)
# Kills only ZION release binaries by matching their FULL path.
# Will NOT kill Node.js, system services, or unrelated processes.

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ReleaseDir = Join-Path $RepoRoot "V3\target\release"

$binaries = @(
    @{ Name = "node";   Path = "$ReleaseDir\node.exe" },
    @{ Name = "server"; Path = "$ReleaseDir\server.exe" },
    @{ Name = "zion-miner"; Path = "$ReleaseDir\zion-miner.exe" }
)

foreach ($bin in $binaries) {
    $procs = Get-Process -Name $bin.Name -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $bin.Path }
    if ($procs) {
        foreach ($p in $procs) {
            Write-Host "Stopping $($bin.Name).exe PID=$($p.Id)"
            Stop-Process -Id $p.Id -Force
        }
    }
}

Write-Host "[stop-stack] All ZION release binaries stopped."
