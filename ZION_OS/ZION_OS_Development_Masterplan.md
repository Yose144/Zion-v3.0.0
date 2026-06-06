# ZION OS — Vyvojovy Masterplan
## Kompletni orchestracni system pro ZION Mainnet & Mining Ekosystem
### Verze: 1.0.0 | Datum: 2026-06-05 | Status: ACTIVE DEVELOPMENT
### Dashboard konsolidace: ✅ HOTOVO | Zion Agent: ✅ BUILD READY | Fleet Dashboard: ✅ SKELETON

---

## 1. VIZE: Co je ZION OS

ZION OS neni "jen dalsi mining OS". Je to **kompletni operacni system** postaveny na Ubuntu, ale kompletne prizpusobeny pro:

- **ZION Mainnet orchestraci** (node, pool, bridge, DAO, WARP)
- **Autonomni mining rig management** (boot z flash, zero-config)
- **Decentralizovanou spravu farm** (Hive-like fleet control)
- **Pripavu na ZION Oasis** (self-hosted cloud, sovereign compute)

### Filozofie OS

| Princip | Popis |
|---------|-------|
| **Local-first** | Rig musi fungovat i bez internetu (local node, local pool) |
| **Autonomni boot** | Vloz flash → zapni rig → boot → tezba bezi do 60 sekund |
| **Zero-config** | Auto-detect GPU, auto-pick backend, auto-connect pool |
| **Remote-ready** | Full REST API + WebSocket pro fleet management |
| **Oasis-ready** | Kazdy rig je potencialni Oasis node (compute + storage) |
| **Open source** | MIT licence, zadne vendor lock-in |

---

## 2. ARCHITEKTURA ZION OS

### 2.1 Vrstvy OS

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 6: ZION OASIS (Future)                                      │
│  - Self-hosted cloud (Nextcloud-like na rigu)                     │
│  - Sovereign compute (AI inference, data processing)                │
│  - Distributed storage (IPFS-like na farme)                     │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 5: FLEET & CONTROL (Hive-like)                              │
│  - Web dashboard (React + Rust Axum)                                │
│  - Mobile app (React Native)                                        │
│  - REST API + WebSocket                                             │
│  - Flight sheets, batch ops, OC profiles                            │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 4: ZION MAINNET STACK                                       │
│  - L1: Node + Pool + Miner                                          │
│  - L2: Bridge + DAO + Atomic Swap                                   │
│  - L3: WARP Relay                                                   │
│  - CLI: zion operator tool                                          │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 3: AGENT & SUPERVISOR                                       │
│  - zion-agent (Rust daemon) — miner lifecycle, watchdog            │
│  - GPU telemetry collector (temp, power, fan, hashrate)             │
│  - Auto-healing (restart miner, soft reboot, OC adjust)            │
│  - OTA update service (signed binaries, rollback)                   │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 2: GPU & HARDWARE ABSTRACTION                               │
│  - AMD: ROCm / amdgpu-pro drivers + OpenCL                          │
│  - NVIDIA: CUDA Toolkit + proprietary drivers                       │
│  - Intel: oneAPI + OpenCL                                           │
│  - OC/Power Manager (sysfs, nvidia-smi, rocm-smi)                   │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 1: BASE OS (Ubuntu-based)                                   │
│  - Minimal Ubuntu Server / Ubuntu Core                              │
│  - Tailscale VPN (zero-config mesh)                                 │
│  - Docker + Docker Compose                                          │
│  - SSH + mosh (mobilni SSH)                                         │
│  - zram + early OOM killer tuning                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Komponenty a jejich umisteni

| Komponenta | Cesta | Tech | Status |
|-----------|-------|------|--------|
| **Zion OS Base** | `ZION_OS/distro/` | Ubuntu remix + debootstrap | PLAN |
| **Zion Agent** | `ZION_OS/agent/` | Rust (tokio + axum) | ✅ BUILD READY |
| **Zion Miner** | `V3/L1/miner/` | Rust (OpenCL/CUDA/Metal) | EXISTUJE |
| **Zion Node** | `V3/L1/core/` | Rust | EXISTUJE |
| **Zion Pool** | `V3/L1/pool/` | Rust | EXISTUJE |
| **Fleet Dashboard** | `ZION_OS/fleet-dashboard/` | React + Rust Axum | ✅ BACKEND + FRONTEND SKELETON |
| **OC Manager** | `ZION_OS/oc-manager/` | Rust + sysfs/NVML | PLAN |
| **OTA Service** | `ZION_OS/ota-service/` | Rust + GitHub releases | PLAN |
| **Watchdog** | `ZION_OS/watchdog/` | Rust + rule engine | PLAN |
| **Boot System** | `ZION_OS/boot/` | initramfs + overlayfs + flash detect | PLAN |
| **SMOS Bridge** | `ZION_OS/smos-bridge/` | Python + SMOS API | EXISTUJE (polovina) |
| **Desktop Dashboard** | `ZION_OS/desktop-dashboard/` | Tauri v2 + React | ✅ PURE FRONTEND REFACTOR |
| **Python Dashboard** | `ZION_OS/dashboard/` | Flask + vanilla JS | ✅ KANONICKY BACKEND (8766) |

---

### 2.3 Dashboard Konsolidace (Dokonceno 2026-06-05)

Puvodne existovaly 3 dashboardy s duplicitni logikou. Byly konsolidovany:

```
┌─────────────────────────────────────────────────────────────┐
│  Tauri Desktop App (React shell)                             │
│  - System tray, notifikace, hide-on-close                   │
│  - VŠECHNA data přes HTTP fetch → localhost:8766          │
│  - Žádný Rust business logic                                │
│  - Cesta: ZION_OS/desktop-dashboard/                       │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP
┌────────────────────▼────────────────────────────────────────┐
│  Python Dashboard (app.py) — KANONICKÝ backend               │
│  - 50+ endpointů, log scraping, service control              │
│  - Explorer, mempool, alerts, payouts, genesis               │
│  - Nyní + /api/proxy/rpc a /api/logs/tail pro Tauri        │
│  - Port 8766                                                │
│  - Cesta: ZION_OS/dashboard/                               │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│  V3 Stack (node, pool, miner) + AI + L2/L3                │
└─────────────────────────────────────────────────────────────┘
```

**Zmeny provedene:**
- `desktop-dashboard/src/lib/api.ts` — odstraněn `tauri::invoke`, vše přes `fetch()`
- `desktop-dashboard/src-tauri/src/main.rs` — z 219 řádků → 68 řádků (jen tray + okno)
- `desktop-dashboard/src-tauri/Cargo.toml` — odstraněn `ureq`
- `dashboard/app.py` — přidány endpointy `/api/proxy/rpc` a `/api/logs/tail`

---

## 3. SMOS KOMPONENTA — Boot z Flash

### 3.1 Vize: Flash → Rig → Tezba za 60 sekund

```
Vloz USB flash (16GB+) → Zapni rig → GRUB → Live overlay →
  → Auto-detect GPU → Auto-pick backend →
  → Connect pool (Edge / local / failover) → Mining bezi
```

### 3.2 Boot Architektura

```
USB Flash Partition Layout:
┌─────────────────┬─────────────────┬─────────────────┐
│   p1: EFI       │   p2: OS        │   p3: DATA      │
│   512MB FAT32   │   4GB ext4      │   zbytek ext4   │
│   (bootloader)  │   (squashfs     │   (persistent:   │
│                 │    overlay)     │    config,      │
│                 │                 │    logs, wallet,│
│                 │                 │    cache)       │
└─────────────────┴─────────────────┴─────────────────┘

Boot Flow:
1. GRUB z EFI partition → nacita kernel + initramfs
2. initramfs detekuje: boot z USB? → ano → overlayfs setup
3. Root filesystem = squashfs (read-only) + overlay na DATA partition
4. First-boot detekce: zadna konfigurace? → spusti wizard
5. Normal boot: nacti konfig z DATA, start zion-agent
6. zion-agent: start miner dle flight sheet
```

### 3.3 First-Boot Wizard (headless / web)

```bash
# Headless mode (default na rigu bez monitoru)
# - Rig bootne, zion-agent startne web server na portu 80
# - Admin pripoji z jineho zarizeni: http://rig-ip
# - Wizard kolekce:
#   1. Wallet (generate new / import mnemonic / use pool account model)
#   2. Pool selection (ZION Edge / custom / local solo)
#   3. GPU confirmation (auto-detected list)
#   4. OC profile (conservative / balanced / aggressive)
#   5. Fleet registration (optional — pair with cloud dashboard)
```

### 3.4 Autonomni Rezim (bez interakce)

```json
// /data/zion/config/autonomous.json
{
  "mode": "autonomous",
  "wallet": "zion1...",
  "pool_failover": [
    "77.42.71.94:8444",
    "100.76.16.108:8444",
    "127.0.0.1:8444"
  ],
  "auto_start_miner": true,
  "auto_update": "stable",
  "telemetry": {
    "enabled": true,
    "endpoint": "https://fleet.zionterranova.com",
    "interval_sec": 30
  }
}
```

### 3.5 Flash Image Build Process

```bash
# Zion OS Image Builder
# Soubor: ZION_OS/distro/build-image.sh

# Kroky:
1. debootstrap ubuntu-minimal → chroot
2. Instalace: linux-generic, amdgpu-pro / nvidia-driver, docker
3. Instalace: tailscale, zion-agent, zion-miner, zion-node, zion-pool
4. Konfigurace: overlayfs, zram, ssh, systemd services
5. Vytvoreni squashfs z chroot
6. Pripraveni EFI + squashfs + data skeleton
7. Vystup: zion-os-v1.0.0-amd64.img (flash ready)

# Pouziti:
sudo dd if=zion-os-v1.0.0-amd64.img of=/dev/sdX bs=4M status=progress
# nebo
sudo balenaEtcher zion-os-v1.0.0-amd64.img  # GUI
```

---

## 4. HIVE-LIKE OVLADACI PANEL

### 4.1 Vize: Jednotny dashboard pro vsechny rigy

Funkcni parita s HiveOS/SMOS + rozsireni o ZION-specific features:

| Feature | HiveOS | ZION Fleet |
|---------|--------|------------|
| Rig list + status | ✅ | ✅ + ZION node sync status |
| Teplota / Power / Fan | ✅ | ✅ + predicted failure |
| Hashrate / Shares | ✅ | ✅ + pool-side PPLNS detail |
| OC Profiles | ✅ | ✅ + algo-specific auto-OC |
| Flight Sheets | ✅ | ✅ + L1-L6 service orchestration |
| Remote Shell | ✅ | ✅ + mosh (mobilni friendly) |
| Reboot / Restart | ✅ | ✅ + graceful L1 shutdown |
| Batch operace | ✅ | ✅ + canary rollout |
| Alerting | ✅ | ✅ + Webhook + Telegram + Push |
| Cost | $3/rig/mesic | **ZDARMA** (self-host) |

### 4.2 Fleet Dashboard Architektura

```
┌─────────────────────────────────────────────────────────────┐
│                    ZION FLEET DASHBOARD                      │
│                  (React frontend + Axum API)               │
├─────────────────────────────────────────────────────────────┤
│  React SPA (vite)                                            │
│  - Rig Grid (real-time cards)                               │
│  - Flight Sheet Editor (coin/algo/pool/wallet/args)        │
│  - OC Profile Editor (GPU-specific)                         │
│  - Batch Ops Panel (select → action)                       │
│  - Alert Feed + Acknowledge                                │
│  - Map View (rig locations)                               │
│  - Earnings Calculator (PPLNS + cena)                      │
├─────────────────────────────────────────────────────────────┤
│  Axum REST API + WebSocket                                   │
│  - /api/rigs — CRUD rigu, status, telemetry                │
│  - /api/flight-sheets — CRUD flight sheetu                │
│  - /api/commands — enqueue command, poll result             │
│  - /ws/rigs — real-time rig telemetry stream              │
│  - /api/alerts — alert rules, history, ack               │
│  - /api/oc-profiles — GPU OC database                     │
│  - /api/earnings — payout historie z poolu                │
├─────────────────────────────────────────────────────────────┤
│  SQLite (v1) / PostgreSQL (v2)                              │
│  - rigs, flight_sheets, commands, telemetry_history        │
│  - alerts, oc_profiles, users, audit_log                    │
│  - Migrations via sqlx                                    │
├─────────────────────────────────────────────────────────────┤
│  Agent Communication (mTLS + Tailscale)                     │
│  - Command Queue: dashboard → agent → rig                 │
│  - Telemetry: rig → agent → dashboard                     │
│  - WebSocket push pro real-time UI                        │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Command Queue System

```rust
// ZION_OS/agent/src/command_queue.rs

pub enum Command {
    StartMiner { flight_sheet_id: String },
    StopMiner,
    RestartMiner,
    ApplyOcProfile { profile_id: String },
    Reboot,
    UpdateAgent { version: String },
    UpdateMiner { version: String },
    ExecShell { command: String, timeout_sec: u32 },
    SetFlightSheet { id: String },
}

pub struct CommandEnvelope {
    pub id: Uuid,
    pub rig_id: String,
    pub command: Command,
    pub status: CommandStatus, // Pending, Running, Completed, Failed
    pub created_at: DateTime<Utc>,
    pub acked_at: Option<DateTime<Utc>>,
    pub result: Option<CommandResult>,
}

// Flow:
// 1. Dashboard POST /api/commands → enqueue do SQLite
// 2. Agent na rigu pollne GET /api/commands/pending?rig_id=X
// 3. Agent vykona, POST /api/commands/{id}/ack (acknowledged)
// 4. Agent POST /api/commands/{id}/result (completed/failed + output)
// 5. Dashboard WebSocket posle update vsem pripojenym klientum
```

### 4.4 Watchdog & Self-Healing

```yaml
# /data/zion/config/watchdog.yaml
rules:
  - name: "miner_no_shares"
    condition: "shares_5min == 0 AND hashrate_5min > 0"
    severity: "warning"
    action: "restart_miner"
    cooldown_sec: 300

  - name: "gpu_overheat"
    condition: "gpu_temp_max > 85"
    severity: "critical"
    action: "stop_miner"
    auto_resolve: "gpu_temp_max < 75"

  - name: "miner_crash_loop"
    condition: "miner_restarts_1h > 5"
    severity: "critical"
    action: "reboot_rig"
    cooldown_sec: 3600

  - name: "pool_unreachable"
    condition: "pool_connected == false AND internet_ok == true"
    severity: "warning"
    action: "switch_pool_to_failover"
    cooldown_sec: 60

  - name: "low_hashrate"
    condition: "hashrate < expected_hashrate * 0.7"
    severity: "warning"
    action: "apply_conservative_oc"
    cooldown_sec: 600
```

---

## 5. UBUNTU-BASED ZION DISTRO

### 5.1 Distro Specifikace

```
Nazev:          ZION OS
Base:           Ubuntu 24.04 LTS Server (minimal)
Kernel:         linux-generic-hwe-24.04 + real-time patch (optional)
Init:           systemd
Filesystem:     overlayfs (read-only base + persistent overlay)
Package mgmt:   apt + custom zion-repo
Size (base):    ~2.5 GB squashfs
Flash req:      16GB+ (8GB OS + zbytek data)
```

### 5.2 Predinstalovane Komponenty

| Kategorie | Balicky / Komponenty |
|-----------|---------------------|
| **Base** | ubuntu-minimal, grub-efi-amd64, linux-generic, systemd |
| **Network** | tailscale, curl, wget, net-tools, iproute2, dnsutils |
| **GPU AMD** | amdgpu-pro-install, rocm-opencl, rocm-smi |
| **GPU NVIDIA** | nvidia-driver-550, cuda-toolkit-12, nvidia-smi |
| **GPU Intel** | intel-oneapi-basekit, intel-gpu-tools |
| **Runtime** | docker-ce, docker-compose-plugin |
| **ZION** | zion-agent, zion-miner, zion-node, zion-pool, zion-cli |
| **Monitoring** | node_exporter, smartmontools |
| **Tools** | htop, vim, tmux, mosh, iperf3, stress-ng |

### 5.3 Systemd Services

```
zion-agent.service         — Hlavni agent (miner lifecycle, API)
zion-node.service          — L1 Node (optional, disabled by default)
zion-pool.service          — L1 Pool (optional, disabled by default)
zion-miner.service         — Miner (controlled by agent, not direct)
zion-watchdog.service      — Watchdog pravidla
zion-ota.service           — OTA update checker (timer)
zion-telemetry.service     — Telemetry sender (timer)
tailscale.service          — VPN mesh
node-exporter.service      — Prometheus metrics
```

### 5.4 Bezpecnostni Model

```
- Root filesystem je read-only (squashfs)
- Persistent data na /data partition (encrypted optional LUKS)
- SSH pouze pres Tailscale (neznamy port, key-only auth)
- zion-agent bezi jako neprivilegovany user (zion:zion)
- Miner bezi v Docker/LXC containeru (optional)
- Audit log vsech prikazu
- OTA updates signed (ed25519) + rollback
```

---

## 6. ZION OASIS INTEGRACE

### 6.1 Vize Oasis

**ZION Oasis = kazdy rig je potencialni cloud node.**

Po skonceni tezby / pri nedostatecne ziskovosti se rig sam prekonfiguruje na:
- **Compute node**: AI inference (Hiran v2.2 llama-server), rendering, compiling
- **Storage node**: Distributed file cache, backup target
- **Network node**: DHT relay, VPN exit node, CDN edge

### 6.2 Oasis Architektura (v2.0+)

```
┌──────────────────────────────────────────────────────────────┐
│  ZION OASIS NODE                                              │
│  (bezi vedle / misto mineru na idle rigu)                   │
├──────────────────────────────────────────────────────────────┤
│  Oasis Controller                                             │
│  - Monitoruje profitability (tezba vs. compute rent)        │
│  - Auto-switch: mining ↔ compute podle market ceny          │
│  - Resource scheduling (GPU time-slicing)                   │
├──────────────────────────────────────────────────────────────┤
│  AI Inference (Hiran v2.2)                                   │
│  - llama-server (GGUF) na GPU                               │
│  - OpenAI-compatible API endpoint                          │
│  - Billing: pay-per-token pres ZION network                 │
├──────────────────────────────────────────────────────────────┤
│  Distributed Storage                                         │
│  - IPFS-like content addressing                             │
│  - ZION storage contract (rent space, earn rewards)           │
├──────────────────────────────────────────────────────────────┤
│  Network Services                                            │
│  - DHT bootstrap node                                         │
│  - Tailscale DERP relay (optional)                            │
│  - CDN edge cache                                             │
└──────────────────────────────────────────────────────────────┘
```

### 6.3 Oasis Roadmap

| Faze | Nazev | Obsah | Casovy horizont |
|------|-------|-------|-----------------|
| 0 | **Zaklad** | OS stabilni, miner funkcni, fleet dashboard | Q3 2026 |
| 1 | **Oasis Core** | llama-server integrace, inference API | Q4 2026 |
| 2 | **Oasis Market** | Storage contracts, compute marketplace | Q1 2027 |
| 3 | **Oasis Mesh** | Full distributed compute grid | Q2-Q3 2027 |

---

## 7. IMPLEMENTACNI FAZE

### Faze 0: Zakladni infrastruktura (1-2 tydny)

| # | Ukol | Vystup | Zodpovedny |
|---|------|--------|------------|
| 0.1 | Sjednotit existujici dokumentaci | Tento masterplan | Architekt |
| 0.2 | Vytvorit `ZION_OS/distro/build-image.sh` | Bootovatelny ISO | DevOps |
| 0.3 | Vytvorit `zion-agent` skeleton | Rust projekt + systemd unit | Rust dev |
| 0.4 | Vytvorit flash partition layout | `sfdisk` + `mkfs` skripty | DevOps |
| 0.5 | Overlayfs boot mechanismus | initramfs hook | DevOps |
| 0.6 | First-boot web wizard | Python/Axum mini server | Fullstack |

### Faze 1: Agent & Miner Control (2-3 tydny)

| # | Ukol | Vystup |
|---|------|--------|
| 1.1 | zion-agent: miner process manager | Start/stop/restart mineru |
| 1.2 | zion-agent: GPU telemetry collector | Temp/power/fan/hashrate |
| 1.3 | zion-agent: REST API (Axum) | /api/status, /api/miner/* |
| 1.4 | zion-agent: config management | TOML config, hot reload |
| 1.5 | Watchdog: rule engine | YAML rules, auto-actions |
| 1.6 | OC Manager: sysfs/nvml wrapper | Apply OC profiles |

### Faze 2: Fleet Dashboard (3-4 tydny)

| # | Ukol | Vystup |
|---|------|--------|
| 2.1 | Fleet API (Axum + SQLite) | /api/rigs, /api/commands |
| 2.2 | Command Queue | Enqueue → poll → ack → result |
| 2.3 | WebSocket telemetry stream | Real-time rig data |
| 2.4 | React frontend: Rig Grid | Status karty, filtrovani |
| 2.5 | React frontend: Flight Sheets | Editor, rollout |
| 2.6 | React frontend: Alerts | Feed, ack, rules |
| 2.7 | Auth (JWT + RBAC) | Admin/operator/viewer |

### Faze 3: SMOS/Hive Parita (2-3 tydny)

| # | Ukol | Vystup |
|---|------|--------|
| 3.1 | Batch operace | Multi-select → action |
| 3.2 | Canary rollout | 5% → 25% → 100% |
| 3.3 | Maintenance mode | Drain, stop accepting jobs |
| 3.4 | OC Database | Per-GPU-per-algo profiles |
| 3.5 | PPLNS Earnings integration | Pool payout API → dashboard |
| 3.6 | Mobile app (React Native) | Monitoring + push notifikace |

### Faze 4: Production Hardening (3-4 tydny)

| # | Ukol | Vystup |
|---|------|--------|
| 4.1 | OTA Service | Signed updates, rollback |
| 4.2 | HA Dashboard | Active/passive |
| 4.3 | PostgreSQL migration | SQLite → PG |
| 4.4 | Security audit | Pen test, fuzzing |
| 4.5 | Dokumentace | User guide, runbook, API docs |

---

## 8. ADRESAROVA STRUKTURA (cilova)

```
ZION_OS/
├── README.md                              # Hlavni dokumentace
├── DEVELOPMENT_MASTERPLAN.md              # Tento soubor
├── IMPLEMENTATION_PLAN.md                 # Detailni plan s daty
│
├── distro/                                # OS build system
│   ├── build-image.sh                     # Hlavni build skript
│   ├── chroot-setup.sh                    # Debian bootstrap + packages
│   ├── overlayfs-setup.sh                 # initramfs overlay hook
│   ├── packages/                          # .deb balicky
│   │   ├── zion-agent/
│   │   ├── zion-miner/
│   │   ├── zion-node/
│   │   └── zion-pool/
│   └── skel/                              # Filesystem skeleton
│       ├── etc/systemd/system/
│       ├── etc/zion/
│       └── data/zion/config/
│
├── agent/                                 # Zion Agent (Rust)
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs
│   │   ├── api.rs                         # Axum REST API
│   │   ├── miner_ctl.rs                   # Miner process manager
│   │   ├── telemetry.rs                   # GPU/system metrics
│   │   ├── command_queue.rs               # Command polling
│   │   ├── watchdog.rs                    # Self-healing rules
│   │   ├── config.rs                      # TOML config
│   │   └── updater.rs                     # OTA update logic
│   └── systemd/
│       └── zion-agent.service
│
├── fleet-dashboard/                       # Cloud/Web dashboard
│   ├── backend/                           # Rust Axum
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── main.rs
│   │       ├── routes/
│   │       │   ├── rigs.rs
│   │       │   ├── commands.rs
│   │       │   ├── flight_sheets.rs
│   │       │   └── alerts.rs
│   │       ├── db.rs
│   │       └── ws.rs
│   └── frontend/                          # React SPA
│       ├── package.json
│       └── src/
│           ├── App.tsx
│           ├── components/
│           │   ├── RigGrid.tsx
│           │   ├── RigCard.tsx
│           │   ├── FlightSheetEditor.tsx
│           │   └── AlertFeed.tsx
│           └── api/
│               └── client.ts
│
├── oc-manager/                            # Overclocking & Power
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       ├── amd.rs                         # amdgpu sysfs
│       ├── nvidia.rs                      # NVML
│       └── intel.rs                       # oneAPI
│
├── ota-service/                           # Auto-update
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       ├── signer.rs                      # ed25519 sign verify
│       └── downloader.rs
│
├── boot/                                  # Boot system
│   ├── initramfs/
│   │   └── hooks/zion-overlay
│   ├── grub/
│   │   └── grub.cfg
│   └── first-boot/
│       └── wizard.py                      # Web-based first setup
│
├── smos-bridge/                           # SMOS kompatibilita
│   ├── smos-api-client.py
│   └── smos-to-zion-migration.sh
│
├── mobile-app/                            # React Native (existuje)
│   └── ...
│
├── desktop-dashboard/                     # Tauri desktop (existuje)
│   └── ...
│
└── docs/                                  # Dokumentace
    ├── USER_GUIDE.md
    ├── RUNBOOK.md
    ├── API_REFERENCE.md
    └── HARDWARE_COMPATIBILITY.md
```

---

## 9. KOMPATIBILITA A HARDWARE MATRIX

### Podporovane GPU

| GPU | Driver | OpenCL | CUDA | Auto-OC | Status |
|-----|--------|--------|------|---------|--------|
| AMD RX Vega (GCN5) | ROCm 5.x / amdgpu-pro | ✅ | — | ✅ | Testovano (Vega 64) |
| AMD RX 5000-7000 (RDNA 1-3) | ROCm 5.x+ | ✅ | — | ✅ | Testovano (RX 5600) |
| NVIDIA RTX 20/30/40/50 | CUDA 12.x | ✅ | ✅ | ✅ | Planovano |
| Intel Arc | oneAPI | ✅ | — | ⏳ | Planovano |
| Apple Silicon | Metal | — | — | — | Existuje (Metal) |

### Testovane Rig Konfigurace

| Konfigurace | GPU | RAM | Storage | Sit | Status |
|-------------|-----|-----|---------|-----|--------|
| Budget | 1x RX 580 | 4GB | 16GB USB | Ethernet | Plan |
| Mid | 1x RX 6600 XT | 8GB | 120GB SSD | WiFi | Plan |
| High | 1x Vega 64 | 8GB | 16GB USB | Ethernet | ✅ Testovano |
| Multi-GPU | 6x RX 6600 | 16GB | 120GB SSD | Ethernet | Plan |
| NVIDIA | 1x RTX 3060 | 8GB | 120GB SSD | Ethernet | Plan |

---

## 10. BUILD INSTRUKCE

### Zion Agent (Rig OS)
```bash
cd ZION_OS/agent
cargo build --release
# Binary: target/release/zion-agent
```

### Tauri Desktop Dashboard
```bash
cd ZION_OS/desktop-dashboard
# Frontend dev
npm install
npm run dev
# Desktop build
cd src-tauri
cargo tauri build
```

### Fleet Dashboard Backend
```bash
cd ZION_OS/fleet-dashboard/backend
cargo run
# API nasloucha na 0.0.0.0:8080
```

### Fleet Dashboard Frontend
```bash
cd ZION_OS/fleet-dashboard/frontend
npm install
npm run dev
# Build: npm run build
```

### Python Dashboard (Kanonicky Backend)
```bash
cd ZION_OS/dashboard
python app.py
# Nasloucha na 127.0.0.1:8766
```

---

## 11. METRIKY USPECHU (Definition of Done)

### Technicke

| Metrika | Cil | Mereni |
|---------|-----|--------|
| Boot-to-mine cas | < 60 sekund | Od zapnuti po prvni share |
| Agent availability | > 99.5% | Uptime agenta na rigu |
| Auto-recovery uspesnost | > 90% | Watchdog restarty bez manualni intervence |
| Command latency | < 2s (LAN) | Dashboard → rig ack |
| Telemetry delay | < 5s (p95) | Rig stav v dashboardu |
| Rollback cas | < 3 minut | Failed OTA → predchozi verze |
| Image build cas | < 15 minut | `build-image.sh` complete |

### Operacni

| Metrika | Cil |
|---------|-----|
| Mining uptime | > 99% |
| Pool efficiency | > 95% |
| Node sync rate | > 99% |
| Fleet satisfaction | > 90% |
| Rigs per admin | > 1000 (1 clovek spravuje 1000 rigu) |

---

## 11. DALSi KROKY (Okamzite akce)

1. **Tento tyden**: Dokoncit `build-image.sh` — bootovatelny USB image
2. **Tento tyden**: Zahajit `zion-agent` Rust skeleton (Cargo.toml + main)
3. **Pristi tyden**: First-boot wizard (web UI na portu 80)
4. **Pristi tyden**: Fleet dashboard backend skeleton (Axum + SQLite)
5. **Do konce mesice**: End-to-end test: flash → boot → mine na Vega 64

---

## Prilohy

- **A**: [ZionOS_MASTERPLAN_AUTOPILOT.md](./ZionOSsmos/ZionOS_MASTERPLAN_AUTOPILOT.md) — Autopilot detail
- **B**: [SMOS-ZION-SETUP.md](./ZionOSsmos/SMOS-ZION-SETUP.md) — SMOS kompatibilita
- **C**: [SmosRigDebug.md](./ZionOSsmos/SmosRigDebug.md) — GPU debug zkusenosti
- **D**: [HIRAN_LOCAL_SETUP.md](../HIRAN_LOCAL_SETUP.md) — AI inference setup
- **E**: [StatusV3.md](../StatusV3.md) — Mainnet status (source of truth)

---

> **Poznamka:** Tento dokument je zive. Jakmile je nejaka faze hotova, oznac ji ✅ a pridej odkaz na merge commit.
> Hlavni vyvojova vetev pro ZION OS je `feature/zion-os-v1`.
