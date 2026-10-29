# Rig Config Report — `vega-smos` (SimpleMining)

**Snapshot:** 2026-10-29 ~14:50 CET · Host `192.168.1.114` (DHCP) · GPU: AMD RX Vega (gfx900) · CPU: Pentium G4560 (4T, no AVX)

## Revenue streams — live state

| Stream | Coin | Driver | Rate (live) | Pool | Accept |
|--------|------|--------|------------:|------|-------:|
| QTU sidecar | QTU (`quantus`) | SRBMiner-MULTI **3.7.9** + ROCm 5.4.6 userland | **~134–144 MH/s** | `eu.lproute.com:5660` | running |
| Stream 4 (gpu-external-2) | **ZANO** (`progpow_zano`) | zion-miner OpenCL, dedicated EthStratum | **~11 MH/s** active (~3.3 MH/s effective @ duty 30) | `de.zano.herominers.com:1110` | **2/2 = 100%** |
| Stream 1 (zion) | **ZION** (`ekam_deeksha`) | zion-miner OpenCL, duty 12% | **~47 KH/s** | `62.171.141.136:8444` (V3 Trinity) | 100% |
| Stream 3 (cpu-external) | **VRSC** (`verushash`) | zion-miner CPU, 4 threads | **~1.4–1.5 MH/s** | pool-relayed via Trinity | 100% |

Stream 2 (gpu-external) is **disabled** — QTU lives in the SRBMiner sidecar
(~2× our native kernel on gfx900; ROCm userland fixes the `can't build
program` failure of the stock SMOS OpenCL stack).

## Miner processes

```bash
# zion-miner (V3 Trinity) — streams 1,3,4
/tmp/zion-miner-v31-cuda --pool 62.171.141.136:8444 \
  --wallet zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6 \
  --worker vega-smos --gpu opencl --threads 4 --log-interval 15 --v3-trinity

# SRBMiner sidecar — QTU owner
/root/srb379/SRBMiner-Multi-3-7-9/SRBMiner-MULTI --algorithm quantus \
  --pool stratum+tcp://eu.lproute.com:5660 \
  --wallet qzjoHwaJ2GfiRSHyYkYcpoJFbHct9pb9EAbs7sE51Uhj8r2zb \
  --worker vega-smos --password x --disable-cpu \
  --api-enable --api-port 21550 --log-file /tmp/srbminer.log --gpu-intensity 30
```

Launch env for SRBMiner prepends `LD_LIBRARY_PATH=/root/rocm546/...` (ROCm
5.4.6 userland, unpacked focal debs — see §15 of `docs/3.0.6/VegaRig.md`).
Wrapper guard `pkill -x SRBMiner-MULTI` before spawn (orphan-sidecar fix).

## Key env (from `/proc/<miner>/environ`)

```ini
# stream enables
ZION_STREAM1_ENABLED=1      # ZION
ZION_STREAM2_ENABLED=0      # QTU → SRBMiner sidecar instead
ZION_STREAM3_ENABLED=1      # VRSC cpu
ZION_STREAM4_ENABLED=1      # ZANO dedicated upstream

# stream4 — ZANO direct (decoupled from Trinity, survives pool outages)
ZION_STREAM4_FORCE_COIN=ZANO
ZION_STREAM4_URL=stratum+tcp://de.zano.herominers.com:1110
ZION_STREAM4_WALLET=ZxCFngZg2XUHmxm7zTL9jwEaDKNPCBDoCZv44myC6PesBXEXrbq8NRaDpkmL7utcYhiLXB2KiJyVmA5atrQbd7Ai2SX3nptts
ZION_STREAM4_PASSWORD=x
ZION_EXT_GPU2_TIME_DUTY_PCT=30

# GPU backends
ZION_GPU_BACKEND=opencl
ZION_EXT_GPU_BACKEND=opencl
ZION_QPOW_BACKEND=opencl
ZION_GPU_TIME_DUTY_PCT=12        # ZION minimal GPU share
ZION_EXT_GPU_TIME_DUTY_PCT=100
ZION_ZANO_DEVICE_NAME=vega
ZION_ZANO_RESERVE=0

# auxpow / batching
ZION_AUXPOW_GPU_WORK_SIZE=1048576
ZION_AUXPOW_PROGPOW_MAX_GWS=1048576
ZION_AUXPOW_GPU_GROUP_SIZE=128
ZION_AUXPOW_GPU_VRAM_PCT=50
ZION_STREAM3_BATCH=2000000
ZION_EXT_CPU_NONCE_COUNT=2000000

# misc
ZION_V3_TRINITY=1
ZION_MINER_ALGORITHM=ekam_deeksha
ZION_MINER_CPU_COIN=VRSC
ZION_STRATUM_TRACE=1             # wire-level stratum tx/rx logging
SRB_ENABLED=1 SRB_GPU_INTENSITY=30
RUST_LOG=info
```

## Deploy chain (SMOS package)

- Package: `custom_teamredminer-zion-trinity-srb-v1.7` — patched tarball at
  `/root/miner_org/custom_teamredminer-zion-trinity-srb-v1.7.tar.gz`
  (survives reboot; SMOS may re-download → check `miner_org` copy stays
  patched).
- Wrapper prefers persistent binary **`/root/zion-miner-v31-zano`** over
  EDGE download → copied to `/tmp/zion-miner-v31-cuda` at launch.
- Current binary (non-public build for wire diagnostics, md5 `4d3fc431…`):
  features `gpu-opencl,native-hashers,native-cosmic-harmony,native-randomx,
  native-verushash,native-ghostrider,tui` — built in `rust:1.97-bullseye`
  docker, `RUSTFLAGS="-C target-cpu=x86-64"` (G4560 has no AVX).
  ⚠️ `native-hashers` is **mandatory** for ProgPowZ DAG generation.
- ROCm stack: `/root/rocm546/` (`comgr`, `hsa-rocr`, `rocm-opencl`,
  `rocm-ocl-icd`, `rocm-core` 5.4.6 focal debs unpacked, `LD_LIBRARY_PATH`
  only — no driver install; kernel `/dev/kfd` already present).
- Logs: `/var/tmp/screen.miner.log` (zion+wrapper), `/tmp/srbminer.log`.

## Notes

- ZANO stream4 is **decoupled** from the V3 Trinity session
  (`runtime.rs` — spawned in `run_v3_trinity`, outside the pool
  session): a project-pool outage no longer stops HeroMiners mining.
  Verified live: `ESTABLISHED → 178.63.50.103:1110` while `:8444` refused.
- HeroMiners ZANO port 1110 = fixed diff **1e9** → expected ~1 share per
  ~3.3e9 effective hashes (~5 min @ duty-30 rate). API confirms
  `roundHashes = 2e9` for the 2 accepted shares.
- Reject-history: the pre-fix binary sent `mining.submit` (yiimp) for
  `progpow_zano` → `"Method not found"`. Now `eth_submitWork` covers the
  whole `EthStratum` protocol family.
- Thermals: ~67–68 °C, ~220 W, fans ~3.2k RPM — stable co-resident.

## 2026-10-29 (2) — SMOS package wipe + durable fix; VRSC disabled

**Incident:** `kill <miner-pid>` for a config restart triggered the SMOS
watchdog to **re-download the whole custom package** from
`http://62.171.141.136/zion-miner/teamredminer-zion-trinity-srb-v1.7.zip`
→ `/root/miner/custom_*/miner` reverted to stock (20880 B, Oct 13) →
all local patches lost: `STREAM4=0`, `STREAM3=1`, stock `/tmp` binary
+ duplicate `/tmp/SRBMiner-MULTI` next to `/root/srb379` one.

**Durable fix (survives re-extract):**
- EDGE zip `teamredminer-zion-trinity-srb-v1.7.zip` patched IN PLACE
  (`/var/www/zion-miner/`, bak `.zip.bak-20261029`) — every future
  re-download now contains the patched `miner` script (STREAM4 ZANO
  block, `CUSTOM_MINER=/root/zion-miner-v31-zano` override, ROCm SRB
  path, orphan `pkill -x SRBMiner-MULTI` guard).
- Rig: `pkgwork/miner` = canonical patched script (also installed to
  `miner/` + repacked `miner_org` tarball + regenerated `.md5`).

**VRSC off:** `ZION_STREAM3_ENABLED="${ZION_STREAM3_ENABLED:-0}"` —
patched in all three places (live miner, miner_org tarball, EDGE zip).
Re-enable via SMOS minerOptions token `ZION_STREAM3_ENABLED=1`.
Verified: `cpu-external` stream idle, ZION ~48 KH/s, ZANO active.
