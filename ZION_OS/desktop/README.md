# ZION V3 Dashboard — Tauri Desktop App

Desktop dashboard for ZION V3 Edge-Primary topology. Built with **Tauri v2** + **React 19** + **Vite** + **Tailwind CSS** + **Recharts**.

## Architecture

- **Backend**: Rust (Tauri) — thin wrapper, all business logic stays in Python `ZION_OS/dashboard/app.py`
- **Frontend**: React — talks to Python dashboard via HTTP on `127.0.0.1:8766`
- **Topology-aware**: Automatically shows Edge/Local services based on `topology` field from `/api/status`
- **Design system**: Zion theme from `docs/3.0.3/ZIONTHEME.md` + website v2.9 (glass panels, gold/purple/cyan accents)

## Prerequisites

- [Rust](https://rustup.rs/)
- [Node.js](https://nodejs.org/) 20+
- Tauri CLI: `cargo install tauri-cli --version ^2.0.0`

## Setup

```bash
cd ZION_OS/desktop
npm install
```

## Development

```bash
# Copy the example env file and fill in the Basic Auth credentials
cp .env.local.example .env.local

# Terminal 1: start Python dashboard backend
cd ../dashboard
python app.py

# Terminal 2: start Tauri dev mode
cd ZION_OS/desktop
npm run tauri:dev
```

## Build

```bash
cd ZION_OS/desktop
cargo tauri build
```

Output: `src-tauri/target/release/bundle/` (`.msi` on Windows, `.deb` on Linux)

## Tab Layout

| Tab | Panels |
|-----|--------|
| **Overview** | Readiness, Launch Checklist, Edge & Local Backup, Service Grid, Monitoring, Chain Status, Alerts |
| **Mining** | Miner, Pool, Performance Charts, Hashrate Chart, Revenue & Pool Accounting, AuxPow Config |
| **Network** | Chain Status, Mempool, Edge Agent, Wallets, Explorer, Alert History |
| **Ecosystem** | Layer Status (L1-L6), DeFi, Bridge Relay, CEX+DEX, WARP Corridors, DAO Proposals |
| **Operations** | Service Controls, Backups, Security, Log Viewer |

## Features

- **Tabbed command center** with all major dashboard metrics from `app.py`
- **Service Grid**: Live/degraded/down status for all Edge + Local services (L1-L6 + Infra)
- **Miner Panel**: Hashrate, shares, device info, algorithm switch, Start/Stop/Restart controls
- **Pool Panel**: Active miners, blocks found, fee split, payout wallet, miner table
- **Chain Sync**: Edge height vs Local height with sync gap visualization
- **Alerts**: Real-time alerts with severity colors and Fix actions
- **Performance Charts**: Rolling hashrate history via Recharts
- **Edge Monitoring**: Prometheus + Grafana status panel with live target health
- **Auto-refresh**: 5s polling with toggle button
- **Desktop notifications** for critical alerts

## Icons

Place icon files in `src-tauri/icons/`:
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)

Generate from a PNG via [tauri.app/v1/guides/features/icons](https://tauri.app/v1/guides/features/icons/):
```bash
cargo tauri icon /path/to/source.png
```
