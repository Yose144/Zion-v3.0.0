# Quick Start — ZION v2.9.6

Rozjeď ZION node za méně než 10 minut.

---

## Požadavky

| Zdroj | Minimum | Doporučeno |
|-------|---------|------------|
| CPU | 2 jádra | 4 jádra |
| RAM | 2 GB | 4 GB |
| Disk | 10 GB SSD | 50 GB SSD |
| OS | Ubuntu 22.04+ / Debian 12+ | Ubuntu 24.04 |
| Síť | 10 Mbps | 100 Mbps |
| Porty | 8334 (P2P), 8444 (RPC) | + 3333 (Stratum), 8080 (Pool API) |

**Docker**: Docker Engine 24+ a Docker Compose v2+.

---

## Varianta A: Docker (doporučeno, ~5 min)

### 1. Klonuj repozitář

```bash
git clone https://github.com/Zion-TerraNova/2.9.6.git
cd 2.9.6
```

### 2. Nastav peněženku

```bash
export MINER_WALLET="zion1qTVOJE_ADRESA"
export SEED_PEERS="seed.zionterranova.com:8334"
```

### 3. Spusť stack

```bash
cd docker
docker compose -f docker-compose.testnet.yml --env-file ../.env up -d
```

Spustí 4 kontejnery:

| Kontejner | Port | Popis |
|-----------|------|-------|
| `zion-core` | 8334, 8444 | Blockchain node (P2P + RPC) |
| `zion-pool` | 3333, 8080 | Mining pool (Stratum + API) |
| `zion-miner` | — | CPU miner (automaticky těží) |
| `zion-redis` | — | Cache pro share tracking |

### 4. Ověř funkčnost

```bash
docker ps --filter 'name=zion-'

curl -s http://localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_info"}' \
  -H 'Content-Type: application/json'
```

### 5. Zastavení

```bash
docker compose -f docker-compose.testnet.yml --env-file ../.env down
```

Data zůstanou v Docker volumes. Pro smazání dat: `docker compose down -v`

---

## Varianta B: Build ze zdrojů (~15 min)

### 1. Nainstaluj Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustup default stable
```

### 2. Klonuj a builduj

```bash
git clone https://github.com/Zion-TerraNova/2.9.6.git
cd 2.9.6

sudo apt-get update && sudo apt-get install -y cmake g++ make pkg-config libssl-dev

cargo build --release
```

Binárky budou v `target/release/`:
- `zion-core` — Blockchain node
- `zion-pool` — Mining pool
- `zion-miner` — CPU/GPU miner

### 3. Spusť node

```bash
./target/release/zion-core \
  --data-dir ./data \
  --rpc-port 8444 \
  --p2p-port 8334 \
  --network testnet \
  --peers "seed.zionterranova.com:8334"
```

### 4. Spusť miner (druhý terminál)

```bash
# ZION mining (public canonical path)
./target/release/zion-miner \
  --pool localhost:3333 \
  --wallet "zion1qTVOJE_ADRESA" \
  --worker muj-miner \
  --threads 3 \
  --algo cosmic_harmony \
  --group zion
```

---

## Varianta C: Stáhni hotové binárky

Na stránce [Download](https://www.zionterranova.com/download) nebo přímo z [GitHub Releases](https://github.com/Zion-TerraNova/2.9.6/releases) si stáhni binárku pro svůj OS.

```bash
chmod +x zion-core zion-miner
./zion-core --data-dir ./data --network testnet \
  --peers "seed.zionterranova.com:8334,seed1.zionterranova.com:8334"
```

---

## Další kroky

- [Pokročilý setup →](#setup) — systemd, kernel tuning, monitoring
- [Mining průvodce →](#mining-guide) — kompletní mining guide
- [API Reference →](#api) — JSON-RPC endpointy
- [FAQ →](#faq) — časté otázky

---

*ZION TerraNova v2.9.6*
