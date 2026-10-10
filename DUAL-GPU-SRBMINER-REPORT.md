# Dual-GPU SRBMiner QTC Mining — Deployment Report

> 2026-10-10 · desktop (Ubuntu, amdgpu) · SRBMiner-MULTI 3.6.9 · `qtcEngine: "srbminer"`

## Topology (post card-swap)

| GPU | PCI | Role | Notes |
|---|---|---|---|
| **RX 5600 XT** (gfx1010) | `06:00.0` | **headless mining** | 6 GB, display-free → full compute OK |
| **RX Vega 56/64** (gfx900) | `0c:00.0` | **display + mining** | 8 GB HBM2, drives monitor; compute needs intensity cap |

`clinfo`/SRBMiner order: GPU0 = 5600XT, GPU1 = Vega.

## Failure history → root causes

| Event | Symptom | Root cause |
|---|---|---|
| Display-card compute (5600XT driving X) | `ring gfx timeout` → BACO reset → VRAM lost → freeze | monolithic/long kernel launches starve display pipeline |
| Vega headless init (old slot) | `ring page0 timeout`, `device lost from bus`, `GPU Recovery Failed: -19` | HW power/PCIe transient on compute init |
| Vega @ intensity 20 (~156 W sustained) | 24× GPU reset loop, `Failed to send message 0x26/0x63/0x46`, fan lock → hard freeze | SMU communication failures under power-transient stress |
| Vega @ intensity 25 | same hashrate as 15 but **3× power (200 W)** | power-throttled — pointless |

**Lesson:** Vega's danger zone is **sustained ≳150 W** → SMU drops off the bus. Keep ≤ ~110 W.

## Final stable config

`miner_config.json`:

```json
"qtcEngine": "srbminer",
"srbminerPool": "stratum+tcp://eu.lproute.com:5660",
"srbminerGpuId": "0,1",
"srbminerExtraArgs": "--gpu-intensity 30,15"
```

sysfs (root, via pkexec):
- 5600XT: `vc 2 1700 900` → caps at **1700 MHz @ 900 mV** (stock 1780@944)
- Vega: `pp_dpm_sclk` all states enabled (stock DVFS — caps strangled it)
- ⚠️ `pp_dpm_*` masks + vf curve **survive only until reboot** — LACT config.yaml entry reapplies daemon-side; keep Vega entry `performance_level: auto`, no curve.

## Results (LuckyPool `eu.lproute.com:5660`, quantus algo)

| Config | 5600XT | Vega | Total | Power | Eff (MH/W) | Errors |
|---|---|---|---|---|---|---|
| int 30,15 + 5600XT@900mV (FINAL) | **76.3** | **100.5** | **176.8 MH/s** | 193 W | **0.914** | 0 |
| int 30,18 + Vega state-5 cap | 75.7 | 64.8 | 140.6 | 238 W | 0.590 | 0 |
| int 30,25 | 76.2 | 98.7 | 175.0 | ~290 W | ~0.60 | 0 (but 200 W sustained on Vega = danger zone) |
| int 30,30 + ZANO stream4 | 47.6 | 33.6 | 81.1 | 195 W | 0.42 | 0 |
| Vega 950 mV cap (state-2) | — | 33.6 | — | — | — | locked 1084 MHz, too tight |
| earlier uncapped int 30,15 | ~74 | ~119 | ~195 | 231 W | 0.84 | 0 |

**Vega observations:** intensity 15 is the sweet spot — autotune picks efficient clocks (~1258–1444 MHz) at 69–110 W; higher intensity only raises power, not hashrate. Vega dominates QPoW (HBM2 + 64 CU): ~100–119 MH/s vs 5600XT's ~76.

**5600XT observation:** `vc 2 1700@900` holds ~1730 MHz @ ~89 W (eff 0.86) — best measured config.

## Ops gotchas encountered

- `stratum+tcp://` scheme **required** — bare `host:port` reconnects forever
- Worker name must drop `@g=zion` suffix (internal group hint breaks LuckyPool)
- Stale SRBMiner instances survive agent restarts → always `pgrep -f SRBMiner` after restart; duplicates double-load GPUs
- `lactd` crash-loops on stale `/run/lactd.sock` → `sudo rm` + restart; daemon `set_gpu_config` on Vega hangs (SMU ops) — prefer direct sysfs via pkexec
- LACT can't parse Vega10 clocks table (different pp_od format) — Vega tuning = sysfs only
- `pkexec` works for root ops (GUI auth prompt on desktop)
- Watchdog script: `journalctl -kf` + `pkill SRBMiner` on first `amdgpu 0000:0c:00.0` error — protects against freeze cascade
- Vega `pp_dpm_*` state-mask writes can leave DVFS degraded (halved hashrate at same clocks) → fix = restore full mask + fresh miner process; reboot if persists

## Concurrent legs

ZION (~118 KH/s, gfx1010 duty 5%) + VRSC CPU (~9 MH/s) run alongside in `zion-miner`; `ZION_STREAM2_ENABLED=0` when SRBMiner handles QTU. ZANO stream4 (`gpuCoin2`) verified working (~4.4–5.1 MH/s, A1 R0) but currently disabled — it splits GPU time with SRBMiner ~40/60.

## Pending

- Kernel redesign per `QPOW-LANE-KERNEL-PLAN.md` (SRB ≈ 1.9–2.7× our OpenCL kernel proves headroom)
- Vega intensity 16–17 midpoint test
- Long soak on final config (watchdog armed)
