# ZION V3 Dashboard — Windows Setup

## Quick Start

```powershell
cd dashboard\Windows
.\start-dashboard-windows.ps1
```

Open browser: `http://127.0.0.1:8766`

## Windows Specific Configuration

### Python Detection
- `python` (Python Launcher)
- `py` (Python Launcher for Windows)
- `$env:LOCALAPPDATA\Programs\Python\Python3*\python.exe`

### Autostart (Task Scheduler)

Create a scheduled task to start dashboard on login:
```powershell
# Create task
schtasks /create /tn "ZION Dashboard" /tr "powershell.exe -ExecutionPolicy Bypass -File C:\path\to\dashboard\Windows\start-dashboard-windows.ps1" /sc onlogon /rl highest

# Start task
schtasks /run /tn "ZION Dashboard"

# Stop task
schtasks /end /tn "ZION Dashboard"
```

### Firewall

If Windows Firewall blocks connections:
1. Windows Security → Firewall & network protection
2. Allow Python or add port 8766 exception

### Resource Monitoring

Windows dashboard uses:
- CPU: `ctypes.windll.kernel32.GlobalMemoryStatusEx`
- RAM: `ctypes.windll.kernel32.GetDiskFreeSpaceExW`
- Disk: `ctypes.windll.kernel32.GetDiskFreeSpaceExW`

### Tailscale VPN

For Edge server connectivity:
```powershell
# Install Tailscale
winget install tailscale.tailscale

# Connect
tailscale up
```

## File Structure

```
dashboard/Windows/
├── start-dashboard-windows.ps1   # Launcher script
└── README.md                      # This file
```

## Troubleshooting

### Port 8766 already in use
```powershell
netstat -ano | findstr :8766
taskkill /PID <PID> /F
```

### Python not found
```powershell
winget install Python.Python.3.12
```

### Execution Policy
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Logs location
```powershell
Get-Content logs\dashboard.log -Wait
```

## Versions Available

| Version | URL | Description |
|---------|-----|-------------|
| v1 | `http://127.0.0.1:8766/` | HTML/JS monolit (default) |
| v2 | `http://127.0.0.1:8766/` | React SPA (enable via `mv v2/dist.disabled v2/dist`) |
| v3 | `http://127.0.0.1:8766/v3/` | Clean rebuild HTML/JS |

## Desktop App (Tauri)

For native Windows app experience:
```powershell
cd APP&WEB\desktop-dashboard
npm install
npm run tauri:dev
```

Build:
```powershell
npm run tauri:build
# Output: src-tauri\target\release\bundle\msi\
```
