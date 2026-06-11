# EdgePrimary — ZION V3 Edge-Primary Deployment Topology

> **Date:** 2026-06-02  
> **Topology:** Edge (Hetzner VPS) runs all L1/L2/L3 non-AI services 24/7. Local PC runs backup node, miners, and AI services.  
> **Status:** Active / Mainnet-track

---

## 1. Architecture Overview

```
+-------------------------------------------------------------+
|  EDGE SERVER (Hetzner VPS) — 100.76.16.108 / 77.42.71.94  |
|  Tailscale: mainnetedge                                    |
|                                                             |
|  L1 (Core):                                                |
|    - Node 1 (Primary / Genesis)  → P2P 8333, RPC 8443      |
|    - Node 2 (Follower / Peer)    → P2P 8334, RPC 8446     |
|    - Pool (Primary)              → Stratum 8444            |
|                                                             |
|  L2 (Infrastructure):                                       |
|    - Bridge (Cross-chain relay)  → Metrics 9102            |
|    - DAO (Governance)            → API 8450                |
|    - Atomic Swap (HTLC)          → API 8452                |
|                                                             |
|  L3 (Advanced):                                             |
|    - WARP (Cross-chain relay)    → API 8453                |
|                                                             |
+-------------------------------------------------------------+
                              |
                    Tailscale VPN mesh
                              |
+-------------------------------------------------------------+
|  LOCAL PC (Linux) — 100.74.34.40 / 100.86.102.5 (W11)      |
|  Tailscale: zionserver-144                                 |
|                                                             |
|  L1 (Backup):                                              |
|    - Backup Node               → P2P 8333, RPC 8443        |
|    - Miners (CPU + GPU)        → connect to Edge:8444      |
|                                                             |
|  AI Services:                                               |
|    - Hiranyagarbha API         → 8001                      |
|    - Hiran Inference           → 8002                      |
|                                                             |
|  Dashboard (Python):                                        |
|    - zion-dashboard.service  → http://127.0.0.1:8766      |
|                                                             |
+-------------------------------------------------------------+
```

---

## 2. Edge Server (Hetzner VPS)

### 2.1 Host Details

| Property | Value |
|----------|-------|
| Provider | Hetzner Cloud |
| Public IP | `77.42.71.94` |
| Tailscale IP | `100.76.16.108` |
| Tailscale name | `mainnetedge` |
| OS | Ubuntu 22.04 LTS |
| Working dir | `/root/zion-2.9.6-main/` |
| Data dir | `/root/zion-2.9.6-main/data/` |

### 2.2 Systemd Services

All services are installed in `/etc/systemd/system/` and enabled for auto-start.

| Service | Binary | Description | Restart |
|---------|--------|-------------|---------|
| `zion-edge-node1.service` | `node` | Primary / Genesis node | always |
| `zion-edge-node2.service` | `node` | Follower P2P peer | always |
| `zion-edge-pool.service` | `server` | Primary mining pool | always |
| `zion-edge-bridge.service` | `zion-bridge` | L2 cross-chain relay | always |
| `zion-edge-dao.service` | `zion-dao` | L2 governance | always |
| `zion-edge-atomic-swap.service` | `zion-atomic-swap` | L2 HTLC swaps | always |
| `zion-edge-warp.service` | `zion-warp-server` | L3 cross-chain relay | always |
| `zion-edge-watchdog.timer` | `watchdog.sh` | Healthcheck every 2 min | timer |

### 2.3 Port Matrix

| Service | Port | Protocol | Bind | Purpose |
|---------|------|----------|------|---------|
| Node 1 P2P | 8333 | TCP | `0.0.0.0` | Peer-to-peer sync (seed for all) |
| Node 1 RPC | 8443 | HTTP | `127.0.0.1` | JSON-RPC (pool + L2/L3 upstream) |
| Node 2 P2P | 8334 | TCP | `0.0.0.0` | Peer-to-peer sync (follower) |
| Node 2 RPC | 8446 | HTTP | `127.0.0.1` | JSON-RPC (local only) |
| Node 2 WS | 8447 | WS | `0.0.0.0` | WebSocket |
| Node 2 Metrics | 9116 | HTTP | `0.0.0.0` | Prometheus metrics |
| Pool Stratum | 8444 | TCP | `0.0.0.0` | Miner connections |
| Pool Routing Metrics | 8455 | HTTP | `0.0.0.0` | Prometheus / JSON snapshot |
| DAO API | 8450 | HTTP | `0.0.0.0` | Governance REST API |
| Atomic Swap API | 8452 | HTTP | `0.0.0.0` | HTLC swap REST API |
| WARP API | 8453 | HTTP | `0.0.0.0` | Cross-chain relay REST API |
| Bridge Metrics | 9102 | HTTP | `0.0.0.0` | Prometheus metrics (no HTTP API) |

### 2.4 Environment File

Source: `edge-deploy/config/edge-environment.sh`

```bash
# Fee Split (89/5/5/1 burn model)
ZION_MINER_ADDRESS=zion1w523a76830x2t5m7f3j023w265e8g5c400a4790
ZION_HUMANITARIAN_WALLET=zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4
ZION_ISSOBELLA_WALLET=zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702

# Pool (PRIMARY)
ZION_POOL_BIND=0.0.0.0:8444
ZION_NODE_RPC_ADDR=127.0.0.1:8443
ZION_POOL_LOOP_COUNT=1000000
ZION_NONCE_COUNT=4096
ZION_PPLNS_WINDOW_SIZE=500000
ZION_ROUTING_METRICS_BIND=0.0.0.0:8455

# Pool wallet (handles payouts)
ZION_POOL_WALLET=zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604
ZION_POOL_PAYOUT_SK_HEX=<redacted>

# Atomic Swap escrow key (testnet placeholder — rotate for mainnet)
ZION_SWAP_ESCROW_KEY=0000...0001
```

### 2.5 Node 1 (Primary) Systemd Unit

```ini
[Unit]
Description=ZION Edge Node 1 (Primary / Genesis)
After=network-online.target tailscaled.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/zion-2.9.6-main
EnvironmentFile=/root/zion-2.9.6-main/edge-deploy/config/edge-environment.sh
Environment="ZION_NODE_ID=zion-edge-primary"
Environment="ZION_P2P_BIND=0.0.0.0:8333"
Environment="ZION_RPC_BIND=127.0.0.1:8443"
Environment="ZION_SEED_PEERS=none"
Environment="ZION_NODE_STATE_PATH=/root/zion-2.9.6-main/data/edge-state.db"
ExecStart=/root/zion-2.9.6-main/V3/target/release/node
Restart=always
RestartSec=10
```

### 2.6 Node 2 (Follower) Systemd Unit

```ini
[Unit]
Description=ZION Edge Node 2 (Follower / P2P Peer)
After=network-online.target tailscaled.service zion-edge-node1.service
Requires=zion-edge-node1.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/zion-2.9.6-main
EnvironmentFile=/root/zion-2.9.6-main/edge-deploy/config/edge-environment.sh
Environment="ZION_NODE_ID=zion-edge-follower"
Environment="ZION_P2P_BIND=0.0.0.0:8334"
Environment="ZION_RPC_BIND=127.0.0.1:8446"
Environment="ZION_METRICS_BIND=0.0.0.0:9116"
Environment="ZION_WEBSOCKET_BIND=0.0.0.0:8447"
Environment="ZION_SEED_PEERS=127.0.0.1:8333"
Environment="ZION_NODE_STATE_PATH=/root/zion-2.9.6-main/data/edge2-state.db"
ExecStart=/root/zion-2.9.6-main/V3/target/release/node
Restart=always
RestartSec=10
```

> **Important:** `edge-environment.sh` must NOT contain `ZION_P2P_BIND` or `ZION_NODE_ID` as shared vars — these are per-service overrides in the systemd units. Including them in the shared env file causes port conflicts.

### 2.7 Pool Systemd Unit

```ini
[Unit]
Description=ZION Edge Pool (Primary)
After=network-online.target tailscaled.service zion-edge-node1.service
Requires=zion-edge-node1.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/zion-2.9.6-main
EnvironmentFile=/root/zion-2.9.6-main/edge-deploy/config/edge-environment.sh
ExecStart=/root/zion-2.9.6-main/V3/target/release/server
Restart=always
RestartSec=10
```

### 2.8 WARP Systemd Unit

```ini
[Unit]
Description=ZION Edge WARP (L3 Cross-Chain Relay)
After=network-online.target tailscaled.service zion-edge-node1.service
Requires=zion-edge-node1.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/zion-2.9.6-main
EnvironmentFile=/root/zion-2.9.6-main/edge-deploy/config/edge-environment.sh
Environment="WARP_CONFIG=/root/zion-2.9.6-main/V3/L3/warp/config/warp-testnet.toml"
Environment="RUST_LOG=info,zion_warp=debug"
ExecStart=/root/zion-2.9.6-main/V3/target/release/zion-warp-server
Restart=always
RestartSec=10
```

> **Note:** `zion-warp-server` does NOT read `--config` CLI flag. It only reads `WARP_CONFIG` env var or default paths. The `--config` flag is silently ignored.

### 2.9 Config Files on Edge

| Config | Path | Purpose |
|--------|------|---------|
| Bridge | `V3/L2/bridge/config/bridge-testnet.toml` | Base Sepolia ↔ ZION L1 |
| DAO | *(built-in defaults)* | SQLite at `data/edge-dao.db` |
| Atomic Swap | `V3/L2/atomic-swap/config/swap-testnet.toml` | API on 8452 |
| WARP | `V3/L3/warp/config/warp-testnet.toml` | API on 8453 |

---

## 3. Local PC (Backup + Miners)

### 3.1 Host Details

| Property | Value |
|----------|-------|
| Tailscale IP | `100.74.34.40` (Linux) / `100.86.102.5` (W11) |
| Tailscale name | `zionserver-144` |
| Working dir (Linux) | `/home/zionserver/2.9.6-main/` |
| Working dir (W11) | `C:\Users\yosef\Desktop\Zion\2.9.6-main` |

### 3.2 Local Services

| Service | Script (Linux) | Script (W11) | Purpose |
|---------|----------------|--------------|---------|
| Backup Node | `scripts/launch-local-backup.sh` | `scripts/launch-local-backup.ps1` | Syncs from Edge 100.76.16.108:8333 |
| CPU Miner | `zion-miner` | `zion-miner.exe` | Connects to Edge 100.76.16.108:8444 |
| GPU Miner | `zion-miner` | `zion-miner.exe` | OpenCL, connects to Edge pool |
| Dashboard | `dashboard/app.py` | `dashboard/app.py` | Python dashboard on 8766 |

### 3.3 Backup Node Environment

```bash
# Linux
ZION_NODE_ID='local-backup-node'
ZION_P2P_BIND='0.0.0.0:8333'
ZION_RPC_BIND='0.0.0.0:8443'
ZION_SEED_PEERS='100.76.16.108:8333'        # Edge primary via Tailscale
ZION_NODE_STATE_PATH="$REPO_ROOT/V3/data/zion-node-state.db"
```

```powershell
# Windows 11
$env:ZION_NODE_ID='local-backup-node'
$env:ZION_P2P_BIND='0.0.0.0:8333'
$env:ZION_RPC_BIND='0.0.0.0:8443'
$env:ZION_SEED_PEERS='100.76.16.108:8333'    # Edge primary via Tailscale
$env:ZION_NODE_STATE_PATH='V3\data\zion-node-state.db'
```

### 3.4 Miner Environment

```bash
# Linux
ZION_POOL_ADDR='100.76.16.108:8444'         # Edge pool via Tailscale
ZION_LOOP_COUNT='1000000'                   # Avoid reconnect loops
ZION_GPU_BACKEND='opencl'                   # or 'cpu'
ZION_GPU_WORK_SIZE='4096'
ZION_WORKER_NAME='gpu-worker-local'
ZION_MINER_ID='gpu-miner-local-01'
```

```powershell
# Windows 11
$env:ZION_POOL_ADDR='100.76.16.108:8444'     # Edge pool via Tailscale
$env:ZION_LOOP_COUNT='1000000'
$env:ZION_GPU_BACKEND='opencl'
$env:ZION_GPU_WORK_SIZE='4096'
$env:ZION_WORKER_NAME='gpu-worker-local'
$env:ZION_MINER_ID='gpu-miner-local-01'
```

### 3.5 Dashboard

```bash
# Config: dashboard/config.json
{
  "host": "127.0.0.1",
  "port": 8766,
  "topology": "edge-primary"
}
```

**Linux:**
```bash
# Systemd user service
systemctl --user status zion-dashboard.service
```

**Windows 11:**
```powershell
# Manual start
.\dashboard\start-dashboard.ps1
# Or double-click start-dashboard.bat in repo root
# Auto-start: run install-dashboard-autostart.bat as Administrator
```

---

## 4. Windows 11 Dashboard

> The Python dashboard (`dashboard/app.py`) already runs natively on Windows 11 using PowerShell launchers. A future native desktop app (Tauri/Electron) is optional.

### 4.1 Current W11 Setup (Working)

The Python stdlib dashboard is fully functional on W11:

```powershell
# Manual start (opens browser automatically)
.\dashboard\start-dashboard.ps1
# Or double-click start-dashboard.bat in repo root
```

Features already working:
- Service grid with Edge + Local services
- Color-coded status, port probes, chain height, pool stats
- Start/Stop/Restart buttons for local services
- Log viewer, alerts, auto-start via `install-dashboard-autostart.bat`

### 4.2 Tech Stack Options

| Option | Pros | Cons |
|--------|------|------|
| **Electron + React** | Cross-platform, rich UI, easy charts | Heavy runtime (~100 MB) |
| **Tauri + React/Vue** | Lightweight (~10 MB), Rust backend | Newer ecosystem |
| **WinUI 3 / MAUI** | Native Windows, system tray | Windows-only, steeper curve |
| **WPF + C#** | Full Windows integration | Legacy stack, not cross-platform |

**Recommended:** Tauri (Rust backend aligns with ZION V3 stack) or Electron (proven, fast to build).

### 4.3 Feature Roadmap

#### Phase 1 — Read-Only Monitor (MVP)

- [ ] Service grid: Edge Node 1, Edge Node 2, Pool, Bridge, DAO, Atomic Swap, WARP, Local Node, Miners
- [ ] Color-coded status (green/yellow/red)
- [ ] Port probe via Tailscale (TCP check to 100.76.16.108)
- [ ] Chain height display (fetch from local RPC + Edge RPC)
- [ ] Pool stats: active miners, hashrate, blocks found (scrape 8455)
- [ ] Miner hashrate chart (parse miner.log)
- [ ] System tray icon with status tooltip

#### Phase 2 — Control Surface

- [ ] Start/Stop/Restart buttons for local services (node, miners)
- [ ] Auto-start on Windows boot (Task Scheduler integration)
- [ ] Tailscale status check (warn if VPN down)
- [ ] Log viewer (tail local logs with color highlighting)
- [ ] Alert notifications (service down, low hashrate, sync lag)

#### Phase 3 — Advanced

- [ ] Payout history table (from pool logs)
- [ ] Fee split visualization (89/5/5/1 pie chart)
- [ ] Wallet balance display (query RPC)
- [ ] Bridge transaction monitor (L1 ↔ EVM)
- [ ] AI chat tab (connect to Hiranyagarbha 8001)
- [ ] Dark/light theme toggle

### 4.4 Architecture Sketch

```
W11 Dashboard (Tauri/Electron)
  ├── Frontend (React + Recharts)
  │     ├── ServiceGrid.tsx      # Edge + Local services
  │     ├── ChainMonitor.tsx     # Height, sync status
  │     ├── PoolStats.tsx        # Hashrate, miners, blocks
  │     ├── MinerControl.tsx       # Start/stop buttons
  │     ├── LogViewer.tsx        # Tail local logs
  │     └── Settings.tsx         # Config, autostart
  │
  └── Backend (Rust / Node.js)
        ├── tcp_probe.rs           # Port checks via Tailscale
        ├── rpc_client.rs          # JSON-RPC to local + Edge
        ├── log_parser.rs          # Parse miner.log / node.log
        ├── process_manager.rs     # Start/stop binaries
        └── system_tray.rs         # Windows native tray
```

### 4.5 Data Sources

| Data | Source | Endpoint / File |
|------|--------|-----------------|
| Edge service health | TCP probe | `100.76.16.108:{port}` |
| Local service health | TCP probe | `127.0.0.1:{port}` |
| Chain height | JSON-RPC | `127.0.0.1:8443/jsonrpc` or `100.76.16.108:8443` |
| Pool stats | Prometheus | `100.76.16.108:8455/metrics` |
| Miner hashrate | Log parse | `logs/miner.log` |
| Node sync status | Log parse | `logs/node1.log` |

### 4.6 Windows Task Scheduler Setup (Auto-start)

```powershell
# PowerShell script to register auto-start
$action = New-ScheduledTaskAction -Execute "zion-dashboard.exe" -WorkingDirectory "C:\ZION\dashboard"
$trigger = New-ScheduledTaskTrigger -AtLogon
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "ZION Dashboard" -Action $action -Trigger $trigger -Settings $settings
```

### 4.7 File Layout

```
APP&WEB/desktop-agent-v2/          # or new top-level folder
├── src-tauri/                       # Rust backend (Tauri)
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       ├── tcp_probe.rs
│       ├── rpc_client.rs
│       └── process_manager.rs
├── src/                             # React frontend
│   ├── App.tsx
│   ├── components/
│   └── styles/
├── public/
├── package.json
├── tauri.conf.json
└── README.md
```

### 4.8 Open Questions

1. Should the W11 dashboard also run on Linux? (Yes — use Tauri for cross-platform)
2. Should it replace the Python dashboard entirely? (No — keep Python as fallback/lightweight option)
3. How to handle Tailscale auth checks? (Ping 100.76.16.108, warn if DERP-only)

---

## 5. Operational Commands

### 5.1 Edge Server Commands

```bash
# Check all services
ssh root@100.76.16.108 "systemctl is-active zion-edge-node1 zion-edge-node2 zion-edge-pool zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp"

# View logs
ssh root@100.76.16.108 "journalctl -u zion-edge-node1 -f --no-pager"
ssh root@100.76.16.108 "journalctl -u zion-edge-pool -f --no-pager"

# Restart a service
ssh root@100.76.16.108 "systemctl restart zion-edge-node2"

# Check ports
ssh root@100.76.16.108 "ss -tlnp | grep -E '8333|8334|8444|8450|8452|8453|8455|9102'"

# Edge RPC health
ssh root@100.76.16.108 "curl -s http://127.0.0.1:8443/health"
```

### 5.2 Local PC Commands

```bash
# Start local stack
bash scripts/launch-local-backup.sh

# Start dashboard
systemctl --user start zion-dashboard.service

# Check local node
bash scripts/node-status.sh

# Watch logs
bash scripts/watch-logs.sh

# Stop everything
bash scripts/stop-stack.sh
```

### 5.3 Tailscale Connectivity Check

```bash
# Verify VPN
nc -z -w2 100.76.16.108 8333 && echo "Node 1 OK"
nc -z -w2 100.76.16.108 8334 && echo "Node 2 OK"
nc -z -w2 100.76.16.108 8444 && echo "Pool OK"
nc -z -w2 100.76.16.108 8450 && echo "DAO OK"
nc -z -w2 100.76.16.108 8452 && echo "Atomic Swap OK"
nc -z -w2 100.76.16.108 8453 && echo "WARP OK"
nc -z -w2 100.76.16.108 8455 && echo "Pool Metrics OK"
nc -z -w2 100.76.16.108 9102 && echo "Bridge Metrics OK"
```

---

## 6. Troubleshooting

### 6.1 Edge Node 2: Port Already in Use

**Symptom:** `failed to bind P2P listener: Address already in use (os error 98)`

**Cause:** `edge-environment.sh` contains `ZION_P2P_BIND=0.0.0.0:8333` which overrides the per-service `Environment=` directive.

**Fix:** Remove `ZION_P2P_BIND` and `ZION_NODE_ID` from `edge-environment.sh`. These must be set only in individual systemd units.

### 6.2 Edge Node 2: Peer Sync Failed

**Symptom:** `peer_sync_failed reason=peer batch block at height N does not link to expected parent ...`

**Cause:** `edge2-state.db` has diverged from the chain that Node 1 is serving.

**Fix:**
```bash
ssh root@100.76.16.108 "systemctl stop zion-edge-node2; rm -f /root/zion-2.9.6-main/data/edge2-state.db; cp /root/zion-2.9.6-main/data/edge-state.db /root/zion-2.9.6-main/data/edge2-state.db; systemctl start zion-edge-node2"
```

### 6.3 Pool: Address Already in Use

**Symptom:** `failed to bind pool listener on 0.0.0.0:8444`

**Cause:** Old pool process (not managed by systemd) is holding the port.

**Fix:**
```bash
ssh root@100.76.16.108 "ss -tlnp | grep 8444; kill -9 <PID>; systemctl restart zion-edge-pool"
```

### 6.4 WARP: Wrong Port (9333 instead of 8453)

**Symptom:** WARP listens on `0.0.0.0:9333`

**Cause:** The systemd unit passes `--config` CLI flag, but `zion-warp-server` ignores CLI flags entirely. It only reads `WARP_CONFIG` env var or default paths.

**Fix:** Remove `--config` from `ExecStart` and set `Environment="WARP_CONFIG=/path/to/warp-testnet.toml"`. Ensure the config file contains `listen_port = 8453`.

### 6.5 Atomic Swap: Missing Escrow Key

**Symptom:** `Invalid escrow key: ZION_SWAP_ESCROW_KEY not set`

**Fix:** Add `ZION_SWAP_ESCROW_KEY=<64-char-hex>` to `edge-environment.sh`.

### 6.6 Dashboard Shows Services as DOWN

**Symptom:** Dashboard intermittently marks edge services as DOWN despite `nc` confirming ports are open.

**Cause:** `tcp_probe` timeout (1.5s for remote hosts) is too aggressive for Tailscale DERP relay connections.

**Workaround:** Use `nc -z -w5` for manual verification. Dashboard health cache (5s TTL) may show stale results during high latency spikes.

---

## 7. Deployment Procedure

### 7.1 First-Time Edge Setup

```bash
# 1. Sync code to Edge
rsync -avz --relative ./V3 ./edge-deploy root@100.76.16.108:/root/zion-2.9.6-main/

# 2. Build on Edge (or copy local binaries)
ssh root@100.76.16.108 "cd /root/zion-2.9.6-main && cargo build --manifest-path V3/Cargo.toml --workspace --release"

# 3. Install systemd units
ssh root@100.76.16.108 "bash /root/zion-2.9.6-main/edge-deploy/setup-edge.sh"

# 4. Start core services
ssh root@100.76.16.108 "systemctl start zion-edge-node1"
sleep 5
ssh root@100.76.16.108 "systemctl start zion-edge-node2 zion-edge-pool"
sleep 5
ssh root@100.76.16.108 "systemctl start zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp"

# 5. Verify
bash edge-deploy/check-edge.sh
```

### 7.2 Update Edge Binaries

```bash
# After local build, copy release binaries to Edge
rsync -avz V3/target/release/node V3/target/release/server \
  V3/target/release/zion-bridge V3/target/release/zion-dao \
  V3/target/release/zion-atomic-swap V3/target/release/zion-warp-server \
  root@100.76.16.108:/root/zion-2.9.6-main/V3/target/release/

# Restart all services
ssh root@100.76.16.108 "systemctl daemon-reload; systemctl restart zion-edge-node1 zion-edge-node2 zion-edge-pool zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp"
```

### 7.3 Local PC Setup

```bash
# Build locally
cargo build --release --manifest-path V3/Cargo.toml --workspace

# Install dashboard systemd user service
mkdir -p ~/.config/systemd/user
cp dashboard/zion-dashboard.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable zion-dashboard.service

# Start local stack
bash scripts/launch-local-backup.sh

# Start dashboard
systemctl --user start zion-dashboard.service
```

---

## 8. Fee Split Model (89/5/5/1 Burn)

| Recipient | Share | Address |
|-----------|-------|---------|
| Miner | 89% | `zion1w523a76830x2t5m7f3j023w265e8g5c400a4790` |
| Humanitarian | 5% | `zion1s29403j538w6p6n0p783l6w5v6t254c0380c2d4` |
| Issobella | 5% | `zion140n8a8t6f3083232r0g6c498r6c0d423f4h9702` |
| Pool Fee | 1% | **Burned** (no wallet) |

Block subsidy: 5.4 ZION  
Miner reward: 4.806 ZION (89%)  
Humanitarian: 0.27 ZION (5%)  
Issobella: 0.27 ZION (5%)  
Burned: 0.054 ZION (1%)

---

## 9. Related Documentation

- `V3/docs/EDGE_PRIMARY_DEPLOY_2026-06-02.md` — Original deploy report
- `V3/docs/CLI_DEPLOY_PLAYBOOK.md` — CLI deployment guide
- `V3/docs/MAINNET_DEPLOY_RUNBOOK.md` — Mainnet runbook
- `AGENTS.md` — Devin / agent operating rules
- `StatusV3.md` — Current status and launch blockers
- `HIRAN_LOCAL_SETUP.md` — Hiran v2.2 local inference guide

---

*Document version: 2026-06-02*  
*Last updated: 2026-06-02*  
*Maintainer: ZION Core Dev*
