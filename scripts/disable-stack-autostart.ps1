# ZION V3 — Disable Stack Auto-Start on Windows 11
# Removes any startup shortcuts or scheduled tasks that auto-launch the ZION stack.
# The dashboard may still auto-start (monitoring only), but services will NOT.
#
# Run as Administrator if you see permission errors.

$RepoRoot = "C:\Users\yosef\Desktop\Zion\2.9.6-main"
$StartupFolder = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"

Write-Host "=== ZION Stack Auto-Start Disable ===" -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot" -ForegroundColor Gray
Write-Host ""

# 1. Remove startup shortcuts that launch the full stack
$stackShortcuts = @(
    "ZION-Stack.lnk",
    "ZION-Full-Stack.lnk",
    "ZION-Node-Pool-Miner.lnk",
    "start-windows-stack.lnk",
    "ZION-Windows-Stack.lnk"
)

$removed = 0
foreach ($name in $stackShortcuts) {
    $path = Join-Path $StartupFolder $name
    if (Test-Path $path) {
        Remove-Item $path -Force
        Write-Host "REMOVED startup shortcut: $name" -ForegroundColor Green
        $removed++
    }
}

# Also check for any shortcut that points to start-windows-stack.bat
$allShortcuts = Get-ChildItem $StartupFolder -Filter "*.lnk" -ErrorAction SilentlyContinue
foreach ($sc in $allShortcuts) {
    try {
        $ws = New-Object -ComObject WScript.Shell
        $shortcut = $ws.CreateShortcut($sc.FullName)
        $target = $shortcut.TargetPath
        if ($target -match "start-windows-stack\.bat|start-node\.ps1|start-pool\.ps1|start-miner\.ps1|launch-local-backup\.ps1") {
            Remove-Item $sc.FullName -Force
            Write-Host "REMOVED startup shortcut: $($sc.Name) -> $target" -ForegroundColor Green
            $removed++
        }
    } catch {
        # ignore
    }
}

if ($removed -eq 0) {
    Write-Host "No stack startup shortcuts found." -ForegroundColor Yellow
}

# 2. Disable scheduled tasks that auto-start the stack
Write-Host ""
Write-Host "--- Checking Scheduled Tasks ---" -ForegroundColor Gray
$tasks = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object {
    $_.TaskName -match 'zion.*stack|zion.*node|zion.*pool|zion.*miner|start.*zion|zion.*start'
} | Select-Object TaskName, State, TaskPath

if ($tasks) {
    foreach ($t in $tasks) {
        Write-Host "Found task: $($t.TaskName) [State=$($t.State)]" -ForegroundColor Yellow
        $confirm = Read-Host "Disable task '$($t.TaskName)'? (y/n)"
        if ($confirm -eq 'y') {
            Disable-ScheduledTask -TaskName $t.TaskName -TaskPath $t.TaskPath -Confirm:$false | Out-Null
            Write-Host "  -> DISABLED" -ForegroundColor Green
        } else {
            Write-Host "  -> skipped" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "No ZION stack scheduled tasks found." -ForegroundColor Yellow
}

# 3. Kill any currently running legacy stack processes (node pool miner in local-dev config)
Write-Host ""
Write-Host "--- Checking running processes ---" -ForegroundColor Gray
$ReleaseDir = "$RepoRoot\V3\target\release"

$procs = Get-Process | Where-Object {
    ($_.ProcessName -eq "node" -and $_.Path -eq "$ReleaseDir\node.exe") -or
    ($_.ProcessName -eq "server" -and $_.Path -eq "$ReleaseDir\server.exe") -or
    ($_.ProcessName -eq "zion-miner" -and $_.Path -eq "$ReleaseDir\zion-miner.exe")
} | Select-Object ProcessName, Id, Path

if ($procs) {
    Write-Host "Found running ZION processes:" -ForegroundColor Yellow
    $procs | Format-Table -AutoSize
    $confirm = Read-Host "Kill these processes? (y/n)"
    if ($confirm -eq 'y') {
        foreach ($p in $procs) {
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            Write-Host "  -> Killed $($p.ProcessName) PID=$($p.Id)" -ForegroundColor Green
        }
    }
} else {
    Write-Host "No running ZION release binaries found." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host "ZION stack will NO LONGER auto-start on Windows boot." -ForegroundColor Green
Write-Host "Dashboard (if installed) will still auto-start for monitoring only." -ForegroundColor Gray
Write-Host ""
Write-Host "To manually start the edge-primary stack:" -ForegroundColor Gray
Write-Host "  .\scripts\launch-local-backup.ps1" -ForegroundColor White
