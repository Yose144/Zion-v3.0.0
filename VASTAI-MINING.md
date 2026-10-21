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

## 5. Vypnutí instance (důležité — jinak utíkají peníze!)

```bash
vastai destroy instance INSTANCE_ID
```

Instance se účtuje za hodinu včetně doby, kdy je "stopped" — data na disku stojí i po zničení... ne, jen běží-li/stopped. **Destroy = konec účtování GPU; neuložená data zmizí.**

## Poznámky

- **SSH endpoint se může měnit** po restartu instance → vždy `vastai show instance ID`.
- Výkon stejné karty se liší podle hostitele (power limit, PCI, "silicon lottery") — SRB pearlhash na RTX 3060 ~21–49 TH/s, quantus ~200–225 MH/s.
- Pro vlastní nativní `zion-miner` build je potřeba Rust + rsync workspace (viz `V31/scripts/vast-triple-mine.sh`).
