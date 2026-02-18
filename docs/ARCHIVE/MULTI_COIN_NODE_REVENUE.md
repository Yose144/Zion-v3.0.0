# 💰 ZION Multi-Coin Node Revenue Strategy

> **Datum:** 17. února 2026  
> **Verze:** 1.0  
> **Autor:** ZION TerraNova Team  
> **Koncept:** Využít stávající i budoucí servery k těžbě dalších coinů **bez počátečního kapitálu** — čistě PoW mining.

---

## 📋 Obsah

1. [Myšlenka](#-myšlenka)
2. [Stávající infrastruktura](#-stávající-infrastruktura)
3. [Již integrované coiny](#-již-integrované-coiny)
4. [CPU Mining — Top kandidáti](#-cpu-mining--top-kandidáti)
5. [GPU Mining — Top kandidáti (budoucí servery)](#-gpu-mining--top-kandidáti-budoucí-servery)
6. [Non-Mining Revenue (nody / relay / DePIN)](#-non-mining-revenue-nody--relay--depin)
7. [Doporučená strategie nasazení](#-doporučená-strategie-nasazení)
8. [Docker compose pro multi-mining](#-docker-compose-pro-multi-mining)
9. [Odhad měsíčních příjmů](#-odhad-měsíčních-příjmů)
10. [Rizika a mitigace](#-rizika-a-mitigace)
11. [Roadmap nasazení](#-roadmap-nasazení)

---

## 🧠 Myšlenka

Naše Hetzner servery (Helsinki, Germany) běží 24/7 pro ZION blockchain. Většinu CPU výkonu
spotřebovává ZION mining, ale:

- **Zbylá CPU jádra** → CPU-mineable coiny (RandomX, AstroBWT, GhostRider, VerusHash)
- **Pokud přidáme GPU** → GPU-mineable coiny (KawPow, Autolykos, FishHash, ProgPow)
- **Samotné nody** → provoz full node / validator pro jiné chain → odměny
- **Nulový počáteční kapitál** — vše je PoW mining nebo node rewards

---

## 🖥️ Stávající infrastruktura

| Server | Lokace | IP | CPU | RAM | Disk | GPU |
|--------|--------|----|-----|-----|------|-----|
| **Helsinki** | Finsko | `77.42.31.72` | AMD (Hetzner) | 64 GB+ | SSD | ❌ zatím ne |
| **Germany** | Německo | `195.201.31.201` | AMD (Hetzner) | 64 GB+ | SSD | ❌ zatím ne |
| **Budoucí** | TBD | TBD | AMD EPYC | 128 GB | NVMe | ✅ RTX 4090 / A4000 |

**Aktuální vytížení:**
- ZION node + pool: ~4–8 jader
- ZION mining (CosmicHarmony): `N-1` jader
- Revenue thread (XMR/MoneroOcean): 1 jádro
- **Volná kapacita:** 2–4 jádra na server (záleží na CPU)

---

## ✅ Již integrované coiny

Tyto coiny jsou **už v** `config/ch3_revenue_settings.json`:

| Coin | Ticker | Algoritmus | Pool | Status |
|------|--------|-----------|------|--------|
| Monero | XMR | RandomX | MoneroOcean → BTC | ✅ Aktivní |
| Ethereum Classic | ETC | Keccak256 (merged) | 2miners | ✅ Merged mining |
| Ravencoin | RVN | KawPow | 2miners | ✅ GPU ready |
| Ergo | ERG | Autolykos | 2miners | ✅ GPU ready |
| VerusCoin | VRSC | VerusHash | luckpool.net | ✅ CPU ready |
| Alephium | ALPH | Blake3 | 2miners | ⏸️ Disabled |

---

## 🔷 CPU Mining — Top kandidáti

> Zdroj: WhatToMine CPU (únor 2026), hashrate.no/cpus  
> Odhady pro **typický serverový CPU (AMD EPYC / Ryzen)**, 2–4 vyhrazená jádra.  
> ⚡ Elektřina na Hetzner je **v ceně serveru** = $0 marginal cost!

### Tier 1 — Doporučeno k okamžitému nasazení

| # | Coin | Ticker | Algoritmus | Cena USD | Denní výnos/CPU* | Market Cap | Proč |
|---|------|--------|-----------|----------|-----------------|------------|------|
| 1 | **Monero** | XMR | RandomX | $328 | ~$0.53 | $6B | ✅ Již běží. King of CPU mining. Likvidní. |
| 2 | **Dero** | DERO | AstroBWTv3 | $0.24 | ~$0.60 | $3.4M | 🔥 Nejlepší CPU profit! Unique algo, ASIC-resistant. Privacy coin. |
| 3 | **Zephyr** | ZEPH | RandomX | $0.59 | ~$0.49 | $6.5M | ✅ RandomX = sdílí miner s XMR. Privacy + stablecoins. Rostoucí. |
| 4 | **Epic Cash** | EPIC | RandomX | $0.40 | ~$0.70 | $7.6M | ✅ RandomX. MimbleWimble privacy. Dobrý výnos. |

> *Denní výnos = hrubý revenue na 1 full CPU (EPYC class). Na 2–4 jádrech bude ~30–50% z toho.

### Tier 2 — Zajímavé, nižší priorita

| # | Coin | Ticker | Algoritmus | Cena USD | Denní výnos/CPU* | Market Cap | Poznámka |
|---|------|--------|-----------|----------|-----------------|------------|----------|
| 5 | **Quantum R L** | QRL | RandomX | $1.76 | ~$0.52 | $138M | Quantum-resistant. Velký cap. RandomX. |
| 6 | **Dagger** | XDAG | RandomX | $0.019 | ~$0.59 | $1.4M | Nový DAG chain. RandomX. Malý cap = risk. |
| 7 | **Tari** | XTM | RandomX | $0.0017 | ~$0.32 | $6.4M | Merged mining s Monero! Digitální assets platforma. |
| 8 | **Raptoreum** | RTM | GhostRider | $0.0001 | ~$0.10 | $715K | CPU-only algo. Velmi malý cap. Spekulativní. |
| 9 | **VerusCoin** | VRSC | VerusHash | $0.80 | ~$0.14 | $64M | ✅ Již v configu. VerusHash 2.2 = CPU-friendly. |
| 10 | **Etica** | ETI | RandomX | $0.034 | ~$0.70 | $260K | Micro-cap! Vysoký výnos ale extreme risk. |

### Tier 3 — Spekulativní long-shot

| Coin | Ticker | Algo | Proč zajímavý | Risk |
|------|--------|------|---------------|------|
| **Salvium** | SAL | RandomX | Privacy + DeFi | Malý cap $50K vol |
| **Kryptokrona** | XKR | RandomX | Švédský privacy coin | Velmi malý |
| **Conceal** | CCX | RandomX | Privacy + governance | Nízký volume |

---

## 🟢 GPU Mining — Top kandidáti (budoucí servery)

> Relevantní **až přidáme GPU** (RTX 4090 / A4000) do serverů.  
> Hetzner nabízí GPU servery (EX-GPU), nebo pronájem u Vast.ai / RunPod.

| # | Coin | Ticker | Algoritmus | Cena USD | Revenue/3070 | Market Cap | Proč |
|---|------|--------|-----------|----------|-------------|------------|------|
| 1 | **Flux** | FLUX | PoUW | $0.07 | top tier | Velký ekosystém | Decentralized cloud. Nodes + mining. |
| 2 | **Zano** | ZANO | ProgPowZ | $9.10 | ~$0.52 | $138M | Privacy + smart contracts. Solidní cap. |
| 3 | **Firo** | FIRO | FiroPow | $0.87 | ~$0.37 | $16M | Lelantus privacy. GPU-friendly. |
| 4 | **Beam** | BEAM | BeamHashIII | $0.024 | ~$0.33 | $3.6M | Confidential DeFi. |
| 5 | **IronFish** | IRON | FishHash | $0.076 | ~$0.32 | $5.3M | Privacy chain. Nový. |
| 6 | **Decred** | DCR | Blake3 | $38 | ~$0.34 | $414M | Hybrid PoW/PoS. Velký cap. |
| 7 | **Ergo** | ERG | Autolykos | $0.33 | ~$0.25 | $27M | ✅ Již v configu. Cardano ekosystém. |
| 8 | **Ravencoin** | RVN | KawPow | $0.009 | ~$0.24 | $104M | ✅ Již v configu. Asset layer. |
| 9 | **Quai** | QUAI | KawPow | $0.054 | ~$0.35 | $50M | Multi-chain PoW. Zajímavý projekt. |
| 10 | **Karlsen** | KLS | KarlsenHash | $0.00005 | ~$0.35 | $142K | GHOST DAG. Micro-cap ale dobrý výnos. |

---

## 🌐 Non-Mining Revenue (nody / relay / DePIN)

**Nulový kapitál, pouze provoz full node na stávajících serverech:**

### Full Node Rewards

| Projekt | Typ | Odměna | HW požadavky | Investice | Poznámka |
|---------|-----|--------|-------------|-----------|----------|
| **Flux** | FluxNode (Cumulus) | ~$15-30/měsíc | 2 CPU, 4GB RAM, 220GB | 1000 FLUX stake (~$70) | ⚠️ Malý stake nutný |
| **Alephium** | Full node | Mining rewards | 4 CPU, 8GB RAM | $0 | Mining + node v jednom |
| **Ergo** | Full node | Mining priority | 2 CPU, 4GB RAM | $0 | Solo mining výhoda |
| **Firo** | Masternode | ~$5-15/měsíc | 2 CPU, 2GB RAM | 1000 FIRO stake (~$870) | ⚠️ Stake nutný |

### DePIN / Decentralized Infrastructure

| Projekt | Služba | Odměna | HW požadavky | Investice |
|---------|--------|--------|-------------|-----------|
| **Filecoin** (Saturn) | CDN cache node | Platba za bandwidth | 10GB RAM, SSD | $0 |
| **IPFS Pinning** | Storage rewards | Micro-platby | SSD prostor | $0 |
| **Akash Network** | Compute provider | Platba za CPU/RAM | K8s cluster | $0 (SW setup) |
| **Livepeer** | Video transcoding | Platba za encoding | GPU potřeba | GPU investment |

### Blockchain Full Nodes (bez odměn, ale strategické)

Provoz ZION bridge relay nodů pro supported chains:
- **Base** (L2 Ethereum) — wZION bridge relay
- **Arbitrum** — wZION bridge relay  
- **BSC** — wZION bridge relay

Tyto nody **nepřinášejí přímý příjem**, ale jsou **nutné pro wZION bridge** infrastrukturu.

---

## 🎯 Doporučená strategie nasazení

### Fáze 1 — Okamžitě (týden 1-2) 🚀

**CPU mining na stávajících serverech — zero cost:**

```
Helsinki (77.42.31.72):
├── ZION node + pool (hlavní)
├── XMR mining via MoneroOcean (✅ běží)
├── + DERO mining (2 jádra) ← NOVÉ
└── + ZEPH mining (1 jádro, RandomX) ← NOVÉ

Germany (195.201.31.201):
├── ZION node + pool (hlavní)
├── XMR mining via MoneroOcean (✅ běží)
├── + DERO mining (2 jádra) ← NOVÉ
└── + Epic Cash mining (1 jádro, RandomX) ← NOVÉ
```

**Odhadovaný extra příjem Fáze 1:**
- DERO: 2 servery × ~$0.30/den = **~$18/měsíc**
- ZEPH: 1 server × ~$0.25/den = **~$7.5/měsíc**
- EPIC: 1 server × ~$0.35/den = **~$10.5/měsíc**
- **Celkem extra: ~$36/měsíc** (při 0 nákladech na elektřinu)

### Fáze 2 — Měsíc 2-3 📈

**Rozšíření o Tari merged mining + QRL:**

- Tari (XTM) merged mining s Monero — **zdarma**, sdílí RandomX hashrateete
- QRL mining na volných jádrech
- Flux Cumulus node (pokud získáme 1000 FLUX stake z těžby)

### Fáze 3 — Q2 2026 🎮

**GPU servery:**

- Pronájem Hetzner EX-GPU nebo Vast.ai
- Multi-GPU mining: FLUX + ZANO + FIRO + QUAI
- Pool profit-switching přes naši infrastrukturu
- **Odhadovaný příjem: $150-400/měsíc per GPU server**

### Fáze 4 — Q3-Q4 2026 🌍

**DePIN + Compute provider:**

- Akash Network compute provider
- Saturn CDN node
- Filecoin storage miner (pokud přibyde NVMe kapacita)

---

## 🐳 Docker compose pro multi-mining

```yaml
# docker-compose.multi-mining.yml
# Deployed alongside ZION node

version: '3.8'

services:
  # ═══════════════════════════════════════════
  # DERO Mining — AstroBWTv3 (CPU)
  # Best CPU profit coin, unique ASIC-resistant algo
  # ═══════════════════════════════════════════
  dero-miner:
    image: alpine:latest
    container_name: zion-dero-miner
    restart: unless-stopped
    entrypoint: /bin/sh
    command: >
      -c "
      apk add --no-cache wget &&
      wget -O /tmp/dero-miner https://github.com/deroproject/derohe/releases/latest/download/dero_linux_amd64 &&
      chmod +x /tmp/dero-miner &&
      /tmp/dero-miner --mining-threads 2
      --daemon-rpc-address=minernode1.dero.io:10100
      --wallet-address WALLET_DERO_ADDRESS
      "
    cpuset: "0-1"  # Limit to 2 CPU cores
    mem_limit: 2g
    deploy:
      resources:
        limits:
          cpus: '2.0'
    labels:
      - "zion.revenue=dero"
      - "zion.algo=astrobwt"

  # ═══════════════════════════════════════════
  # Zephyr Mining — RandomX (CPU)
  # Privacy + stable, RandomX algo shared with XMR
  # ═══════════════════════════════════════════
  zeph-miner:
    image: alpine:latest
    container_name: zion-zeph-miner
    restart: unless-stopped
    entrypoint: /bin/sh
    command: >
      -c "
      apk add --no-cache curl &&
      curl -L -o /tmp/xmrig.tar.gz https://github.com/xmrig/xmrig/releases/latest/download/xmrig-linux-static-x64.tar.gz &&
      tar xzf /tmp/xmrig.tar.gz -C /tmp &&
      /tmp/xmrig*/xmrig
      -o gulf.moneroocean.stream:10001
      -u WALLET_ZEPH_ADDRESS
      -p zion_zeph
      -a rx/0
      -t 1
      --no-color
      "
    cpuset: "2"
    mem_limit: 3g
    deploy:
      resources:
        limits:
          cpus: '1.0'
    labels:
      - "zion.revenue=zeph"
      - "zion.algo=randomx"

  # ═══════════════════════════════════════════
  # Epic Cash — RandomX (CPU)
  # MimbleWimble privacy, good returns
  # ═══════════════════════════════════════════
  epic-miner:
    image: alpine:latest
    container_name: zion-epic-miner
    restart: unless-stopped
    entrypoint: /bin/sh
    command: >
      -c "
      apk add --no-cache curl &&
      curl -L -o /tmp/xmrig.tar.gz https://github.com/xmrig/xmrig/releases/latest/download/xmrig-linux-static-x64.tar.gz &&
      tar xzf /tmp/xmrig.tar.gz -C /tmp &&
      /tmp/xmrig*/xmrig
      -o fastepic.eu:3416
      -u WALLET_EPIC_ADDRESS
      -p zion_epic
      -a rx/0
      -t 1
      --no-color
      "
    cpuset: "3"
    mem_limit: 3g
    deploy:
      resources:
        limits:
          cpus: '1.0'
    labels:
      - "zion.revenue=epic"
      - "zion.algo=randomx"

  # ═══════════════════════════════════════════
  # VerusCoin — VerusHash (CPU)
  # Already configured, just enable container
  # ═══════════════════════════════════════════
  vrsc-miner:
    image: oink70/ccminer-verus:latest
    container_name: zion-vrsc-miner
    restart: unless-stopped
    command: >
      -a verushash
      -o stratum+tcp://eu.luckpool.net:3956
      -u RWrHVj8e7fkvfUw4Jf6qJNUHdr6baAsoF5
      -p zion_vrsc
      -t 1
    cpuset: "4"
    mem_limit: 2g
    deploy:
      resources:
        limits:
          cpus: '1.0'
    labels:
      - "zion.revenue=vrsc"
      - "zion.algo=verushash"

# ═══════════════════════════════════════════
# Networks & Volumes
# ═══════════════════════════════════════════
networks:
  default:
    name: zion-mining-net
```

---

## 📊 Odhad měsíčních příjmů

### Scénář A — Pouze CPU (stávající servery)

> 2 servery × AMD CPU, elektřina v ceně, 2-4 jádra volná per server

| Coin | Servery | Jádra | Denně USD | Měsíčně USD | Poznámka |
|------|---------|-------|-----------|-------------|----------|
| **ZION** | 2 | hlavní | — | — | Vlastní coin, block rewards |
| **XMR** | 2 | 1+1 | ~$0.40 | ~$12 | ✅ Již běží (MoneroOcean) |
| **DERO** | 2 | 2+2 | ~$0.60 | ~$18 | 🆕 Nejlepší CPU profit |
| **ZEPH** | 1 | 1 | ~$0.25 | ~$7.5 | 🆕 RandomX privacy |
| **EPIC** | 1 | 1 | ~$0.35 | ~$10.5 | 🆕 RandomX MimbleWimble |
| **VRSC** | 1 | 1 | ~$0.14 | ~$4 | ✅ Již v configu |
| | | | | | |
| **CELKEM** | | | **~$1.74/den** | **~$52/měsíc** | Náklady: $0 extra |

### Scénář B — CPU + 1× GPU server (Q2 2026)

| Zdroj | Denně USD | Měsíčně USD |
|-------|-----------|-------------|
| CPU mining (scénář A) | $1.74 | $52 |
| GPU mining (1× RTX 4090) | $2-4 | $60-120 |
| Flux node reward | $0.5-1 | $15-30 |
| **CELKEM** | **$4-7/den** | **$127-202/měsíc** |
| GPU server cost | | -$80-120/měsíc |
| **NET PROFIT** | | **$7-82/měsíc** |

### Scénář C — Full scale (Q4 2026)

| Zdroj | Měsíčně USD |
|-------|-------------|
| 4× CPU server mining | $100+ |
| 2× GPU server mining | $240+ |
| Flux nodes (3×) | $60+ |
| DePIN (Akash/Saturn) | $50+ |
| **CELKEM** | **$450+/měsíc** |
| Infrastruktura cost | -$200-300/měsíc |
| **NET PROFIT** | **$150-250+/měsíc** |

---

## ⚠️ Rizika a mitigace

| Risk | Dopad | Pravděpodobnost | Mitigace |
|------|-------|-----------------|----------|
| **Pokles ceny coinů** | Nižší výnosy | Vysoká | Diverzifikace 5+ coinů, auto-convert do BTC/ZION |
| **Difficulty spike** | Nižší výnosy | Střední | Profit-switching, opuštění neprofitabilních coinů |
| **Hetzner TOS** | Ban serveru | Nízká | Mining v Docker s CPU limity, bez GPU overload |
| **Micro-cap coin death** | Ztráta nameného | Střední | Max 20% compute na micro-cap coiny |
| **Server downtime** | Ztráta příjmů | Nízká | Monitoring, auto-restart, redundance |
| **Electricity cost change** | Marže | Nízká | Hetzner = flat rate, VPS included |

### Hetzner Mining Policy ⚠️

Hetzner **povoluje** mining na dedikovaných serverech, ale:
- ❌ **Zakázáno** na cloud (CX/CPX) instancech
- ✅ **Povoleno** na dedikovaných (AX/EX) serverech
- ⚡ Nepřekračovat CPU thermal limits
- 🔊 Nezatěžovat síť nadměrně

**→ Naše servery jsou dedikované = OK pro mining.**

---

## 🗓️ Roadmap nasazení

```
Týden 1 (Feb 2026):
  ✅ Vytvoření wallet adres pro DERO, ZEPH, EPIC
  ✅ Test DERO mining na Helsinki (2 jádra)
  ✅ Monitoring script pro multi-mining
  
Týden 2 (Feb 2026):
  □ Deploy docker-compose.multi-mining.yml na oba servery
  □ DERO + ZEPH na Helsinki
  □ DERO + EPIC na Germany
  □ Dashboard pro sledování výnosů
  
Měsíc 2 (Mar 2026):
  □ Vyhodnocení prvního měsíce
  □ Tari merged mining s XMR (bonus, 0 extra compute)
  □ QRL mining test
  □ Optimalizace thread allocation
  
Q2 2026:
  □ GPU server procurement
  □ FLUX + ZANO + FIRO mining
  □ Flux Cumulus node setup
  □ Profit-switching integration do CH v3
  
Q3-Q4 2026:
  □ DePIN integrace (Akash, Saturn)
  □ Auto-convert pipeline: altcoins → BTC → ZION buyback
  □ Full monitoring dashboard
  □ Scaling na 4+ serverů
```

---

## 🔧 Potřebné wallety

| Coin | Síť | Wallet typ | Kde vytvořit |
|------|------|-----------|-------------|
| DERO | DERO HE | DERO address | CLI: `dero-wallet-cli` |
| ZEPH | Zephyr | Standard address | `zephyr-wallet-cli` |
| EPIC | Epic Cash | Listener wallet | `epic-wallet` |
| QRL | QRL | Q-address | `qrl-wallet` |
| XTM | Tari | Tari address | `tari_console_wallet` |
| FLUX | Flux | t-address | Zelcore wallet |

**Tip:** Pro maximální jednoduchost — těžit DERO, ZEPH, EPIC přes **pool s auto-convert do BTC**
(např. MoneroOcean pro RandomX coiny, nebo Zergpool pro multi-algo).

---

## 📐 Integrace do CH v3 Revenue Settings

Nové coiny přidat do `config/ch3_revenue_settings.json` → `streams.dynamic_gpu.pools`:

```json
{
  "DERO": {
    "coin": "DERO",
    "stratum": "stratum+tcp://dero.herominers.com:1111",
    "wallet": "DERO_WALLET_ADDRESS",
    "worker": "zion_pool",
    "algorithm": "astrobwt/v3",
    "protocol": "stratum",
    "enabled": true,
    "threads": 2,
    "type": "cpu"
  },
  "ZEPH": {
    "coin": "ZEPH",
    "stratum": "stratum+tcp://zeph.herominers.com:1123",
    "wallet": "ZEPH_WALLET_ADDRESS",
    "worker": "zion_pool",
    "algorithm": "rx/0",
    "protocol": "stratum",
    "enabled": true,
    "threads": 1,
    "type": "cpu"
  },
  "EPIC": {
    "coin": "EPIC",
    "stratum": "stratum+tcp://fastepic.eu:3416",
    "wallet": "EPIC_WALLET_ADDRESS",
    "worker": "zion_pool",
    "algorithm": "rx/0",
    "protocol": "stratum",
    "enabled": true,
    "threads": 1,
    "type": "cpu"
  }
}
```

---

## 🏆 Shrnutí — Co se vyplatí HNED

| Priorita | Coin | Akce | Extra příjem/měsíc | Effort |
|----------|------|------|-------------------|--------|
| 🥇 | **DERO** | Deploy AstroBWT miner, 2 jádra/server | ~$18 | Nízký |
| 🥈 | **ZEPH** | XMRig s RandomX, 1 jádro | ~$7.5 | Minimální |
| 🥉 | **EPIC** | XMRig s RandomX, 1 jádro | ~$10.5 | Minimální |
| 4. | **XMR** | ✅ Již běží | ~$12 | Zero |
| 5. | **VRSC** | ✅ Již v configu, aktivovat | ~$4 | Minimální |
| 6. | **Tari** | Merged s XMR (free) | ~$3-5 bonus | Zero |

**→ DERO + ZEPH + EPIC = nejrychlejší ROI bez jakéhokoliv počátečního kapitálu.**

---

> *"Every idle CPU cycle is a missed opportunity."*  
> — ZION TerraNova Multi-Mining Strategy v1.0  
> 
> **Data sources:** WhatToMine.com, hashrate.no, minerstat.com (17. února 2026)
