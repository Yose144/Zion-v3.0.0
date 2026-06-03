# ZION V3 Dashboard — Cross-Platform Guide (Windows 11 · Ubuntu · macOS)

The dashboard backend (`dashboard/app.py`) is **zero-dependency Python stdlib** and runs
identically on all three platforms. Service control (start/stop/launch) is delegated to
per-OS scripts in `scripts/`:

- **Windows 11** → PowerShell scripts (`*.ps1`)
- **Ubuntu / Linux** → Bash scripts (`*.sh`)
- **macOS** → the **same** Bash scripts (`*.sh`) with `uname`-based branches

The OS is auto-detected: `app.py` picks `.ps1` on `os.name == "nt"`, otherwise `.sh`.
Linux and macOS share one set of `.sh` files; differences (GPU backend, terminal emulator,
package manager) are handled internally via `uname -s` in `scripts/_lib.sh`.

---

## 1. Start the dashboard

| OS | Command |
|----|---------|
| Windows 11 | `dashboard\start-dashboard.ps1` |
| Ubuntu / Linux | `dashboard/start-dashboard.sh` (or `cd dashboard && python3 app.py`) |
| macOS | `dashboard/start-dashboard.sh` (or `cd dashboard && python3 app.py`) |

Then open **http://127.0.0.1:8766**.

Optional systemd unit for Linux servers: `dashboard/zion-dashboard.service`.

```bash
sudo cp dashboard/zion-dashboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now zion-dashboard
```

---

## 2. Shared shell library — `scripts/_lib.sh`

All Linux/macOS control scripts `source` this helper, which provides:

| Symbol | Purpose |
|--------|---------|
| `ZION_OS` | `"linux"` or `"macos"` (from `uname -s`) |
| `REPO_ROOT`, `LOG_DIR`, `DATA_DIR`, `BIN_DIR` | Resolved repo paths |
| `find_exe <name>` | Locate a built binary (release first, then debug) |
| `start_bg <id> <exe> [args...]` | `nohup` launch + write `logs/<id>.pid` |
| `stop_pidfile <id>` | Stop a service by its PID file (for node1/node2 which share a binary) |
| `stop_match <pattern>` | `pkill -f` by command-line pattern |
| `default_gpu_backend` | `opencl` on Linux, `metal` on macOS |

---

## 3. OS-specific behaviour

| Concern | Windows 11 | Ubuntu/Linux | macOS |
|---------|------------|--------------|-------|
| Control scripts | `*.ps1` | `*.sh` | `*.sh` |
| GPU miner backend | OpenCL/CUDA | OpenCL (`default_gpu_backend`) | Metal (`default_gpu_backend`) |
| Binary names | `*.exe` | no suffix | no suffix |
| Open terminal | Windows Terminal / PowerShell | gnome-terminal → konsole → xfce4-terminal → xterm | `Terminal.app` (osascript) |
| Monitoring | Docker Desktop | Docker Engine | Docker Desktop |
| Background launch | hidden window | `nohup` + `setsid` | `nohup` + `setsid` |

---

## 4. Control actions → scripts

Every dashboard control action maps to a script basename; the extension is chosen per OS.

| Action | Script basename | L# |
|--------|-----------------|----|
| launch-stack / launch-full | `launch-stack` / `launch-full` | L1 |
| stop-stack / stop-all | `stop-stack` / `stop-all` | L1 |
| start-node1 / start-node2 | `start-node` / `start-node2` | L1 |
| stop-node1 / stop-node2 | `stop-node1` / `stop-node2` | L1 |
| start-pool / stop-pool | `start-pool` / `stop-pool` | L1 |
| start-miner / -cpu / -gpu | `start-miner` / `start-miner-cpu` / `start-miner-gpu` | L1 |
| stop-miner | `stop-miner` | L1 |
| backup-chain / verify-chain / restore | `backup-chain` / `verify-chain` / `restore-chain` | L1 |
| core-util / zion-cli | `core-util-run` / `zion-cli-run` | L1 |
| start/stop-hiranyagarbha | `start-hiranyagarbha` / `stop-hiranyagarbha` | L3 |
| start/stop hiran-inference | `start-hiran-inference` / `stop-ai-native` | L3 |
| start/stop-dao | `start-dao` / `stop-dao` | L2 |
| start/stop-bridge | `start-bridge` / `stop-bridge` | L2 |
| start/stop-atomic-swap | `start-atomic-swap` / `stop-atomic-swap` | L2 |
| start/stop-warp | `start-warp` / `stop-warp` | L3 |
| start/stop-oasis | `start-oasis` / `stop-oasis` | L4 |
| start/stop-humanitarian | `start-humanitarian` / `stop-humanitarian` | L5 |
| start/stop-space | `start-space` / `stop-space` | L6 |
| start/stop-monitoring | `start-monitoring` / `stop-monitoring` | Infra |
| open-terminal | `open-terminal` | — |

### Service ports (Linux/macOS env defaults)

| Service | Port | Env overrides |
|---------|------|---------------|
| DAO (L2) | 8081 | `DAO_API_PORT`, `DAO_DB_PATH` |
| Atomic Swap (L2) | 8888 | `ZION_SWAP_CONFIG` |
| Bridge (L2) | metrics 9101 | `ZION_BRIDGE_CONFIG` (defaults to testnet) |
| WARP (L3) | dev defaults | `WARP_CONFIG` |
| Hiranyagarbha (L3) | 8001 | `HIRANYAGARBHA_BIND`, `LLM_BASE_URL` |
| Hiran Inference (L3) | 8002 | `HIRAN_GPU_LAYERS` (0 = CPU) |
| OASIS (L4) | 8094 | `OASIS_PORT`, `OASIS_DB`, `OASIS_BIND` |
| Free World (L5) | 8095 | `FREE_WORLD_PORT`, `FREE_WORLD_DB` |
| Issobella (L6) | 8096 | `ISSOBELLA_PORT`, `ISSOBELLA_DB` |

---

## 5. Building binaries

All platforms build the same Rust workspace:

```bash
cargo build --release --manifest-path V3/Cargo.toml --workspace
```

Produced binaries (in `V3/target/release/`): `node`, `server`, `zion-miner`, `core-util`,
`zion` (CLI), `zion-dao`, `zion-bridge`, `zion-atomic-swap`, `zion-warp-server`,
`zion-oasis`, `zion-free-world`, `zion-issobella`, `zion-ai-native-api`.

The dashboard's **Install / Build** action runs `scripts/install-deps.sh` (Linux/macOS) or
`scripts/install-deps.ps1` (Windows).

---

## 6. Monitoring (all platforms)

Prometheus + Grafana run via Docker Compose:

```bash
docker compose -f V3/docker/docker-compose.yml --profile monitoring up -d
```

The dashboard exposes this as **start-monitoring** / **stop-monitoring** and as step 2 of
**launch-full**. If Docker is unavailable, `launch-full` still starts the core stack and
logs a warning (monitoring is best-effort).

- Prometheus: http://127.0.0.1:9090
- Grafana: http://127.0.0.1:3000 (admin / see `V3/docker/.env`)

---

## 7. PID files & logs

`start_bg` writes `logs/<id>.pid` for every service it launches. This lets node1 and node2
(same `node` binary) be stopped individually via `stop_pidfile`. Logs are written to
`logs/<id>.log` and `logs/<id>.err`.

---

## 8. Notes / known constraints

- **DashV2** (the React/Vite DAO Guardian portal) is a separate Vite app and is already
  cross-platform — not affected by these scripts.
- `node1` and `node2` share the `node` binary; individual stop relies on PID files written
  by the start scripts. `stop-stack` / `stop-all` use pattern matching and stop both.
- macOS GPU mining uses the Metal kernel (`ekam_deeksha.metal`); Linux uses OpenCL.
