# 💰 ZION — KOMPLETNÍ REVENUE PLÁN

> **Verze:** 1.0 — 23. února 2026  
> **Architektura:** CH3 (50/25/25) — ZION / Multi-Algo / NCL  
> **Celkem: 5 revenue streamů, jen 3 stojí compute**

---

## 🗂️ OBSAH

1. [Přehled architektury](#1-přehled-architektury)
2. [Aktuální stav serverů](#2-aktuální-stav-serverů)
3. [Stream 1 — CPU Mining (ZION + MoneroOcean)](#3-stream-1--cpu-mining)
4. [Stream 2 — ETC Merged Mining (FREE)](#4-stream-2--etc-merged-mining-free)
5. [Stream 3 — NXS Merged Mining (FREE)](#5-stream-3--nxs-merged-mining-free)
6. [Stream 4 — GPU Profit-Switch](#6-stream-4--gpu-profit-switch)
7. [Stream 5 — NCL AI Compute Gateway](#7-stream-5--ncl-ai-compute-gateway)
8. [Bandwidth Revenue (Mysterium)](#8-bandwidth-revenue-mysterium)
9. [NKN Relay Node](#9-nkn-relay-node)
10. [Cenové kalkulace a projekce](#10-cenové-kalkulace-a-projekce)
11. [TODO — Nezahájené úkoly](#11-todo--nezahájené-úkoly)
12. [Deploy příkazy](#12-deploy-příkazy)

---

## 1. Přehled architektury

```
┌─────────────────────────────────────────────────────────────────┐
│              ZION CH3 Revenue Model — 50/25/25                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  100% CPU/GPU compute                                             │
│       │                                                           │
│       ├─── 50% → Stream 1: ZION CosmicHarmony                    │
│       │              ├── FREE byproduct → Stream 2: ETC/Keccak   │
│       │              └── FREE byproduct → Stream 3: NXS/SHA3     │
│       │                                                           │
│       ├─── 25% → Stream 4: Multi-Algo GPU profit-switch          │
│       │              └── ERG / RVN / ETC / ALPH (WhatToMine)    │
│       │                                                           │
│       └─── 25% → Stream 5: NCL AI Compute                        │
│                      └── embeddings / code_analysis / LLM        │
│                                                                   │
│  + Bandwidth (bez compute nákladů):                              │
│       ├── Mysterium VPN (5 nodů, MYST payout)                    │
│       └── NKN Relay (2 nody, NKN payout)                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Aktuální stav serverů

> Snapshot: 23. 2. 2026 ~13:30 UTC

| Server | IP | Arch | Kontejnery | Revenue stav |
|--------|-----|------|-----------|-------------|
| **Helsinki** (TreeOfLife) | 77.42.31.72 | ARM64 | zion-core, zion-pool, zion-miner, zion-dero-miner, zion-zeph-miner, zion-mysterium, zion-nkn, monitoring stack | ✅ Plný stack |
| **SeedDE** | 46.225.126.243 | ARM64 | zion-core, zion-miner, zion-dero-miner, zion-epic-miner, zion-mysterium, zion-nkn | ✅ Seed + revenue |
| **Usa1** | 5.78.178.227 | x86_64 | zion-core, zion-miner, zion-xmr-x86, zion-mysterium | ✅ Seed + bandwidth |
| **Usa2** | 178.156.240.160 | x86_64 | zion-core, zion-miner, zion-xmr-x86, zion-mysterium | ✅ Seed + bandwidth |
| **Asia3** | 5.223.43.93 | x86_64 | zion-core, zion-miner, zion-xmr-x86, zion-mysterium | ✅ Seed + bandwidth |

### SSH klíče

| Server | Klíč |
|--------|------|
| Helsinki + Usa1/2/3 | `~/.ssh/zion_hetzner_key` |
| SeedDE | `~/.ssh/zion_server_key` |

### Mysterium identities (všech 5 nodů — **Registered**)

| Server | Mysterium ID | Stav |
|--------|-------------|------|
| Helsinki | `0xbf85983bf3ecc65791b2884e30a9c0e1636b757b` | ✅ Registered |
| SeedDE | `0x1a9bcc8298a4cd214a90fb63e1eb5effa8fd8969` | ✅ Registered |
| Usa1 | `0xbfce8102af31342a22bdf217c7fd446d1476d2f7` | ✅ Registered |
| Usa2 | `0xe4286963afec6dbef08c217779a032e72661d711` | ✅ Registered |
| Asia3 | `0x687c466b9068d89f3ddba98dab15bd591e2ab61d` | ✅ Registered |

MMN API key: `8JCWSBmBlkYE9gsUq4qQPN3dOj25tctxtj18RSob`  
Dashboard: https://my.mystnodes.com

---

## 3. Stream 1 — CPU Mining

### Architektura

```
Desktop / Server CPU
    └── zion-miner (vlastní pool na pool:3333)
    └── zion-dero-miner (MoneroOcean, ARM64 compiled xmrig)
    └── zion-zeph-miner (MoneroOcean, Helsinki only)
    └── zion-epic-miner (MoneroOcean, SeedDE only)
    └── zion-xmr-x86 (MoneroOcean, x86 pre-built binary)
```

### Aktuální výkon

| Server | Miner | Algo | Pool | Hashrate (cca) | Stav |
|--------|-------|------|------|---------------|------|
| Helsinki | zion-dero-miner (2T) | rx/0 | MoneroOcean | ~200 H/s | ✅ |
| Helsinki | zion-zeph-miner (1T) | rx/0 | MoneroOcean | ~100 H/s | ✅ |
| SeedDE | zion-dero-miner (2T) | rx/0 | MoneroOcean | ~200 H/s | ✅ |
| SeedDE | zion-epic-miner (1T) | rx/0 | MoneroOcean | ~100 H/s | ✅ |
| Usa1 | zion-xmr-x86 (1T) | rx/0 | MoneroOcean | ~40 H/s | ✅ |
| Usa2 | zion-xmr-x86 (1T) | rx/0 | MoneroOcean | ~40 H/s | ✅ |
| Asia3 | zion-xmr-x86 (1T) | rx/0 | MoneroOcean | ~40 H/s | ✅ |

**Celkem: ~720 H/s (RandomX)**  
MoneroOcean auto-switch maximalizuje zisk (XMR/DERO/ZEPH/EPIC výběr nejziskovějšího).

### MoneroOcean peněženka

```
XMR payout: 42m86RBWf4PeuRf8P5rwA96XvmCKAfF77doWYJRv3KKAKrT8GTb5b3pbHTtaZsbJ4BERW1NHgh8WQgpAxAoEiXF82skcKsK
Dashboard:  https://moneroocean.stream/#/dashboard?addr=42m86...
```

### TODO — CPU Mining

- [ ] **MSR hugepages na VPS** — x86 servery mají `msr module not available` → ~30% pomalejší. Řešení: `docker run --privileged` + `msr-tools`, nebo přijmout limit.
- [ ] **Zvýšit počet threadů** na Usa1/2/Asia3 (CPX11 = 2 vCPU) — aktuálně 1T, lze 2T
- [ ] **DERO mining** na x86 — AstroBWTv3 je lepší než RandomX na slabých CPU, přepnout Usa1/2/Asia3
- [ ] **Pool failover watchdog** — skript pro restart zion-pool pokud spadne

---

## 4. Stream 2 — ETC Merged Mining (FREE)

### Princip

CosmicHarmony pipeline produkuje Keccak256 intermediate hash jako volný vedlejší produkt — ten lze submitovat do ETC/NiceHash poolu **bez jakéhokoliv výpočetního nákladu navíc**.

### Konfigurace (config/ch3_revenue_settings.json)

```json
"etc": {
  "pool": "stratum+tcp://etc.2miners.com:1010",
  "wallet": "bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw",
  "worker": "zion_merged",
  "enabled": true
}
```

### TODO — ETC Merged

- [ ] **Implementovat Keccak export** v pool/src (pool musí forwardovat Keccak intermediate do etc.2miners.com)
- [ ] **Testovat merged mining** na testnet poollu
- [ ] **Auto-convert ETC → BTC** (2miners podporuje přímý BTC payout)

---

## 5. Stream 3 — NXS Merged Mining (FREE)

### Princip

SHA3-512 intermediate hash z CosmicHarmony Stage 2 → submitovat do Nexus poolu.

### Konfigurace

```json
"nxs": {
  "pool": "stratum+tcp://pool.nexus.io:9549",
  "enabled": false  ← zatím disabled
}
```

### TODO — NXS Merged

- [ ] Nízká priorita (NXS market cap $15M, malý dopad)
- [ ] Aktivovat po ETC merged mining

---

## 6. Stream 4 — GPU Profit-Switch

### Soubory

| Soubor | Popis |
|--------|-------|
| `docker/docker-compose.gpu-revenue.yml` | Full GPU stack |
| `scripts/profit_switcher.py` | WhatToMine API auto-switch |
| `scripts/gpu_metrics_exporter.py` | Prometheus metriky (:9200) |
| `docker/.env.gpu-revenue.example` | Konfigurační šablona |

### Podporované GPU minery

| Miner | Profil | Platforma | Coiny |
|-------|--------|-----------|-------|
| **lolminer** | default | NVIDIA + AMD | ERG, RVN, ETC, ALPH |
| **teamredminer** | `amd` | AMD ROCm/OpenCL | ERG, RVN, ETC |
| **t-rex** | `nvidia-trex` | NVIDIA CUDA | ERG, RVN, ETC, KawPow |

### Profit-switch coiny (aktuální ceny ~2026-02-23)

| Coin | Ticker | Algo | Pool | Revenue RTX 3080/den |
|------|--------|------|------|---------------------|
| Ergo | ERG | Autolykos2 | erg.2miners.com:8008 | ~$0.80 |
| Ravencoin | RVN | KawPow | rvn.2miners.com:6060 | ~$0.60 |
| ETC | ETC | Etchash | etc.2miners.com:1010 | ~$1.20 |
| Alephium | ALPH | Blake3 | alph.2miners.com:1199 | ~$0.90 |
| Kaspa | KAS | kHeavyHash | pool.woolypooly.com:3112 | ~$1.50+ |

WhatToMine auto-switch každých 15 minut s 5% hysteresis.

### Deploy GPU server

```bash
# NVIDIA server
ZION_BTC_WALLET=bc1q... WHATTOMINE_GPU_ID=353 \
docker compose -f docker/docker-compose.gpu-revenue.yml --profile nvidia up -d

# AMD server
ZION_BTC_WALLET=bc1q... WHATTOMINE_GPU_ID=335 \
docker compose -f docker/docker-compose.gpu-revenue.yml --profile amd up -d
```

### TODO — GPU Stack

- [ ] **Pronajmout GPU server** — Hetzner GX1 (RTX 4000 Ada, €0.49/h) nebo Vast.ai (RTX 3080 ~$0.20/h)
- [ ] **Testovat lolminer** na GPU serveru (ověřit Docker GPU passthrough)
- [ ] **Aktivovat profit-switcher** — napojit na lolminer REST API (:19999)
- [ ] **KAS mining** — KHeavyHash nejziskovější, přidat do poolu
- [ ] **ETC mining na GPU** — Etchash, lepší než CPU MoneroOcean na moderním GPU
- [ ] **GPU monitoring v Grafana** — přidat gpu_metrics_exporter (:9200) do prometheus targets

---

## 7. Stream 5 — NCL AI Compute Gateway

### Soubory

| Soubor | Popis |
|--------|-------|
| `scripts/ncl_gateway.py` | HTTP server port 8002, polluje pool NCL tasky |
| `docker/docker-compose.gpu-revenue.yml` | `ncl-gateway` service |
| `docker/docker-compose.revenue.yml` | `ncl-gateway` service (profil ncl) |
| `L1/miner/src/ncl/mod.rs` | Rust NCL client (v zion-miner) |
| `L1/cosmic-harmony/src/ncl_integration.rs` | CH3 NCL integrace |
| `config/ch3_revenue_settings.json` | NCL config: gateway_url, allocation 25% |

### Aktuální stav

NCL gateway je **připravena** ale pool zatím nevydává NCL tasky (pool side není implementováno).

Architektura:
```
ZION Pool (NCL task endpoint: /ncl/task)
    └── ncl_gateway.py (poll každých 5s)
         ├── hash_verification (CPU, vždy dostupné)
         ├── embeddings (sentence-transformers, opt-in)
         ├── code_analysis (statická analýza)
         └── llm_inference (llama.cpp GGUF, GPU opt-in)
```

### Podporované task typy

| Typ | Runtime | GPU | Status |
|-----|---------|-----|--------|
| `hash_verification` | Python CPU | ❌ | ✅ Implementováno |
| `code_analysis` | Python CPU | ❌ | ✅ Implementováno |
| `embeddings` | ONNX Runtime | opt | 🔧 Stub (ONNX model chybí) |
| `llm_inference` | llama.cpp | opt | 🔧 Stub (GGUF chybí) |
| `image_classification` | ONNX | opt | 🔧 Stub |

### TODO — NCL

- [ ] **Pool side**: implementovat `/ncl/task` a `/ncl/result` endpointy v pool serveru
- [ ] **ONNX model**: stáhnout all-MiniLM-L6-v2.onnx (~23MB) pro embeddings
- [ ] **GGUF model**: llama-3.2-1B-Instruct.Q4.gguf (~800MB) pro LLM inference
- [ ] **Aktivovat ncl-gateway** na Helsinki (port 8002 volný)
- [ ] **NCL reward systém** — pool musí platit ZION za dokončené tasky
- [ ] **Testnet NCL round** — end-to-end test task dispatch → result → reward

---

## 8. Bandwidth Revenue — Mysterium

### Aktuální stav

Všech 5 nodů **Registered** via MMN API key sponsorship. Quality oracle potřebuje 30–60 min pro nové nody.

| Node | Identita | Status |
|------|---------|--------|
| Helsinki | `0xbf8598...` | ✅ Registered → earning |
| SeedDE | `0x1a9bcc...` | ✅ Registered → earning |
| Usa1 | `0xbfce81...` | ✅ Registered → earning |
| Usa2 | `0xe42869...` | ✅ Registered → earning |
| Asia3 | `0x687c46...` | ✅ Registered → earning |

**Payout**: MYST token na Polygon Mainnet (ChainID 137)  
**MYST token**: `0x1379E8886A944d2D9d440b3d88DF536Aea08d9Ee`  
**Backup**: `MYSTERIUM_KEYS_BACKUP.json` (lokálně, gitignored)

### Konfigurace

```yaml
# docker-compose.revenue.yml / docker-compose.mysterium-only.yml
command: --mmn.api-key=8JCWSBmBlkYE9gsUq4qQPN3dOj25tctxtj18RSob service --agreed-terms-and-conditions
ports:
  - "4449:4449"
  - "41920-41925:41920-41925/udp"
```

### TODO — Mysterium

- [ ] **Exportovat private keys** Usa1/Usa2/Asia3 z Docker volume → přidat do `MYSTERIUM_KEYS_BACKUP.json`
  ```bash
  ssh root@<ip> "docker exec zion-mysterium ls /var/lib/mysterium-node/keystore/"
  # zkopírovat keystore soubory a dešifrovat offline
  ```
- [ ] **Sledovat quality score** — za 1–2 hodiny by mělo stoupnout z 0 na >50
  ```bash
  ssh root@<ip> 'TOKEN=$(curl -sf -X POST http://localhost:4449/tequilapi/auth/authenticate -d "{\"username\":\"myst\",\"password\":\"mystberry\"}" -H "Content-Type: application/json" | grep -o "\"token\":\"[^\"]*\"" | cut -d: -f2 | tr -d "\""); curl -s "http://localhost:4449/tequilapi/quality" -H "Authorization: Bearer $TOKEN"'
  ```
- [ ] **MYST payout sledování** na https://my.mystnodes.com
- [ ] **Port forwarding ověření** — UDP 41920-41925 musí být dostupné z internetu (Hetzner cloud firewall)
- [ ] **Import do MetaMask** — private keys Usa1/Usa2/Asia3 po exportu

---

## 9. NKN Relay Node

### Aktuální stav

NKN běží na Helsinki + SeedDE, ale čeká na první transakci (CreateID).

**Stav**: Spuštěno, wallet inicializován, potřebuje fundování.

| Server | NKN adresa | Status |
|--------|-----------|--------|
| Helsinki | `NKNa2RgWynz4HB6BMqUACwqrzSwdZHcGznKg` | ⚠️ Čeká na 10 NKN |
| SeedDE | (stejná wallet — shared volume) | ⚠️ Čeká na 10 NKN |

### Kalkulace NKN

| Parametr | Hodnota |
|---|---|
| Cena 1 NKN | ~$0.0055 |
| Vstupní náklad (2×10 NKN) | **~$0.11** |
| Odhad výdělku | ~0.1–0.5 NKN/den/node |
| Roční návratnost | ~$0.40–$2.00 |

**Doporučení**: Nízká priorita. Vstupní cena je zanedbatelná, ale výdělky jsou při aktuální ceně NKN minimální. Aktivovat až po stabilizaci ostatních streamů.

### TODO — NKN

- [ ] (opt) Koupit 20 NKN (~$0.11) a poslat na wallet adresu → activovat oba nody
- [ ] Automatizovat wallet init flow v docker-compose

---

## 10. Cenové kalkulace a projekce

### Aktuální příjmy (odhad, únor 2026)

#### CPU Mining — 5 serverů

| Zdroj | H/s | XMR/den | $/den | $/měsíc |
|-------|-----|---------|-------|---------|
| Helsinki 3T (dero+zeph) | ~300 H/s | ~0.00014 XMR | ~$0.031 | ~$0.93 |
| SeedDE 2T (dero+epic) | ~300 H/s | ~0.00014 XMR | ~$0.031 | ~$0.93 |
| Usa1/2/Asia3 3×1T | ~120 H/s | ~0.000056 XMR | ~$0.012 | ~$0.36 |
| **Celkem CPU** | **~720 H/s** | **~0.00034 XMR** | **~$0.074** | **~$2.22** |

_XMR cena: ~$220. MoneroOcean auto-switches na nejziskovější coin._

#### Mysterium — 5 nodů × 2 services každý

Výdělky závisí na využití. Nové nody typicky:
- Prvních 7 dní: $0 (quality oracle budování)
- Po 1 týdnu: $0.01–$0.05/den/node
- Etablované nody: $0.05–$0.20/den/node

| Projekce | $/den | $/měsíc |
|----------|-------|---------|
| Konzervativní (5 nodů × $0.02) | $0.10 | $3.00 |
| Střední (5 nodů × $0.08) | $0.40 | $12.00 |
| Optimistická (5 nodů × $0.20) | $1.00 | $30.00 |
| _MYST cena: ~$0.10_ | | |

#### GPU Mining (po přidání GPU serveru)

Příklad RTX 3080, nejziskovější coin (KAS/ETC):

| GPU | Hashrate | Coin | Pool | $/den | $/měsíc |
|-----|---------|------|------|-------|---------|
| RTX 3080 | 95 MH/s | ETC (Etchash) | 2miners | ~$1.20 | ~$36 |
| RTX 3080 | 55 MH/s | ERG (Autolykos) | 2miners | ~$0.80 | ~$24 |
| RTX 3080 | auto | profit-switch | WhatToMine | ~$1.50 | ~$45 |
| $0.20/h náklady (Vast.ai) | | | | -$4.80 | -$144 |
| **Čistý zisk** | | | | **~$0** | **~-$99** |

⚠️ **Vlastní GPU server** (bez pronájmu) by byl ziskový: Hetzner GX1 €0.49/h = ~€352/měsíc vs ~$45 výdělek → **nevyplatí se pronajímat**. GPU se vyplatí pouze pokud máš **vlastní hardware** nebo levný dedicated server.

#### Celková projekce (bez GPU, únor 2026)

| Stream | $/měsíc (střední) | Status |
|--------|-------------------|--------|
| CPU Mining (MoneroOcean) | $2.22 | ✅ Běží |
| Mysterium (5 nodů) | $12.00 | ✅ Zahájen |
| ETC Merged (FREE) | $0 (neimpl.) | 🔧 TODO |
| GPU Profit-Switch | $0 (no GPU) | ⏸ Čeká na HW |
| NCL AI | $0 (neimpl.) | 🔧 TODO |
| **Celkem** | **~$14.22/měsíc** | |

---

## 11. TODO — Nezahájené úkoly

### Vysoká priorita 🔴

- [ ] **Mysterium quality score** — zkontrolovat po 1–2h zda stouplo z 0
- [ ] **Exportovat PK** nových nodů (Usa1/Usa2/Asia3) do MYSTERIUM_KEYS_BACKUP.json
- [ ] **Port forwarding check** — UDP 41920-41925 na všech 5 serverech
- [ ] **Pool failover** — zion-pool na Helsinki občas padá, watchdog restart script

### Střední priorita 🟡

- [ ] **ETC merged mining** — implementovat v pool/src (Keccak intermediate export)
- [ ] **Zvýšit threads** na x86 serverech: Usa1/2/Asia3 mají 2 vCPU, xmr-x86 běží na 1T
- [ ] **DERO na x86** — AstroBWTv3 výnosnější než rx/0 na slabých VPS
- [ ] **NCL gateway aktivace** — spustit na Helsinki, sledovat jestli pool vydá task
- [ ] **Pool NCL endpoint** — implementovat /ncl/task a /ncl/result v pool serveru
- [ ] **Grafana GPU dashboard** — přidat gpu_metrics_exporter do monitoring stacku

### Nízká priorita 🟢

- [ ] **NKN aktivace** — koupit 20 NKN (~$0.11), aktivovat oba nody
- [ ] **VRSC miner** — VerusHash vrsc-miner přidat na x86 servery (profil vrsc)
- [ ] **ALPH mining** — Blake3 aktivovat v ch3_revenue_settings.json
- [ ] **KAS mining** — kHeavyHash, vyžaduje GPU (nejziskovější GPU coin 2026)
- [ ] **NXS merged** — SHA3 intermediate, aktivovat po ETC
- [ ] **Buyback bot** — auto XMR/BTC → ZION token (config/ch3_revenue_settings.json ready)
- [ ] **Desktop Agent GPU** — opravit `npm start` crash, otestovat GPU miner v electron app

---

## 12. Deploy příkazy

### CPU mining (ARM64 — Helsinki/SeedDE)

```bash
# Helsinki
COMPOSE_PROFILES=helsinki docker compose -p zion-revenue \
  -f docker/docker-compose.revenue.yml up -d --force-recreate

# Germany/SeedDE  
COMPOSE_PROFILES=germany docker compose -p zion-revenue \
  -f docker/docker-compose.revenue.yml up -d --force-recreate
```

### CPU mining (x86 — Usa1/Usa2/Asia3)

```bash
# Na každém x86 serveru
COMPOSE_PROFILES=x86 docker compose -f /root/docker-compose.revenue.yml up -d xmr-x86-miner
```

### Mysterium only (všechny servery)

```bash
# Na každém serveru (soubor je na /root/)
docker compose -f /root/docker-compose.mysterium-only.yml up -d
```

### GPU revenue stack (na GPU serveru)

```bash
# NVIDIA
ZION_BTC_WALLET=bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw \
ZION_WORKER=zion_gpu_1 \
WHATTOMINE_GPU_ID=353 \
docker compose -f docker/docker-compose.gpu-revenue.yml up -d

# AMD
ZION_BTC_WALLET=bc1qvujra09wlsm35tmhc0v0fnxpsj0cuaq88hd8mw \
ZION_WORKER=zion_gpu_amd \
WHATTOMINE_GPU_ID=335 \
docker compose -f docker/docker-compose.gpu-revenue.yml --profile amd up -d
```

### NCL Gateway (opt-in)

```bash
# Na Helsinki
COMPOSE_PROFILES=ncl docker compose -f /root/docker-compose.revenue.yml up -d ncl-gateway

# Nebo na GPU serveru (s GPU akcelerací)
docker compose -f docker/docker-compose.gpu-revenue.yml up -d ncl-gateway
```

### Stav všech nodů (rychlý přehled)

```bash
# CPU
for ip in 77.42.31.72 46.225.126.243 5.78.178.227 178.156.240.160 5.223.43.93; do
  echo "=== $ip ===" 
  ssh -i ~/.ssh/zion_hetzner_key root@$ip 'docker ps --format "{{.Names}} {{.Status}}" | grep -v "zion-core\|zion-miner\|zion-pool\|zion-redis\|monitoring"'
done

# Mysterium registration check
# Nahradit ID dle tabulky výše:
TOKEN=$(curl -sf -X POST http://SERVER_IP:4449/tequilapi/auth/authenticate \
  -H "Content-Type: application/json" -d '{"username":"myst","password":"mystberry"}' \
  | grep -o '"token":"[^"]*"' | cut -d: -f2 | tr -d '"')
curl -s "http://SERVER_IP:4449/tequilapi/identities/IDENTITY_ADDRESS" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | grep registration
```

---

## 📁 Klíčové soubory

| Soubor | Popis |
|--------|-------|
| `docker/docker-compose.revenue.yml` | ARM64 + x86 CPU revenue stack |
| `docker/docker-compose.mysterium-only.yml` | Pouze Mysterium (x86 seridy) |
| `docker/docker-compose.gpu-revenue.yml` | GPU profit-switch stack |
| `docker/.env.gpu-revenue.example` | GPU config šablona |
| `config/ch3_revenue_settings.json` | Kompletní CH3 konfigurace (5 streamů) |
| `scripts/profit_switcher.py` | WhatToMine auto-switch |
| `scripts/ncl_gateway.py` | NCL AI task gateway |
| `scripts/gpu_metrics_exporter.py` | Prometheus GPU exporter |
| `MYSTERIUM_KEYS_BACKUP.json` | 🔒 Lokálně (gitignored!) — private keys |

---

_Poslední aktualizace: 23. 2. 2026 — Session 29_
