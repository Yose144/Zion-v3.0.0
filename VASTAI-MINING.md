# Vast.ai → Mining — rychlý návod

Jak najít nejlevnější GPU instanci na Vast.ai a pustit na ní SRBMiner (QTU/PRL/…).

## 0. Jednorázově: Vast.ai CLI

```bash
pip install vastai
vastai set api-key VASK_API_KLIC      # z https://vast.ai/console/cli/
vastai show instances               # kontrola
```

## 1. Najít nejlevnější RTX instanci

```bash
# RTX 3060 seřazené od nejlevnější (jen spolehlivé hosty, volné):
vastai search offers 'gpu_name=RTX_3060 reliability>0.95 num_gpus=1 rentable=true' -o 'dph+'

# jiná karta → změň gpu_name (RTX_3070, RTX_3060_Ti, RTX_3090, ...)
vastai search offers 'gpu_name=RTX_3070 reliability>0.95 num_gpus=1 rentable=true' -o 'dph+'
```

První sloupec = **offer ID**, cena je v sloupci **$/hr**. Typicky RTX 3060 ≈ $0.06–0.08/h.

> ⚠️ Pro ZION Pearl nativní tensor kernely je potřeba **SM80+** (RTX 30xx/40xx). RTX 20xx/2080 Ti (SM75) umí jen fallback — pro čistý SRBMiner je to jedno.

## 2. Pronajmout instanci

```bash
vastai create instance OFFER_ID --image nvidia/cuda:12.4.1-devel-ubuntu22.04 --disk 32 --ssh --direct
# vrátí: new_contract: <INSTANCE_ID>
```

Počkat ~1–3 minuty, pak zjistit SSH endpoint:

```bash
vastai show instance INSTANCE_ID
# → SSH Addr (např. ssh4.vast.ai) + SSH Port (např. 36594)
```

## 3. Připojit se přes SSH

```bash
ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519 root@ssh4.vast.ai -p 36594
# ověření GPU:
nvidia-smi
```

> SSH klíč musí být nahraný v https://vast.ai/console/ (Account → SSH keys) — `id_ed25519`/`id_rsa` podle toho, co máš přidané.

## 4. Nainstalovat a spustit SRBMiner (QTU)

```bash
mkdir -p ~/miners && cd ~/miners &&
wget https://github.com/doktor83/SRBMiner-Multi/releases/download/3.7.9/SRBMiner-Multi-3-7-9-Linux.tar.gz &&
tar xzf SRBMiner-Multi-3-7-9-Linux.tar.gz &&
cd SRBMiner-Multi-3-7-9 &&
chmod +x SRBMiner-MULTI &&
./SRBMiner-MULTI --algorithm quantus --pool eu.lproute.com:5660 --wallet qzjoHwaJ2GfiRSHyYkYcpoJFbHct9pb9EAbs7sE51Uhj8r2zb --worker rig1
```

### Pearl místo Quantus

```bash
./SRBMiner-MULTI --algorithm pearlhash --pool pearl-eu2.luckypool.io:3360 --wallet PRL_WALLET --worker rig1
```

### Těžba na pozadí (přežije odpojení SSH)

```bash
nohup ./SRBMiner-MULTI --algorithm quantus --pool eu.lproute.com:5660 --wallet qzjoHwaJ2GfiRSHyYkYcpoJFbHct9pb9EAbs7sE51Uhj8r2zb --worker rig1 > ~/mine.log 2>&1 &
tail -f ~/mine.log   # sledování logu
```

## 4b. DUAL mining přes náš pool — PRL + QTU v jednom `zion-miner`

Jeden proces, dva GPU streamy, **vše přes `pool.zionterranova.com:8444`**
(V3 Trinity — pool sám routuje PRL → `prlu:` LuckyPool a QTU → `qtun:`
upstream). Žádný SRBMiner sidecar. ZION stream je vypnutý
(`ZION_STREAM1_ENABLED=0`). Vyžaduje SM80+ GPU (RTX 30xx/40xx) pro tensor
kernely; na SM75 (RTX 20xx) PRL běží jen fallback kernelem.

### Referenční měření — SRBMiner dual (2 procesy na 1 kartě)

SRBMiner nemá integrovaný pearlhash+quantus dual mód — "dual" = dva
nezávislé procesy, které si kartu dělí **time-sharingem** (~50/50).
Nesrovnatelné 1:1 s in-process schedulerem `zion-miner`.

```bash
cd ~/miners/SRBMiner-Multi-3-7-9
nohup ./SRBMiner-MULTI --algorithm pearlhash --pool pearl-eu2.luckypool.io:3360 \
  --wallet PRL_WALLET --worker rig1-prl > ~/srb-prl.log 2>&1 &
nohup ./SRBMiner-MULTI --algorithm quantus --pool eu.lproute.com:5660 \
  --wallet qzjoHwaJ2GfiRSHyYkYcpoJFbHct9pb9EAbs7sE51Uhj8r2zb --worker rig1-qtu \
  > ~/srb-qtu.log 2>&1 &
```

**Změřeno (RTX 3060 @170 W, 4 min steady):** PRL **~24.9 TH/s** +
QTU **~107 MH/s** současně (každý ~47–49 % svého solo výkonu).

### Nativní dual — binárka

```bash
# Varianta A — prebuilt z Edge (nemusí obsahovat nejnovější kernely):
cd ~/miners && curl -fsSL -o zion-miner \
  http://62.171.141.136/zion-miner/zion-miner-v31-cuda && chmod +x zion-miner

# Varianta B — vlastní build (doporučeno, ~15 min na 6vCPU):
# na lokálním stroji (z repo root):
rsync -az -e "ssh -i ~/.ssh/id_ed25519 -p PORT" V31/ root@HOST:/root/zion-native/
# na instanci:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal &&
  export PATH=/root/.cargo/bin:$PATH &&
  cd /root/zion-native && cargo build --release -p zion-miner --features gpu-cuda &&
  ln -sf target/release/zion-miner /root/zion-miner
```

### Spuštění — dual PRL+QTU (ZION vypnutý)

```bash
export ZION_MINER_ID=vast-3060 ZION_GPU_BACKEND=cuda ZION_PROFILE=pool \
  ZION_VERBOSE=1 ZION_INTERACTIVE=0 ZION_NO_STICKY=1 ZION_LOG_INTERVAL=15 \
  ZION_STATS_FILE=/root/zion-miner-stats.json ZION_V3_TRINITY=1 \
  ZION_AUTOTUNE=1 ZION_IGNORE_GPU_SELF_TEST_FAIL=1 \
  ZION_STREAM1_ENABLED=0 \
  ZION_STREAM2_ENABLED=1 ZION_STREAM2_FORCE_COIN=PRL ZION_PEARL_K=2048 \
  ZION_STREAM3_ENABLED=0 \
  ZION_STREAM4_ENABLED=1 ZION_STREAM4_FORCE_COIN=QTU ZION_QPOW_BACKEND=cuda \
  ZION_MINER_THREADS=4

# ── max-perf knoby (A/B měřené, PEARL-OPTIMIZATION.md §16-20) ──
export ZION_PEARL_CUMULATIVE_MMA=1     # +1.5 % PRL
export ZION_PEARL_STREAMS=4            # default, explicit
export ZION_PEARL_BATCH=64             # +4.4 % PRL vs 16
# v13 packed-k kernel = default na SM80+; fallback: ZION_PEARL_MINE=v6

# duty split — vyber JEDEN profil:
# (a) PRL-first: PRL 100 / QTU 40 → nejvyšší PRL, QTU drží ~110 MH/s
export ZION_EXT_GPU_TIME_DUTY_PCT=100 ZION_EXT_GPU2_TIME_DUTY_PCT=40
# (b) QTU-focused: PRL 35 / QTU 60 → PRL ~6 TH/s, QTU ~129 MH/s
# export ZION_EXT_GPU_TIME_DUTY_PCT=35 ZION_EXT_GPU2_TIME_DUTY_PCT=60
# (c) free contention 100/100 → scheduler sám rozdělí (~25 % PRL / 75 % QTU)

nohup ./zion-miner --pool pool.zionterranova.com:8444 \
  --wallet ZION_WALLET --worker vast-3060 \
  --gpu cuda --threads 4 --log-interval 15 --v3-trinity \
  > /root/dual.log 2>&1 &
tail -f /root/dual.log
```

### Změřené výkony (RTX 3060 @170 W, 300 s okna, steady-state)

| Profil | PRL | QTU | Pozn. |
|---|---|---|---|
| SRB 2×proc (reference) | ~24.9 TH/s | ~107 MH/s | time-sharing, ne in-process dual |
| nativní 100/40 (PRL-first, v13) | **~24.8 TH/s** | **~110 MH/s** | ≈parita se SRB na obou mincích |
| nativní 100/40 (v6) | ~22.5 TH/s | ~106 MH/s | `ZION_PEARL_MINE=v6` |
| nativní 35/60 (v6) | ~5.9 TH/s | ~129 MH/s | QTU-focused |
| nativní 100/100 free (v13) | ~6.3 TH/s | ~119 MH/s | scheduler jede ~3× víc QTU |
| solo (v13 / v6) | ~27 / ~24 TH/s | ~156 MH/s | horní mez |

PRL se v metrikách zobrazuje v **GH/s** (24.8 TH/s = `24800 GH/s`).

### Kontrola

```bash
tail -f /root/dual.log | grep metrics    # PRL: xx GH/s | QTU: xx MH/s | zion: 0
curl -s 'https://pool.zionterranova.com/public/v1/miner/ZION_WALLET' | python3 -m json.tool
nvidia-smi                               # ~95-100 % util, ~135-170 W
```

### Známé chování / caveat

- **`zion: 0 H/s` v metrics = správně** — banner může říkat "Stream 1 enabled",
  metriky jsou autoritativní.
- **Pool-side fallback:** když je QTU upstream job dočasně stale, pool může
  na gpu2 slot poslat jinou coinu (ZANO). Nejnovější binárka ji s
  `ZION_STREAM4_FORCE_COIN` nastaveným **odmítne a stream počká** (idle)
  — starší buildy ji skutečně těžily. Ověř v `[metrics]`, že stream 4
  ukazuje `QTU`, ne `ZANO`.
- **Výplaty:** PRL/QTU shares jdou přes pool → LuckyPool/upstream
  (`prlu:`/`qtun:` legy). PRL payout sweeper na poolu běží v dry-run —
  finální PRL výplatní cesta je ještě v dokončování (viz AGENTS.md
  2026-10-20 entry).

## 5. Vypnutí instance (důležité — jinak utíkají peníze!)

```bash
vastai destroy instance INSTANCE_ID
```

Instance se účtuje za hodinu včetně doby, kdy je "stopped" — data na disku stojí i po zničení... ne, jen běží-li/stopped. **Destroy = konec účtování GPU; neuložená data zmizí.**

## Poznámky

- **SSH endpoint se může měnit** po restartu instance → vždy `vastai show instance ID`.
- Výkon stejné karty se liší podle hostitele (power limit, PCI, "silicon lottery") — SRB pearlhash na RTX 3060 ~21–49 TH/s, quantus ~200–225 MH/s.
- Pro vlastní nativní `zion-miner` build je potřeba Rust + rsync workspace (viz `V31/scripts/vast-triple-mine.sh`).
