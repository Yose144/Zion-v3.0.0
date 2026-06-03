# ZION V3 Dashboard — Platform-Specific Setup

## Quick Start by Platform

### macOS
```bash
cd dashboard/MacOS
chmod +x start-dashboard-macos.sh
./start-dashboard-macos.sh
```
Open: `http://127.0.0.1:8766`

### Windows
```powershell
cd dashboard\Windows
.\start-dashboard-windows.ps1
```
Open: `http://127.0.0.1:8766`

### Ubuntu
```bash
cd dashboard/Ubuntu
chmod +x start-dashboard-ubuntu.sh
./start-dashboard-ubuntu.sh
```
Open: `http://127.0.0.1:8766`

## Platform-Specific Features

| Feature | macOS | Windows | Ubuntu |
|---------|-------|---------|--------|
| **Autostart** | launchd | Task Scheduler | systemd |
| **Python Detection** | python3, /usr/bin/python3, /opt/homebrew/bin/python3 | python, py, LOCALAPPDATA | python3, /usr/bin/python3 |
| **Resource Monitoring** | sysctl, vm_stat, shutil.disk_usage | ctypes.windll.kernel32 | /proc/meminfo, statvfs |
| **Tailscale** | brew install --cask tailscale | winget install tailscale.tailscale | curl -fsSL https://tailscale.com/install.sh \| sh |
| **Firewall** | System Settings → Network → Firewall | Windows Security → Firewall | sudo ufw allow 8766/tcp |

## Dashboard Versions

All platforms support 3 dashboard versions:

| Version | URL | Description |
|---------|-----|-------------|
| v1 | `http://127.0.0.1:8766/` | HTML/JS monolit (default) |
| v2 | `http://127.0.0.1:8766/` | React SPA (enable via `mv v2/dist.disabled v2/dist`) |
| v3 | `http://127.0.0.1:8766/v3/` | Clean rebuild HTML/JS |

## Autostart Configuration

### macOS (launchd)
```bash
cp dashboard/MacOS/com.zion.dashboard.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.zion.dashboard.plist
launchctl start com.zion.dashboard
```

### Windows (Task Scheduler)
```powershell
schtasks /create /tn "ZION Dashboard" /tr "powershell.exe -ExecutionPolicy Bypass -File C:\path\to\dashboard\Windows\start-dashboard-windows.ps1" /sc onlogon /rl highest
schtasks /run /tn "ZION Dashboard"
```

### Ubuntu (systemd)
```bash
sudo cp dashboard/Ubuntu/zion-dashboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable zion-dashboard
sudo systemctl start zion-dashboard
```

## Troubleshooting

### Port 8766 already in use
```bash
# macOS/Linux
lsof -i :8766
kill -9 <PID>

# Windows
netstat -ano | findstr :8766
taskkill /PID <PID> /F
```

### Python not found
```bash
# macOS
brew install python3

# Windows
winget install Python.Python.3.12

# Ubuntu
sudo apt update && sudo apt install python3 python3-pip
```

### Logs location
```bash
# All platforms
tail -f logs/dashboard.log
```

## Desktop App (Tauri)

For native app experience on all platforms:
```bash
cd APP&WEB/desktop-dashboard
npm install
npm run tauri:dev
```

Build:
```bash
npm run tauri:build
# Output:
# macOS: src-tauri/target/release/bundle/macos/
# Windows: src-tauri/target/release/bundle/msi/
# Ubuntu: src-tauri/target/release/bundle/appimage/
```

## File Structure

```
dashboard/
├── MacOS/
│   ├── start-dashboard-macos.sh
│   ├── com.zion.dashboard.plist
│   ├── config-macos.json
│   └── README.md
├── Windows/
│   ├── start-dashboard-windows.ps1
│   └── README.md
├── Ubuntu/
│   ├── start-dashboard-ubuntu.sh
│   ├── zion-dashboard.service
│   └── README.md
├── v1/          # HTML/JS monolit
├── v2/          # React SPA
├── v3/          # Clean rebuild
└── PLATFORM_SETUP.md
```

## Configuration

Each platform has a config file with:
- Python detection paths
- Port assignments
- Service definitions
- Monitoring settings
- Tailscale VPN settings

Example: `dashboard/MacOS/config-macos.json`

## Edge Server Connectivity

All platforms auto-detect Tailscale VPN status for Edge server:
- VPN IP: `100.76.16.108`
- Public IP: `77.42.71.94`
- Pool Port: `8444`
- RPC Port: `8443`

Dashboard shows real-time connectivity status in the topology panel.
