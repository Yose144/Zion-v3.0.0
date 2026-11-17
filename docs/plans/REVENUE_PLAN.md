# 💰 ZION Revenue Plan — Mining + Nody

> **Datum:** 17. února 2026 | **Verze:** 1.0  
> **Princip:** Využít stávající servery na maximum — elektřina v ceně, nulový extra kapitál.

---

## 🖥️ Co máme

| Server | Lokace | CPU | RAM | Disk volný | Bandwidth |
|--------|--------|-----|-----|------------|-----------|
| **Helsinki** | FI `77.42.31.72` | AMD Hetzner AX | 64 GB | ~200 GB SSD | 1 Gbps / 20 TB |
| **Germany** | DE `46.225.126.243` | AMD Hetzner AX | 64 GB | ~200 GB SSD | 1 Gbps / 20 TB |

**Aktuální obsazení:** ZION node + pool (hlavní jádra) + XMR revenue (1T) → **volná: 2–4 jádra, ~16 GB RAM, 200 GB disk per server.**

GPU: ❌ zatím žádné. Vše níže = čistě CPU + nody.

---

## ✅ Už běží

| # | Co | Stav | Příjem |
|---|-----|------|--------|
| 1 | ZION mining (CosmicHarmony) | ✅ Aktivní | Block rewards |
| 2 | ETC merged mining (Keccak byproduct) | ✅ Aktivní | Zdarma — vedlejší produkt CH |
| 3 | XMR přes MoneroOcean → BTC | ✅ Aktivní, 1 jádro | ~$12/měsíc |

---

## 🚀 Plán — 3 fáze

### Fáze 1 — Tento týden (0 Kč investice)

> **Jen Docker kontejnery na stávajících serverech. Žádný kapitál.**

#### A) CPU Mining — 3 nové coiny (4 jádra celkem)

| Coin | Algo | Proč | Jádra | Server | ~$/měsíc |
|------|------|------|-------|--------|----------|
| **DERO** | AstroBWTv3 | Nejlepší CPU profit, ASIC-resistant | 2+2 | oba | ~$18 |
| **ZEPH** | RandomX | Sdílí miner s XMR, privacy + stablecoins | 1 | Helsinki | ~$7 |
| **EPIC** | RandomX | MimbleWimble, dobrý výnos | 1 | Germany | ~$10 |

**Setup = Docker compose** (viz níže). XMRig pro ZEPH/EPIC, DERO miner pro DERO.

#### B) Pasivní nody — bandwidth/relay (minimální CPU)

| Node | Co dělá | Investice | Setup | ~$/měsíc (2 srv) |
|------|---------|-----------|-------|-------------------|
| **Mysterium** | VPN exit node, platba za bandwidth | $0 | Docker 1-liner | $10–60 |
| **NKN** | P2P relay node | $0 | Docker 1-liner | $2–10 |
| **Grass** | AI bandwidth sharing | $0 | Standalone binary | $5–20 |

**Proč tyhle 3:** Minimální CPU/RAM footprint, nula kapitálu, Docker ready. Mysterium má 22K+ nodů a reálné B2B payouty.

#### C) Tari merged mining — zdarma

| Coin | Algo | Proč | Effort | ~$/měsíc |
|------|------|------|--------|----------|
| **Tari (XTM)** | RandomX | Merged mining s XMR — 0 extra compute! | Konfigurace v XMRig | ~$3–5 bonus |

**Fáze 1 celkem: ~$55–130/měsíc** při 0 investici.

---

### Fáze 2 — Měsíc 2–3 (z výdělku Fáze 1)

| Co | Investice | Odkud | ~$/měsíc |
|----|-----------|-------|----------|
| **Flux Cumulus** node (Helsinki) | ~$71 (1000 FLUX) | Z Fáze 1 výdělku | $15–40 |
| **Flux Cumulus** node (Germany) | ~$71 (1000 FLUX) | Z Fáze 1 výdělku | $15–40 |
| **VRSC aktivace** | $0 | Už v configu, jen enable kontejner | ~$4 |
| **QRL** mining test | $0 | RandomX, 1 jádro | ~$5 |

**Fáze 2 celkem: ~$90–220/měsíc** (investice ~$142 z vlastních výdělků).

---

### Fáze 3 — Q2 2026 (scaling)

| Co | Podmínka | ~$/měsíc |
|----|----------|----------|
| Flux upgrade Cumulus → Nimbus | 12 500 FLUX ze staking rewards | $50–120 |
| GPU server (Hetzner EX-GPU) | Vyhodnocení ROI | $60–120 |
| wZION bridge relay nodes (Base, Arb) | Po deploy na testnet | strategické |

**Fáze 3 cíl: $200–400/měsíc.**

---

## 🐳 Docker Compose — Deploy Fáze 1

```yaml
# docker-compose.revenue.yml
# Deploy na oba servery (Helsinki + Germany)
# Upravit: WALLET adresy, cpuset dle serveru

version: '3.8'

services:

  # ═══════════════════════════════════════
  # DERO — AstroBWTv3 (CPU) — best profit
  # ═══════════════════════════════════════
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
      --wallet-address DERO_WALLET_ADDRESS
      "
    cpuset: "0-1"
    mem_limit: 2g
    deploy:
      resources:
        limits:
          cpus: '2.0'

  # ═══════════════════════════════════════
  # ZEPH — RandomX (CPU) — POUZE Helsinki
  # ═══════════════════════════════════════
  zeph-miner:
    image: alpine:latest
    container_name: zion-zeph-miner
    restart: unless-stopped
    profiles: ["helsinki"]
    entrypoint: /bin/sh
    command: >
      -c "
      apk add --no-cache curl &&
      curl -L -o /tmp/xmrig.tar.gz https://github.com/xmrig/xmrig/releases/latest/download/xmrig-linux-static-x64.tar.gz &&
      tar xzf /tmp/xmrig.tar.gz -C /tmp &&
      /tmp/xmrig*/xmrig
      -o gulf.moneroocean.stream:10001
      -u ZEPH_WALLET_ADDRESS
      -p zion_zeph
      -a rx/0
      -t 1
      --no-color
      "
    cpuset: "2"
    mem_limit: 3g

  # ═══════════════════════════════════════
  # EPIC — RandomX (CPU) — POUZE Germany
  # ═══════════════════════════════════════
  epic-miner:
    image: alpine:latest
    container_name: zion-epic-miner
    restart: unless-stopped
    profiles: ["germany"]
    entrypoint: /bin/sh
    command: >
      -c "
      apk add --no-cache curl &&
      curl -L -o /tmp/xmrig.tar.gz https://github.com/xmrig/xmrig/releases/latest/download/xmrig-linux-static-x64.tar.gz &&
      tar xzf /tmp/xmrig.tar.gz -C /tmp &&
      /tmp/xmrig*/xmrig
      -o fastepic.eu:3416
      -u EPIC_WALLET_ADDRESS
      -p zion_epic
      -a rx/0
      -t 1
      --no-color
      "
    cpuset: "3"
    mem_limit: 3g

  # ═══════════════════════════════════════
  # MYSTERIUM — VPN/bandwidth node ($0)
  # ═══════════════════════════════════════
  mysterium-node:
    image: mysteriumnetwork/myst:latest
    container_name: zion-mysterium
    restart: unless-stopped
    cap_add:
      - NET_ADMIN
    ports:
      - "4449:4449"
      - "41920-41925:41920-41925/udp"
    volumes:
      - /opt/mysterium/data:/var/lib/mysterium-node
    command: service --agreed-terms-and-conditions

  # ═══════════════════════════════════════
  # NKN — P2P relay node ($0)
  # ═══════════════════════════════════════
  nkn-node:
    image: nknorg/nkn:latest
    container_name: zion-nkn
    restart: unless-stopped
    ports:
      - "30001-30005:30001-30005"
    volumes:
      - /opt/nkn/data:/nkn/data
    command: nknd -p "" --no-nat

networks:
  default:
    name: zion-revenue-net
```

**Deploy:**
```bash
# Helsinki (DERO + ZEPH + nody)
COMPOSE_PROFILES=helsinki docker compose -f docker-compose.revenue.yml up -d

# Germany (DERO + EPIC + nody)
COMPOSE_PROFILES=germany docker compose -f docker-compose.revenue.yml up -d
```

### 🔧 Aktuální implementace (23. února 2026)

Produkční nasazení běží z `docker/docker-compose.revenue.yml` a obsahuje tyto změny oproti původnímu návrhu výše:

- **ARM64 kompatibilita:** kontejnery běží na `ubuntu:22.04`, DERO binárka se vybírá podle architektury (`arm64` / `amd64`).
- **DERO endpoint:** používá se `node.derofoundation.org:10100` (původní `minernode1.dero.io` byl z hostů nedostupný).
- **ZEPH endpoint:** používá se `zephyr.herominers.com:1123` (hostname `zeph.herominers.com` je neplatný).
- **XMRig build režim:** ZEPH/EPIC kontejnery kompilují `xmrig` uvnitř kontejneru, restart-safe (`rm -rf /tmp/xmrig`) a CPU-only build (`-DWITH_OPENCL=OFF -DWITH_CUDA=OFF`).
- **Compose warning fix:** `version: '3.8'` bylo odstraněno (Compose v2 ho ignoruje jako obsolete).

#### Stav po deploy (23. února 2026)

- `mysterium` běží na obou serverech stabilně.
- `dero-miner` běží, ale vrací chybu poolu: `unregistered miner or you need to wait 15 mins` (nutná registrace/propagace mineru na DERO straně).
- `zeph-miner` běží po opravě restart loopu; po prvním startu probíhá delší build `xmrig`.
- `epic-miner` běží, ale z Germany je aktuálně problém s konektivitou na `fastepic.eu:3416`.
- `nkn` zůstává zatím vypnutý v produkci, dokud nebude idempotentně dořešená inicializace wallet (`wallet.json`/password flow).

---

## 📊 Přehled příjmů

### Stávající (Fáze 0)

| Zdroj | $/měsíc |
|-------|---------|
| XMR (MoneroOcean) | ~$12 |
| ETC merged | ~$3 |
| **Celkem** | **~$15** |

### Po Fázi 1 (+2 týdny)

| Zdroj | $/měsíc |
|-------|---------|
| XMR (běží) | ~$12 |
| ETC merged (běží) | ~$3 |
| **DERO** (2 srv × 2 jádra) | ~$18 |
| **ZEPH** (1 srv × 1 jádro) | ~$7 |
| **EPIC** (1 srv × 1 jádro) | ~$10 |
| **Tari** merged s XMR | ~$4 |
| **Mysterium** (2 srv) | ~$15 |
| **NKN** (2 srv) | ~$4 |
| **Grass** (2 srv) | ~$10 |
| **Celkem** | **~$83** |
| Extra náklady | **$0** |

### Po Fázi 2 (+3 měsíce)

| Zdroj | $/měsíc |
|-------|---------|
| Fáze 1 celkem | ~$83 |
| **Flux Cumulus** (2 nody) | ~$40 |
| **VRSC** (1 jádro) | ~$4 |
| **Celkem** | **~$127** |
| Extra náklady | ~$142 jednorázově (Flux stake) |

---

## 📋 Checklist — Co udělat

### Týden 1
- [ ] Vytvořit DERO wallet (`dero-wallet-cli`)
- [ ] Vytvořit ZEPH wallet (`zephyr-wallet-cli`)
- [ ] Vytvořit EPIC wallet (`epic-wallet`)
- [ ] Deploy `docker-compose.revenue.yml` na Helsinki
- [ ] Deploy `docker-compose.revenue.yml` na Germany
- [ ] Mysterium: claim node na `http://IP:4449`
- [ ] Setup Grass na obou serverech

### Týden 2
- [ ] Tari merged mining — přidat do XMRig konfigurace
- [ ] Monitoring: ověřit že DERO/ZEPH/EPIC skutečně hashují
- [ ] Ověřit první Mysterium payouty
- [ ] Health check script (viz níže)

### Měsíc 2
- [ ] Vyhodnotit skutečné příjmy vs odhady
- [ ] Koupit 2× 1000 FLUX ze zisku → Cumulus nody
- [ ] Aktivovat VRSC kontejner

---

## 🔧 Health Check Script

```bash
#!/bin/bash
# revenue_check.sh — stav všech revenue nodů
echo "═══ ZION Revenue Health Check — $(date) ═══"
echo ""

for c in zion-dero-miner zion-zeph-miner zion-epic-miner \
         zion-mysterium zion-nkn; do
  STATUS=$(docker inspect --format='{{.State.Status}}' "$c" 2>/dev/null || echo "not found")
  UPTIME=$(docker inspect --format='{{.State.StartedAt}}' "$c" 2>/dev/null || echo "-")
  printf "%-20s %s  (since %s)\n" "$c" "$STATUS" "${UPTIME:0:19}"
done

echo ""
echo "CPU load: $(uptime | awk -F'load average:' '{print $2}')"
echo "RAM free: $(free -h | awk '/Mem:/{print $4}')"
echo "Disk:     $(df -h / | awk 'NR==2{print $4 " free"}')"
```

---

## ⚠️ Co NEDĚLÁME (a proč)

| Vynecháno | Důvod |
|-----------|-------|
| ~~Storj~~ | Nemáme dost volného disku, pomalý nárůst reputace |
| ~~Akash~~ | Vyžaduje K8s cluster — overkill |
| ~~Pocket Network~~ | Složitý setup, potřeba full nodes chainů |
| ~~The Graph~~ | 100K GRT stake ($2800) + archive node |
| ~~Livepeer~~ | Potřeba GPU |
| ~~GPU mining~~ | Zatím žádné GPU na serverech |
| ~~Micro-cap coiny~~ (RTM, XKR, CCX) | Příliš malý cap, risk > reward |
| ~~Theta Guardian~~ | 10K THETA stake ($2000) |

---

## 🔗 Integrace do CH v3

Nové coiny přidat do `config/ch3_revenue_settings.json` → `streams.dynamic_gpu.pools`:

```json
{
  "DERO": {
    "coin": "DERO",
    "stratum": "stratum+tcp://dero.herominers.com:1111",
    "wallet": "DERO_WALLET_ADDRESS",
    "worker": "zion_pool",
    "algorithm": "astrobwt/v3",
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
    "enabled": true,
    "threads": 1,
    "type": "cpu"
  }
}
```

---

## 📐 Architektura — jak to sedí dohromady

```
Helsinki Server (AMD, 64 GB RAM)
├── ZION node + pool          ← hlavní (N-2 jader)
├── XMR → MoneroOcean → BTC   ← 1 jádro (✅ běží)
├── ETC merged mining          ← 0 jader — byproduct CH
├── DERO (AstroBWTv3)          ← 2 jádra (NOVÉ)
├── ZEPH (RandomX)             ← 1 jádro (NOVÉ)
├── Tari merged s XMR          ← 0 jader — free
├── Mysterium VPN node         ← ~0 CPU, bandwidth
├── NKN relay node             ← ~0 CPU, bandwidth
└── Grass bandwidth            ← ~0 CPU, bandwidth

Germany Server (AMD, 64 GB RAM)
├── ZION node + pool          ← hlavní (N-2 jader)
├── XMR → MoneroOcean → BTC   ← 1 jádro (✅ běží)
├── ETC merged mining          ← 0 jader — byproduct CH
├── DERO (AstroBWTv3)          ← 2 jádra (NOVÉ)
├── EPIC (RandomX)             ← 1 jádro (NOVÉ)
├── Tari merged s XMR          ← 0 jader — free
├── Mysterium VPN node         ← ~0 CPU, bandwidth
├── NKN relay node             ← ~0 CPU, bandwidth
└── Grass bandwidth            ← ~0 CPU, bandwidth
```

---

## 🏆 TL;DR

1. **DERO + ZEPH + EPIC** = +$35/měsíc, Docker, zero cost
2. **Mysterium + NKN + Grass** = +$29/měsíc, bandwidth nody, zero cost
3. **Tari merged** = +$4/měsíc, zero compute
4. **Flux Cumulus** (Fáze 2) = +$40/měsíc, $142 z vlastního výdělku
5. **Celkem Fáze 1: ~$83/měsíc** → **Fáze 2: ~$127/měsíc** → nulové extra náklady

> *"Every idle CPU cycle is a missed opportunity."*

---

*Tento dokument nahrazuje: `MULTI_COIN_NODE_REVENUE.md` + `NODE_REVENUE_STRATEGY.md`*
