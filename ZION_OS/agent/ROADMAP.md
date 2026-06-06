# ZION Agent — Roadmap

## Fáze 0: Core Agent (HOTOVÉ)

- [x] HTTP API (Axum) — status, miner řízení, telemetry, config
- [x] Miner kontroler — spawn, SIGTERM/SIGKILL, restart
- [x] Miner parser — real-time stdout `key=value` → `MinerStats`
- [x] GPU telemetry — AMD sysfs (teplota, power, fan, clocks, VRAM)
- [x] Watchdog engine — expression evaluator + akce (restart, reboot, OC)
- [x] OC manager — AMD sysfs writer (power limit, fan, DPM states)
- [x] Build skripty — `build.sh` / `build.ps1` s cross-compile
- [x] Systemd units — agent, watchdog, telemetry, OTA

## Fáze 1: Fleet Integration

- [ ] **Command queue** — poll pending commands z fleet dashboard, ack, submit result
- [ ] **Telemetry upload** — POST /api/telemetry s rig_id, GPU stavy, miner stats
- [ ] **Fleet dashboard frontend** — React SPA: seznam rigů, detail, command panel
- [ ] **Flight sheets** — definice pool/wallet/OC/backend jako entity ve fleet DB
- [ ] **Rig registrace** — first-boot wizard generuje rig_id, zaregistruje se do fleetu
- [ ] **Failover pool** — watchdog `switch_pool_to_failover` mění config a restartuje miner

## Fáze 2: Rig OS Image

- [ ] **Cross-compile pipeline** — sestavit `zion-agent` pro `x86_64-unknown-linux-gnu` z Windows hosta (Docker / WSL / `cross`)
- [ ] **build-image.sh** — vytvořit flash-ready `.img` (EFI + squashfs + persistent data)
- [ ] **chroot-setup.sh** — nainstalovat GPU drivery, Docker, Tailscale do Ubuntu chroot
- [ ] **Overlayfs boot** — initramfs hook pro USB flash s persistentní `/data` partition
- [ ] **First-boot wizard** — webový konfigurátor na portu 80 (GPU detect, wallet, OC profile)
- [ ] **Auto-update OTA** — stáhnout nový agent binárku, ověřit signaturu, atomický swap, rollback

## Fáze 3: GPU Backends & Tuning

- [ ] **NVIDIA telemetry** — integrace `nvml-wrapper` pro teplotu, power, fan, clocks
- [ ] **NVIDIA OC** — `nvidia-smi` power limit, aplikace profilů přes NVML
- [ ] **Intel ARC** — sysfs telemetry (pokud je dostupná na Linuxu)
- [ ] **Per-GPU OC profily** — profil pro konkrétní GPU (ne jen globální)
- [ ] **Auto-tuning** — automatické hledání stable OC (schodkový test, hashrate tracking)
- [ ] **GPU health check** — ECC errors, Xid kódy (NVIDIA), HW faults (AMD)

## Fáze 4: Enterprise & Security

- [ ] **TLS/mTLS** — HTTPS API, client cert pro fleet komunikaci
- [ ] **API key autentizace** — fleet token v headeru
- [ ] **Audit log** — lokální log všech akcí (start, stop, restart, OC, watchdog triggers)
- [ ] **Alerting integrace** — Prometheus metrics endpoint, Alertmanager rules
- [ ] **Multi-rig orchestrace** — batch commands: "restart miner na všech rig s GPU temp > 80"
- [ ] **Offline mode** — agent funguje bez fleet připojení, queue se flushne po reconnectu
- [ ] **Signované binárky** — ed25519 signatura všech release artifactů

## Fáze 5: Desktop Integration

- [ ] **Tauri desktop** — čistý frontend volající agent API (port 8767)
- [ ] **System tray** — jedním klikem start/stop miner, status tooltip
- [ ] **Notifikace** — push notifikace při watchdog alertu, low hashrate, GPU overheat
- [ ] **Log viewer** — stream stdout/stderr z agenta do desktop UI
- [ ] **Local dashboard** — embedded webview s grafy (hashrate, teploty, power)

## Prioritní úkoly (Next)

1. **Fleet dashboard frontend** — React SPA napojená na existující Axum backend
2. **Cross-compile** — Docker build pro Linux target z Windows
3. **Rig OS image** — otestovat `build-image.sh` a vyrobit první flash-ready `.img`
4. **NVIDIA support** — `nvml-wrapper` feature flag pro NVIDIA telemetry
