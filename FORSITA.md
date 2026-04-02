# ZION TerraNova — Kompletní Průvodce Repositářem

> **Pro koho:** Pro každého — vývojáře, přítele, nováčka, i úplného laika.  
> **Účel:** Vysvětlit co je kde, jak to funguje, jak to spustit, a jak pokračovat.  
> **Poslední update:** 2. dubna 2026

---

## 📖 Co je ZION?

ZION TerraNova je **vlastní blockchain** — postavený od nuly v jazyku **Rust**. Není to fork Bitcoinu ani Etherea. Je to úplně nový chain s vlastním těžebním algoritmem (Cosmic Harmony), UTXO transakcemi, a 6-vrstvou architekturou (od základního chainu po vesmírnou stanici).

**Klíčové vlastnosti:**
- 144 miliard ZION celkem (nikdy víc)
- Odměna za blok: 5,400 ZION, klesá o 20% každých 10 let
- Těžba poběží 100+ let
- Stoprocentní spalování poplatků (deflationary)
- Fair Launch — žádný presale, žádný ICO

---

## 🗂️ Mapa Repositáře — Co je Kde

```
2.9.6/                          ← ROOT — hlavní repo
│
├── README.md                   ← Hlavní README projektu
├── ROADMAP.md                  ← Master roadmapa (přehled fází)
├── FORSITA.md                  ← TOTO — kompletní průvodce (čteš právě teď)
├── LICENSE                     ← MIT licence
├── Cargo.toml                  ← Rust workspace config (root)
├── Genesis                     ← Genesis ASCII art (symbolický soubor)
├── PREMINE_ADDRESSES_PUBLIC.txt← 15 genesis peněženek (VEŘEJNÉ adresy)
│
├── V3/                         ← 🚀 AKTIVNÍ KÓDOVÁ LINIE (mainnet)
│   ├── L1/                     ←   Jádro blockchainu
│   │   ├── core/               ←     Node (konsensus, P2P, RPC, storage)
│   │   ├── cosmic-harmony/     ←     PoW algoritmus (Ekam Deeksha v2)
│   │   ├── pool/               ←     Mining pool (Stratum, PPLNS)
│   │   ├── miner/              ←     Miner (CPU + GPU backend)
│   │   └── native-libs/        ←     C/Metal/CUDA nativní knihovny
│   ├── L2/                     ←   DeFi vrstva
│   │   ├── bridge/             ←     wZION bridge (ZION ↔ Base)
│   │   ├── dao/                ←     DAO governance
│   │   └── atomic-swap/        ←     HTLC atomic swapy
│   ├── L3/                     ←   AI & Cross-chain
│   │   ├── ncl/                ←     Neural Compute Layer
│   │   ├── warp/               ←     Universal bridge (7 chainů)
│   │   └── ai-native/          ←     AI Agent framework
│   ├── ROADMAP.md              ←   Detailní V3 roadmapa (source of truth)
│   └── README.md               ←   V3 status a popis
│
├── L1/ … L6/                   ← Legacy vrstvy (historický referenční kód)
│                                  L1=chain, L2=DeFi, L3=AI, L4=Oasis,
│                                  L5=Free World, L6=Issobella
│                                  ⚠️ Nový kód se píše do V3/, ne sem!
│
├── APP&WEB/                    ← Frontendové aplikace
│   ├── desktop-agent/          ←   Electron desktop app (mining GUI + wallet)
│   │   └── src/main.js         ←     Hlavní proces Electronu
│   ├── mobile-app/             ←   React Native + Expo mobilní app
│   │   └── src/screens/        ←     9 obrazovek (wallet, bridge, mining…)
│   ├── website-v2.9/           ←   Next.js 16 web (explorer, bridge, DeFi)
│   │   └── src/app/            ←     App Router stránky
│   └── public_html/            ←   Starý statický web (legacy)
│
├── docker/                     ← Docker soubory pro deployment
│   ├── docker-compose.v3-mainnet.yml  ← ⭐ HLAVNÍ compose pro mainnet
│   ├── Dockerfile.v3.core      ←   Build image pro node
│   ├── Dockerfile.v3.pool      ←   Build image pro pool
│   ├── Dockerfile.v3.miner     ←   Build image pro miner
│   └── …                       ←   Další compose soubory (monitoring, web…)
│
├── config/                     ← Konfigurační soubory
│   ├── mainnet.toml            ←   Konfigurace mainnetu
│   ├── testnet.toml            ←   Konfigurace testnetu
│   └── …                       ←   Bridge, DAO, devnet konfigurace
│
├── scripts/                    ← Skripty pro deployment a operace
│   ├── deploy-v3-mainnet.sh    ←   Deploy na servery
│   ├── bridge-test-tx.py       ←   Testovací bridge transakce
│   └── …                       ←   Monitoring, backup, deploy skripty
│
├── docs/                       ← Dokumentace (desítky souborů)
│   ├── DEFI_FULL_ROADMAP.md    ←   ⭐ DeFi ecosystem plán (6 waves)
│   ├── MAINNET_CONSTITUTION.md ←   Neměnné parametry protokolu
│   ├── v2.9.6/                 ←   Specifikace verze 2.9.6
│   ├── whitepaper/             ←   Technický whitepaper
│   ├── 2.9.7/                  ←   Pre-MainNet gate dokumentace
│   ├── 2.9.8/                  ←   Deeksha kanonická release docs
│   ├── 2.9.9/                  ←   Cleanup & migrace + archive/
│   └── …                       ←   Audity, reporty, plány
│
├── tests/                      ← Integrační testy
├── tools/                      ← Pomocné nástroje
├── monitoring/                 ← Prometheus/Grafana konfigurace
├── ops/                        ← Operační playbooks
├── legal/                      ← Právní disclaimer
└── opencl_sdk/                 ← OpenCL SDK pro GPU mining
```

---

## 💰 Premine — Genesis Peněženky

V genesis bloku je předem vytvořeno **16.28 miliard ZION** (11.31% z celkového supplym) ve **12 peněženkách**. Plus 3 operační peněženky přidané v V3.

Veřejné adresy jsou v souboru **`PREMINE_ADDRESSES_PUBLIC.txt`** v rootu.

### Přehled premine:

| # | Účel | Adresa (zkrácená) | Kolik |
|---|------|--------------------|-------|
| 1-5 | OASIS Golden Egg/Xp | `zion166e6v…` až `zion1n8h2a…` | 5× 1.65B = **8.25B** |
| 6 | DAO Treasury (hlavní) | `zion176u8r…` | **2.5B** |
| 7 | DAO Grants & Bounties | `zion12643n…` | **1.0B** |
| 8 | DAO Ecosystem Bootstrap | `zion1k8w73…` | **0.5B** |
| 9 | Core Development Fund | `zion1q540v…` | **1.0B** |
| 10 | Network Infrastructure | `zion1h4w39…` | **1.0B** |
| 11 | Genesis Creator | `zion1x638z…` | **0.59B** |
| 12 | Humanitarian (Children) | `zion1m4v5z…` | **1.44B** |
| 13 | Issobella Fund (5% tithe) | `zion170a37…` | ~plní se těžbou |
| 14 | Pool Fee (1% tithe) | `zion1y5u65…` | ~plní se těžbou |
| 15 | Pool Payout Wallet | `zion1k3h7p…` | ~tranzitní |

### ⚠️ Privátní klíče

- Premine klíče (1–12): v souboru `PREMINE_WALLETS_BACKUP.json` — **NENÍ v repo** (gitignored), existuje jen offline
- Tithe klíče (13–14): v souboru `TITHE_WALLETS_BACKUP.txt` — **NENÍ v repo** (gitignored)
- **POZOR:** Staré verze repozitáře mohou obsahovat klíče v git historii. Před jakýmkoli veřejným forkem je NUTNÉ spustit BFG Repo-Cleaner!

---

## ⚡ Jak to Spustit — Krok za Krokem

### Prerekvizity

```bash
# Na macOS:
brew install rust docker docker-compose

# Na Ubuntu/Debian:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
sudo apt install docker.io docker-compose-plugin

# Ověř:
rustc --version    # potřebuješ 1.75+
cargo --version
docker --version
```

### Varianta A: Spustit vše přes Docker (NEJJEDNODUŠŠÍ)

```bash
# 1. Klonuj repo
git clone https://github.com/Yose144/2.9.6.git
cd 2.9.6

# 2. Vytvoř .env soubor s peněženkovými adresami
#    (bez toho node neví kam posílat odměny za těžbu)
cat > .env << 'EOF'
MINER_WALLET=zion1TVOJE_ADRESA_SEM
HUMANITARIAN_WALLET=zion1m4v5z8z850u480c5c208z274e334369275n5y20
ISSOBELLA_WALLET=zion170a374s6h390k7w244m5c4f354v8n4678844655
POOL_FEE_WALLET=zion1y5u653y3w4z7p5r3l034y0q6u06542a426z77j7
POOL_PAYOUT_WALLET=zion1k3h7p6q4z7l0s495w6h775f566u0276237rh8x5
POOL_SIGNING_KEY=TVUJ_PRIVATNI_KLIC_HEX
EOF

# 3. Spusť mainnet stack
docker compose --env-file .env -f docker/docker-compose.v3-mainnet.yml up -d

# 4. Zkontroluj že běží
docker ps
# Měl bys vidět: zion-core, zion-pool, zion-miner, redis, ...

# 5. Zkontroluj chain
echo '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":{}}' | \
  nc -w 3 127.0.0.1 8443
```

### Varianta B: Buildit a spustit z source (pro vývojáře)

```bash
# 1. Klonuj a jdi do V3
git clone https://github.com/Yose144/2.9.6.git
cd 2.9.6

# 2. Zkontroluj Rust toolchain
cat V3/rust-toolchain.toml
# Pokud tam je specifická verze, nainstaluj:
# rustup install <verze>

# 3. Build celý V3 workspace
cd V3
cargo build --release
# Výstup: V3/target/release/zion-core, zion-miner, zion-pool

# 4. Spusť node
./target/release/zion-core \
  --config ../config/mainnet.toml \
  --data-dir ./data \
  --p2p-port 8334 \
  --rpc-port 8443

# 5. V jiném terminálu: spusť miner
./target/release/zion-miner \
  --pool 127.0.0.1:3333 \
  --wallet zion1TVOJE_ADRESA \
  --worker muj-pc \
  --threads 4 \
  --algo cosmic_harmony
```

### Varianta C: Generovat peněženku

```bash
# Z V3 workspace
cd V3
cargo run --release --bin wallet-generator

# Nebo z desktop agenta (JavaScript):
cd APP&WEB/desktop-agent
node src/wallet-generator.js
```

---

## 🌐 Aktuální Servery (Duben 2026)

| Server | IP | Lokace | Docker služby |
|--------|----|--------|---------------|
| **Praha** | 91.98.122.165 | Hetzner EU | Core, Pool, Miner, Bridge, Web, Monitoring |
| **USA** | 5.78.194.94 | Hetzner US | Core, Pool, Miner |
| **Singapur** | 5.223.84.191 | Hetzner SG | Core, Pool, Miner |

### Jak se připojit k serveru

```bash
# SSH (potřebuješ klíč):
ssh -i ~/.ssh/zion_hetzner_key root@91.98.122.165

# Na serveru:
cd /root/zion-2.9.6
docker ps                    # seznam running kontejnerů
docker logs zion-core        # logy node
docker logs zion-v3-bridge   # logy bridge

# Zkontrolovat chain výšku:
echo '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":{}}' | \
  nc -w 3 127.0.0.1 8443
```

### Porty

| Port | Služba | Popis |
|------|--------|-------|
| 8334 | P2P | Peer-to-peer mesh |
| 8443 | RPC | JSON-RPC 2.0 (raw TCP, ne HTTP!) |
| 3333 | Stratum | Pool mining protokol |
| 8080 | Pool API | Pool statistiky |
| 443 | HTTPS | Website |

**⚠️ DŮLEŽITÉ:** RPC na portu 8443 je **raw TCP** — nefunguje přes `curl`! Musíš použít `nc` nebo raw socket:

```bash
# SPRÁVNĚ:
echo '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":{"address":"zion1..."}}' | nc -w 3 127.0.0.1 8443

# ŠPATNĚ (nefunguje):
curl http://localhost:8443/...
```

---

## 🔗 Bridge — ZION ↔ wZION (Base)

Bridge umožňuje převést ZION tokeny z hlavního chainu na Base blockchain jako wZION (wrapped ZION) — ERC-20 token.

### Smart Kontrakty na Base Mainnet

| Kontrakt | Adresa | Odkaz |
|----------|--------|-------|
| **wZION** (ERC-20) | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` | [BaseScan](https://basescan.org/address/0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6) |
| **ZIONBridge** | `0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721` | [BaseScan](https://basescan.org/address/0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721) |
| **ZIONAtomicSwap** | (verified na BaseScan) | |

### Jak funguje bridge (zjednodušeně)

```
ZION chain                          Base chain
─────────                          ──────────
1. Pošleš 100 ZION na vault        
   s memo: BRIDGE:base:0xTVOJE_EVM_ADRESA
                    │
                    ▼
2. Bridge watcher detekuje lock TX
                    │
3. Čeká 60 bloků (finalita)
                    │
                    ▼
4. Relayer pošle submitLockProof()
   na ZIONBridge kontrakt
                    │
                    ▼
                                    5. ZIONBridge mintne 100 wZION
                                       na tvoji EVM adresu
                                    6. wZION se objeví v MetaMask!
```

### Bridge vault adresa (kam posíláš ZION pro bridge)

```
zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0
```

---

## 🖥️ Desktop Agent (Electron App)

**Cesta:** `APP&WEB/desktop-agent/`

Jednoduché GUI pro těžbu a správu peněženky.

```bash
cd APP&WEB/desktop-agent
npm install
npm start           # spustí Electron app
```

### Struktura:
- `src/main.js` — Electron hlavní proces
- `src/preload.js` — Bridge mezi main a renderer
- `src/ui/` — GUI (HTML + JS)
- `src/wallet-generator.js` — Generování peněženek

---

## 📱 Mobile App (React Native)

**Cesta:** `APP&WEB/mobile-app/`

```bash
cd APP&WEB/mobile-app
npm install
npx expo start      # spustí Expo dev server
# Naskenuj QR kód v Expo Go app na telefonu
```

### 9 Obrazovek:
Dashboard, Wallet, Send, Receive, Mining, Bridge, Network, Settings, TransactionHistory

---

## 🌐 Website (Next.js)

**Cesta:** `APP&WEB/website-v2.9/`

```bash
cd APP&WEB/website-v2.9
npm install
npm run dev         # http://localhost:3000
```

### Hlavní stránky:
- `/` — Landing page (3D Spline animace)
- `/explorer` — Block explorer (bloky, TX, adresy, richlist)
- `/bridge` — Bridge UI
- `/defi` — DeFi dashboard
- `/mining` — Mining info
- `/dao` — DAO governance
- `/download` — Stažení desktop agenta
- `/roadmap` — Veřejná roadmapa

---

## 🧪 Testy

```bash
# Spustit VŠECHNY V3 testy (1300+):
cd V3
cargo test

# Jen bridge testy (157):
cargo test --manifest-path L2/bridge/Cargo.toml

# Jen DAO testy (65):
cargo test --manifest-path L2/dao/Cargo.toml

# Jen core testy:
cargo test --manifest-path L1/core/Cargo.toml

# Jen cosmic-harmony testy (95):
cargo test --manifest-path L1/cosmic-harmony/Cargo.toml
```

---

## 🐳 Docker Služby (Compose)

Hlavní compose: `docker/docker-compose.v3-mainnet.yml`

| Služba | Popis |
|--------|-------|
| `core` | ZION node (konsensus, P2P, RPC) |
| `seed1` | Seed node (pomáhá peer discovery) |
| `pool` | Mining pool (Stratum, PPLNS payout) |
| `miner` | CPU miner |
| `redis` | Cache pro pool |
| `bridge` | wZION bridge relay daemon |
| `swap` | Atomic swap service |
| `dao` | DAO governance daemon |
| `website` | Next.js web (port 443) |
| `prometheus` | Metriků sběrač |
| `grafana` | Dashboard monitoring |
| `alertmanager` | Alerty |
| `node-exporter` | System metriky |
| `redis-exporter` | Redis metriky |
| `stability-collector` | Stabilita collector |

### Základní Docker příkazy

```bash
# Spustit vše:
docker compose --env-file .env -f docker/docker-compose.v3-mainnet.yml up -d

# Zastavit vše:
docker compose -f docker/docker-compose.v3-mainnet.yml down

# Rebuild jedné služby (např. po změně kódu):
docker compose -f docker/docker-compose.v3-mainnet.yml build core
docker compose -f docker/docker-compose.v3-mainnet.yml up -d core

# Logy:
docker logs -f zion-core          # live logy node
docker logs zion-v3-bridge --tail 50  # posledních 50 řádků bridge
```

---

## 📡 RPC API — Dostupné Metody

| Metoda | Popis |
|--------|-------|
| `getChainInfo` | Výška chainu, difficulty, mempool |
| `getBalance` | Zůstatek adresy (UTXO + account) |
| `getBlock` | Blok podle hashe |
| `getBlockByHeight` | Blok podle výšky |
| `getTransaction` | Transakce podle hashe |
| `getUtxos` | Nespotřebované výstupy adresy |
| `getSupplyInfo` | Aktuální zásoby (mined, supply) |
| `sendRawTransaction` | Odeslat surovou transakci |
| `submitTransaction` | Odeslat account TX |
| `getBlockTemplate` | Template pro mining |
| `submitBlock` | Odeslat vyřešený blok |
| `getMempoolInfo` | Stav mempoolu |
| `getPeerInfo` | Připojení peers |
| `getNodeInfo` | Info o node |
| `getBridgeLocks` | Bridge lock transakce |
| `getBridgeVaultBalance` | Zůstatek bridge vaultu |
| `submitBridgeUnlock` | Poslat bridge unlock |

---

## 📂 Co je V3 vs Legacy (L1-L6)

| | V3/ | L1/-L6/ (root) |
|---|-----|----------------|
| **Účel** | Aktivní mainnet kód | Historický referenční kód |
| **Stav** | Běží na 3 serverech | Nepoužívá se pro produkci |
| **Psát nový kód?** | ✅ ANO, sem | ❌ NE, jen reference |
| **Testy** | 1300+ passing | Může být outdated |

**Pravidlo:** Veškerý nový mainnet kód jde do `V3/`. Legacy `L1/`-`L6/` v rootu slouží jako referenční materiál a zdrojový audit kód pro migraci.

---

## 🔧 Jak Pokračovat ve Vývoji

### 1. Bridge Hardening (priorita teď)
```bash
# Kód bridge je v:
V3/L2/bridge/src/
  ├── lib.rs          # hlavní modul
  ├── relayer.rs      # L1→EVM relay logika  
  ├── l1_watcher.rs   # sleduje L1 chain pro lock TX
  ├── evm_watcher.rs  # sleduje Base pro burn TX
  ├── db.rs           # SQLite persistence
  └── validator.rs    # validator set (3/5 quorum)
```

### 2. Přidat novou RPC metodu
```bash
# RPC handler je v:
V3/L1/core/src/rpc.rs

# Přidej metodu do match bloku v handle_request()
# Pak: cargo test --manifest-path V3/L1/core/Cargo.toml
```

### 3. Upravit website
```bash
cd APP&WEB/website-v2.9
# Stránky jsou v src/app/<nazev>/page.tsx
# Např. explorer: src/app/explorer/page.tsx
npm run dev  # hot reload na http://localhost:3000
```

### 4. Upravit desktop agent
```bash
cd APP&WEB/desktop-agent
# Hlavní logic: src/main.js
# UI: src/ui/renderer.js + src/ui/index.html
npm start    # spustí Electron
```

### 5. Deploy na server
```bash
# Nejdřív commitni a pushni:
git add -A && git commit -m "popis zmeny" && git push origin main

# Pak na serveru:
ssh -i ~/.ssh/zion_hetzner_key root@91.98.122.165
cd /root/zion-2.9.6
git pull origin main

# Rebuild konkrétní služby:
docker compose --env-file .env -f docker/docker-compose.v3-mainnet.yml build core
docker compose --env-file .env -f docker/docker-compose.v3-mainnet.yml up -d core
```

---

## 📊 Emise a Tokenomika (Zjednodušeně)

```
Celkem:                 144,000,000,000 ZION
Genesis premine:         16,280,000,000 ZION  (11.31%)
K vytěžení:             127,720,000,000 ZION  (88.69%)

Blok každých:           60 sekund
Odměna za blok:         5,400.067 ZION (prvních 10 let)
Potom:                  -20% každých 10 let
Po 100 letech:          ~724 ZION/blok navždy (tail emise)

Za každý blok:
  ⛏️  Miner dostane:       89%  (4,806 ZION)
  🕊️  Humanitarian:         5%  (270 ZION)
  🔭  Issobella Fund:       5%  (270 ZION)
  🏊  Pool Fee:              1%  (54 ZION)
```

---

## ⚠️ Bezpečnostní Poznámky

1. **Privátní klíče NIKDY nenahrávej na GitHub** — jsou v `.gitignore`
2. **Git historie může obsahovat staré klíče** — před veřejným forkem použij BFG Repo-Cleaner
3. **RPC port (8443) nevystavuj veřejně** — je to raw TCP bez autentikace
4. **Bridge validator key** musí mít práva `chmod 600, chown 999:999`
5. **V3 kód je audit-ready** ale formální třetí-strana audit zatím neproběhl

---

## 📚 Klíčové Dokumenty

| Soubor | Co v něm najdeš |
|--------|-----------------|
| `README.md` | Přehled projektu, parametry, status |
| `ROADMAP.md` | Master roadmapa — fáze vývoje |
| `FORSITA.md` | Toto — kompletní průvodce |
| `V3/ROADMAP.md` | Detailní V3 implementační stav |
| `docs/DEFI_FULL_ROADMAP.md` | DeFi plán (6 waves, ~12-18 týdnů) |
| `docs/MAINNET_CONSTITUTION.md` | Neměnné parametry (supply, emission, block time) |
| `docs/whitepaper/` | Technický whitepaper |
| `PREMINE_ADDRESSES_PUBLIC.txt` | 15 genesis peněženek (veřejné adresy) |

---

## 🆘 Časté Problémy

### "cargo build" selže
```bash
# Ujisti se že jsi ve V3/:
cd V3
cargo build --release
# Pokud chyba na OpenCL/Metal: to je OK, GPU backend je optional
```

### Node se nespojí s peery
```bash
# Zkontroluj seed peers v configu:
cat config/mainnet.toml | grep seed
# Ručně přidej:
# seed_peers = ["91.98.122.165:8334", "5.78.194.94:8334"]
```

### Docker "no space left"
```bash
docker system prune -a    # smaže staré images (opatrně!)
```

### RPC vrací prázdnou odpověď
```bash
# Nepoužívej curl! Použij nc:
echo '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":{}}' | nc -w 3 127.0.0.1 8443
```

### Bridge nefunguje
```bash
# Zkontroluj logy:
docker logs zion-v3-bridge 2>&1 | tail -50
# Ověř validator key permissions:
ls -la /etc/zion/bridge-validator.key
# Má být: -rw------- 999:999
```

---

## 🤝 Jak Přispět

1. Forkni repo na GitHubu
2. Vytvoř branch: `git checkout -b moje-zmena`
3. Piš kód do `V3/` (ne do legacy `L1/`-`L6/`)
4. Spusť testy: `cd V3 && cargo test`
5. Commitni a pushni
6. Otevři Pull Request

---

*"On the Star — building for 100 years, not for a hype cycle."* ⭐
