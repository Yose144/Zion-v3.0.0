# ZION V3 Dashboard — macOS Setup

## Quick Start

### Dashboard
```bash
cd dashboard/MacOS
chmod +x start-dashboard-macos.sh
./start-dashboard-macos.sh
```
Open browser: `http://127.0.0.1:8766`

### Local Node + Miner
```bash
cd dashboard/MacOS
chmod +x start-local-node.sh
./start-local-node.sh
```

This starts:
- Local ZION node (P2P: 8333, RPC: 8443)
- Local miner (connects to Edge pool via Tailscale: 100.76.16.108:8444)
- Miner wallet: `zion1a59644y2a2z3p5p2f88308d2u536f0e2e3rd5a8`

Stop with:
```bash
./stop-local-node.sh
```

## Miner Wallet

**Address:** `zion1a59644y2a2z3p5p2f88308d2u536f0e2e3rd5a8`  
**Secret Key:** `4ad78f484623640d08e33d63b35925d3c519a9b32f04cf854e41a1877920235c`

**⚠️ SAVE SECRET KEY SECURELY**

## macOS Specific Configuration

### Python Detection Order
1. `python3` (PATH)
2. `/usr/bin/python3` (system)
3. `/opt/homebrew/bin/python3` (Homebrew)

### Autostart (launchd)

Create a launchd agent to start dashboard on login:

```bash
# Copy launchd plist to ~/Library/LaunchAgents/
cp dashboard/MacOS/com.zion.dashboard.plist ~/Library/LaunchAgents/

# Load the agent
launchctl load ~/Library/LaunchAgents/com.zion.dashboard.plist

# Start the service
launchctl start com.zion.dashboard
```

To stop:
```bash
launchctl stop com.zion.dashboard
launchctl unload ~/Library/LaunchAgents/com.zion.dashboard.plist
```

### Firewall

If macOS firewall blocks connections:
1. System Settings → Network → Firewall
2. Allow Python or add port 8766 exception

### Resource Monitoring

macOS dashboard uses native `sysctl` and `vm_stat` for:
- CPU usage
- RAM (via `sysctl hw.memsize` + `vm_stat`)
- Disk (via `shutil.disk_usage`)

### Tailscale VPN

For Edge server connectivity:

**Status:** ✅ Installed and connected

**Tailnet Devices:**
- `100.100.46.39` — jose--macbook-pro (macOS) — current machine
- `100.76.16.108` — mainnetedge (linux) — **active**, relay "hel" (Helsinki)
- `100.74.34.40` — zionserver-144 (linux) — offline, last seen 23h ago
- `100.86.102.5` — zionserver (windows)

**SSH Access via Tailscale:**
```bash
# SSH to Edge server
tailscale ssh root@100.76.16.108

# Example output
# MainnetEdge
# 20:30:35 up 10 days,  6:34,  4 users,  load average: 0.27, 0.17, 0.11
```

**Check Status:**
```bash
tailscale status
```

Dashboard auto-detects Tailscale VPN status via `tailscale status`.

## File Structure

```
dashboard/MacOS/
├── start-dashboard-macos.sh      # Launcher script
├── com.zion.dashboard.plist      # launchd agent
└── README.md                     # This file
```

## Troubleshooting

### Port 8766 already in use
```bash
lsof -i :8766
kill -9 <PID>
```

### Python not found
```bash
brew install python3
```

### Logs location
```bash
tail -f logs/dashboard.log
```

## Versions Available

| Version | URL | Description |
|---------|-----|-------------|
| v1 | `http://127.0.0.1:8766/` | HTML/JS monolit (default) |
| v2 | `http://127.0.0.1:8766/` | React SPA (enable via `mv v2/dist.disabled v2/dist`) |
| v3 | `http://127.0.0.1:8766/v3/` | Clean rebuild HTML/JS |

## Desktop App (Tauri)

For native macOS app experience:
```bash
cd APP&WEB/desktop-dashboard
npm install
npm run tauri:dev
```

Build:
```bash
npm run tauri:build
# Output: src-tauri/target/release/bundle/macos/
```
