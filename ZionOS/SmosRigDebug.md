# SMOS Rig Debug — ZION Deeksha GPU Mining

**Rig:** 518837 (ZionRig) — simplemining.net  
**GPU:** AMD RX Vega 64 (gfx900, GCN 5.0, 8 GB HBM2)  
**OS:** SMOS i066d (kernel 5.15.80-sm#066d, driver amd21.50.2, ROCm 5.x)  
**Server:** 91.98.122.165 (pool :3333, RPC :8443, downloads nginx)  
**SMOS Group:** 1765707 (ZION-Deeksha-AMD)  
**API Token:** `api-3fb4dbbd2a4ae13622b2a9d574e9c5d1fe2c69fde0db128ad60be3fb3f68d5ef`  
**Last Updated:** 2026-04-11  

---

## Current State (2026-04-11)

### What Works
- Rig online on SMOS, RX Vega 64 detected, driver amd21.50.2 (ROCm 5.x) — correct driver for Vega
- ZANO mining at 17.17 MH/s / 198W — **hardware is fully functional**
- V3 miner builds on server with `cargo build --release -p zion-miner --features gpu-opencl`
- Group config updated: `--gpu opencl` + `zion-miner-v3.0.5.zip` (with OpenCL device scoring fix)
- Pool running at 91.98.122.165:3333, miner connects and receives jobs

### What Doesn't Work Yet
- **GPU power 40W** (idle) — miner not actually exercising the GPU
- Rig still running old v3.0.13 binary with `--gpu cpu` — needs restart to pick up new group config
- Previous Vega gfx900 OpenCL issue: `clEnqueueWriteBuffer` / `clEnqueueNDRangeKernel` hang after `clBuildProgram` (documented in `docs/VEGA_GPU_MINING_DEBUG_REPORT_2026-04-09.md`)
- All shares `RejectedLowDifficulty` — suggests CPU fallback path producing trivially easy hashes

### Key Discovery: `--gpu cpu` Was Configured
The SMOS group 1765707 had `--gpu cpu` in minerOptions all along. The miner was running CPU-only Deeksha (on a Pentium G4560 — extremely slow), never touching the GPU. **This is likely the primary reason GPU power was at idle 40W.**

Fixed on 2026-04-11: group config updated via API to `--gpu opencl`.

---

## Debug Timeline

### Phase 1: Driver & Power (2026-04-09 — 2026-04-10)

| Step | Action | Result |
|------|--------|--------|
| 1 | Rig on SMOS i088 (amd22.40.6, ROCm 6.x) | GPU detected DEAD, 0W |
| 2 | Reflash to i085 (amd22.40.6, ROCm 6.1) | GPU seen, stuck at 19W |
| 3 | Reflash to **i066d** (amd21.50.2, ROCm 5.x) | **186W instant** — Vega PM works |
| 4 | OC tuning (10 iterations) | Core=1200 Mem=950 PL=100 VDDC=950 → 198W |
| 5 | ZANO validation mining | **17.17 MH/s** — hardware confirmed OK |

**Root cause:** `amd22.40.6` (ROCm 6.x) ignores Vega/GCN5 sysfs power management entirely.

### Phase 2: OpenCL Kernel Issues (2026-04-09 — 2026-04-10)

| Version | Fix | Result |
|---------|-----|--------|
| v3.0.1 | Large work size (4096×256) | Kernel compilation hang |
| v3.0.2 | Removed aggressive AMD CL flags | Kernel compiles; hung after banner |
| v3.0.3 | Buffer allocation logging | Revealed hang at NPU buffers |
| v3.0.4 | stdout flush diagnostics | Pinpointed `biases_buf` hang |
| v3.0.5 | Replace `copy_host_slice` with create+write | Hung at `write().enq()` |
| v3.0.6 | Separate buffer creation from writes | All buffers create, writes hang |
| v3.0.7 | **Skip NPU data writes** | Full init! Pool connected |
| v3.0.8 | Blocking writes (`.block(true)`) | Job received, `mine_batch` hangs |
| v3.0.9 | Separate transfer queue | Same — `mine_batch` hangs |

**Root cause:** gfx900 driver bug — `clEnqueueWriteBuffer` / `clEnqueueNDRangeKernel` deadlocks after `clBuildProgram` on same device context. All v3.0.1–v3.0.9 testing was on images i085/i088 (broken ROCm 6.x). **Never tested on i066d (ROCm 5.x) where the driver actually works.**

### Phase 3: Device Selection Fix (2026-04-10 — 2026-04-11)

| Step | Action | Result |
|------|--------|--------|
| 1 | Compared desktop-agent Python vs Rust miner | Python scores devices (AMD>Intel>NVIDIA); Rust uses `Device::first(Platform::default())` |
| 2 | Ported Python device scoring to Rust `gpu_backend.rs` | `pick_opencl_device()` with vendor scoring + env var overrides |
| 3 | Added diagnostic logs (`gpu_opencl_pick`, `gpu_opencl_init` with platform name) | Build passes |
| 4 | Built v3.0.5 on server with `--features gpu-opencl` | 1.4 MB binary, deployed to /opt/zion/downloads |
| 5 | Updated group minerOptions to `--gpu opencl` + v3.0.5 URL | API confirms update |
| 6 | Attempted rig restart via API | Rig still showing old config — restart may not have applied |

---

## Immediate Plan: Get GPU Mining Running

### Step 1: Force Rig to Pick Up New Config
The SMOS group config is updated (`--gpu opencl`, v3.0.5), but the rig is still running old v3.0.13 with `--gpu cpu`.

```bash
# Via SMOS API (commandId=7):
miner stop && sleep 3 && miner start

# Or full reboot if that doesn't work:
reboot

# Or via SMOS web dashboard — force "Reload" on rig 518837
```

**Verification:** consoleSystem should show:
```
Running miner: custom_zion-miner-v3.0.5
Options: [...] --gpu opencl
```

### Step 2: Verify OpenCL Picks Vega
New `pick_opencl_device()` should log:
```
gpu_opencl_pick mode=auto platform_idx=0 device_idx=0 platform="AMD Accelerated Parallel Processing" device="gfx900:xnack-"
```

If it picks CPU instead, override with:
```
ZION_OCL_PLATFORM_IDX=0 ZION_OCL_DEVICE_IDX=0
```

### Step 3: Test OpenCL on i066d (ROCm 5.x)
Previous kernel compile hang + buffer write deadlock were on i085/i088 (ROCm 6.x). **i066d (ROCm 5.x) was never tested with the Deeksha OpenCL kernel.** This is the critical test.

Possible outcomes:
1. **Works** — GPU mine at >0 H/s, power rises to 150-200W → Done ✅
2. **Kernel compile hang** — Same as v3.0.1 on old images → Need to reduce kernel complexity or pre-compile
3. **Buffer write deadlock** — Same as v3.0.5-v3.0.9 → gfx900 fundamental issue, need alternative approach

### Step 4: If OpenCL Fails on Vega
Fallback approaches (in priority order):

1. **CPU Deeksha + GPU forwarding** — Mine Deeksha on CPU but use `--gpu opencl` for hash acceleration only (memory-hard stage on GPU, rest on CPU)
2. **Reduced kernel** — Strip Deeksha OpenCL to only the memory-hard Blake3 stage (most parallelizable), do NPU+fusion on CPU
3. **RDNA GPU** — Test on RX 5600/6600 (RDNA 1/2) which has better OpenCL driver support than GCN5 Vega
4. **SRBminer integration** — Write Deeksha algo plugin for SRBminer (mature AMD miner with battle-tested OpenCL code). Large effort but most reliable path for production AMD rigs.

### Step 5: Fix RejectedLowDifficulty
All shares are rejected with `RejectedLowDifficulty`. Causes:
- CPU mode produces hashes too slowly (Pentium G4560)
- Pool difficulty may be set too high for CPU hashrate
- Possible epoch/height mismatch in hash computation (known previous issue)

Need to check pool-side logs: `ssh root@91.98.122.165 'journalctl -u zion-pool --since "1 hour ago" | grep -i reject | tail -20'`

---

## SMOS API Reference

### Working Endpoints
```
GET  /rigs              — List all rigs
GET  /rigs/518837       — Full rig status (including redisData with base64 console)
GET  /rig-groups/1765707 — Group config
PUT  /rig-groups/1765707 — Update group (Content-Type: application/json)
     Body: {"minerOptions": "https://...zip --pool ... --gpu opencl"}
PATCH /rigs/execute-command — Run command on rig (Content-Type: application/merge-patch+json)
     Body: {"rigIds": [518837], "commandId": 7, "commandOptions": "shell command here"}
```

### API Gotchas
- **Cloudflare WAF** blocks PATCH requests with long shell commands containing `curl`, `rm -rf`, `wget`, etc. Keep commands short and simple.
- `Content-Type: application/merge-patch+json` required for PATCH; `application/json` for PUT.
- Only `commandId: 7` (custom command) works via API token. Commands 1-6 (reboot, restart, etc.) return 404.
- Group config update via PUT is instant in API but rig requires **miner restart** or **reboot** to pick up changes.

### Console Decoding
```python
import base64, re
raw = rig_data["redisData"]["console"]  # or consoleSystem
text = base64.b64decode(raw).decode("utf-8", errors="replace")
text = re.sub(r"<[^>]+>", " ", text)  # Strip HTML tags
```

---

## Files Modified (V3 Miner)

| File | Changes |
|------|---------|
| `V3/L1/miner/src/gpu_backend.rs` | Added `device_score()`, `pick_opencl_device()` — proper AMD-preferred device selection matching desktop-agent Python logic. Env var overrides `ZION_OCL_PLATFORM_IDX`, `ZION_OCL_DEVICE_IDX`. Diagnostic logs `gpu_opencl_pick`, `gpu_opencl_init`. |
| `V3/L1/miner/src/main.rs` | Telemetry epoch display fix, session management improvements |
| `V3/L1/miner/src/banner.rs` | Banner formatting |
| `V3/L1/miner/Cargo.toml` | Feature flags for gpu-opencl |
| `V3/L1/cosmic-harmony/src/algorithms_npu.rs` | NPU variable topology fixes |
| `V3/L1/cosmic-harmony/src/gpu/kernels/cosmic_harmony_deeksha.cl` | OpenCL kernel build option compat |

### Server Build
```bash
ssh root@91.98.122.165
source ~/.cargo/env
cd /root/zion-2.9.6/V3
cargo build --release -p zion-miner --bin zion-miner --features gpu-opencl
# Binary: /root/zion-2.9.6/V3/target/release/zion-miner (1.4 MB)
# Packaged: /opt/zion/downloads/zion-miner-v3.0.5.zip
```

---

## OC Settings (Vega 64 on i066d)

| Parameter | Value | Notes |
|-----------|-------|-------|
| Core Clock | 1200 MHz | Stable across all tests |
| Memory Clock | 950 MHz | ≥1000 crashes MC to 800 MHz |
| PowerLimit | 100 | = 100% TDP. Values 1-7 = DPM stage (wrong!) |
| VDDC | 950 mV | |
| Fan Min | 40% | |
| Temp Target | 68°C | |

**Full reboot required after every OC change** — miner reload doesn't reset DPM table.

---

## Future: ZION OS for Mining Rigs

SimpleMining works but has significant limitations for ZION mining:

### Problems with SMOS
1. **No native Deeksha algo support** — Must use "custom miner" with manual zip packaging
2. **Limited API** — Only custom shell commands (commandId=7); no proper restart/reboot via API token
3. **Cloudflare WAF** — Blocks complex remote commands, making automated deployment hard
4. **No kernel/OpenCL management** — Can't install custom ROCm versions or debug OpenCL issues
5. **Update lag** — Can't control when rig picks up new config; sometimes needs full reboot cycle
6. **Cost** — $2/rig/month × many rigs adds up
7. **Dependency risk** — If SMOS goes down or changes API, all rigs go offline

### ZION OS Vision

A lightweight Linux-based mining OS (like SMOS/HiveOS) purpose-built for ZION network mining:

#### Core Features
- **Pre-installed ZION miner** with Deeksha GPU backends (OpenCL, CUDA, Metal)
- **Auto-config** — Detects GPU vendor/model, picks optimal backend and work sizes
- **OTA updates** — Signed binary updates from ZION server, no manual zip packaging
- **Remote management API** — Full REST API: start/stop/restart miner, change config, reboot, OC, logs
- **Web dashboard** — Real-time hashrate, power, temperature, shares, earnings
- **Wallet integration** — Pre-configured wallet or generate-on-boot

#### Architecture
```
┌──────────────────────────────────────────────────┐
│  ZION OS (Minimal Linux — Debian/Alpine base)    │
│                                                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ zion-    │  │ OC/Power  │  │ Remote Agent │  │
│  │ miner    │  │ Manager   │  │ (REST API)   │  │
│  │ (Deeksha)│  │ (sysfs)   │  │ + WebSocket  │  │
│  └──────────┘  └───────────┘  └──────────────┘  │
│                                                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ GPU      │  │ Watchdog  │  │ OTA Update   │  │
│  │ Drivers  │  │ (auto-    │  │ Service      │  │
│  │ (ROCm/   │  │ restart,  │  │ (signed      │  │
│  │  CUDA)   │  │  reboot)  │  │  binaries)   │  │
│  └──────────┘  └───────────┘  └──────────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │ Telemetry → ZION Cloud Dashboard        │    │
│  │ (hashrate, power, temp, shares, uptime) │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

#### Implementation Phases

**Phase 1: Remote Agent (v0.1)** — Deploy on existing SMOS as custom service
- Rust binary that manages zion-miner lifecycle
- REST API for config, restart, logs
- Heartbeat + telemetry to ZION cloud
- SSH tunnel fallback for debugging
- Eliminates need for SMOS API — controls miner directly

**Phase 2: Standalone Image (v0.5)** — Bootable USB/SD Linux image
- Minimal Debian/Alpine with pre-installed AMD + NVIDIA drivers
- Auto-detect GPU, auto-configure miner
- Web UI on :80 for local management
- ZION cloud registration on first boot

**Phase 3: Fleet Management (v1.0)** — Cloud dashboard for multiple rigs
- Central web dashboard (like SMOS/HiveOS)
- Batch OC profiles, batch firmware updates
- Pool auto-switching, profit optimization
- Alert system (offline, overtemp, low hashrate)
- Mobile app for monitoring

**Phase 4: Hardware Partnerships (v2.0)**
- Pre-flashed USB sticks sold with rigs
- OEM partnerships for ZION mining kits
- Integrated profitability calculator

#### Driver Matrix (Target)
| GPU Family | Driver | OpenCL | CUDA | Status |
|-----------|--------|--------|------|--------|
| AMD Vega (GCN5) | amd21.50.2 / ROCm 5.x | ✅ | — | Needs testing on i066d |
| AMD RDNA 1-3 (RX 5000-7000) | ROCm 5.x or 6.x | ✅ | — | Desktop-agent proven on RX 5600 |
| NVIDIA Turing+ (RTX 2000-5000) | 550.x+ | ✅ | ✅ | CUDA preferred |
| Intel Arc | oneAPI | ✅ | — | Untested |

#### ZION OS vs SMOS/HiveOS
| Feature | SMOS | HiveOS | ZION OS |
|---------|------|--------|---------|
| Deeksha native | ❌ | ❌ | ✅ |
| Auto GPU config | Manual OC | Manual OC | Auto per algo |
| Update mechanism | Image reflash | Partial OTA | Full OTA |
| API quality | Minimal | Good | Full REST + WS |
| Cost | $2/rig/mo | $3/rig/mo | Free |
| Open source | No | No | Yes (MIT) |
| Rig independence | Cloud-locked | Cloud-locked | Local-first |

---

## Continuation Checklist (Next Session)

- [ ] Verify rig picked up v3.0.5 + `--gpu opencl` (check consoleSystem after restart)
- [ ] Monitor GPU power — should jump from 40W to 150-200W if OpenCL works
- [ ] If OpenCL hangs on i066d like on i085/i088, try reduced work_size (64, 32, 16)
- [ ] If still hangs, test with `ZION_OCL_PLATFORM_IDX=0 ZION_OCL_DEVICE_IDX=0` override
- [ ] Check pool logs for share acceptance: `journalctl -u zion-pool | grep ZionRig`
- [ ] If Vega remains broken, test on RDNA GPU (RX 5600/6600)
- [ ] Fix `RejectedLowDifficulty` — likely epoch/height mismatch or pool difficulty issue
- [ ] Start Phase 1 of ZION OS: remote agent binary prototype
