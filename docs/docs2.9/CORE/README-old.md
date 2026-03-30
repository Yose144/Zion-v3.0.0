# 🌐 ZION Blockchain v2.5 TestNet - Multi-Chain Dharma Ecosystem

![ZION Blockchain](https://img.shields.io/badge/ZION-v2.5%20TestNet-purple) ![Multi-Chain](https://img.shields.io/badge/Multi--Chain-Dharma%20Ecosystem-gold) ![TestNet](https://img.shields.io/badge/Status-Active%20Development-green)

**🌈 Decentralized Multi-Chain Technology for Global Community 🌈**

ZION v2.5 TestNet is an advanced blockchain platform focused on **multi-chain interoperability**, **community governance**, and **sustainable economic models**. Built on proven RandomX consensus with modern infrastructure designed for cross-chain communication and real-world utility.

**🎯 Mission: Decentralized Technology for Human Flourishing 🌱**
> *Building bridges between communities, technologies, and possibilities.*

## 🔗 MULTI-CHAIN DHARMA ARCHITECTURE

ZION v2.5 is built on a **multi-chain philosophy** that emphasizes:

### 🌐 Core Principles
- **🔗 Interoperability** - Cross-chain communication and asset transfers
- **🏛️ Decentralized Governance** - Community-driven development and decisions
- **💚 Sustainable Economics** - Fair distribution and environmental responsibility
- **🌍 Global Accessibility** - Multi-language support (CZ/EN/ES/FR/PT)
- **�️ Security First** - Battle-tested cryptographic foundations

### 🏗️ Technical Foundation
```
┌─────────────────────────────────────────────┐
│           ZION Multi-Chain Stack            │
├─────────────────────────────────────────────┤
│ � Cross-Chain Bridges & Atomic Swaps      │
│ ⚡ Lightning Network Integration            │
│ �️ Decentralized Governance (DAO)          │
│ 💎 RandomX Proof-of-Work Consensus         │
│ � Multi-Language Community Support        │
│ �️ Advanced Cryptographic Security         │
└─────────────────────────────────────────────┘
```

## 🌱 ZION DEVELOPMENT PHILOSOPHY

ZION vznikl z potřeby vytvořit **skutečně decentralizované řešení** pro moderní digitální ekonomiku:

### 🎯 Core Mission
Vybudovat **multi-chain ecosystem**, který:
- **Spojuje komunity** napříč různými blockchain sítěmi
- **Democratizuje finance** prostřednictvím fair mining a DeFi
- **Podporuje inovace** v cross-chain technologiích  
- **Zachovává soukromí** s pokročilou kryptografií
- **Minimalizuje environmentální dopad** efektivním konsensem

### 🌐 Vision 2025+
- **Cross-Chain Hub** - Central point pro asset bridging
- **DeFi Ecosystem** - Decentralizované finance pro všechny
- **Community Governance** - Skutečná decentralizace rozhodování
- **Developer Tools** - Snadná integrace pro vývojáře
- **Global Adoption** - Přístupná technologie pro každého

## 📊 Aktuální stav (2025-09-22)

### 🔄 **Git Status (Latest)**:
- **Main repo**: `342cfec` - MULTICHAIN DHARMA ECOSYSTEM transformation ⭐
- **Submodule**: `7233b0d` - Z3 address prefix + UPnP build fixes
- **Branch**: `master` (clean, pushed to origin)
- [DEPRECATED] Submodule: Tento projekt již nepoužívá submodule pro `zion-cryptonote` – core je vendored v repozitáři.

### ✅ **Funguje**:
- **RandomX blockchain**: Genesis `63c7c425...`, blok čas 120s, odměna 333 ZION
- **Mining pool**: Stratum na `91.98.122.165:3333` (když je backend stabilní)
- **Windows miner**: XMRig 6.21.3 s tunelem, 10+ vláken, automatické restart
- **RPC infrastruktura**: Monero-kompatibilní shim s retry/backoff

### ⚠️ **Problémy**:
- **Seed nody**: Občasné restarty kvůli config/launch issues
- **Stratum**: Intermitentní "connection refused" při nestabilním backendu
- **DNS**: rpc-shim nemůže dosáhnout seed aliasů v Docker síti

### 🎯 **Cíl**: Vytěžit 60+ bloků pro bootstrap sítě → Launch to the Stars! 🌟

### 🚀 **Recent Achievements (Git Log)**:
- ⭐ **Dharma transformation**: README upgraded to cosmic philosophy
- 🔧 **Z3 address prefix**: New addresses start with `Z3...` (backward compatible)
- 🛡️ **Build hardening**: Optional UPnP, better error handling  
- 🎨 **Frontend polish**: Tailwind matrix style, wallet admin UI
- 🔗 **Adapter improvements**: Better RPC error mapping (501/503)

## � DHARMA TECHNOLOGY PHILOSOPHY

ZION implementuje **dharma-driven development** - technologie v souladu s etickými principy:

- **🌱 Sustainable Mining**: RandomX algoritmus optimalizovaný pro energetickou efektivitu
- **🤝 Community First**: Decisions driven by community consensus, not corporate interests  
- **🔒 Privacy by Design**: Advanced cryptography protecting user sovereignty
- **🌐 Global Inclusion**: Multi-language support and accessible interfaces
- **⚖️ Fair Distribution**: Mining accessible to everyone, preventing centralization
- **🔄 Open Source**: Transparent development with community contributions

*"Technology should serve humanity, not the other way around."*

## 🏗️ Technical Architecture - Multi-Chain Protocol Stack

```
┌─ ZION Blockchain ─┐    ┌─ Pool Infrastructure ─┐    ┌─ Mining Clients ─┐
│ • seed1/seed2     │    │ • uzi-pool (3333)     │    │ • XMRig (rx/0)   │
│ • P2P: 18080      │ ←→ │ • rpc-shim (18089)    │ ←→ │ • SSH tunnel      │
│ • RPC: 18081      │    │ • Redis cache         │    │ • Windows/Mac     │
│ • RandomX PoW     │    │ • Wallet services     │    │ • 10+ threads     │
│ • ⭐ Star-Ready   │    │ • 🌌 Multi-chain prep │    │ • 🚀 To the Stars │
└───────────────────┘    └───────────────────────┘    └───────────────────┘
```

### Klíčové komponenty (Dharma-Enhanced):
- **`zion-cryptonote/`**: Core blockchain (RandomX, CryptoNote-derived)
- **`adapters/zion-rpc-shim/`**: Monero API compatibility layer
- **`adapters/uzi-pool-config/`**: node-cryptonote-pool configuration
- **`docker/compose.pool-seeds.yml`**: Production orchestration
- **`mining/`**: Windows mining scripts and XMRig configs
- **`frontend/`**: Next.js status dashboard

## 🚀 Rychlý start - Launch Sequence

### 🌟 **Phase 1: Server Ignition** (Linux)
```bash
# Vytvoř Docker síť
docker network create zion-seeds || true

# Spusť stack
cd Zion/
docker compose -f docker/compose.pool-seeds.yml up -d

# Ověř běh
curl http://localhost:18089/metrics.json  # RPC shim health
docker ps | grep zion-                    # Kontejnery
> Z3 adresy: Nové peněženky začínají `Z3...`. Viz `logs/runtime/20250923T/README.md` a `.env.example` pro nastavení `POOL_ADDRESS`, `DEV_ADDRESS`, `CORE_DEV_ADDRESS` bez ukládání tajemství do gitu. Pro bezpečné zálohy použij `scripts/secure-backup.*`.
```

### ⭐ **Phase 2: Windows Mining to the Stars**
```powershell
# PowerShell helper (auto-detect wallet, builds xmrig config)
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-mining.ps1 -DryRun
# Remove -DryRun to actually start mining
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-mining.ps1

# Přímé připojení (když Stratum funguje)
cmd.exe /c "D:\Zion\mining\start-mining-windows.bat"

# SSH tunel (záloha)
cmd.exe /c "D:\Zion\mining\start-mining-windows-tunnel.bat"

# Kontrola stavu
Get-Process -Name ssh,xmrig
Get-NetTCPConnection -LocalPort 3333
```

### 🌌 **Phase 3: Universal Mining** (macOS/Linux)
```bash
# XMRig příklad
./xmrig \
  --url stratum+tcp://91.98.122.165:3333 \
  --algo rx/0 \
  --user ajmqontZjiVUmtNjQu1RNUYq1RZgd5EDodX3qgjcaTMoMzG8EkG4bVPgLhEgudBoH82fQU1iZVw6XPfddKWAHDdA3x92ToH4uo \
  --pass MINER-ID \
  --rig-id MINER-ID \
  --threads 4 \
  --donate-level 1
```

## 🔧 Management skripty

### Windows PowerShell:
- **`scripts/ssh-key-setup.ps1`**: Automatické SSH klíče pro tunel
- **`scripts/ssh-probe-pool.ps1`**: Vzdálená diagnostika serveru
- **`mining/xmrig-selftest.bat`**: Rychlý test mineru (2 vlákna)

### Monitoring:
```powershell
# Miner log
Get-Content 'D:\Zion\mining\platforms\windows\xmrig-6.21.3\xmrig-3333-*.log' -Tail 50

# Server health (přes SSH)
powershell -File "D:\Zion\scripts\ssh-probe-pool.ps1" -ServerIp 91.98.122.165
```
# ZION NETWORK V3

Síť ZION postavená na Proof‑of‑Work (RandomX) s referenčním stackem pro těžbu přes Stratum pool, RPC most (shim) a Next.js Genesis Hub pro on‑boarding minerů.

Aktuální stav: port 3333 je otevřen (Uzi pool běží), ale daemon může občas vracet “Core is busy” (-9) při getblocktemplate. Zavedli jsme delší backoff, serializaci GBT a nižší polling; pool jede přes RPC shim.

## Architektura V3

- ziond (seed1, seed2) — P2P 18080, RPC 18081
- RPC Shim (adapters/zion-rpc-shim) — Monero‑like JSON‑RPC na 18089, retry/backoff, mutex pro GBT, health `/`
- Uzi Pool (node‑cryptonote‑pool) — Stratum port 3333, Redis pro stav
- Genesis Hub (frontend/Next.js) — wallet + miner konfigurátor, health
- Docker Compose orchestrace (docker/compose.pool-seeds.yml)

Klíčové porty: 18080 (P2P), 18081 (RPC), 18089 (shim), 3333 (Stratum)

## Rychlý start (Docker)

```bash
# 1) Vytvoř síť pro stack (pokud ještě neexistuje)
docker network create zion-seeds || true

# 2) Spusť seed nody a Redis
docker compose -f docker/compose.pool-seeds.yml up -d seed1 seed2 redis

# 3) Postav a spusť RPC shim
docker compose -f docker/compose.pool-seeds.yml build --no-cache rpc-shim
docker compose -f docker/compose.pool-seeds.yml up -d rpc-shim

# 4) Postav Uzi pool image a spusť pool
docker build -t zion:uzi-pool -f docker/uzi-pool/Dockerfile .
docker compose -f docker/compose.pool-seeds.yml up -d uzi-pool

# 5) Ověř běh
curl -s http://localhost:18089/   # {"status":"ok"}
docker ps | grep zion-
```

Poznámky:
- Pool je připojen na rpc‑shim:18089, který tlumí špičky a sjednocuje RPC metody.
- Pool při startu čeká na zdraví shim, aby se daemon nezahltil GBT dotazy.

## Automatický resync z Gitu (Windows PowerShell)

Přidali jsme skript `scripts/resync-from-git.ps1` pro bezpečnou synchronizaci lokálního pracovního adresáře s `origin/main`.

- Jednorázový resync (fast-forward):

```powershell
pwsh -NoProfile -File .\scripts\resync-from-git.ps1 -Branch main
```

- Vynucený resync při divergenci (hard reset na `origin/main`):

```powershell
pwsh -NoProfile -File .\scripts\resync-from-git.ps1 -Branch main -HardReset
```

- Po resyncu restartovat služby přes Docker Compose:

```powershell
pwsh -NoProfile -File .\scripts\resync-from-git.ps1 -RestartServices
```

- Watch mód (periodicky kontroluje repozitář a aplikuje změny):

```powershell
pwsh -NoProfile -File .\scripts\resync-from-git.ps1 -Watch -IntervalSeconds 60
```

Pozn.: Skript očekává, že běžíte z kořene repozitáře.

- Oficiální GENESIS wallet je uložena v repozitáři v `config/OFFICIAL_GENESIS_WALLET.conf`.
- Při nasazení seed uzlů se tento soubor mountuje read‑only do kontejnerů na cestu:
	- `/home/zion/.zion/OFFICIAL_GENESIS_WALLET.conf`

## Handover a denní logy

- Handover pro Sonnet: `logs/HANDOVER_SONNET_2025-09-20.md`
- Dnešní status RandomX poolu: `logs/DEPLOYMENT_2025-09-20_POOL_RANDOMX_STATUS.md`

## Připojení mineru (XMRig)

- URL: stratum+tcp://<server>:3333
- User: ZION adresa (Z…)
- Pass: x
- Algo: rx/0

Příklad příkazu:
```bash
xmrig \
	--url stratum+tcp://<server>:3333 \
	--algo rx/0 \
	--user Zxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
	--pass x \
	--keepalive \
	--rig-id HUB \
	--donate-level 0
```

Genesis Hub (frontend) umí vygenerovat xmrig.json i spouštěcí skript.

## Genesis Hub (Frontend)

```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```
Funkce:
- Validace adresy a QR kód (PNG export)
- Generátor XMRig příkazu i JSON configu
- Health přehled (shim + konfig parametrů)

## Logy a diagnostika

- Runtime: logs/runtime/<timestamp>/
- Souhrn: logs/DEPLOYMENT_UPDATE_20250920_MOON_SUN_STAR_SUMMARY.md
- Shim a pool logy: docker logs a runtime snapshoty
- Sběr: scripts/collect_runtime_logs.sh

## Troubleshooting “Core is busy” (-9)

- Shim serializuje getblocktemplate (mutex) a exponenciálně čeká
- Pool má zvýšený blockRefreshInterval (~20 s)
- Po restartu dej uzlu 60–120 s warm‑up
- Zdraví shim: `curl -s http://<server>:18089/`

### Nestabilní seed2 / dočasný seed1-only režim

Pokud `zion-seed2` restartuje (např. "Failed to initialize blockchain storage") a shim/pool pády blokují těžbu:

- Použij dočasný override, aby `rpc-shim` mluvil jen na `zion-seed1`:
	- Soubor: `docker/compose.rpc-shim-seed1.yml` (nastavuje `ZION_RPC_URLS=http://zion-seed1:18081/json_rpc`).
	- Spusť těžbu skriptem s přepínačem:
		- `pwsh -File .\scripts\start-mining.ps1 -ShimSeed1Only -TargetBlocks 60`
- Po opravě `seed2` vrať `ZION_RPC_URLS` na multi-URL: `http://zion-seed1:18081/json_rpc,http://zion-seed2:18081/json_rpc`.

## Build (volitelné mimo Docker)

```bash
sudo apt update && sudo apt install -y build-essential cmake libboost-all-dev libssl-dev
# macOS: brew install cmake openssl boost

git clone https://github.com/Yose144/Zion.git
# [DEPRECATED] Submodule inicializace již není potřeba (core je vendored)
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)   # macOS: -j$(sysctl -n hw.ncpu)
```

## Nasazení na server (SSH)

```bash
# Doporučeno: ssh-key-setup.sh pro bezheslové přihlášení
./scripts/ssh-redeploy-pool.sh <server-ip> [user]
```

## Úklid

```bash
bash scripts/cleanup_workspace.sh
bash scripts/cleanup_docker.sh
# volitelný git hook: bash scripts/install_git_hooks.sh
```

## Parametry sítě (Dharma Specifications)

- **Network ID**: zion-mainnet-v1 🌟
- **Philosophy**: Multi-chain Dharma Ecosystem
- **P2P**: 18080 | **RPC**: 18081 | **Stratum**: 3333
- **Block time**: 120 s | **Algo**: RandomX (rx/0) ⚡
- **Max supply**: 144,000,000,000 ZION (144B tokens to the stars)
- **Mission**: To the Stars, not just the Moon! 🚀⭐

## 🌟 Dharma License

MIT — viz `LICENSE`  
*"Code with compassion, mine with mindfulness, build for the stars."*

**🔄 Git Repository**: [github.com/Yose144/Zion](https://github.com/Yose144/Zion)  
**📝 Latest Commit**: `342cfec` - Multichain Dharma Ecosystem transformation  
**🌿 Submodule**: `zion-cryptonote@7233b0d` (feature/address-prefix-z3)

— Last updated: 2025‑09‑23 (V3 - Multichain Dharma Edition) ⭐
## Sestavení

## OPS Quickstart (Prometheus + Alertmanager + Monitor)

Rychlé spuštění observability + monitoringu na serveru:

1) Spusť stack a proxy/Prometheus/Alertmanager:

```bash
scripts/ryzen-up.sh
```

2) Ověř metriky a UI:

```bash
curl -s http://localhost:8080/shim/metrics | head
curl -s http://localhost:8080/adapter/metrics | head
# UI
# Prometheus:   http://<server>:9090
# Alertmanager: http://<server>:9093
# Grafana:      http://<server>:3000 (admin / ${GRAFANA_ADMIN_PASSWORD:-admin})
```

3) Nainstaluj systemd monitor a periodický status (jako root):

```bash
sudo ./scripts/install-ops-automation.sh \
	--repo /opt/Zion \
	--base http://localhost:8080 \
	--interval 30 --stall-min 5 \
	--webhook https://your.webhook/endpoint

systemctl status zion-monitor-shim zion-status.timer
tail -n 50 /var/log/zion/status.log
```

4) Záloha peněženky:

```bash
./scripts/backup-wallet.sh zion-walletd
ls -lh backups/
```

Poznámky:
- Rate-limit a API klíč pro `/wallet/send` nastavíš přes `SEND_RATE_*` a `ADAPTER_API_KEY` na `zion-wallet-adapter`.
- Prometheus alert rules jsou v `docker/prometheus/alerts.yml`; Alertmanager výstup je defaultně „do nikam“ – nastav si vlastního příjemce.
