# Zion OS - ZION Mainnet Operations System

## Overview

Zion OS je komplexní interní systém pro správu celého ZION Mainnetu. Centralizuje dashboard, desktop agenta, mobile app, automatické aktualizace a monitoring do jednotné platformy.

## Architecture

**Central Dashboard + Distributed Components:**
- **Central Dashboard:** Hlavní kontrolní centrum (web + API)
- **Desktop Agent:** Správa lokálních node a GPU mining
- **Mobile App:** Mobilní přístup a notifikace
- **Auto-Update System:** Automatické aktualizace komponent
- **Monitoring:** Real-time sledování a alerting
- **Node Detection:** Automatická detekce a správa node
- **Pool Management:** Správa mining poolů
- **Mining Agent:** Multi-GPU mining (CUDA, AMD, Metal)

## Components

### 1. Central Dashboard
- **Location:** `dashboard/`
- **Tech:** Python Flask + React v1 (HTML) + React v2 (SPA)
- **Features:**
  - Multi-node detection panel
  - Real-time monitoring
  - Service health tracking
  - L1-L6 service grid
  - Alert system
  - Wallet management
  - Block explorer

### 2. Desktop Agent
- **Location:** `APP&WEB/desktop-agent/`
- **Tech:** Electron + Rust + Python
- **Features:**
  - Node management (start/stop/restart)
  - GPU mining control
  - Auto-update
  - System tray
  - Native metrics polling
  - L1-L6 service grid
  - Chain/pool/miner panels

### 3. Mobile App
- **Location:** `APP&WEB/mobile-app/`
- **Tech:** React Native
- **Features:**
  - Mobile monitoring
  - Push notifications
  - Quick actions
  - Wallet access
  - Node status

### 4. Auto-Update System
- **Location:** `ZION_OS/auto-update/`
- **Tech:** Rust + Git
- **Features:**
  - Semantic versioning
  - Rollback capability
  - Delta updates
  - Signature verification
  - Schedule updates

### 5. Monitoring & Alerting
- **Location:** `ZION_OS/monitoring/`
- **Tech:** Prometheus + Grafana + Alertmanager
- **Features:**
  - Metrics collection
  - Alert rules
  - Dashboard integration
  - Notification channels

### 6. Node Detection
- **Location:** `dashboard/nodes.json` + `dashboard/app.py`
- **Tech:** Python + RPC probes
- **Features:**
  - Auto-detection via RPC
  - Port scanning
  - Tailscale VPN integration
  - Health checks
  - Priority management

### 7. Mining Agent
- **Location:** `APP&WEB/mining-agent/`
- **Tech:** Rust + GPU backends
- **Features:**
  - Multi-GPU support (CUDA, AMD, Metal)
  - Pool integration
  - Performance monitoring
  - Auto-tuning
  - Failover

### 8. ZION Agent (Rig OS)
- **Location:** `agent/`
- **Tech:** Rust (Tokio + Axum)
- **Features:**
  - Autonomous mining rig control
  - Real-time miner stdout parsing (hashrate, shares)
  - GPU telemetry (AMD sysfs, NVIDIA NVML)
  - Watchdog engine (expression-based rules + self-healing)
  - OC manager (AMD power/fan/DPM sysfs writer)
  - Fleet dashboard integration
  - OTA auto-updates
  - Systemd service deployment

## Platform Support

### macOS
- Dashboard: ✅
- Desktop Agent: ✅
- Mining Agent: ✅ (Metal)
- Auto-update: ✅

### Windows
- Dashboard: ✅
- Desktop Agent: ✅
- Mining Agent: ⏳ (CUDA)
- Auto-update: ✅

### Linux
- Dashboard: ✅
- Desktop Agent: ⏳
- Mining Agent: ⏳ (AMD)
- Auto-update: ✅

## Directory Structure

```
ZION_OS/
├── README.md                 # Tento soubor
├── IMPLEMENTATION_PLAN.md     # Implementation plan
├── dashboard/               # Central dashboard
│   ├── app.py              # Python Flask backend
│   ├── dashboard.html      # v1 HTML dashboard
│   ├── dashboard.js        # v1 JS logic
│   ├── v2/                 # v2 React SPA
│   ├── nodes.json          # Node detection config
│   ├── MacOS/              # macOS specific setup
│   ├── Ubuntu/             # Ubuntu specific setup
│   └── Windows/            # Windows specific setup
├── desktop-dashboard/      # Desktop Tauri app
│   ├── src/                # Tauri main + renderer
│   └── src-tauri/          # Rust backend
├── mobile-app/             # React Native app
│   ├── src/                # React Native source
│   └── android/ios/        # Platform specific
├── agent/                  # ZION Agent (Rig OS)
│   ├── Cargo.toml          # Rust workspace
│   ├── src/                # Core modules
│   ├── systemd/            # systemd service units
│   ├── build.sh            # Linux/macOS build script
│   ├── build.ps1           # Windows build script
│   └── README.md           # Agent documentation
├── mining-agent/           # Multi-GPU mining
│   ├── Cargo.toml          # Rust project
│   ├── src/main.rs         # Agent logic
│   └── test_e2e_pool.sh    # E2E test
├── auto-update/             # Auto-update system (TODO)
│   ├── Cargo.toml          # Rust project
│   └── src/               # Update logic
└── monitoring/             # Monitoring stack (TODO)
    ├── prometheus/        # Prometheus config
    ├── grafana/           # Grafana dashboards
    └── alertmanager/      # Alert rules
```

## Quick Start

### 1. Start Central Dashboard
```bash
cd ZION_OS/dashboard
python3 app.py
# Open http://127.0.0.1:8766
```

### 2. Start Desktop Dashboard
```bash
cd ZION_OS/desktop-dashboard
npm install
cargo tauri dev --manifest-path src-tauri/Cargo.toml
```

### 3. Start ZION Agent (Rig OS)
```bash
cd ZION_OS/agent
./build.sh --release
sudo cp target/release/zion-agent /usr/local/bin/
sudo systemctl enable --now zion-agent
# API na http://localhost:8767
```

### 4. Start Mining Agent (legacy)
```bash
cd ZION_OS/mining-agent
cargo build --release --features gpu-metal
./target/release/mining-agent --pool 100.76.16.108:8444 --backend auto
```

### 4. Check Node Detection
```bash
curl http://127.0.0.1:8766/api/nodes
```

## API Endpoints

### Dashboard API
- `GET /api/status` - Overall status
- `GET /api/nodes` - Node detection
- `GET /api/checklist` - Launch checklist
- `GET /api/alerts` - Active alerts
- `GET /api/history` - Metrics history

### Desktop Agent API
- `POST /api/node/start` - Start node
- `POST /api/node/stop` - Stop node
- `POST /api/node/restart` - Restart node
- `POST /api/miner/start` - Start miner
- `POST /api/miner/stop` - Stop miner
- `GET /api/metrics` - System metrics

### Mining Agent API
- `GET /api/stats` - Mining statistics
- `GET /api/gpu` - GPU information
- `POST /api/backend/switch` - Switch GPU backend

## Configuration

### Node Detection
```json
{
  "nodes": {
    "edge-primary": {
      "host": "100.76.16.108",
      "rpc_port": 8443,
      "platform": "linux",
      "role": "primary"
    }
  }
}
```

### Platform Setup
- **macOS:** `dashboard/MacOS/`
- **Windows:** `dashboard/Windows/`
- **Ubuntu:** `dashboard/Ubuntu/`

## Security

- **SSH Keys:** Tailscale VPN for secure access
- **API Authentication:** JWT tokens
- **Wallet Security:** Encrypted storage
- **Update Verification:** Signature checking

## Monitoring

### Key Metrics
- Node health and sync status
- Pool performance
- Mining hashrate
- Network latency
- System resources
- Alert response time

### Alerting
- Node down alerts
- Pool connection failures
- Mining performance drops
- Update failures
- Security events

## Development

### Adding New Component
1. Create directory in `ZION_OS/`
2. Implement component with API
3. Add to central dashboard
4. Update documentation
5. Add monitoring

### Testing
- Unit tests for each component
- Integration tests for API
- E2E tests for full system
- Load testing for pool

## Roadmap

### Phase 1 (Current)
- ✅ Central dashboard with node detection
- ✅ Platform-specific setup
- ✅ Mining agent with Metal support
- ✅ Tailscale VPN integration
- ✅ ZION Agent — core (API, miner control, telemetry, watchdog, OC)
- ⏳ ZION Agent — fleet integration + rig OS image
- ⏳ Desktop agent integration
- ⏳ Mobile app basic features

### Phase 2
- ⏳ Auto-update system
- ⏳ Monitoring stack (Prometheus + Grafana)
- ⏳ Alerting system
- ⏳ Desktop agent full features
- ⏳ Mobile app full features

### Phase 3
- ⏳ CUDA backend for mining agent
- ⏳ AMD backend for mining agent
- ⏳ Advanced auto-update
- ⏳ Multi-cluster support
- ⏳ AI-powered optimization

## License

MIT License - ZION Project
