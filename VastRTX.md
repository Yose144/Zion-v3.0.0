# VastRTX — Trinity + SRBMiner Max-Extraction Report

**Datum:** 2026-10-19 · **Instance:** vast.ai `56680673` · **GPU:** RTX 3060 SM86, 12 GB · **Cena:** $0.068/h
**Miner build:** `zion-miner` z HEAD (on-instance cargo build) · **SRBMiner:** MULTI 3.7.6 (produkční binárka z Edge, md5 `bb2677a2…`)

> ⚠️ Wallet adresy se do tohoto souboru NEpíšou — na instanci jsou v `/root/trinity/{prl,qtu}_wallet.txt`, zdroj = Edge `/etc/zion/edge-environment.sh` (`ZION_POOL_PEARL_UPSTREAM_WALLET`, `ZION_POOL_AUXPOW_WALLET_QTU`).

---

## 1. Solo baselines (RTX 3060, ustálené)

| algo | SRBMiner 3.7.6 | native zion-miner | SRB gain |
|---|---|---|---|
| **pearlhash (PRL)** | **~43–46 TH/s** | ~19–21 TH/s-eq (2762 att/s best) | **~2.2×** |
| **quantus (QTU)** | **197.6 MH/s** | ~127–134 MH/s | **~1.5×** |
| ekam_deeksha (ZION) | — (SRB neumí) | ~16–25 KH/s raw kernel; host-bound | — |

**⚠️ Korekce:** dřívější "SRB PRL solo = 20.8 TH/s" byl artefakt — běžel leftover soak miner. Skutečné solo = **~43–46 TH/s** (match s referencí 46.55 TH/s z instance 56527570). QTU 197.6 MH/s taky match s ref 212.

## 2. Naměřené kombinace (GPU 100 %, ~120 W)

| # | konfigurace | PRL | QTU | ZION | combined % solo* |
|---|---|---|---|---|---|
| — | all-native quad (4/48/48, §18) | ~19 TH/s-eq | 83 MH/s | ~0.4 sh/s | ~85 % |
| A | SRB-QTU + native PRL + ZION | ~9.7 TH/s-eq | 110 MH/s | ~0.4 sh/s | ~78 % |
| D | SRB-PRL + native QTU + ZION | 21.2 TH/s | 61.6 MH/s | ~0.3 sh/s | ~79 % |
| **E** | **SRB-PRL + SRB-QTU + native ZION** | **20.9 TH/s** | **90.6 MH/s** | **~0.25 sh/s** | **~93 %** ✅ |

\* combined % = Σ(podíl nejlepšího možného solo daného coinu). Config E **dominuje native quad na OBŮ coinů zároveň** (20.9>19 PRL i 90.6>83 QTU) — dva SRB procesy se driver-timesharingem dělí ~48/46 a native si vezme ~4 % na ZION.

### PRL duty pod SRB-QTU (pro úplnost)
| native PRL duty | SRB QTU | native PRL |
|---|---|---|
| 100 (free) | 110 MH/s | ~1350 att/s |
| 55 | ~131 MH/s | ~790 att/s |

---

## 3. Vítězná konfigurace — Config E (MAX extraction)

### Native miner — jen ZION (ekam_deeksha), ~4 % karty

```bash
setsid nohup env \
  ZION_V3_TRINITY=1 \
  ZION_STREAM1_ENABLED=1 ZION_STREAM2_ENABLED=0 \
  ZION_STREAM3_ENABLED=0 ZION_STREAM4_ENABLED=0 \
  ZION_GPU_BACKEND=cuda \
  ZION_GPU_WORK_SIZE=2048 \
  ZION_GPU_SKIP_CPU_RESCAN=1 \
  ZION_GPU_TIME_DUTY_PCT=4 \
  ZION_INTERACTIVE=0 ZION_NO_STICKY=1 \
  RUST_LOG=warn RUST_MIN_STACK=67108864 \
  /root/trinity/V31/target/release/zion-miner \
    --pool pool.zionterranova.com:8444 \
    --wallet <ZION_WALLET> --worker vast-3060-hybF \
    --gpu cuda --threads 2 --log-interval 15 \
    --v3-trinity --no-cpu \
  > /root/trinity/hybF.log 2>&1 < /dev/null &
```

### SRBMiner — PRL (upstream LuckyPool)

```bash
setsid nohup ./SRBMiner-MULTI \
  --algorithm pearlhash \
  --pool stratum+tcp://pearl-eu2.luckypool.io:3360 \
  --wallet $(cat prl_wallet.txt) \
  --worker vast3060prl --password x --disable-cpu \
  > /root/trinity/srb-prl3.log 2>&1 < /dev/null &
```

### SRBMiner — QTU (druhý proces, LuckyPool route)

```bash
setsid nohup ./SRBMiner-MULTI \
  --algorithm quantus \
  --pool stratum+tcp://eu.lproute.com:5660 \
  --wallet $(cat qtu_wallet.txt) \
  --worker vast3060qtc --password x --disable-cpu \
  > /root/trinity/srb-qtu3.log 2>&1 < /dev/null &
```

**Naměřeno steady-state:** PRL 20.9 TH/s (A2 R0) + QTU 90.6 MH/s (A3 R0) + ZION ~0.25 sh/s · GPU 100 % · ~120 W · VRAM ~1.3 GB.

### Alternativa: all-native quad (jeden proces, čistší ops)

```bash
ZION_STREAM2_ENABLED=1 ZION_STREAM2_FORCE_COIN=PRL \
ZION_STREAM4_ENABLED=1 ZION_STREAM4_FORCE_COIN=QTU \
ZION_EXT_GPU2_TIME_DUTY_PCT=48 ZION_EXT_GPU_TIME_DUTY_PCT=100 \
ZION_GPU_TIME_DUTY_PCT=4 ZION_PEARL_CUMULATIVE_MMA=1 ZION_PEARL_BATCH=64 \
ZION_GPU_WORK_SIZE=2048 ZION_GPU_SKIP_CPU_RESCAN=1
# → PRL ~2650 att/s + QTU ~83 MH/s + ZION ~0.4 sh/s (single-process duty scheduler)
```

---

## 4. Pool endpointy (produkce)

| coin | endpoint |
|---|---|
| ZION V3 | `pool.zionterranova.com:8444` |
| PRL upstream (prlu:) | `pearl-eu2.luckypool.io:3360` |
| QTU upstream (lproute) | `eu.lproute.com:5660` |

⚠️ `eu.lproute.com:5660` **přijme TCP connect i pro pearlhash** (`Connected ... [pearlhash]`), ale NEPOSÍLÁ joby → SRB tiše hlásí `0.00 H/s`. PRL musí na `pearl-eu2.luckypool.io:3360`.

## 5. Gotchas / zkušenosti

- **`pkill -f "…zion-miner --pool"` zabíjí vlastní SSH shell** (pattern matchne jeho cmdline) → vždy `pkill -x zion-miner` / `pgrep -x`.
- `ZION_STREAM4_FORCE_COIN=QTU` **nepřemapuje** druhý GPU slot samo o sobě — V3 pool coin přiděluje; při `STREAM2_ENABLED=0` + `STREAM4=1` dostal slot ZANO (ProgPoW DAG init, idle). QTU na slot1: `STREAM2_ENABLED=1` + `STREAM2_FORCE_COIN=QTU`.
- SRBMiner hlásí hashrate i bez share flow — vždy hlídat `A/R` sloupce + pool strana.
- `ZION_GPU_SKIP_CPU_RESCAN=1` + `ZION_GPU_WORK_SIZE=2048` = +31 % ZION share rate, −3 GB VRAM (opt-in, viz PEARL-OPTIMIZATION.md §17).
- Native `--threads` škáluje jen syntetickou EWMA metriku, ne reálný share output.
- Instance stále **běží** — Config E soak. ~$1.63/den z kreditu.

## 6. Doporučení pro produkci

1. **SMOS rig (1070 Ti):** produkční wrapper pattern držet — SRBMiner sidecar pro QTU + native ZION/PRL. PRL zatím native (rig kernel ~SM75 path); případný SRB pearlhash sidecar = další krok po ověření endpooint+wallet flow.
2. **Vast/cloud benchmark výsledek:** max extraction = **2× SRBMiner + native ZION** (~93 % combined); pokud jediný proces požadavek → all-native quad (~85 %).
3. PRL profit routing gate beze změny — upstream bridge cesta (viz AGENTS.md 2026-10-20 PRL payout entry).
