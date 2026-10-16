# Mining Status Report — 2026-10-06

Kompletní stav ZION V31 Trinity mining setupu po dnešním ladění.
Všechna čísla jsou **pool-verified** (Edge journal `v3_external_submit`/`v3_external_forward`
× upstream job-suffix diff), ne jen miner-side odhady.

## Topologie

| Stroj | GPU | Worker | Streamy |
|---|---|---|---|
| SMOS rig `518837` (skupina 1780844 "ZionTrinity") | RX Vega 64 (gfx900) + RX 5600 XT (gfx1010), CPU Pentium G4560 4T | `vega-smos` | ZION + QTU (GPU), VRSC (CPU) |
| Lokální desktop (`zionserver` host) | GTX 1070 Ti 8 GB (sm_61, CUDA), CPU 11T | `dest-zion@g=zion` | ZION + QTU (GPU), VRSC (CPU) |

Pool: `zion-v31-pool` na Edge `62.171.141.136:8444` → upstream k1pool (QTU),
Herominers (ZANO bridge připraven), VRSC pool.

## Aktuální výkon (měřeno na poolu)

### QTU (Quantus QPoW) — k1pool

| Worker | Pool-effective | Accept | Pozn. |
|---|---|---|---|
| vega-smos | **~48–51 MH/s** | 100 % (0 rej/12min) | Vega ~49 + 5600 XT ~24-29 (70 % času) |
| dest-zion | **~21–27 MH/s** | 100 % | 1070 Ti @ duty=25 ZION |
| **Celkem** | **~70–75 MH/s** | | před laděním ~58 |

### ZION (deeksha ekam/lite)

| Worker | Efektivní | Pozn. |
|---|---|---|
| vega-smos | ~230 KH/s (kernel-rate ~750 KH/s @ 30 % duty na 5600 XT) | shar(y) plynule accepted |
| dest-zion | ~750 KH/s kernel-rate @ 25 % duty | 0 rejects |

### VRSC (CPU)

| Worker | Hashrate | Accept |
|---|---|---|
| vega-smos | ~1.6 MH/s | ~92 % (občas dup/stale race) |
| dest-zion | ~3.4 MH/s | ~98 % |

## Rozložení GPU času (cílové)

- **Vega 64:** čisté QPoW — nejlepší karta pro Poseidon2 (`ZION_ZANO_RESERVE=1`, `ZION_ZANO_DEVICE_NAME=vega`)
- **5600 XT:** QPoW ~70 % + ZION ~30 % (`ZION_GPU_TIME_DUTY_PCT=30`, driver timesharing)
- **1070 Ti:** QPoW ~75 % + ZION ~25 % (`ZION_GPU_TIME_DUTY_PCT=25` přes wrapper)
- QPoW Multi: `ZION_QPOW_OCL_DEVICES=gfx900,gfx1010` → `QpowGpuMiner::Multi` s hashrate-weighted nonce split

## Dnešní tuning sweep (rig)

| Parametr | Testováno | Výsledek |
|---|---|---|
| `ZION_QPOW_OCL_LOCAL_SIZE` | 64 / 128 / 256 | flat |
| `ZION_QPOW_OCL_NPT` | 1 / 4 / 8 | **NPT=4 ≈ +10–15 %**, NPT=8 flat vs 4 |
| `ZION_STREAM2_BATCH` | 4M / 8M / 16M | **8M ≈ +10 %**, 16M flat |
| `ZION_GPU_TIME_DUTY_PCT` | 100 / 60 / 30 | 30 = specifikace (ZION ~30 %) |

Vyladěné hodnoty jsou teď defaults ve `wrapper_v31_trinity.sh` (zip **v3.4.18**).

**Opravený bug:** `ZION_STREAM2_BATCH=4194304` byl ve wrapperu hardcoded
→ minerOptions passthrough se přepisoval. Nyní `:-` default.

## Verifikace accept/reject na poolu (29min + 12min okna)

- vega-smos QTU: **66/66 + 32/32 Accepted, 0 rejects**
- dest-zion QTU: **23/23 + 10/10 Accepted, 0 rejects**
- ZION `v3_share`: tisíce accepted, **0 rejects**
- VRSC: jednotlivé `duplicate share` / `job not found` = normální stale racy

Duplicate-share fix z 5.10. (per-session nonce salt) drží — **0 QTU dupů**.

## Provedené změny (dnes)

### Kód
- `runtime.rs` — `ZION_GPU_TIME_DUTY_PCT` duty-cycle na ZION stream (post-batch sleep `gpu_ms·(100−d)/d`), obě ZION cesty
- `gpu/mod.rs` — `QpowGpuMiner::Multi` (paralelní multi-device QPoW, weighted split), `per_gpu_hashrates`, fix single-sub-miner EMA
- `runtime.rs` — `ZION_QPOW_OCL_DEVICES` filtr funguje i pod `RESERVE=1`
- `desktop-agent/src/main.js` — `gpuZionDutyPct` config → `ZION_GPU_TIME_DUTY_PCT` env

### SMOS telemetrie (rozluštěno z `/root/utils/miner_api.sh`)
- Parser `^teamredminer`: `devs+summary+devs2+summary2` na `127.0.0.1:4028`
- Nested sekce, klíč **`KHS 30s`** (KH/s×1000→H/s), `Accepted`/`Rejected`
- `smos_api.py` sidecar emituje kompletní schéma; vestavěný Rust API jako fallback
- `api-beat` heartbeat (1/min) → Edge nginx access.log = observability kanál
- SMOS dashboard live: `hash` (QTU), `hash2` (ZION), per-GPU h1/h2 správně

### Lokální stroj (dest-zion)
- Stará binárka (Oct-5) neměla duty knob → ZION žral ~60 % GPU
- Nová release binárka → `resources/zion-miner.bin` + bash wrapper `zion-miner`
  exportuje `ZION_GPU_TIME_DUTY_PCT=25`
- Agent failover respawn po SIGKILL za ~5 s — bez restartu Electron UI
- `miner_config.json`: `gpuZionDutyPct=25` pro budoucí restarty agenta

### Deploy artifacts
- Rig binary: `/var/www/zion-miner/zion-miner-v31` (bullseye build, `target-cpu=x86-64` kvůli G4560 bez AVX)
- SMOS zip: `teamredminer-zion-trinity-smos-v3.4.18.zip` (folder v zipu, `miner`=wrapper + `smos_api.py`)
- minerOptions: `ZION_QPOW_OCL_DEVICES=gfx900,gfx1010 ZION_GPU_TIME_DUTY_PCT=30`
- Lokální backupy: `zion-miner.bak-preduty-*` v resources

## Poznámky / limity měření

- Miner-side EMA vs pool-effective se liší ~15–25 % (EMA = kernel-time;
  stale drops, job rotation, mezibatch mezery nepočítá). **Pro rozhodnutí používat
  jen pool submit rate.**
- Občasné ~1–2 min mezery v submitech = upstream/network blip k1poolu —
  miner běží dál, submits se obnoví samy.
- `http://127.0.0.1:8444/api/pool/miners-dashboard` vrací empty reply —
  stratum port není HTTP endpoint; pool stats ověřovat přes journal, ne curl.

## Rollback

- Rig: SMOS group minerOptions → starší zip (`…-v3.4.14.zip`), nebo
  `ZION_GPU_TIME_DUTY_PCT=100` (ZION full) / `ZION_STREAM2_FORCE_COIN=ZANO` (ZANO rollback)
- Lokál: `mv resources/zion-miner.bak-preduty-* resources/zion-miner` +
  restart mineru; nebo `ZION_GPU_TIME_DUTY_PCT=100` env před startem agenta
- Binárka Edge: `zion-miner-v31.bak-pre-multiqpow-*`

## Co zbývá jako možné vylepšení (odhad přínosu)

- ZION duty 30→20 na 5600 XT: +2–3 MH/s QTU, −80 KH/s ZION
- Kernel-level QPoW optimalizace (Montgomery repr., field-op batching): náročné, ±10–20 % teoreticky
- Per-device `ZION_QPOW_OCL_*` env (teď globální): malé
- 1070 Ti: `gpuStream2Batch` 1M→4M: <2 %
