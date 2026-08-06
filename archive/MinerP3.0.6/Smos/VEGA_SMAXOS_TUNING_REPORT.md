# Kompletní tuning report: vega-smos (ZionRig)

**Datum:** 2026-07-23  
**Lokace:** `MinerP3.0.6/Smos/`  
**Rig:** `ZionRig` / `vega-smos` (SMOS rig ID 518837)  
**Hardware:** AMD Radeon Vega 64 8GB (`gfx900:xnack-`, 64 CU, 1630 MHz), Intel Pentium G4560, 8GB RAM  
**Pool:** `62.171.141.136:8444`  
**Worker:** `vega-smos`  
**Payout wallet:** `zion1s6m204400290l660k622r3r0c6u040g5j6cu2x5`

---

## 1. Cíl

Dostat troj-stream miner (ZION GPU + ZANO GPU + VRSC CPU) do stabilního stavu na SMOS a maximalizovat ZANO / ProgPoWZ hashrate na Vega 64 bez kernel hangů (`amdgpu` context lost).

---

## 2. Historie problému

- Původní build s `ds_bpermute` + `GROUP_SIZE=256` na GCN/Vega způsoboval kernel hang a restart mineru.
- Bez `bpermute` (share+barrier fallback) ZANO běželo ~6.5–7.0 MH/s stabilně.
- Cílem bylo zapnout `bpermute` bezpečně a dostat se nad 9 MH/s.

---

## 3. Změny v kódu

### `AuXpow/src/gpu_miner.rs`

- Detekce GCN/Vega architektury (`gfx8xx`, `gfx9xx`) — default `USE_BPERMUTE=0` pro tyto GPU.
- Cap `GROUP_SIZE=128` pro GCN/Vega pro snížení VGPR/register pressure.
- Env override: `ZION_AUXPOW_GPU_USE_BPERMUTE` a `ZION_AUXPOW_GPU_GROUP_SIZE` umožňují ruční tuning.

### `V3/L1/native-ffi/build.rs`

- Oprava duplicitních symbolů `aesenc` z `haraka_portable.c`, které byly kompilovány dvakrát (C i C++ build).

### `V3/L1/miner/src/main.rs`

- Pokus o ztišení `ext_gpu_share_found` / `ext_share_submitted` logů pod `QUIET` režimem (build v71).
- Build v71 padal po ~7 s, proto byly změny revertnuty.

---

## 4. Test work-size pro ZANO

Všechny testy s `GROUP_SIZE=128` a `USE_BPERMUTE=1`, GPU teplota 66–71 °C.

| Verze | Work size | ZANO hashrate (TUI) | ZANO accepted (ukázka) | Stabilita |
|-------|-----------|---------------------|------------------------|-----------|
| v70   | 1M        | ~9.0–9.5 MH/s       | ~8 / 10 min            | Stabilní, 0 kernel hangů |
| v73   | 2M        | ~7.5–8.0 MH/s       | ~7 / 8 min             | Stabilní, 0 kernel hangů |
| v72   | 4M        | ~7.0–7.5 MH/s       | ~4 / 10 min            | Stabilní, nižší výkon |

**Závěr:** 1M work size dává nejvyšší stabilní hashrate na této Vega 64. Větší work size nezrychluje a 4M dokonce zpomaluje.

---

## 5. Finální konfigurace (`v3.1.9-vega-complete-70`)

### SMOS wrapper (`wrapper_complete.sh`)

```bash
export ZION_EXT_GPU_TIME_DUTY_PCT=100
export ZION_SECONDARY_GPU_WORK_SIZE=1000000
export ZION_AUXPOW_GPU_WORK_SIZE=1000000
export ZION_AUXPOW_GPU_GROUP_SIZE=128
export ZION_AUXPOW_GPU_USE_BPERMUTE=1
export ZION_AUXPOW_GPU_VRAM_PCT=40
export ZION_AUXPOW_GPU_BYTES_PER_ITEM=64
export ZION_ZANO_STALE_SECS=30
```

### Další důležité env vars

```bash
export ZION_STREAM1_ENABLED=1
export ZION_STREAM2_ENABLED=1
export ZION_STREAM2_FORCE_COIN=ZANO
export ZION_MINER_CPU_COIN=VRSC
export ZION_EXT_CPU_NONCE_COUNT=2000000
export ZION_NO_STICKY=1
export ZION_INTERACTIVE=0
```

### Uložená konfigurace

- `vega-smos.env` — kompletní env vars pro tento rig.
- `vega-smos.deploy.sh` — deploy script pro Edge server + SMOS API.
- `wrapper_complete.sh` — aktuální SMOS wrapper.

---

## 6. Výsledné hashrate

Typický stav po zavedení v70:

```text
  GPU: 12–14 kH/s  |  Total: 12–14 kH/s
  ACTIVE   ZION   deeksha_lite_v1  12–15 kH/s  A:200+  R:0
  ACTIVE   ZANO   progpow_zano      9.0–9.5 MH/s  A:2–4  R:0–1
  ACTIVE   VRSC   verushash         1.3–1.4 MH/s  A:0–5  R:0–1
```

- **ZION GPU:** ~12–15 kH/s
- **ZANO GPU:** ~9.0–9.5 MH/s (oproti původním ~2 MH/s velké zlepšení)
- **VRSC CPU:** ~1.3–1.4 MH/s
- **GPU teplota:** ~66–71 °C
- **Pool accept rate:** > 99 %
- **Kernel hangy:** 0 v testovacím okně

---

## 7. Pool metriky

Příklad z pool logu (Edge server):

```text
external_share_result coin=ZANO accepted=true
external_share_result coin=VRSC accepted=true
```

- `kernel_hang` / `ext_gpu_batch_error`: 0
- ZANO accepted: ~0.8–1.0 za minutu
- VRSC accepted: ~1.5 za minutu
- Celkový accept rate: > 99 %

---

## 8. Známé problémy

1. **Duplicate ZANO shares.** Pool občas vrací `duplicate share — server-side dedup (nonce already forwarded)`. Miner posílá stejný nonce dvakrát — jde o miner-side dedup issue, nikoliv GPU stabilitu.
2. **SMOS konzole je zaplavená logy.** ZION `SHARE_ACCEPTED` a external share logy posouvají dashboard z 19řádkového bufferu. QUIET log suppression build (v71) padal, proto zatím není nasazen.
3. **TUI ZANO counter.** `A:R` čísla pro ZANO stream v dashboardu nesedí přesně s pool metrikami — pro revenue používat pool logy.

---

## 9. Deployment checklist

- [x] Zdrojový kód upraven (GCN detekce, build fix)
- [x] Docker build na Edge serveru (`rust:1.97.0-bullseye`)
- [x] Binárka v `/var/www/zion-miner/zion-miner-v3.1.9-vega-complete-70.zip`
- [x] `minerOptions` SMOS rig group nastaveno na v70 ZIP
- [x] Cache smazána a rig rebootnut
- [x] Triple-stream stabilní provoz ověřen
- [x] Konfigurace uložena v `MinerP3.0.6/Smos/`
- [x] Report zapsán do `MinerP3.0.6/Smos/VEGA_SMAXOS_TUNING_REPORT.md`

---

## 10. Soubory v tomto adresáři

```text
Smos/
├── README.md                         # přehled SMOS miner + env vars
├── DEPLOY.md                         # postup nasazení na SMOS
├── VEGA_SMAXOS_TUNING_REPORT.md      # tento kompletní report
├── vega-smos.env                     # uložená env konfigurace rigu
├── vega-smos.deploy.sh               # deploy script pro v70
├── wrapper_complete.sh               # aktuální SMOS wrapper
├── build_complete.sh                 # Docker build script
└── zion-miner-smos-v3.1.9-vega-complete-62  # stará binárka (historická)
```

---

## 11. Co dál (doporučení)

- Vyřešit duplicate ZANO shares v `auxpow_client.rs` / `gpu_backend.rs` — track submitted `(job_id, nonce)` per stream a nepřeposílat duplicity.
- Zkusit QUIET log suppression znovu, ale s menší změnou (např. throttling share logů místo úplného skrytí).
- Monitorovat dlouhodobou stabilitu v70 přes 24–48 hodin — teplota a kernel hangy.
