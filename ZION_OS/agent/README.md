# ZION Agent

Autonomní Rust agent pro ZION Mainnet mining rigy. Běží jako systemd služba na Ubuntu-minimal, řídí miner, sbírá GPU telemetry, vykonává watchdog pravidla a komunikuje s fleet dashboard.

## Architektura

```
┌─────────────────────────────────────────────┐
│              ZION Agent                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ API      │ │ Telemetry│ │ Watchdog │    │
│  │ (Axum)   │ │ Collector│ │ Engine   │    │
│  │ :8767    │ │          │ │          │    │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘    │
│       │            │            │          │
│  ┌────┴────────────┴────────────┴─────┐    │
│  │           AgentState                │    │
│  │  (config, miner_pid, miner_stats)   │    │
│  └─────────────────────────────────────┘    │
│       │            │            │          │
│  ┌────┴─────┐ ┌───┴────┐ ┌────┴────┐      │
│  │ miner_ctl│ │ GPU    │ │ OC      │      │
│  │ (parser) │ │ Telemetry│ │ Manager │      │
│  └──────────┘ └────────┘ └─────────┘      │
└─────────────────────────────────────────────┘
```

## Moduly

| Modul | Soubor | Funkce |
|---|---|---|
| `main` | `src/main.rs` | Entry point, graceful shutdown, HTTP router, auto-start |
| `api` | `src/api.rs` | Axum handlers: status, miner start/stop, telemetry, config |
| `config` | `src/config.rs` | Načítání/ukládání `agent.toml` a `watchdog.yaml` |
| `miner_ctl` | `src/miner_ctl.rs` | Spawn/zastavení `zion-miner`, stdout/stderr parsing |
| `miner_parser` | `src/miner_parser.rs` | Real-time parser `key=value` stdout → `MinerStats` |
| `telemetry` | `src/telemetry.rs` | Periodický sběr a upload do fleet dashboard |
| `watchdog` | `src/watchdog.rs` | Expression engine + akce (restart, reboot, OC) |
| `oc_manager` | `src/oc_manager.rs` | AMD sysfs writer: power limit, fan, DPM states |
| `gpu_telemetry` | `src/gpu_telemetry/` | AMD (sysfs), NVIDIA (NVML placeholder), unifikované typy |
| `updater` | `src/updater.rs` | GitHub releases polling, OTA updates |
| `command_queue` | `src/command_queue.rs` | Fleet command polling/ack/result (stub) |

## HTTP API

| Endpoint | Method | Popis |
|---|---|---|
| `/api/status` | GET | rig_id, version, uptime, miner_running, gpu_count |
| `/api/miner/start` | POST | Spustí miner s volitelným pool/wallet/worker |
| `/api/miner/stop` | POST | SIGTERM → SIGKILL miner proces |
| `/api/miner/restart` | POST | Stop + start |
| `/api/telemetry` | GET | Konfigurace telemetry, miner pool/backend |
| `/api/gpu` | GET | Live GPU telemetry (teplota, výkon, frekvence) |
| `/api/config` | GET/POST | Čtení/zápis agent.toml |
| `/api/commands/pending` | GET | Fleet command poll (stub) |
| `/health` | GET | Liveness probe |

## Miner Parser

Miner vypisuje strukturované řádky:

```
hashrate_hps=1500.50
hashrate_10s_hps=1450.00
hashrate_60s_hps=1480.00
accepted_shares=42
rejected_shares=3
share_status=Accepted
```

`miner_parser.rs` čte stdout/stderr přes `tokio::io::AsyncBufReadExt::lines()` a aktualizuje `MinerStats` v reálném čase.

## Watchdog Engine

Pravidla se definují v `watchdog.yaml`:

```yaml
rules:
  - name: low_hashrate
    condition: "hashrate_5min < 1000"
    severity: critical
    action: restart_miner
    cooldown_sec: 300
  - name: no_shares
    condition: "shares_5min == 0 AND miner_running == true"
    severity: critical
    action: restart_miner
    cooldown_sec: 600
  - name: gpu_overheat
    condition: "gpu_temp_max > 85"
    severity: warning
    action: apply_conservative_oc
    cooldown_sec: 120
```

Podporované akce: `restart_miner`, `stop_miner`, `reboot_rig`, `apply_conservative_oc`, `switch_pool_to_failover`.

## OC Manager (AMD sysfs)

Předpřipravené profily:
- `conservative` — 120W, 50% fan, low DPM
- `balanced` — 180W, 65% fan, auto DPM
- `max_perf` — 250W, 85% fan, high DPM

```rust
let profile = oc_manager::preset_conservative();
oc_manager::apply_profile(&profile).await?;
```

Zápis kontroluje: soubor existuje, patří do `/sys/class/drm`, běží jako root.

## Build

### Linux/macOS
```bash
./build.sh --release
```

### Windows
```powershell
.\build.ps1 -Release
```

### Cross-compile (ARM)
```bash
./build.sh --target aarch64-unknown-linux-gnu --release
```

## Instalace jako systemd služba

```bash
sudo cp systemd/zion-agent.service /etc/systemd/system/
sudo cp systemd/zion-watchdog.service /etc/systemd/system/
sudo cp systemd/zion-telemetry.service /etc/systemd/system/
sudo cp systemd/zion-ota.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now zion-agent
```

## Konfigurace

`data/zion/config/agent.toml`:

```toml
rig_id = "rig-01"
api_bind = "0.0.0.0:8767"
autonomous_mode = true
auto_start_miner = true
auto_update = "stable"

[miner]
binary_path = "/usr/local/bin/zion-miner"
default_pool = "62.171.141.136:8444"
default_wallet = "zion1..."
default_worker = "rig01"
default_gpu_backend = "opencl"
extra_args = []

[telemetry]
enabled = true
fleet_url = "https://fleet.zion.network/api/telemetry"
interval_sec = 30

[watchdog]
enabled = true
check_interval_sec = 60
rules_file = "/data/zion/config/watchdog.yaml"
```

## Závislosti

- `tokio` — async runtime
- `axum` — HTTP API
- `sysinfo` — CPU/ RAM / procesy
- `reqwest` — HTTP client (telemetry, updater)
- `serde` + `toml` + `serde_yaml` — serializace
- `tracing` — structured logging
- `chrono` — datetime
- `uuid` — generování rig_id
- `nix` — Unix signály (SIGTERM) — *optional unix-only*

## GPU Telemetry Paths (Linux AMD)

| Metrika | sysfs cesta | Jednotka |
|---|---|---|
| Teplota | `hwmon*/temp1_input` | m°C |
| Hotspot | `hwmon*/temp2_input` | m°C |
| VRAM temp | `hwmon*/temp3_input` | m°C |
| Power | `hwmon*/power1_average` | μW |
| Power limit | `hwmon*/power1_cap` | μW |
| Fan RPM | `hwmon*/fan1_input` | RPM |
| Fan duty | `hwmon*/pwm1` | 0-255 |
| GPU busy | `gpu_busy_percent` | % |
| VRAM used | `mem_info_vram_used` | B |
| VRAM total | `mem_info_vram_total` | B |
| Core clock | `pp_dpm_sclk` | MHz (active s *) |
| Memory clock | `pp_dpm_mclk` | MHz (active s *) |

## License

MIT — ZION Project
