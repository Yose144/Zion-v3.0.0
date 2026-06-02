# ZION V3 — Stop Node 2 (Local Dev / Optional)
# Kills the ZION node.exe from the release directory by matching full path.
# This is safe and will NOT kill Node.js or other unrelated node processes.

$ReleaseDir = "C:\Users\yosef\Desktop\Zion\2.9.6-main\V3\target\release"
$nodeExe = "$ReleaseDir\node.exe"

$procs = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $nodeExe }
if ($procs) {
    foreach ($p in $procs) {
        Write-Host "Stopping node.exe PID=$($p.Id) Path=$($p.Path)"
        Stop-Process -Id $p.Id -Force
    }
    Write-Host "[stop-node2] Node 2 stopped."
} else {
    Write-Host "[stop-node2] No ZION node.exe found from release dir."
}
