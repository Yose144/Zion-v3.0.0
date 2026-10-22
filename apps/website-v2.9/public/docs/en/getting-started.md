# Quick Start — ZION v2.9.6

Bring up a ZION node in under 10 minutes.

---

## Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disk | 10 GB SSD | 50 GB SSD |
| OS | Ubuntu 22.04+ / Debian 12+ | Ubuntu 24.04 |
| Network | 10 Mbps | 100 Mbps |
| Ports | 8334 (P2P), 8444 (RPC) | + 3333 (Stratum), 8080 (Pool API) |

**Docker:** Docker Engine 24+ and Docker Compose v2+.

---

## Option A: Docker (recommended, ~5 min)

### 1. Clone the repository

```bash
git clone https://github.com/Zion-TerraNova/2.9.6.git
cd 2.9.6
```

### 2. Set your wallet

```bash
export MINER_WALLET="zion1qYOUR_ADDRESS"
export SEED_PEERS="seed.zionterranova.com:8334"
```

### 3. Start the stack

```bash
cd docker
docker compose -f docker-compose.testnet.yml --env-file ../.env up -d
```

This starts 4 containers:

| Container | Port | Description |
|-----------|------|-------------|
| `zion-core` | 8334, 8444 | Blockchain node (P2P + RPC) |
| `zion-pool` | 3333, 8080 | Mining pool (Stratum + API) |
| `zion-miner` | — | CPU miner (starts mining automatically) |
| `zion-redis` | — | Cache for share tracking |

### 4. Verify the stack

```bash
docker ps --filter 'name=zion-'

curl -s http://localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_info"}' \
  -H 'Content-Type: application/json'
```

### 5. Stop it

```bash
docker compose -f docker-compose.testnet.yml --env-file ../.env down
```

Data remains in Docker volumes. To wipe it, run `docker compose down -v`.

---

## Option B: Build from source (~15 min)

### 1. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustup default stable
```

### 2. Clone and build

```bash
git clone https://github.com/Zion-TerraNova/2.9.6.git
cd 2.9.6

sudo apt-get update && sudo apt-get install -y cmake g++ make pkg-config libssl-dev

cargo build --release
```

The binaries will be in `target/release/`:
- `zion-core` — blockchain node
- `zion-pool` — mining pool
- `zion-miner` — CPU/GPU miner

### 3. Start the node

```bash
./target/release/zion-core \
  --data-dir ./data \
  --rpc-port 8444 \
  --p2p-port 8334 \
  --network testnet \
  --peers "seed.zionterranova.com:8334"
```

### 4. Start the miner (second terminal)

```bash
./target/release/zion-miner \
  --pool localhost:3333 \
  --wallet "zion1qYOUR_ADDRESS" \
  --worker my-miner \
  --threads 3 \
  --algo cosmic_harmony \
  --group zion
```

---

## Option C: Download prebuilt binaries

You can get binaries for your OS from [Download](https://www.zionterranova.com/download) or directly from [GitHub Releases](https://github.com/Zion-TerraNova/2.9.6/releases).

```bash
chmod +x zion-core zion-miner
./zion-core --data-dir ./data --network testnet \
  --peers "seed.zionterranova.com:8334,seed1.zionterranova.com:8334"
```

---

## Next steps

- [Advanced Setup →](#setup) — systemd, kernel tuning, monitoring
- [Mining Guide →](#mining-guide) — complete mining guide
- [API Reference →](#api) — JSON-RPC endpoints
- [FAQ →](#faq) — common questions

---

*ZION TerraNova v2.9.6*