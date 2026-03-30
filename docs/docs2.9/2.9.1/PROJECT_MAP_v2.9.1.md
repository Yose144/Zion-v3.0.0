# ZION TerraNova v2.9.1 / v2.9.5 — Project Map

> Cíl: rychlá orientace v repu (co je kde, co je „root/entrypoint", jak to spustit/nasadit, jaké jsou porty a kritická rizika).
> **Poslední aktualizace:** 17. ledna 2026

---

## 📊 Aktuální stav (17.1.2026)

| Metrika | Hodnota |
|---------|---------|
| **TestNet Block Height** | 514+ bloků |
| **Pool Hashrate** | 12,883 H/s |
| **Blockchain Nodes** | 3 (multi-node P2P) |
| **Docker Containers** | 7/7 healthy |
| **Test Coverage** | 540+ Python + 108 Rust testů |
| **Rust LOC (v2.9.5)** | ~15,350 |

---

## 🆕 v2.9.5 Rust Native Stack (NOVÝ!)

Paralelní high-performance rewrite v Rustu:

```
2.9.5/
├── Cargo.toml                    # Workspace root
├── zion-native/
│   ├── core/                     # Blockchain core (~6,550 LOC)
│   │   └── src/
│   │       ├── algorithms/       # cosmic_harmony, blake3, randomx, yescrypt
│   │       ├── blockchain/       # block, consensus, validation, reorg
│   │       ├── p2p/              # TCP handshake, gossip, seeds, security
│   │       ├── storage/          # LMDB persistence
│   │       ├── mempool/          # TX pool + eviction
│   │       └── jsonrpc/          # RPC server
│   ├── pool/                     # Mining pool (~6,861 LOC)
│   │   └── src/
│   │       ├── stratum/          # Stratum v2 server (Tokio)
│   │       ├── shares/           # Share validation (vlastní hash!)
│   │       ├── pplns/            # PPLNS calculator
│   │       ├── payout/           # Payout manager + scheduler
│   │       └── consciousness/    # Level rewards
│   └── docker-compose.native-test.yml
└── zion-universal-miner/         # Native miner (~1,834 LOC)
    └── src/
        ├── miner/                # CPU/GPU mining loops
        └── stratum/              # Stratum client
```

### Rust stack porty
- **8080** — Core JSON-RPC
- **3333** — Pool Stratum
- **8181** — Pool HTTP stats API
- **6380** — Redis (test)

### Spuštění Rust stacku lokálně
```bash
cd 2.9.5/zion-native
docker-compose -f docker-compose.native-test.yml up -d
```

### Status v2.9.5 (17.1.2026)
- ✅ **Core**: Produkčně připravený (TX validace, UTXO rollback, P2P security)
- ✅ **Pool**: Produkčně připravený (vlastní share hash výpočet, PostgreSQL scheduler)
- ⚠️ **Miner**: Není E2E funkční (Stratum session handling TODO)

---

## 1) High-level architektura (runtime)

### Python Stack (v2.9.1 - produkční)

Typický produkční/testnet stack (Docker):

- **Blockchain node** (PoW chain + RPC)
- **Mining pool** (Stratum + stats API)
- **API gateway** (FastAPI, agent control plane + read-only agregace)
- **Redis** (cache / share tracking)
- **Prometheus + Grafana** (monitoring)
- **Web (Next.js export)** (statické `out/` přes Nginx)

### Datové toky

1. Miner → **Pool (Stratum 3333)** → share validation/VarDiff → ukládání do DB/Redis
2. Pool → **Blockchain RPC (Monero-style 18081)** → template + submit block
3. Web/Explorer → **API (/api/… přes Nginx)** → dotazy na chain/pool
4. Monitoring → **Prometheus** → **Grafana**

## 2) Kanonické „roots“ / entrypointy

### Docker stack (kanonický)

- [docker/compose/docker-compose-v2.9-production.yml](docker/compose/docker-compose-v2.9-production.yml)
  - definuje služby: blockchain, pool, api, redis, prometheus, grafana (a další dle verze)
  - mapování portů a env varů

### Deployment skripty

- [scripts/deploy-complete-stack.sh](scripts/deploy-complete-stack.sh)
  - „all-in-one“ deploy (rsync/scp + build + up + healthchecks)
- [deploy_production_clean.sh](deploy_production_clean.sh)
  - čistší/ops deploy cesta (dle root dokumentace a reportů)

### Blockchain (Python)

- [src/core/new_zion_blockchain.py](src/core/new_zion_blockchain.py)
  - obsahuje `main()` a je hlavní blockchain engine

### Pool (Python)

- [src/pool/zion_pool_v2_9.py](src/pool/zion_pool_v2_9.py)
  - obsahuje `main()` a je hlavní orchestrátor poolu

### Pool payouts pipeline

- Trigger: když `ProtocolHandler` vyhodnotí share jako blok, volá `payout_manager.on_block_accepted(...)` ([src/pool/network/protocol_handler.py#L360-L486](src/pool/network/protocol_handler.py#L360-L486)), což přímo navazuje na `PoolPayoutManager`.
- Distribution: `PoolPayoutManager._distribute_block_reward()` ([src/pool/payout/payout_manager.py#L92-L196](src/pool/payout/payout_manager.py#L92-L196)) dotáhne blok přes RPC, použije `RewardCalculator` pro rozklad (miner/pool/tithe) a kredituje pending zůstatky podle PPLNS okna `get_recent_valid_shares()`.
- Outgoing payments: background `_loop()` ([src/pool/payout/payout_manager.py#L198-L317](src/pool/payout/payout_manager.py#L198-L317)) střídá `_confirm_sent_payouts()` a `_process_payouts()` – kandidáti se tahají z DB, validují se adresy a transakce se posílají přes `rpc.send_transaction` s lock/unlock v tabulce `payouts_v2`.
- Dokumentace a runbook: [docs/2.9/POOL_PAYOUTS_SYSTEM_v2.9_CZ.md](docs/2.9/POOL_PAYOUTS_SYSTEM_v2.9_CZ.md) popisuje DB model, testovací config (lokální chain na portu 18082) a incident runbook (reconcile, invalid address, VarDiff).

### API (FastAPI)

- [src/api/](src/api/) (aktuálně 4 soubory v této workspace snapshot)
  - [api/__init__.py](api/__init__.py) (hlavní FastAPI app; obsahuje `app = FastAPI(...)` a `uvicorn.run(...)` pro lokální běh)
  - [src/api/optimization.py](src/api/optimization.py) (optimalizace a factory `create_optimized_app()`; obsahuje default `version="2.8.7"`)
  - [src/api/dashboard_endpoints.py](src/api/dashboard_endpoints.py)
  - [src/api/websocket_api.py](src/api/websocket_api.py)
  - [src/api/router_v2_8_8.py](src/api/router_v2_8_8.py) (legacy prefix)

**API runtime entrypoint (Docker):**
- [docker/api-v2.9/Dockerfile](docker/api-v2.9/Dockerfile)
  - spouští: `uvicorn api.__init__:app --host 0.0.0.0 --port 8001 --proxy-headers`
  - healthcheck: `GET /health` na portu 8001

Pozn.: v repu existují i další FastAPI servery (např. [src/main.py](src/main.py) na portu 8000), ale produkční compose v2.9 typicky používá Docker image s entrypointem výše.

### Website (Next.js export)

- [website-v2.9/next.config.ts](website-v2.9/next.config.ts)
  - v dokumentaci je klíčové: `output: "export"` (statický hosting)

### Desktop agent (Electron)

- [desktop-agent/package.json](desktop-agent/package.json)
  - `npm start` spouští Electron aplikaci

## 3) Porty a služby (podle compose + reportů)

Z [docker/compose/docker-compose-v2.9-production.yml](docker/compose/docker-compose-v2.9-production.yml):

- **3333/tcp** — pool Stratum (public)
- **8080/tcp** — pool stats API (v compose aktuálně public)
- **8001/tcp** — API (bind na `127.0.0.1`, přístup přes Nginx `/api/`)
- **8545/tcp** — ETH-style JSON-RPC (bind na `127.0.0.1`)
- **18081/tcp** — Monero-style RPC (public v compose; používá pool/explorer)
- **6379/tcp** — Redis (typicky localhost/internal)
- **9090/tcp** — Prometheus
- **3000/tcp** — Grafana

## 4) Konfigurace (kde a co)

### Produkční JSON configy (dle dokumentace)

- `config/blockchain_production.json`
- `config/pool_production.json`
- `monitoring/prometheus.yml`

Poznámky:
- V [docs/2.9/DEPLOYMENT_CHECKLIST.md](docs/2.9/DEPLOYMENT_CHECKLIST.md) jsou tyto soubory označené jako „Created/Exists“.
- V [docs/2.9/STACK_SUMMARY_v2.9.md](docs/2.9/STACK_SUMMARY_v2.9.md) je dříve uvedeno, že configy „chybí“ — pravděpodobně časový nesoulad mezi dokumenty.

## 5) Dokumentační „autority“ (co brát jako pravdu)

### Nasazení / provoz

- [docs/2.9/QUICK_DEPLOY_GUIDE.md](docs/2.9/QUICK_DEPLOY_GUIDE.md)
- [docs/2.9/DEPLOYMENT_PLAN_v2.9_COMPLETE.md](docs/2.9/DEPLOYMENT_PLAN_v2.9_COMPLETE.md)
- [docs/2.9/DEPLOYMENT_CHECKLIST.md](docs/2.9/DEPLOYMENT_CHECKLIST.md)
- [docs/2.9/INFRASTRUCTURE_COMPLETION_SUMMARY_CZ.md](docs/2.9/INFRASTRUCTURE_COMPLETION_SUMMARY_CZ.md)

### P0/P1 problémy + fixy

- [docs/2.9/BLOCK_SUBMISSION_FIX_DEPLOYED.md](docs/2.9/BLOCK_SUBMISSION_FIX_DEPLOYED.md)
- [docs/2.9/P0_FIX_VERIFICATION_REPORT_22_DEC_2025.md](docs/2.9/P0_FIX_VERIFICATION_REPORT_22_DEC_2025.md)
- [docs/2.9/TESTNET_DEBUG_REPORT_22_DEC_2025.md](docs/2.9/TESTNET_DEBUG_REPORT_22_DEC_2025.md)

## 6) Ekonomické parametry (aktuální root)

- Block reward (MainNet/TestNet): 50 ZION base + 392.857 ZION bonus × level multiplier (CL1-CL9 → 1.0×–10.0×).
- Min/max per block (bez halvingu): 442.86 ZION (CL1) až 3,978.57 ZION (CL9).
- Dokumentované v [docs/WP2.9/03_TECHNICAL_ARCHITECTURE.md](docs/WP2.9/03_TECHNICAL_ARCHITECTURE.md), [docs/WP2.9/05_CONSCIOUSNESS_MINING.md](docs/WP2.9/05_CONSCIOUSNESS_MINING.md), [docs/WP2.9/06_ECONOMIC_MODEL.md](docs/WP2.9/06_ECONOMIC_MODEL.md).

### Explorer + statický hosting

- [docs/2.9/EXPLORER_STATIC_FIX_20_12_2025.md](docs/2.9/EXPLORER_STATIC_FIX_20_12_2025.md)

### Pool payouts

- [docs/2.9/POOL_PAYOUTS_SYSTEM_v2.9_CZ.md](docs/2.9/POOL_PAYOUTS_SYSTEM_v2.9_CZ.md)

## 6) Známé rozpory / místa ke srovnání

1. **API verze v dokumentaci vs runtime**
   - [docs/2.9/API_DOCUMENTATION.md](docs/2.9/API_DOCUMENTATION.md) ukazuje `/health` response s verzí `2.8.4`.
   - jinde se komunikuje 2.9.0/2.9.1.
  - v kódu je vidět více „version“ zdrojů: [api/__init__.py](api/__init__.py) (docstring 2.9.0) a [src/api/optimization.py](src/api/optimization.py) (factory default 2.8.7).

2. **Port 8080 “localhost-only” vs compose**
   - [docs/2.9/TESTNET_DEBUG_REPORT_22_DEC_2025.md](docs/2.9/TESTNET_DEBUG_REPORT_22_DEC_2025.md) popisuje mapování `127.0.0.1:8080:8080` jako problém.
   - aktuální [docker/compose/docker-compose-v2.9-production.yml](docker/compose/docker-compose-v2.9-production.yml) mapuje `8080:8080`.

3. **Ekonomika / reward model**
   - Kód (pool) je kanonický zdroj pro „co se skutečně vyplácí“:
     - [src/pool/blockchain/reward_calculator.py](src/pool/blockchain/reward_calculator.py)
       - `TESTNET_MODE = True` ⇒ blok reward je **50 ZION**, bez consciousness bonusu/tithe; pool fee bere z configu (typicky 1%).
       - pro MainNet je v kódu zachovaná logika: base **5400.067** + bonus **1569.63 × multiplier** (whitelist + 2025–2035 window), ale je defaultně vypnutá.
   - Dokumenty k ekonomice:
     - [docs/2.9/ECONOMIC_CALCULATIONS_CORRECT.md](docs/2.9/ECONOMIC_CALCULATIONS_CORRECT.md) (řeší rozpor 5,479.45 vs 5,400.067; obsahuje více variant)
     - [docs/2.9/POOL_PAYOUTS_SYSTEM_v2.9_CZ.md](docs/2.9/POOL_PAYOUTS_SYSTEM_v2.9_CZ.md) (popisuje payout state machine a integraci s reward calc)
   - Consciousness multipliers a hra:
     - [src/core/consciousness_mining_game.py](src/core/consciousness_mining_game.py)

4. **TestNet/MainNet přepínače v infra**
   - V [docker/compose/docker-compose-v2.9-production.yml](docker/compose/docker-compose-v2.9-production.yml) je současně `NETWORK=mainnet` a `ZION_TESTNET_EASY_MODE=1`.
   - V poolu je navíc hardcoded `TESTNET_MODE = True` v [src/pool/blockchain/reward_calculator.py](src/pool/blockchain/reward_calculator.py), takže ekonomika je „testnet simple“ i když infra env říká mainnet.
   - Doporučení: udělat jednotné pravidlo (env/config) a reflektovat ho ve reward calculatoru i v dokumentaci.

## 7) „Jak to spustit“ (rychlé orientační kroky)

### Lokální Docker stack

- použij [docker/compose/docker-compose-v2.9-production.yml](docker/compose/docker-compose-v2.9-production.yml)
- obecně:
  - `docker compose -f docker/compose/docker-compose-v2.9-production.yml up -d`
  - `docker compose -f docker/compose/docker-compose-v2.9-production.yml logs -f`

### Website build (statický export)

- dle [docs/2.9/DEPLOYMENT_CHECKLIST.md](docs/2.9/DEPLOYMENT_CHECKLIST.md):
  - `cd website-v2.9`
  - `npm install`
  - `npm run build` → vytvoří `website-v2.9/out/`

### Desktop agent

- v [desktop-agent/package.json](desktop-agent/package.json):
  - `npm install`
  - `npm start`

## 8) Krátké „co je kde“ (repo orientace)

- `src/core/` — blockchain engine + RPC + chain subsystémy
- `src/pool/` — pool (stratum, vardiff, validation, payouts, db)
- `src/api/` — FastAPI gateway + dashboard/websocket endpointy
- `website-v2.9/` — Next.js web/dashboard/explorer (static export)
- `desktop-agent/` — Electron desktop miner agent
- `docs/2.9/` — v2.9 sprint/testnet/deploy dokumenty (nejvyšší signál)
- `ai/` — AI orchestrátor a self-learning tooling
- `2.9.5/` — **Rust native stack** (paralelní vývoj pro výkon)

---

## 9) v2.9.1 Stability Update (Leden 2026)

Klíčové opravy stability Python stacku:

| Komponenta | Fix | Popis |
|------------|-----|-------|
| **Template Manager** | `asyncio.Lock` | Fix "thundering herd" na RPC volání |
| **Job Manager** | `MAX_JOBS=50000` + LRU | Fix memory leaks |
| **Database** | WAL Mode + indexy | Performance tuning |
| **Logging** | Standardizované | Nahrazeny `print()` za `logger.debug()` |
| **Desktop Agent** | Security | BIP39 implementation, Wallet Import |

---

## 10) P2P Compact Block Relay (BIP 152) ✅

Dokončeno 4.1.2026:

- Block propagation < 5 sekund
- Multi-node sync (3 nody běží)
- Chain reorganization < 30 sekund
- Fork resolution funguje

---

## 11) GPU Mining Support

### Podporované algoritmy

| Algoritmus | CPU | GPU | Poznámka |
|------------|-----|-----|----------|
| Cosmic Harmony | ✅ 500 kH/s | ✅ 10-50 MH/s | ZION native |
| RandomX | ✅ optimální | ❌ pomalejší | CPU-only |
| Yescrypt | ✅ | ⚠️ 3-5x | Moderate boost |
| Blake3 | ✅ | ✅ 50-100x | Excellent |

### AMD RX 5600 XT očekávaný výkon

| Algoritmus | Hashrate | Power |
|------------|----------|-------|
| Cosmic Harmony | ~25-40 MH/s | 150W |
| Blake3 | ~2-3 GH/s | 120W |

### GPU Mining příkazy
```bash
# Seznam GPU
./zion-miner --gpu --list-devices

# Těžba s GPU
./zion-miner \
  --pool stratum+tcp://91.98.122.165:3333 \
  --wallet ZION_YOUR_ADDRESS \
  --algorithm cosmic_harmony \
  --gpu \
  --gpu-devices 0

# AMD OpenCL setup (Windows)
# Nainstaluj Adrenalin drivers (OpenCL included)
```

---

## 12) Doporučený další krok

1. Sjednotit „network mode" (testnet/mainnet) mezi compose env a reward kalkulací (aktuálně jsou tam paralelní přepínače).
2. Rozhodnout autoritativní ekonomický dokument a zarovnat ho s konstantami v [src/pool/blockchain/reward_calculator.py](src/pool/blockchain/reward_calculator.py).
3. Dopsat sekci „Authoritative vs legacy" pro API routery (v2.8.8 vs v2.9) a udělat jasný entrypoint modul pro API (jeden jediný zdroj pravdy).
4. Dokončit Rust miner E2E integraci (Stratum session handling).
