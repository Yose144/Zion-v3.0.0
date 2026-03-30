# ZION – Komplexní architektura projektu (Přehled)

Datum: 2025-09-21  
Autor: GitHub Copilot

## Stručný přehled
ZION je decentralizovaná kryptoměna postavená na **RandomX Proof-of-Work** algoritmu s moderní infrastrukturou pro mining přes Stratum pool. Projekt kombinuje:
- **C++ blockchain core** (zion-cryptonote fork)
- **Node.js RPC proxy** (Monero-kompatibilní API)
- **Mining pool** (node-cryptonote-pool)
- **Next.js frontend** (miner onboarding)
- **Docker orchestraci** (produkční nasazení)
- **Windows mining tooling** (XMRig + SSH tunely)

## 📁 Struktura hlavních komponent

```
D:\Zion/
├─ zion-cryptonote/        # Core blockchain (C++, RandomX)
├─ src/                    # Lokální C++ sources (daemon, core, crypto)
├─ include/                # C++ headers (zion.h, blockchain.h)
├─ adapters/               # Middleware služby
│  ├─ zion-rpc-shim/       # Monero-like JSON-RPC proxy (Node.js)
│  ├─ uzi-pool-config/     # Pool konfigurace (JSON, patches)
│  └─ wallet-adapter/      # Wallet API bridge
├─ docker/                 # Container orchestrace
│  ├─ compose.pool-seeds.yml  # Produkční stack
│  ├─ Dockerfile.zion-cryptonote.minimal  # Core build
│  └─ uzi-pool/            # Pool container setup
├─ frontend/               # Next.js miner hub (TypeScript)
├─ mining/                 # Windows XMRig tooling
├─ scripts/                # Deployment & management skripty
├─ config/                 # Genesis, network parametry
├─ logs/                   # Deployment historie
└─ docs/                   # Technická dokumentace
```

## 🏗️ Architektura služeb

### 1. Blockchain Core (C++/RandomX)
- **Umístění**: `src/`, `include/`, `zion-cryptonote/`
- **Technologie**: C++17, RandomX (tevador), Boost, OpenSSL
- **Klíčové soubory**:
  - `src/daemon/main.cpp` – hlavní daemon proces
  - `include/zion.h` – síťové konstanty (max supply, block time, porty)
  - `include/blockchain.h` – blockchain logika, UTXO, mempool
- **Síťové parametry**:
  - Max Supply: 144,000,000,000 ZION (6 decimálů)
  - Block Time: 120 sekund
  - Initial Reward: 333 ZION
  - Halvening: každých 210k bloků
  - P2P Port: 18080, RPC Port: 18081

### 2. RPC Proxy Middleware (Node.js)
- **Umístění**: `adapters/zion-rpc-shim/`
- **Účel**: Překládá Monero-like JSON-RPC volání na zion-cryptonote RPC
- **Klíčové funkce**:
  - `getblocktemplate` s retry/backoff na "Core is busy" (-9)
  - `submitblock` s více JSON-RPC variantami + REST fallbacky
  - Cache na 12s pro block templates
  - Mutex serializace GBT požadavků
  - Health endpoints: `/getheight`, `/getblocktemplate`, `/submit`
  - Metriky: `/metrics.json`, `/metrics` (Prometheus)
- **Dependencies**: Express 4.19, Axios 1.7, dotenv
- **Environment**: `ZION_RPC_URLS`, `SHIM_PORT=18089`, `GBT_CACHE_MS`

### 3. Mining Pool (node-cryptonote-pool)
- **Umístění**: `docker/uzi-pool/`, `adapters/uzi-pool-config/`
- **Technologie**: Node.js 8, zone117x/node-cryptonote-pool fork
- **Konfigurace**: `adapters/uzi-pool-config/config.json`
- **Stratum Port**: 3333
- **Funkcionalita**:
  - RandomX algoritmus (rx/0)
  - Variable difficulty (min 2, max 100k)
  - Share trust system
  - Payment intervals (20s)
  - Redis pro persistenci
- **Integrace**: Komunikuje s rpc-shim:18089

### 4. Frontend Hub (Next.js)
- **Umístění**: `frontend/`
- **Technologie**: Next.js 14.2.5, React 18.3, TypeScript 5.4
- **Funkce**:
  - ZION address validace + QR kódy
  - XMRig konfigurátor (JSON export)
  - Mining command generator
  - Pool health monitoring
  - Responsive design
- **Dependencies**: qrcode.react, @types/* pro TypeScript

### 5. Docker Orchestrace
- **Hlavní compose**: `docker/compose.pool-seeds.yml`
- **Služby**:
  - `seed1`, `seed2`: ziond daemon (CLI parametry, bez config mount)
  - `rpc-shim`: proxy na portu 18089
  - `uzi-pool`: Stratum na portu 3333
  - `redis`: cache pro pool
  - `walletd`: wallet daemon (8070)
  - `wallet-adapter`: wallet API bridge (18099)
- **Networks**: `zion-seeds` (external bridge)
- **Volumes**: persistent data pro seeds, pool, wallet

### 6. Windows Mining Tooling
- **Umístění**: `mining/`
- **XMRig verze**: 6.21.3 (rx/0 optimized)
- **Skripty**:
  - `start-mining-windows.bat`: přímé připojení na pool
  - `start-mining-windows-tunnel.bat`: přes SSH tunel
  - `xmrig-selftest.bat`: rychlý 2-vláknový test
- **Konfigurace**: `platforms/windows/xmrig-6.21.3/config-zion.json`
- **Wallet**: `ajmqontZji...` (test mining address)

### 7. Management & DevOps
- **PowerShell skripty** (`scripts/*.ps1`):
  - `ssh-key-setup.ps1`: automatické SSH klíče
  - `ssh-redeploy-pool.ps1`: vzdálený deploy na server
  - `ssh-probe-pool.ps1`: health diagnostika
- **Bash skripty** (`scripts/*.sh`):
  - `cleanup_docker.sh`: odstranění kontejnerů/volumes
  - `collect_runtime_logs.sh`: sběr logů z běžícího stacku
  - `monitor-pool.sh`: kontinuální monitoring
- **Deploy targety**: Ryzen server (91.98.122.165)

## 🔄 Data Flow & Workflow

```
Miner (XMRig) ──→ Stratum:3333 ──→ uzi-pool ──→ rpc-shim:18089 ──→ ziond:18081
                                     ↓                              ↓
                                   Redis                         Blockchain
                                   (shares)                      (blocks)
```

### Mining workflow:
1. **XMRig** se připojí na Stratum port 3333
2. **uzi-pool** generuje job z `getblocktemplate` (přes rpc-shim)
3. **rpc-shim** cache-uje templates, retry na "Core is busy"
4. Miner odesílá share, pool validuje difficulty
5. Při block candidate: pool volá `submitblock` (přes rpc-shim)
6. **rpc-shim** zkouší 12 pokusů s backoff + REST fallbacky
7. Úspěšný blok: invalidace cache, broadcast přes P2P

## 🎯 Současný stav & Problémy

### ✅ Funguje:
- Stratum port 3333 je otevřený a přijímá připojení
- XMRig těží, shares jsou přijímány (difficulty 100-100k)
- rpc-shim běží s health OK na 18089 (interně)
- seed1/seed2 jsou healthy (Docker health checks)
- Block template generation (height=1, difficulty=1)

### ⚠️ Známé limity:
- `submitblock` často vrací "-9 Core is busy"
- Blockchain height zatím 1 (genesis)
- rpc-shim port 18089 není externě dostupný (pouze 3333)
- Seed nody hlásí "Failed to connect to seed peers" (izolovaná síť)

### 🔧 Nedávné zlepšení:
- rpc-shim rozšířen o 12 pokusů submitblock + REST fallbacky
- `reserve_size` minimum 16 bajtů pro extra nonce space
- GET helpers: `/submit?blob=...`, `/getheight`, `/getblocktemplate`
- Výrazně zlepšené logování a metriky
- CLI parametry pro seeds (místo config mount)

## 🚀 Next Steps & Optimalizace

### Prioritní:
1. **Vyřešit "Core is busy" submit blocker** – možné řešení:
   - Zvýšit delay před prvním submitem po GBT
   - Experimentovat s nižším polling rate
   - Sledovat daemon logy v čase submitu
   
2. **Bootstrapping sítě** – cíl 60+ bloků:
   - Jakmile submitblock projde, spustit continuous mining
   - Monitoring výšky přes shim `/getheight`
   
3. **Stabilizace produkce**:
   - Vystavit 18089 externě pro monitoring
   - Seed node DNS/discovery zlepšení
   - Automatic restart policies

### Dlouhodobé:
- P2P network expansion (více seed nodů)
- Payment system optimization
- Web dashboard s real-time metrics
- Mobile mining support

## 📋 Deployment Checklist

### Server setup:
```bash
# 1. Síť
docker network create zion-seeds

# 2. Build & deploy
./scripts/ssh-redeploy-pool.ps1 -ServerIp 91.98.122.165

# 3. Health check
curl -s http://localhost:18089/metrics.json
```

### Windows mining:
```powershell
# Příprava
.\scripts\ssh-key-setup.ps1 -ServerIp 91.98.122.165

# Mining start
.\mining\start-mining-windows.bat

# Health
Get-Process xmrig; Get-NetTCPConnection -LocalPort 3333
```

---

**Poznámka**: Projekt je ve fázi beta testingu s funkčním mining flow, ale s bekologovými blockers na submitblock. Infrastruktura je připravená na škálování a produkční nasazení po vyřešení core daemon optimalizací.