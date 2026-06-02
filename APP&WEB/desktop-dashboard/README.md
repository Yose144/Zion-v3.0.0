# ZION V3 Dashboard — Tauri Desktop App

Desktop dashboard for ZION V3 Edge-Primary topology. Built with **Tauri v2** + **React 19** + **Vite** + **Tailwind CSS** + **Recharts**.

## Architecture

- **Backend**: Rust (Tauri) — thin wrapper, all business logic stays in Python `dashboard/app.py`
- **Frontend**: React — talks to Python dashboard via HTTP on `127.0.0.1:8766`
- **Topology-aware**: Automatically shows Edge/Local services based on `topology` field from `/api/status`

## Prerequisites

- [Rust](https://rustup.rs/)
- [Node.js](https://nodejs.org/) 20+
- Tauri CLI: `cargo install tauri-cli --version ^2.0.0`

## Setup

```bash
cd APP&WEB/desktop-dashboard
npm install
```

## Development

```bash
# Terminal 1: start Python dashboard backend
cd ../../dashboard
python app.py

# Terminal 2: start Tauri dev mode
cd APP&WEB/desktop-dashboard
cargo tauri dev
```

## Build

```bash
cargo tauri build
```

Output: `src-tauri/target/release/bundle/` (`.msi` on Windows)

## Features

- **Service Grid**: Live/degraded/down status for all Edge + Local services (L1/L2/L3)
- **Miner Panel**: Hashrate, shares, device info, Start/Stop/Restart controls
- **Pool Panel**: Active miners, blocks found, fee split, payout wallet
- **Chain Sync**: Edge height vs Local height with sync gap visualization
- **Alerts**: Real-time alerts with severity colors and Fix actions
- **Performance Chart**: Rolling hashrate history via Recharts
- **Edge Monitoring**: Prometheus + Grafana status panel with live target health
- **Auto-refresh**: 3s polling with toggle button

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
