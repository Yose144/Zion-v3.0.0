# 🌐 ZION Node Revenue Strategy — Pasivní příjem z provozu nodů

> **Datum:** 17. února 2026  
> **Verze:** 1.0  
> **Autor:** ZION TerraNova Team  
> **Koncept:** Provozovat nody (validátory, storage, compute, relay, DePIN) na stávajících serverech = **pasivní příjem bez extra kapitálu** nebo s minimálním stake z vytěženého.

---

## 📋 Obsah

1. [Proč nody místo těžby](#-proč-nody-místo-těžby)
2. [Naše infrastruktura](#-naše-infrastruktura)
3. [Tier 1 — Nulový kapitál](#-tier-1--nulový-kapitál-deploy-ihned)
4. [Tier 2 — Nízký kapitál ($50-300)](#-tier-2--nízký-kapitál-50-300)
5. [Tier 3 — Střední kapitál ($300-3000)](#-tier-3--střední-kapitál-300-3000)
6. [Tier 4 — DePIN & AI Compute](#-tier-4--depin--ai-compute)
7. [Tier 5 — Strategické full nodes (ZION infra)](#-tier-5--strategické-full-nodes-zion-infra)
8. [Docker compose — Multi-Node Stack](#-docker-compose--multi-node-stack)
9. [Odhad příjmů — 3 scénáře](#-odhad-příjmů--3-scénáře)
10. [Roadmap nasazení](#-roadmap-nasazení)
11. [Rizika a mitigace](#-rizika-a-mitigace)
12. [Monitoring & Správa](#-monitoring--správa)

---

## 🧠 Proč nody místo těžby

| | Mining | Node provoz |
|---|---|---|
| **CPU zátěž** | 100% na jádro | 5–20% celkově |
| **Disk zátěž** | Minimální | Vyšší (blockchain data) |
| **Příjem** | Závisí na hashrate + difficulty | Stabilní, závisí na uptime |
| **Skalování** | Více jader = více hashů | Více nodů = diverzifikace |
| **Hetzner TOS** | ⚠️ Šedá zóna na cloud | ✅ Plně povoleno |
| **Pasivita** | Aktivní monitoring | Set & forget |
| **Wear** | CPU degradace | Disk IO (SSD endurance) |

**Závěr:** Nody jsou stabilnější, méně zatěžují HW a nemají problém s Hetzner TOS.

---

## 🖥️ Naše infrastruktura

| Server | Lokace | IP | CPU | RAM | Disk | Volná kapacita |
|--------|--------|----|-----|-----|------|---------------|
| **Helsinki** | Finsko | `77.42.31.72` | AMD (Hetzner AX) | 64 GB | 2× SSD (512GB+) | ~200 GB volno |
| **Germany** | Německo | `195.201.31.201` | AMD (Hetzner AX) | 64 GB | 2× SSD (512GB+) | ~200 GB volno |

**Co můžeme nabídnout node sítím:**
- ✅ **CPU:** 4-8 volných jader per server
- ✅ **RAM:** 16-24 GB volné per server
- ✅ **Disk:** 200-400 GB volného SSD
- ✅ **Bandwidth:** 1 Gbps, Hetzner = 20 TB traffic included
- ✅ **Uptime:** 99.9% (Hetzner SLA)
- ✅ **Lokace:** EU (nízká latence pro většinu projektů)

---

## 🟢 Tier 1 — Nulový kapitál (deploy ihned)

> **$0 investice. Pouze software setup. Okamžitý příjem.**

### 1. Storj — Decentralized Storage Node

| Parametr | Hodnota |
|----------|---------|
| **Typ** | Storage provider — pronájem disku |
| **Token** | STORJ ($0.11) |
| **Market Cap** | $15.8M |
| **Investice** | $0 |
| **Příjem** | $1.50/TB/měsíc (storage) + $2/TB (egress) |
| **HW požadavky** | Min 500 GB HDD/SSD, 2 TB doporučeno, 100+ Mbps |
| **Setup difficulty** | ⭐⭐ Střední (Docker, port forwarding, identity) |
| **Realistický příjem** | **$3-15/měsíc per server** (záleží na alokaci od Storj satellites) |

**Proč:**
- Nulový kapitál — pronajímáme volný disk
- Storj satellites posílají data automaticky
- Platby v STORJ tokenu přes zkSync (nízké fees)
- Čím déle node běží, tím více dat dostáváte (reputace roste)

**Payout:**
- Storage: $1.50/TB/měsíc
- Egress (download): $2.00/TB
- Audit/Repair: $2.00/TB
- Výplata měsíčně přes Ethereum L1 nebo zkSync L2

**Setup:**
```bash
# 1. Vytvoření identity (trvá hodiny — CPU intenzivní, jednorázové)
docker run --rm -v /opt/storj/identity:/app/identity storjlabs/identity:latest create storagenode

# 2. Autorizace identity (potřeba registrace na storj.io)
docker run --rm -v /opt/storj/identity:/app/identity storjlabs/identity:latest authorize storagenode <AUTH_TOKEN>

# 3. Spuštění node
docker run -d --restart unless-stopped \
  -p 28967:28967/tcp -p 28967:28967/udp -p 14002:14002 \
  -v /opt/storj/identity:/app/identity \
  -v /opt/storj/data:/app/config \
  --name storj-node \
  storjlabs/storagenode:latest \
  --wallet.address=0xYOUR_ETH_WALLET \
  --contact.external-address=YOUR_IP:28967 \
  --storage.path=/app/config/storage \
  --storage.allocated-disk-space=200GB
```

---

### 2. Mysterium Network (MYST) — VPN/Bandwidth Node

| Parametr | Hodnota |
|----------|---------|
| **Typ** | Decentralizovaný VPN exit node + proxy |
| **Token** | MYST ($0.13) |
| **Market Cap** | $4.4M |
| **Investice** | $0 |
| **Příjem** | Platba za VPN traffic + proxy bandwidth |
| **HW požadavky** | 1 CPU, 1 GB RAM, 1 GB disk, public IP |
| **Setup difficulty** | ⭐ Snadné (Docker one-liner) |
| **Realistický příjem** | **$5-30/měsíc** (závisí na lokaci a traffic) |

**Proč:**
- 22,000+ nodů v síti — živý projekt
- EU datacenter = dobrá poptávka po VPN nodech
- B2B i P2P klienti platí za bandwidth
- 1000+ TB měsíčního trafficu v síti
- Pokrývá 135+ zemí

**Setup:**
```bash
docker run -d \
  --name mysterium-node \
  --restart unless-stopped \
  --cap-add NET_ADMIN \
  -p 4449:4449 \
  -p 41920-41925:41920-41925/udp \
  -v /opt/mysterium/data:/var/lib/mysterium-node \
  mysteriumnetwork/myst:latest \
  service --agreed-terms-and-conditions
```

Po startu → web UI na `http://SERVER_IP:4449` → claim node → nastavit výplatu.

---

### 3. NKN (New Kind of Network) — Relay Node

| Parametr | Hodnota |
|----------|---------|
| **Typ** | Peer-to-peer networking relay |
| **Token** | NKN ($0.006) |
| **Market Cap** | $5.1M |
| **Investice** | $0 (ale generování mining rewards vyžaduje ID fee ~10 NKN) |
| **Příjem** | Mining rewards za relay služby |
| **HW požadavky** | 1 CPU, 2 GB RAM, 50 GB disk |
| **Setup difficulty** | ⭐ Snadné |
| **Realistický příjem** | **$1-5/měsíc** |

**Proč:**
- Decentralizovaný networking layer
- +38% za 7 dní (sentiment roste)
- Minimální resource footprint
- Relay node pomáhá síti a vydělává

**Setup:**
```bash
docker run -d \
  --name nkn-node \
  --restart unless-stopped \
  -p 30001-30005:30001-30005 \
  -v /opt/nkn/data:/nkn/data \
  nknorg/nkn:latest \
  nknd -p "" --no-nat
```

---

### 4. Grass — Bandwidth Sharing (AI Data)

| Parametr | Hodnota |
|----------|---------|
| **Typ** | Bandwidth node pro AI training data scraping |
| **Token** | GRASS ($0.21) |
| **Market Cap** | $97M |
| **Investice** | $0 |
| **Příjem** | Grass Points → GRASS token airdrops |
| **HW požadavky** | Minimální — browser extension nebo standalone |
| **Setup difficulty** | ⭐ Velmi snadné |
| **Realistický příjem** | **$5-20/měsíc** (závisí na airdrop schedule) |

**Proč:**
- Velký market cap ($97M) — seriózní projekt
- AI data scraping je hot narrativa
- Datacenter IP = vyšší bonus oproti residential
- Hlavní node software v přípravě

---

### 5. Bless Network — Edge Computing Node

| Parametr | Hodnota |
|----------|---------|
| **Typ** | Edge computing / bandwidth sharing |
| **Token** | BLESS ($0.006) |
| **Market Cap** | $10.5M |
| **Investice** | $0 |
| **Příjem** | Node rewards |
| **HW požadavky** | Minimální |
| **Setup difficulty** | ⭐ Snadné |
| **Realistický příjem** | **$2-10/měsíc** |

---

### Tier 1 — Souhrn

| Projekt | Setup time | Příjem/měsíc | Per server | Oba servery |
|---------|-----------|-------------|------------|-------------|
| **Storj** | 2-4 hodiny | $3-15 | ✅ | **$6-30** |
| **Mysterium** | 30 min | $5-30 | ✅ | **$10-60** |
| **NKN** | 15 min | $1-5 | ✅ | **$2-10** |
| **Grass** | 15 min | $5-20 | ✅ | **$10-40** |
| **Bless** | 15 min | $2-10 | ✅ | **$4-20** |
| **CELKEM** | | | | **$32-160/měsíc** |

**→ Zero capital = potenciálně $32-160/měsíc pasivního příjmu.**

---

## 🔵 Tier 2 — Nízký kapitál ($50-300)

> **Drobný stake/collateral, získatelný z mining rewards nebo nákupem.**

### 6. Flux — FluxNode Cumulus

| Parametr | Hodnota |
|----------|---------|
| **Typ** | Decentralized cloud infrastructure node |
| **Token** | FLUX ($0.071) |
| **Market Cap** | $28.5M |
| **Collateral** | **1,000 FLUX** (~$71) |
| **HW požadavky** | 2 vCores, 4 threads, 8 GB RAM, 220 GB SSD, 25 Mbit |
| **Setup difficulty** | ⭐⭐⭐ Středně náročné (Flux OS + node setup) |
| **Block reward** | 1 FLUX/blok pro Cumulus tier (každých 30s!) |
| **Realistický příjem** | **$15-40/měsíc** |

**Proč Flux je #1 node projekt:**
- **PoUW v2** (Proof of Useful Work) — 30s block time, každý node placen s každým blokem
- 14 FLUX per block: 9 Stratus + 3.5 Nimbus + 1 Cumulus + 0.5 Foundation
- Decentralized cloud — real use case (alternativa k AWS)
- FluxCloud, FluxAI, FluxEdge — živé produkty
- **Collateral $71 je rychle získatelný z jiné těžby**

**Tiers:**

| Tier | Collateral | HW | Reward share | ~Měsíc |
|------|-----------|-----|-------------|--------|
| **Cumulus** | 1,000 FLUX (~$71) | 2C/8GB/220GB | 1 FLUX/blk | $15-40 |
| **Nimbus** | 12,500 FLUX (~$888) | 4C/32GB/440GB | 3.5 FLUX/blk | $50-120 |
| **Stratus** | 40,000 FLUX (~$2,832) | 8C/64GB/880GB | 9 FLUX/blk | $130-350 |

**Plán:** Začít Cumulus ($71), reinvestovat rewards → upgrade na Nimbus.

**Setup:**
```bash
# 1. Install Flux OS
bash -i <(curl -s https://raw.githubusercontent.com/RunOnFlux/fluxnode-multitool/master/multitoolbox.sh)

# 2. Follow setup wizard → provide Flux address, collateral TX, identity key
# 3. Node se registruje v síti a začne produkovat rewards
```

---

### 7. Pocket Network (POKT) — RPC Relay Node

| Parametr | Hodnota |
|----------|---------|
| **Typ** | Decentralizovaný RPC provider (jako Infura/Alchemy) |
| **Token** | POKT ($0.015) |
| **Market Cap** | $30.8M |
| **Stake** | **15,000 POKT** (~$230) |
| **HW požadavky** | 4 CPU, 16 GB RAM, 100 GB SSD per chain |
| **Setup difficulty** | ⭐⭐⭐⭐ Náročné (full nodes podporovaných chainů) |
| **Realistický příjem** | **$20-80/měsíc** (závisí na relay count) |

**Proč:**
- Obsluhuje RPC requesty pro dApps (Ethereum, Polygon, BSC...)
- Platba za každý relay
- Skvěle se pojí s provozem ZION bridge relay nodů (Base, Arbitrum, BSC)
- **Synergie:** Pokud budeme provozovat ETH/BSC/Arbitrum full node pro wZION bridge, můžeme stejný node použít i pro Pocket = dvojí příjem

---

### 8. HOPR — Privacy Mixnet Node

| Parametr | Hodnota |
|----------|---------|
| **Typ** | Privacy relay (mixnet) |
| **Token** | HOPR ($0.020) |
| **Market Cap** | $11.9M |
| **Stake** | **Minimální HOPR stake** (~$30-100) |
| **HW požadavky** | 2 CPU, 2 GB RAM, 10 GB disk |
| **Setup difficulty** | ⭐⭐ Střední |
| **Realistický příjem** | **$5-20/měsíc** |

**Proč:**
- Privacy relay pro metadata ochranu
- Cover traffic rewards — placen za forwardování traffic
- Malý footprint, ideální jako side-node

---

### 9. Aleph Cloud (ALEPH) — Decentralized Compute/Storage

| Parametr | Hodnota |
|----------|---------|
| **Typ** | Compute + storage node (decentralized AWS) |
| **Token** | ALEPH ($0.024) |
| **Market Cap** | $4.4M |
| **Stake** | **Minimální ALEPH stake** (variabilní) |
| **HW požadavky** | 4 CPU, 8 GB RAM, 100 GB+ SSD |
| **Setup difficulty** | ⭐⭐ Střední |
| **Realistický příjem** | **$5-15/měsíc** |

---

### Tier 2 — Souhrn

| Projekt | Stake potřeba | Setup | Příjem/měsíc oba servery |
|---------|--------------|-------|-------------------------|
| **Flux Cumulus** | ~$71 | 2h | **$30-80** |
| **Pocket** | ~$230 | 4h+ | **$40-160** |
| **HOPR** | ~$30-100 | 1h | **$10-40** |
| **Aleph** | variabilní | 2h | **$10-30** |
| **CELKEM** | **$331-401** | | **$90-310/měsíc** |

---

## 🟡 Tier 3 — Střední kapitál ($300-3000)

> **Vyšší stake, vyšší rewards. Ideální po rozběhnutí Tier 1+2 příjmů.**

### 10. Flux Nimbus / Stratus (upgrade)

| Tier | Collateral | Příjem/měsíc |
|------|-----------|-------------|
| **Nimbus** | 12,500 FLUX (~$888) | $50-120 |
| **Stratus** | 40,000 FLUX (~$2,832) | $130-350 |

**Strategie:** Reinvestovat Cumulus rewards → upgrade na Nimbus za ~6 měsíců.

### 11. Theta Network — Guardian / Edge Node

| Parametr | Hodnota |
|----------|---------|
| **Typ** | Video CDN + edge computing |
| **Token** | THETA ($0.21), TFUEL ($0.015) |
| **Market Cap** | $209M (THETA), $109M (TFUEL) |
| **Stake** | Edge Node: **$0** / Guardian Node: **10,000 THETA (~$2,093)** |
| **Příjem** | TFUEL rewards za edge computing |
| **Realistický příjem** | Edge: **$1-5/měsíc** / Guardian: **$15-40/měsíc** |

**Edge Node je zdarma** — minimální resources, TFUEL rewards.  
Guardian Node vyžaduje 10K THETA stake ale vyšší rewards.

### 12. Livepeer — Video Transcoding Orchestrator

| Parametr | Hodnota |
|----------|---------|
| **Typ** | Decentralized video transcoding |
| **Token** | LPT ($2.48) |
| **Market Cap** | $123M |
| **Stake** | Self-delegate LPT (minimální ~100 LPT / $248) |
| **HW požadavky** | GPU silně doporučeno pro transcoding |
| **Realistický příjem** | **$20-100/měsíc** (s GPU) |

### 13. The Graph — Indexer Node

| Parametr | Hodnota |
|----------|---------|
| **Typ** | Blockchain data indexer (subgraphs) |
| **Token** | GRT ($0.028) |
| **Market Cap** | $302M |
| **Stake** | Min **100,000 GRT (~$2,800)** |
| **HW požadavky** | 8+ CPU, 32+ GB RAM, SSD, Ethereum archive node |
| **Realistický příjem** | **$50-200/měsíc** (ale vysoké HW nároky) |

---

## 🟣 Tier 4 — DePIN & AI Compute

> **Prodáváme compute/storage/bandwidth za crypto. Naše servery = výrobní prostředek.**

### 14. Akash Network — Compute Provider

| Parametr | Hodnota |
|----------|---------|
| **Typ** | Decentralized cloud marketplace (alt. k AWS) |
| **Token** | AKT ($0.34) |
| **Market Cap** | $98.5M |
| **Investice** | $0 (software setup, Kubernetes cluster) |
| **HW požadavky** | Kubernetes cluster, 4+ CPU, 16+ GB RAM |
| **Setup difficulty** | ⭐⭐⭐⭐⭐ Náročné (K8s + Akash provider) |
| **Realistický příjem** | **$20-100/měsíc** (závisí na poptávce) |

**Proč Akash:**
- "Airbnb pro servery" — pronajímáme volný compute
- 127,590 deployments
- Akash Provider Console zjednodušuje setup
- CPU i GPU compute na marketplace
- **Synergie s ZION:** Můžeme hostovat ZION nody pro ostatní na Akashu

**Setup summary:**
1. Kubernetes cluster (k3s / microk8s)
2. Akash Provider software
3. Registrace jako provider v Akash console
4. Automatický matching s klienty

---

### 15. Filecoin — Storage Provider (Saturn CDN)

| Parametr | Hodnota |
|----------|---------|
| **Typ** | Decentralized storage + CDN |
| **Token** | FIL ($0.98) |
| **Market Cap** | $736M |
| **Saturn CDN investice** | $0 (lightweight cache node) |
| **Full storage miner** | Nutný FIL collateral + NVMe |
| **Realistický příjem** | Saturn: **$5-20/měsíc** / Full: **$100+/měsíc** |

**Saturn CDN L1 node = zero capital:**
- Cache content pro Filecoin/IPFS síť
- Placen za delivered bandwidth
- Nízké resource nároky

---

### 16. io.net — GPU Compute Marketplace

| Parametr | Hodnota |
|----------|---------|
| **Typ** | Decentralized GPU cloud pro ML/AI |
| **Token** | IO ($0.11) |
| **Market Cap** | $31M |
| **Investice** | $0 pro CPU worker, GPU pro plný příjem |
| **Realistický příjem** | CPU: **$2-10/měsíc** / GPU: **$50-200/měsíc** |

---

### 17. Nosana — Solana CI/CD Compute

| Parametr | Hodnota |
|----------|---------|
| **Typ** | Decentralized CI/CD + GPU inference |
| **Token** | NOS ($0.18) |
| **Market Cap** | $14.7M |
| **Investice** | $0 (GPU silně doporučeno) |
| **Realistický příjem** | **$5-30/měsíc** |

---

## 🔴 Tier 5 — Strategické full nodes (ZION infra)

> **Tyto nody nepřinášejí přímý příjem, ale jsou nutné pro ZION ekosystém.**
> **S Pocket Network ale mohou generovat příjem sekundárně!**

### ZION wZION Bridge Relay Nodes

Pro wZION bridge potřebujeme full nodes podporovaných chainů:

| Chain | Typ | Disk | RAM | Synergie |
|-------|-----|------|-----|----------|
| **Ethereum** (L1) | Full node (Geth) | 500 GB+ | 16 GB | Pocket Network relays |
| **Base** (L2) | Full node | 50 GB | 8 GB | Pocket Network relays |
| **Arbitrum** (L2) | Full node | 100 GB | 8 GB | Pocket Network relays |
| **BSC** | Full node | 500 GB+ | 16 GB | Pocket Network relays |
| **Solana** | Validator (optional) | 500 GB+ | 256 GB | ⚠️ Vysoké nároky |
| **Polygon** | Full node | 200 GB | 16 GB | Pocket Network relays |

**Pocket Network synergie:** Každý full node, který provozujeme pro wZION bridge, může
zároveň obsluhovat Pocket Network RPC relays = **dvojí využití, dvojí příjem**.

---

## 🐳 Docker compose — Multi-Node Stack

```yaml
# docker-compose.nodes.yml
# ZION Multi-Node Revenue Stack

version: '3.8'

services:
  # ═══════════════════════════════════════════
  # STORJ — Storage Node (zero capital)
  # Earn $1.50/TB/month storage + $2/TB egress
  # ═══════════════════════════════════════════
  storj-node:
    image: storjlabs/storagenode:latest
    container_name: zion-storj-node
    restart: unless-stopped
    ports:
      - "28967:28967/tcp"
      - "28967:28967/udp"
      - "14002:14002"
    volumes:
      - /opt/storj/identity:/app/identity
      - /opt/storj/data:/app/config
    environment:
      - WALLET=0xYOUR_ETH_WALLET
      - EMAIL=your@email.com
      - ADDRESS=YOUR_PUBLIC_IP:28967
      - STORAGE=200GB
    labels:
      - "zion.node=storj"
      - "zion.revenue=storage"

  # ═══════════════════════════════════════════
  # MYSTERIUM — VPN/Proxy Node (zero capital)
  # Earn from bandwidth sharing (B2B + P2P)
  # ═══════════════════════════════════════════
  mysterium-node:
    image: mysteriumnetwork/myst:latest
    container_name: zion-mysterium-node
    restart: unless-stopped
    cap_add:
      - NET_ADMIN
    ports:
      - "4449:4449"
      - "41920-41925:41920-41925/udp"
    volumes:
      - /opt/mysterium/data:/var/lib/mysterium-node
    command: service --agreed-terms-and-conditions
    labels:
      - "zion.node=mysterium"
      - "zion.revenue=bandwidth"

  # ═══════════════════════════════════════════
  # NKN — Network Relay Node (zero capital)
  # Earn from P2P relay services
  # ═══════════════════════════════════════════
  nkn-node:
    image: nknorg/nkn:latest
    container_name: zion-nkn-node
    restart: unless-stopped
    ports:
      - "30001-30005:30001-30005"
    volumes:
      - /opt/nkn/data:/nkn/data
    command: nknd -p "" --no-nat
    labels:
      - "zion.node=nkn"
      - "zion.revenue=relay"

  # ═══════════════════════════════════════════
  # THETA — Edge Node (zero capital)
  # Earn TFUEL for edge computing / CDN
  # ═══════════════════════════════════════════
  theta-edge:
    image: thetatoken/theta-edge-node:latest
    container_name: zion-theta-edge
    restart: unless-stopped
    ports:
      - "15888:15888"
      - "17888:17888"
    volumes:
      - /opt/theta/data:/data
    labels:
      - "zion.node=theta"
      - "zion.revenue=edge-compute"

  # ═══════════════════════════════════════════
  # HOPR — Privacy Mixnet Node (low capital)
  # Earn from cover traffic relay
  # ═══════════════════════════════════════════
  hopr-node:
    image: gcr.io/hoprassociation/hoprd:stable
    container_name: zion-hopr-node
    restart: unless-stopped
    ports:
      - "9091:9091"
      - "3001:3001"
    volumes:
      - /opt/hopr/data:/app/hoprd-db
    environment:
      - HOPRD_API_TOKEN=YOUR_API_TOKEN
    labels:
      - "zion.node=hopr"
      - "zion.revenue=privacy-relay"

# ═══════════════════════════════════════════
# Volumes
# ═══════════════════════════════════════════
volumes:
  storj-data:
  mysterium-data:
  nkn-data:
  theta-data:
  hopr-data:

# ═══════════════════════════════════════════
# Networks
# ═══════════════════════════════════════════
networks:
  default:
    name: zion-nodes-net
```

---

## 📊 Odhad příjmů — 3 scénáře

### Scénář A — Minimum (Tier 1 only, zero capital)

> Deploy na oba servery, žádná investice.

| Node | Per server | 2 servery | Příjem/měsíc |
|------|-----------|-----------|-------------|
| Storj | $3-15 | ✅ | $6-30 |
| Mysterium | $5-30 | ✅ | $10-60 |
| NKN | $1-5 | ✅ | $2-10 |
| Grass | $5-20 | ✅ | $10-40 |
| Theta Edge | $1-5 | ✅ | $2-10 |
| **CELKEM** | | | **$30-150/měsíc** |
| **Náklady navíc** | | | **$0** |
| **NET** | | | **$30-150/měsíc** |

### Scénář B — Growth (Tier 1 + 2, small investment)

> Reinvestujeme první měsíc příjmů do Flux Cumulus stake.

| Zdroj | Příjem/měsíc |
|-------|-------------|
| Tier 1 nodes (Storj, Myst, NKN, Grass, Theta) | $30-150 |
| Flux Cumulus (2× node) | $30-80 |
| HOPR (2× node) | $10-40 |
| **CELKEM** | **$70-270/měsíc** |
| Investice (jednorázová) | ~$170 (FLUX + HOPR stake) |
| **ROI** | **< 1 měsíc** |

### Scénář C — Full Scale (Q3-Q4 2026)

> Všechny tiery + bridge relay nodes + Pocket Network + Akash.

| Zdroj | Příjem/měsíc |
|-------|-------------|
| Tier 1 nodes | $30-150 |
| Flux Nimbus (2×) | $100-240 |
| Pocket Network (2×) | $40-160 |
| Akash Provider | $20-100 |
| Theta Guardian | $15-40 |
| HOPR + Aleph + misc | $15-45 |
| **CELKEM** | **$220-735/měsíc** |
| Investice (total) | ~$1,500-2,500 |
| **Měsíční ROI** | **~15-30%** |
| **Payback** | **2-4 měsíce** |

---

## 🗓️ Roadmap nasazení

```
═══════════════════════════════════════════════
  FÁZE 1 — ZERO CAPITAL (Týden 1-2, Feb 2026)
═══════════════════════════════════════════════

Týden 1:
  □ Storj identity creation (oba servery)
  □ Mysterium node deploy (oba servery)
  □ NKN node deploy (oba servery)
  □ Grass node/extension setup

Týden 2:
  □ Theta Edge node deploy
  □ Monitoring dashboard setup
  □ Storj node autorizace + start
  □ Ověření prvních payoutů

═══════════════════════════════════════════════
  FÁZE 2 — LOW CAPITAL (Měsíc 2, Mar 2026)
═══════════════════════════════════════════════

  □ Nákup 1,000 FLUX z Tier 1 příjmů
  □ Flux Cumulus node setup (Helsinki)
  □ HOPR node deploy (Germany)
  □ Bless Network node deploy
  □ Vyhodnocení Tier 1 výnosů

═══════════════════════════════════════════════
  FÁZE 3 — EXPANSION (Q2 2026)
═══════════════════════════════════════════════

  □ Flux Cumulus node #2 (Germany)
  □ Pocket Network node setup
  □ Akash Provider evaluation
  □ wZION bridge relay nodes (Base, Arbitrum, BSC)
  □ Pocket Network synergie s bridge nodes

═══════════════════════════════════════════════
  FÁZE 4 — SCALE UP (Q3-Q4 2026)
═══════════════════════════════════════════════

  □ Flux upgrade: Cumulus → Nimbus
  □ 3. server procurement (GPU)
  □ Livepeer orchestrator (GPU)
  □ io.net GPU worker
  □ Theta Guardian node upgrade
  □ The Graph Indexer evaluation
  □ Akash Provider scale-up

═══════════════════════════════════════════════
  CÍLE NA KONEC 2026
═══════════════════════════════════════════════

  🎯 10+ aktivních node projektů
  🎯 $300-700/měsíc pasivní příjem
  🎯 ZION bridge relay infra plně funkční
  🎯 Všechny investice splacené (ROI < 4 měsíce)
```

---

## ⚠️ Rizika a mitigace

| Risk | Dopad | Pravd. | Mitigace |
|------|-------|--------|----------|
| **Token price crash** | Nižší USD příjmy | Vysoká | Diverzifikace 10+ projektů, auto-sell |
| **Projekt shutdown** | Ztráta node příjmů | Střední | Nevsadit vše na 1 projekt, sledovat vývoj |
| **Hetzner TOS** | Blokace služeb | Nízká | Nody jsou legitimní, žádný TOS problém |
| **Disk space limit** | Nemůžeme přijímat Storj data | Nízká | Dokoupit SSD, Hetzner storage box |
| **Network saturation** | Méně odměn na node | Střední | Být early adopter, diversifikovat |
| **Stake lock-up risk** | Collateral locked v bear market | Střední | Začít s Tier 1 (zero capital) |
| **Setup complexity** | Čas na konfiguraci | Nízká | Docker compose ready, scripty |

### Hetzner kompatibilita ✅

Na rozdíl od miningu, **provoz nodů** je na Hetzner plně v souladu s TOS:
- ✅ Storage nodes (Storj, Filecoin) — uložení dat
- ✅ VPN/relay nodes (Mysterium, NKN, HOPR) — síťové služby
- ✅ Compute providers (Akash) — pronájem resource
- ✅ Validator/full nodes — blockchain infrastruktura
- ✅ CDN nodes (Theta, Saturn) — content delivery

**→ Žádné riziko banu, na rozdíl od intenzivního CPU miningu.**

---

## 📈 Monitoring & Správa

### Dashboard stack

```bash
# Prometheus + Grafana pro monitoring všech nodů
docker run -d --name prometheus -p 9090:9090 prom/prometheus
docker run -d --name grafana -p 3000:3000 grafana/grafana

# Storj dashboard
# → http://SERVER:14002

# Mysterium dashboard
# → http://SERVER:4449

# Flux dashboard
# → https://cloud.runonflux.com
```

### Automatický reporting

```bash
#!/bin/bash
# node_health_check.sh — Kontrola všech nodů
echo "=== ZION Node Revenue Health Check ==="
echo "Date: $(date)"
echo ""

echo "--- Storj ---"
docker inspect --format='{{.State.Status}}' zion-storj-node 2>/dev/null || echo "NOT RUNNING"

echo "--- Mysterium ---"
docker inspect --format='{{.State.Status}}' zion-mysterium-node 2>/dev/null || echo "NOT RUNNING"

echo "--- NKN ---"
docker inspect --format='{{.State.Status}}' zion-nkn-node 2>/dev/null || echo "NOT RUNNING"

echo "--- Theta Edge ---"
docker inspect --format='{{.State.Status}}' zion-theta-edge 2>/dev/null || echo "NOT RUNNING"

echo "--- HOPR ---"
docker inspect --format='{{.State.Status}}' zion-hopr-node 2>/dev/null || echo "NOT RUNNING"

echo ""
echo "Docker nodes running: $(docker ps --filter 'label=zion.node' --format '{{.Names}}' | wc -l)"
```

---

## 🏆 Shrnutí — Priority

| # | Projekt | Investice | Příjem/měsíc (2 servery) | Kdy | Effort |
|---|---------|----------|-------------------------|-----|--------|
| 🥇 | **Storj** | $0 | $6-30 | Ihned | ⭐⭐ |
| 🥈 | **Mysterium** | $0 | $10-60 | Ihned | ⭐ |
| 🥉 | **Flux Cumulus** | ~$71 | $30-80 | Měsíc 2 | ⭐⭐⭐ |
| 4 | **Grass** | $0 | $10-40 | Ihned | ⭐ |
| 5 | **NKN** | $0 | $2-10 | Ihned | ⭐ |
| 6 | **Theta Edge** | $0 | $2-10 | Ihned | ⭐ |
| 7 | **HOPR** | ~$50 | $10-40 | Měsíc 2 | ⭐⭐ |
| 8 | **Pocket** | ~$230 | $40-160 | Q2 | ⭐⭐⭐⭐ |
| 9 | **Akash** | $0 | $20-100 | Q2 | ⭐⭐⭐⭐⭐ |
| 10 | **Flux Nimbus** | ~$888 | $100-240 | Q3 | ⭐⭐⭐ |

**→ Storj + Mysterium + Grass + NKN + Theta = $30-150/měsíc BEZ JAKÉHOKOLIV KAPITÁLU**  
**→ S Flux Cumulus ($71 stake): $60-230/měsíc**  
**→ Full scale: $220-735/měsíc**

---

## 🔗 Kombinace s MULTI_COIN_NODE_REVENUE.md

Tato strategie **doplňuje** (ne nahrazuje) mining strategii:

| Aktivita | Příjem/měsíc | CPU load |
|----------|-------------|----------|
| ZION mining (hlavní) | Block rewards | Vysoký |
| XMR mining (1 jádro) | ~$12 | Střední |
| **Node provoz (tento dokument)** | **$30-735** | **Nízký** |
| GPU mining (budoucí) | $60-120 | GPU only |

**→ Nody a mining se KOMBINUJÍ — nody mají nízký CPU footprint, mining zabírá CPU.**
**→ Optimální mix: ZION mining (hlavní jádra) + nody (zbylé resources).**

---

> *"Don't just mine the coins — be the infrastructure."*  
> — ZION TerraNova Node Strategy v1.0  
> 
> **Zdroje:** runonflux.com, storj.dev, mysterium.network, akash.network,  
> depinscan.io, coingecko.com/categories/depin (17. února 2026)
