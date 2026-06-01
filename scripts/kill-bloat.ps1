# ZION Pre-Launch Bloat Killer
# Ukoncí zbytecne procesy pred startem ZION stacku
# Spust jako: powershell -ExecutionPolicy Bypass -File scripts\kill-bloat.ps1

$targets = @(
    "EpicGamesLauncher",
    "EpicWebHelper",
    "steam",
    "steamwebhelper",
    "Spotify",
    "chrome",
    "msedge",
    "msedgewebview2",
    "Discord",
    "Telegram",
    "OneDrive"
)

Write-Host "[kill-bloat] Stopping background bloat..." -ForegroundColor Yellow

foreach ($name in $targets) {
    Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $_.Kill()
            Write-Host "  Stopped $($_.ProcessName) PID=$($_.Id)" -ForegroundColor Green
        } catch {
            Write-Host "  Failed to stop $($_.ProcessName) PID=$($_.Id): $_" -ForegroundColor Red
        }
    }
}

# Optional: shutdown WSL if not needed
$wsl = Get-Process "wsl" -ErrorAction SilentlyContinue
if ($wsl) {
    Write-Host "[kill-bloat] WSL detected. Run 'wsl --shutdown' if you don't need it." -ForegroundColor Cyan
}

# Show freed RAM
Start-Sleep -Seconds 1
$os = Get-CimInstance Win32_OperatingSystem
$availMB = [math]::Round($os.FreePhysicalMemory / 1KB, 0)
Write-Host "[kill-bloat] Available RAM now: $availMB MB" -ForegroundColor Cyan
