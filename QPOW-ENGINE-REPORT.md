# QPoW Engine — Stav, Architektura a Verifikovaný Výkon

**Datum:** 2026-10-06 · **Scope:** QPoW (Quantus/Poseidon2-Goldilocks) GPU mining v nativním zion-mineru — rig + lokální desktop-agent, ext. pool `62.171.141.136:8444` → upstream k1pool.

---

## 1. Topologie a aktuální výkon (pool-verified)

| Uzel | GPU | Backend | Role | QPoW | Poznámka |
|---|---|---|---|---|---|
| `vega-smos` | RX Vega 64 (gfx900) | OpenCL | čisté QPoW | ~42–49 MH/s | kernel-rate ~49, pool-eff. ~42–51 |
| `vega-smos` | RX 5600 XT (gfx1010) | OpenCL | dual ZION@30% + QPoW | ~24–29 MH/s | ZION ~700 KH/s kernel navrch |
| `dest-zion` | GTX 1070 Ti (sm_61) | CUDA | dual ZION@25% + QPoW | **~30–33 MH/s** | + btcunlock @15 % duty |
| `dest-zion` | CPU (11 vláken) | — | VRSC | ~4.3 MH/s | |

**Součet QTU na ext. pool: ~72–75 MH/s**, 0 rejects v čistých oknech (29 min: 89/89 accepted).

Share-rate → hashrate: `rate = Σ(upstream_diff) / window`. Upstream diff je suffix v `job_id` (`1889xxxx_1000000000`), vardiff se adaptivně zvedá (1e9 → 2e9) → Poisson šum na krátkých oknech; měřit ≥10 min.

## 2. Backendy

### OpenCL (AMD) — `V31/L1/miner/src/gpu/qpow_opencl.rs`

- Kernel `csrc/opencl/poseidon2_kernel.cl` — čistá u64 Goldilocks aritmetika (Poseidon2 nad p = 2⁶⁴−2³²+1), compute-bound.
- **Vyladěné defaults (sweep 6. 10.):** `ZION_STREAM2_BATCH=8388608` (8M), `ZION_QPOW_OCL_NPT=4` (nonces/thread), `ZION_QPOW_OCL_LOCAL_SIZE=64`.
- Sweep výsledky: NPT 1→4 = **+10–15 % kernel-rate**; NPT=8 flat; LS 64/128/256 flat; batch 4M→8M +malé, 16M flat → strop kernelu.
- Multi-GPU: `QpowGpuMiner::Multi` (`gpu/mod.rs`) — **hashrate-weighted nonce partition** přes `thread::scope`, per-device EMA; NENÍ 50/50 split (pomalá karta neblokuje rychlou).
- Device filter `ZION_QPOW_OCL_DEVICES=gfx900,gfx1010` — funguje i pod `ZION_ZANO_RESERVE=1` (fix `6a1f4173d`).

### CUDA (NVIDIA) — `V31/L1/miner/src/gpu/qpow_cuda.rs`

- `QPOW_THREADS_PER_BLOCK=256`, `QPOW_MAX_BLOCKS=4096`, `nonces_per_thread=1`.
- sm_61 (1070 Ti) měření v kódu: **NPT=1 ~40 MH/s > NPT=5 ~35 MH/s** — NPT na CUDA nezvedat.
- Tunables: `ZION_CUDA_WORK_CAP`, `ZION_CUDA_TPB`, `ZION_CUDA_MAX_WORK_SIZE`, `ZION_STREAM2_BATCH`.
- **1070 Ti solo QPoW: ~33–34 MH/s** (nad referencem v AGENTS.md 38–40 MH/s — reálné délící se o ZION 25 % + btcunlock 15 %).

### CPU fallback

Existuje, ale ~2 řády pomalejší — jen pro stroje bez GPU.

## 3. Duty-cycle koordinace (multi-stream GPU sharing)

Jeden GPU = časově sdílený mezi streamy. Throttle je vždy **měřený kernel-time → proporcionální sleep** (ne aplikace-levý gap):

| Knob | Strana | Význam |
|---|---|---|
| `ZION_GPU_TIME_DUTY_PCT` | ZION stream | % GPU času pro ZION (default 100); 25–30 doporučeno |
| `ZION_EXT_GPU_TIME_DUTY_PCT` | ext/QPoW stream | % pro QPoW (100 = plný) |
| `BTCUNLOCK_GPU_DUTY` / `--gpu-duty` | btcunlock keyscan | % pro lottery scan |

⚠️ Gap-based throttle (`ZION_EXT_GPU_GAP_MS`) je **mrtvá páka** — aplikuje se jen po nalezené share, ne po každém batchi. Duty-cycle je správný mechanismus.

### dest-zion 3-stream koexistence (6. 10. večer)

`zion-btcunlock.service` (puzzle #71 keyscan, ~23.8 Mk/s neomezeně) **dusil miner na ~12–17 MH/s QTU**. Po nasazení `--gpu-duty 15`: btcunlock ~3.5 Mk/s + QTU ~30–33 MH/s + ZION ~1.3 MH/s současně, 0 rejects. Implementace: `BTCunlock/src/keyscan.rs` (`gpu_duty_pct`), `btcunlock-worker.py` (`BTCUNLOCK_GPU_DUTY`), systemd `zion-btcunlock.service` `Environment=BTCUNLOCK_GPU_DUTY=15`. Commit `ac0e33dce`.

## 4. Share-pipeline a duplicity

- Ext stream loop `runtime.rs`: kontinuální batche na aktuálním jobu, stale-check před submitem (`job_id` rotace → drop).
- **Duplicate-share fix `08783ca49`:** session-specific nonce salt z worker/session/job — dřív všechny sessiony skenovaly stejný low64 prostor → duplikáty mezi workery. Ověřeno: 0 dup rejects ve 29-min okně.
- Watchdog: 300 s bez jakékoliv share → exit(1) → agent failover respawn (~5 s).

## 5. SMOS observability (rozluštěno)

SMOS `miner_api.sh` pro `teamredminer-*` zípy: posílá `{"command":"devs+summary+devs2+summary2"}` na `127.0.0.1:4028` a parsuje **`.devs.DEVS[]."KHS 30s"`** (×1000 → H/s), `.summary.SUMMARY[]` → `hash`, `.summary2` → `hash2` (dual). Sidecar `smos_api.py` emituje cgminer-text i JSON nested+flat. Per-GPU: `devs` = QPoW per karta, `devs2` = ZION per karta.

Console: `ZION_INTERACTIVE=0` + `--log-interval 15` → `[metrics] QTU: .. [gfx1010=.. gfx900=..] A.. R.. | zion: .. | VRSC: ..` každých 15 s.

## 6. Známé limity / TODO

- OpenCL kernel je na stropu pro tuto architekturu — další výkon jen přes hlubokou přepis (Montgomery repr., fused rounds, INT32 tricks) — risk/effort vysoký.
- Miner EMA ≠ wall-clock efektivní rate u duty-cyclu (EMA počítá kernel-time, ne GPU-čas) — agregáty na poolu jsou pravda, `devs`/`devs2` "KHS 30s" je instant rate.
- `--metrics` endpoint + stats file `/tmp/zion-miner-stats.json` = strojově čitelný stav (per-stream, per-GPU, A/R).

## 7. Reprodukce měření

```bash
# pool-side efektivní QTU rate (diff-weighted), okno N minut:
journalctl -u zion-v31-pool --since "N min ago" | grep v3_external_submit \
  | grep <worker> | grep QTU | grep -oE '_[0-9]+' | tr -d _ \
  | awk '{s+=$1;n++} END{print n, s/(N*60)/1e6, "MH/s"}'

# miner-side: tail miner.log | grep "QTU:" / SMOS konzole [metrics]
```
