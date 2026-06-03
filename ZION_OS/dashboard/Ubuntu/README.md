# ZION V3 Dashboard — Ubuntu Setup

## Quick Start

```bash
cd dashboard/Ubuntu
chmod +x start-dashboard-ubuntu.sh
./start-dashboard-ubuntu.sh
```

Open browser: `http://127.0.0.1:8766`

## Ubuntu Specific Configuration

### Python Detection
- `python3` (apt)
- `/usr/bin/python3` (system)

### Autostart (systemd)

Create a systemd service to start dashboard on boot:

```bash
# Copy systemd service
sudo cp dashboard/Ubuntu/zion-dashboard.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable autostart
sudo systemctl enable zion-dashboard

# Start service
sudo systemctl start zion-dashboard

# Check status
sudo systemctl status zion-dashboard
```

To stop:
```bash
sudo systemctl stop zion-dashboard
sudo systemctl disable zion-dashboard
```

### Firewall (ufw)

If ufw blocks connections:
```bash
sudo ufw allow 8766/tcp
sudo ufw reload
```

### Resource Monitoring

Ubuntu dashboard uses:
- CPU: `/proc/meminfo`
- RAM: `/proc/meminfo`
- Disk: `statvfs` (via `shutil.disk_usage`)

### Tailscale VPN

For Edge server connectivity:
```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Connect
sudo tailscale up
```

## File Structure

```
dashboard/Ubuntu/
├── start-dashboard-ubuntu.sh     # Launcher script
├── zion-dashboard.service        # systemd service
└── README.md                     # This file
```

## Troubleshooting

### Port 8766 already in use
```bash
sudo lsof -i :8766
sudo kill -9 <PID>
```

### Python not found
```bash
sudo apt update
sudo apt install python3 python3-pip
```

### Logs location
```bash
tail -f logs/dashboard.log
```

### systemd logs
```bash
sudo journalctl -u zion-dashboard -f
```

## Versions Available

| Version | URL | Description |
|---------|-----|-------------|
| v1 | `http://127.0.0.1:8766/` | HTML/JS monolit (default) |
| v2 | `http://127.0.0.1:8766/` | React SPA (enable via `mv v2/dist.disabled v2/dist`) |
| v3 | `http://127.0.0.1:8766/v3/` | Clean rebuild HTML/JS |

## Desktop App (Tauri)

For native Linux app experience:
```bash
cd APP&WEB/desktop-dashboard
npm install
npm run tauri:dev
```

Build:
```bash
npm run tauri:build
# Output: src-tauri/target/release/bundle/appimage/
```
