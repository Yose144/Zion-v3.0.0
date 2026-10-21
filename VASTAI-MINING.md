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

## 4b. TRIPLE mining přes náš pool — ZION + PRL + QTU v jednom `zion-miner`

Jeden proces, tři GPU streamy, **vše přes `62.171.141.136:8444`** (V3 Trinity —
pool sám routuje PRL → `prlu:` LuckyPool a QTU → `lproute:` upstream).
Žádný SRBMiner sidecar. Vyžaduje SM80+ GPU (RTX 30xx/40xx) pro tensor kernely.

### Varianta A — prebuilt binárka z Edge (nejrychlejší)

```bash
cd ~/miners && curl -fsSL -o zion-miner \
  http://62.171.141.136/zion-miner/zion-miner-v31-cuda && chmod +x zion-miner
```

> ⚠️ Edge binary se aktualizuje manuálně — pro nejnovější kernely
> (cumulative-MMA, IUNROLL=21) je lepší varianta B.

### Varianta B — vlastní build (max performance, ~15 min)

```bash
# na lokálním stroji (z repo root):
rsync -az -e "ssh -i ~/.ssh/id_ed25519 -p PORT" V31/ root@HOST:/root/zion-native/
# na instanci:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal &&
  export PATH=/root/.cargo/bin:$PATH &&
  cd /root/zion-native && cargo build --release -p zion-miner --features gpu-cuda &&
  ln -sf target/release/zion-miner /root/zion-miner
```

### Spuštění — max-performance env set (změřeno na RTX 3060)

```bash
export ZION_MINER_ID=vast-3060 ZION_GPU_BACKEND=cuda ZION_PROFILE=pool \
  ZION_VERBOSE=1 ZION_INTERACTIVE=0 ZION_NO_STICKY=1 ZION_LOG_INTERVAL=15 \
  ZION_STATS_FILE=/root/zion-miner-stats.json ZION_V3_TRINITY=1 \
  ZION_AUTOTUNE=1 ZION_IGNORE_GPU_SELF_TEST_FAIL=1 \
  ZION_MINER_ALGORITHM=ekam_deeksha ZION_NONCE_AUTOTUNE=1 \
  ZION_NONCE_COUNT=262144 ZION_GPU_MAX_BATCH=262144 \
  ZION_STREAM1_ENABLED=1 \
  ZION_STREAM2_ENABLED=1 ZION_STREAM2_FORCE_COIN=PRL ZION_PEARL_K=2048 \
  ZION_STREAM3_ENABLED=0 \
  ZION_STREAM4_ENABLED=1 ZION_STREAM4_FORCE_COIN=QTU ZION_QPOW_BACKEND=cuda \
  ZION_MINER_THREADS=4

# ── max-perf knoby (měřené A/B, viz PEARL-OPTIMIZATION.md §16-19) ──
export ZION_GPU_WORK_SIZE=2048            # +31 % ZION share rate
export ZION_GPU_SKIP_CPU_RESCAN=1         # rescan landmine pryč
export ZION_PEARL_CUMULATIVE_MMA=1        # +1.5 % PRL (opt-in vítěz)
export ZION_PEARL_STREAMS=4               # default, explicit pro jistotu
export ZION_PEARL_BATCH=64                # +4.4 % PRL vs 16

# duty split — vyber JEDEN profil:
# (a) balanced triple  ZION 5 / PRL 35 / QTU 60:
export ZION_GPU_TIME_DUTY_PCT=5 ZION_EXT_GPU_TIME_DUTY_PCT=35 ZION_EXT_GPU2_TIME_DUTY_PCT=60
# (b) max-PRL: cap jen QTU, PRL vyplní mezery (~4/50/46):
# export ZION_GPU_TIME_DUTY_PCT=4 ZION_EXT_GPU_TIME_DUTY_PCT=100 ZION_EXT_GPU2_TIME_DUTY_PCT=46
# (c) PRL solo: 0 / 100 / 0

nohup ./zion-miner --pool 62.171.141.136:8444 \
  --wallet ZION_WALLET --worker vast-3060 \
  --gpu cuda --threads 4 --log-interval 15 --v3-trinity \
  > /root/triple.log 2>&1 &
tail -f /root/triple.log
```

**Očekávané výkony (RTX 3060, duty 5/35/60):** ZION ~68 KH/s · PRL ~5–6 TH/s
zobrazeno (contended) · QTU ~138 MH/s. Solo: PRL ~24 TH/s, QTU ~156 MH/s.

> Pozor: `ZION_STREAM2_ENABLED` gate — bez něj GPU-external stream zahálí
> (viz AGENTS §16.5). Shares ověř přes `curl http://62.171.141.136:8443/public/v1/...`.

## 5. Vypnutí instance (důležité — jinak utíkají peníze!)

```bash
vastai destroy instance INSTANCE_ID
```

Instance se účtuje za hodinu včetně doby, kdy je "stopped" — data na disku stojí i po zničení... ne, jen běží-li/stopped. **Destroy = konec účtování GPU; neuložená data zmizí.**

## Poznámky

- **SSH endpoint se může měnit** po restartu instance → vždy `vastai show instance ID`.
- Výkon stejné karty se liší podle hostitele (power limit, PCI, "silicon lottery") — SRB pearlhash na RTX 3060 ~21–49 TH/s, quantus ~200–225 MH/s.
- Pro vlastní nativní `zion-miner` build je potřeba Rust + rsync workspace (viz `V31/scripts/vast-triple-mine.sh`).
