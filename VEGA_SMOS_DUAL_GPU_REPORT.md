# Vega SMOS Dual-GPU Claymore Mining Report

**Datum:** 2026-07-25
**Rig:** `vega-smos` (SMOS rig ID 518837)
**Hardware:** AMD Radeon Vega 64 8GB (gfx900, 64 CU) + AMD Radeon RX 5600 XT 6GB (gfx1010, RDNA1)
**Pool:** `62.171.141.136:8444`
**Worker:** `vega-smos`
**Verze:** v90 (`zion-miner-v3.1.9-vega-complete-90.zip`)

---

## 1. Cíl

Dostat dual-GPU rig (Vega 64 + RX 5600 XT) do stavu, kdy obe GPU soucasne tezi ZION (Deeksha Lite v1) a ZANO (ProgPoWZ) v Claymore Dual rezimu, s maximalnim vyuzitim obou karet. CPU tezi VRSC (VerusHash) jako treti stream.

---

## 2. Architektura reseni — Claymore Dual MAX

### Multi-GPU dispatch (ZION)

`MultiGpuMiner` v `gpu_backend.rs` wrapuje dva OpenCL sub-minery (jeden pro kazdou GPU). Kazdy sub-miner ma vlastni OpenCL context/queue — jsou plne nezavisle a thread-safe.

- **Nonce rozdeleni:** Dynamicky vazene podle per-GPU hashrate (EMA alpha=0.3). Rychlejsi GPU dostava vice nonci, aby obe karty skoncily batch soucasne → zadne cekani (idle).
- **Double-buffered async readback:** Kazdy sub-miner ma 2 output buffery (A/B) + dedicated read queue. While GPU pocita chunk N+1, CPU zpracovava chunk N z read queue. GPU pipeline je 100% plna.

### ZANO ProgPoWZ (Stream 2)

ZANO bezi na GPU vybrane pres `ZION_ZANO_DEVICE_NAME=vega` (Vega 64 — nejlepsi ProgPoW priorita). `ZION_ZANO_RESERVE=0` znamena, ze Vega 64 je sdilena mezi ZION (MultiGpuMiner sub-miner) a ZANO (AuxPoW stream) pres time-slicing (`ZION_EXT_GPU_TIME_DUTY_PCT=100`).

### VRSC VerusHash (Stream 3)

CPU thread tezi VerusHash na Intel Pentium G4560 (2 core / 4 thread).

---

## 3. Klicove opravy v v90 (oproti v89)

### 3.1 `ZION_GPU_EARLY_BREAK=0` (kriticke)

v89 mel `ZION_GPU_EARLY_BREAK=1`, coz capnulo batch na jeden chunk (`work_size` nonci) a **kompletnie vyplo double-buffered async readback** — optimalizaci, ktera dava +50% hashrate (commit `a6d8ad35d`, viz `docs/3.0.6/30khsDeeksha.md`).

S `=0` GPU zpracuje cely 65536-nonce batch pres vice chunku s ping-pong A/B buffery. GPU pipeline zustava plna.

**Dopad:** ZION 15.6 → 39.3 kH/s (**2.5x**)

### 3.2 `ZION_GPU_MAX_BATCH=65536` (bylo 32768)

S 2 GPU v MultiGpuMiner, kazda GPU dostava ~polovinu batche. Pri 32768 to byla ~16384 = presne Vega 64 `work_size`. Double-buffering vyzaduje `batch_portion > work_size` (strikne vetsi), takze Vega 64 nikdy double-buffer nepouzila. Pri 65536 kazda GPU dostane ~32768 > 16384 → double-buffering aktivni na obou kartach.

### 3.3 Odstraneno `ZION_AUXPOW_GPU_USE_BPERMUTE=1`

v89 forcivalo bpermute na VSECH GPU vcetne Vega 64 (gfx900), coz muze zpusobit kernel hang. Auto-detekce v `gpu_miner.rs` spravne vypina bpermute na GCN/Vega a zapina na RDNA (RX 5600 XT).

### 3.4 `ZION_EXT_GPU_BATCH_SIZE=2097152` (bylo 4194304)

Snizeni ZANO batche z 4M na 2M (default pro sdilenou GPU). 4M blokovalo Vega 64 prilis dlouho a stavovalo ZION GPU time.

### 3.5 `ZION_GPU_WORK_SIZE=16384` (bylo 32768)

Matchnuto na Vega 64 optimal (GCN hard cap). Auto-tune stejne capne per-device, ale env var je ted konzistentni.

---

## 4. Vysledky

### ZION (Deeksha Lite v1)

| Verze | ZION hashrate | Poznamka |
|-------|--------------|----------|
| v84 (separate GPU) | ~14 kH/s | Vega→ZANO, RX5600→ZION |
| v87 (Claymore, ZANO 1 GPU) | 14.6 kH/s | Obě GPU ZION, ZANO stale 1 GPU |
| v88 (Claymore, even split) | 21.3 kH/s | Obě GPU obě mince, 50/50 split |
| v89 (weighted) | 15.6 kH/s | Dynamic weighting, EARLY_BREAK=1 vyplo double-buffer |
| **v90 (double-buffer fix)** | **39.3 kH/s** | **EARLY_BREAK=0, MAX_BATCH=65536** |

Prumer z poslednich 20 batchu (pool log): 39.3 kH/s, peak 45.8 kH/s.

### ZANO (ProgPoWZ)

ZANO bezi stabilne, shares accepted. Pool log ukazuje pravidelne `external_share_result miner=vega-smos coin=ZANO accepted=true`.

### VRSC (VerusHash CPU)

9 shares accepted za 10 minut — stabilni.

### Pool accept rate

> 99% — pouze 1 rejected share (`job not found` — stale job pri rebootu).

---

## 5. Aktualni konfigurace (v90 wrapper)

```bash
# ZION GPU (Deeksha Lite v1)
export ZION_GPU_WORK_SIZE=16384
export ZION_NONCE_COUNT=65536
export ZION_NONCE_COUNT_MIN=32768
export ZION_NONCE_COUNT_MAX=262144
export ZION_GPU_MAX_BATCH=65536
export ZION_GPU_EARLY_BREAK=0          # ← kriticke: double-buffer aktivni
export ZION_GPU_NO_STREAM_BYPRODUCT=1

# Triple stream
export ZION_STREAM1_ENABLED=1          # ZION GPU
export ZION_STREAM2_ENABLED=1          # ZANO GPU (ProgPoWZ)
export ZION_STREAM3_ENABLED=1          # VRSC CPU
export ZION_STREAM2_FORCE_COIN=ZANO
export ZION_MINER_CPU_COIN=VRSC
export ZION_EXT_CPU_NONCE_COUNT=2000000

# ZANO / AuxPoW GPU
export ZION_ZANO_RESERVE=0             # vsechny GPU na ZION, ZANO time-sliced
export ZION_ZANO_DEVICE_NAME=vega      # Vega 64 pro ProgPoWZ
export ZION_EXT_GPU_TIME_DUTY_PCT=100
export ZION_SECONDARY_GPU_WORK_SIZE=1048576
export ZION_AUXPOW_GPU_WORK_SIZE=1048576
export ZION_AUXPOW_GPU_GROUP_SIZE=128
export ZION_AUXPOW_GPU_VRAM_PCT=50
export ZION_AUXPOW_GPU_BYTES_PER_ITEM=64
export ZION_ZANO_STALE_SECS=30
export ZION_EXT_GPU_BATCH_SIZE=2097152 # 2M (sdilena GPU)
```

---

## 6. Zmeny v kodu

### `V3/L1/miner/src/gpu_backend.rs`

- **`MultiGpuMiner`** (line ~560): Per-GPU hashrate tracking (EMA), `compute_weighted_ranges()` pro proportional nonce split, `update_hashrates()` pro dynamicky balancing.
- **`create_gpu_backend()`** (line ~2068): Multi-GPU enumeration s `GpuDeviceInfo` struct (gfx codename, CU count, VRAM, PCI bus). `ZION_ZANO_RESERVE=0` rezim: vsechny GPU na ZION, ZANO time-sliced.
- **`create_gpu_backend_with_cuda_device()`** (no-CUDA path, line ~2429): Routuje pres `create_gpu_backend` (ne pres `create_gpu_backend_inner`), aby ZANO taky dostal multi-GPU.
- **`OpenClExternalMiner`**: Pridan `device_name_cached: String` field.

### `AuXpow/src/gpu_miner.rs`

- **`GpuMiner::device_name()`** getter (line ~390).
- **`auxpow_device_name_matches_filter`** fix (line ~2502).

### `V3/L1/miner/src/main.rs`

- Stream 2 (external GPU) thread predava `work_size` z `config.secondary_gpu_work_size`.

---

## 7. Build & Deploy

### Build

```bash
# Docker build (rust:1.97-bullseye, GLIBC ≤2.31)
/tmp/build_complete.sh
# Output: /home/zionserver/2.9.6-main/zion-miner-built
```

Features: `gpu-opencl,native-hashers,native-verushash,native-randomx`

### Deploy

1. `scp zion-miner-built zion-new:/var/www/zion-miner/zion-miner`
2. Vytvorit wrapper ZIP na Edge: `/var/www/zion-miner/zion-miner-v3.1.9-vega-complete-90.zip`
3. SMOS API: `PUT /rig-groups/1773590` s `minerOptions` = URL ZIPu
4. `PATCH /rigs/execute-command` — clear cache (`rm -rf /root/miner/zion-miner-v3.1.9-vega-*`)
5. `PUT /rigs/518837` — `{"execute":"reboot"}`

### Deploy script

`/tmp/deploy_v90.py` — automatizovany deploy pres SMOS API.

---

## 8. Soubory

```
MinerP3.0.6/Smos/
├── VEGA_SMAXOS_TUNING_REPORT.md      # v70 era report (historicky)
├── VEGA_SMOS_DUAL_GPU_REPORT.md      # tento report (v90)
├── vega-smos.env                      # ulozena env konfigurace (v70)
├── vega-smos.deploy.sh                # deploy script (v70 pattern)
└── wrapper_complete.sh                # v70 wrapper (historicky)

# v90 wrapper je na Edge serveru:
/var/www/zion-miner/zion-miner-v3.1.9-vega-complete-90.zip
```

---

## 9. Stav

**Rig je dolazeny a stabilni.** v90 bezi s:

- ZION: ~39 kH/s (2.5x zlepseni oproti v89)
- ZANO: stabilni ProgPoWZ na Vega 64
- VRSC: stabilni VerusHash na CPU
- Pool accept rate: > 99%
- 0 kernel hangy

---

## 10. Co dals (doporuceni)

- **Per-GPU work_size tuning:** Vega 64 optimal = 16384, RX 5600 XT optimal = 8192. Momentalne oba sub-minery dedi stejny `work_size` z env. Auto-tune to opravuje per-device, ale explicitni per-GPU override by mohl pomoci.
- **Duplicate ZANO shares:** Pool obcas vraci `duplicate share`. Miner-side dedup (track submitted `(job_id, nonce)` per stream).
- **Long-term stability test:** 24-48h monitoring teplot a kernel hangy.
