# ZION V3 — Stop Pool
# Kills the ZION server.exe from the release directory by matching full path.
# This is safe and will NOT kill unrelated Windows services or other server processes.

$ReleaseDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release"
$poolExe = "$ReleaseDir\server.exe"

$procs = Get-Process -Name "server" -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $poolExe }
if ($procs) {
    foreach ($p in $procs) {
        Write-Host "Stopping server.exe PID=$($p.Id) Path=$($p.Path)"
        Stop-Process -Id $p.Id -Force
    }
    Write-Host "[stop-pool] Pool stopped."
} else {
    Write-Host "[stop-pool] No ZION server.exe found from release dir."
}
