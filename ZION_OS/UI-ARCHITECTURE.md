# Zion OS UI Architecture — "RTX Spark" Edition

## Vize

Zion OS UI je GPU-akcelerovaný, real-time operations dashboard inspirovaný NVIDIA DGX Spark monitoringem. Cílem je sci-fi/cyberpunk vizuální zážitek s nativním výkonem — jako bys ovládal kosmickou loď, ne webovou stránku.

## Tech Stack

| Vrstva | Technologie | Důvod |
|--------|-------------|-------|
| **Desktop Shell** | Tauri v2 (Rust) | Nativní výkon, system tray, Rust IPC, menší než Electron |
| **Renderer** | React 18 + TypeScript | Komponentový model, ekosystém |
| **3D / GPU Viz** | React Three Fiber (Three.js) + WebGPU | 3D topologie sítě, GPU-accelerované vizualizace |
| **2D Grafy** | Custom Canvas (zero-deps) + visx | GPU-friendly, žádné pomalé SVG/DOM knihovny |
| **UI Komponenty** | shadcn/ui + Tailwind CSS | Glassmorphism, cyberpunk dark theme |
| **Real-time** | Tauri Events + WebSocket fallback | Native IPC pro lokální, WS pro vzdálené |
| **Stav** | Zustand | Lehký, neblocking |
| **Backend** | Rust Axum (embedded v Tauri) | WebSocket broadcast, hardware polling |

## Klíčové Funkce (RTX Spark Inspired)

### 1. 3D Network Topology
- **React Three Fiber** scéna s node grafem
- Edge = Tailscale VPN tunely, Core = lokální PC, macOS = Apple Silicon
- Animované datové toky mezi nody (particle systems)
- Hover na node = detailní panel s metrikami
- OrbitControls pro rotaci/zoom

### 2. GPU Metrics (Arc Gauges)
- **Metal / CUDA / OpenCL** utilization gauges
- Teplota, power draw, memory VRAM
- Per-core CPU heatmap (canvas)
- Real-time sparklines (60s historie)

### 3. Real-time Stream
- **WebSocket** nebo **Tauri Events** pro push metrik
- 1s interval pro hardware, 10s pro blockchain
- Server-Sent Events jako fallback
- Staleness detection (blink red když data zestárnou)

### 4. Glassmorphism UI
- Transparentní panely s backdrop-blur
- Neon accent colors podle stavu (green=OK, yellow=warn, red=critical)
- Monospace font pro technická data (JetBrains Mono)
- Gradient borders, glow efekty

### 5. Service Grid
- L1-L6 služby jako "karty" s 3D tilt efektem
- Start/Stop/Restart s haptickou odezvou
- Dependency graf (co závisí na čem)
- Log tail přímo v kartě (ANSI colors)

## Adresářová Struktura

```
ZION_OS/ui/
├── Cargo.toml                    # Tauri v2 workspace
├── tauri/
│   ├── src/
│   │   ├── main.rs              # Tauri entrypoint
│   │   ├── commands.rs          # Tauri commands (start/stop/status)
│   │   ├── hardware.rs          # GPU/CPU metrics polling (NVML, Metal)
│   │   ├── websocket.rs         # WS server pro real-time
│   │   └── orchestrator.rs      # Manifest loader + service control
│   └── Cargo.toml
├── src/                         # React frontend
│   ├── main.tsx
│   ├── App.tsx
│   ├── stores/
│   │   └── orchestratorStore.ts # Zustand store
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── GpuGauge.tsx     # Arc gauge (canvas)
│   │   │   ├── CpuHeatmap.tsx   # Per-core heatmap
│   │   │   └── Sparkline.tsx    # Mini time-series
│   │   ├── three/
│   │   │   ├── NetworkScene.tsx # 3D topologie
│   │   │   ├── NodeMesh.tsx     # 3D node reprezentace
│   │   │   └── DataParticles.tsx # Animované toky
│   │   ├── ui/
│   │   │   ├── ServiceCard.tsx  # Glassmorphism karta
│   │   │   ├── LogTail.tsx      # ANSI log viewer
│   │   │   ├── AlertBanner.tsx  # Toast notifikace
│   │   │   └── Sidebar.tsx      # Navigace
│   │   └── layout/
│   │       ├── DashboardLayout.tsx
│   │       └── GridLayout.tsx
│   ├── hooks/
│   │   ├── useHardwareMetrics.ts
│   │   ├── useWebSocket.ts
│   │   └── useServiceControl.ts
│   ├── lib/
│   │   ├── colors.ts            # Cyberpunk palette
│   │   ├── metrics.ts           # Metrika normalizace
│   │   └── utils.ts
│   └── styles/
│       └── globals.css          # Tailwind + custom glow
└── package.json
```

## Hardware Polling (Rust)

### macOS (Metal)
```rust
// Použití metal crate pro GPU metriky
// Použití sysinfo crate pro CPU/RAM
// IOKit pro teploty
```

### Linux (NVIDIA)
```rust
// nvml-wrapper crate pro NVIDIA GPU
// sysinfo pro CPU/RAM
// lm-sensors pro teploty
```

### Windows
```rust
// nvml-wrapper pro NVIDIA
// wmi pro CPU/RAM
// Windows Performance Counters
```

## WebSocket Protocol

```json
{
  "type": "metrics",
  "timestamp": "2026-06-03T23:45:00Z",
  "data": {
    "cpu": {"usage": 45.2, "cores": [12, 34, 56, ...], "temp": 65},
    "gpu": {"usage": 89.5, "vram": 12.4, "temp": 72, "power": 280},
    "memory": {"total": 32, "used": 18.5, "free": 13.5},
    "services": {
      "zion-node": {"state": "running", "pid": 1234, "uptime": 3600},
      "zion-pool": {"state": "running", "pid": 5678}
    },
    "network": {"rx": 12.5, "tx": 8.3}
  }
}
```

## Cyberpunk Color Palette

```css
:root {
  --zion-bg: #0a0a0f;
  --zion-panel: rgba(20, 20, 35, 0.7);
  --zion-border: rgba(100, 200, 255, 0.2);
  --zion-glow: 0 0 20px rgba(0, 255, 200, 0.3);
  --accent-ok: #00ffaa;
  --accent-warn: #ffcc00;
  --accent-critical: #ff3366;
  --accent-info: #00ccff;
  --text-primary: #e0e0e0;
  --text-dim: #888899;
}
```

## Build

```bash
cd ZION_OS/ui
npm install
# Dev s HMR
cargo tauri dev
# Production build
cargo tauri build
```

## Rozdíly oproti existujícímu desktop-dashboard

| | Staré desktop-dashboard | Nový Zion OS UI |
|---|---|---|
| Framework | Tauri v2 + React | Tauri v2 + React + R3F |
| Vizualizace | 2D statické | 3D + GPU gauges + particles |
| Real-time | HTTP polling 5s | WebSocket push 1s |
| Hardware | Žádné | GPU/CPU/thermal monitoring |
| Theme | Basic dark | Cyberpunk glassmorphism |
| Logs | Statické | ANSI colored tail |

## Fáze Implementace

1. **Fáze 1:** Základní Tauri + React + shadcn/ui shell
2. **Fáze 2:** Service grid s glassmorphism kartami
3. **Fáze 3:** Real-time WebSocket + Rust hardware polling
4. **Fáze 4:** 3D network topology (R3F)
5. **Fáze 5:** GPU arc gauges + CPU heatmap (canvas)
6. **Fáze 6:** Log tail + alerting UI
7. **Fáze 7:** Mobile companion (React Native)
