# Mining Guide — ZION

Complete guide to mining the ZION blockchain along the current public canonical path.

---

## Overview

- **Algorithm:** Cosmic Harmony Deeksha (`cosmic_harmony`)
- **Block reward:** 5,400.067 ZION -> Decade Decay (-20% / 10 years), 725 ZION tail
- **Block time:** 60 seconds
- **DAA:** LWMA with a 60-block window, max change +-25%
- **Mining horizon:** 100+ years + perpetual tail emission
- **Fees:** burned (deflationary mechanism)
- **Legacy revenue support:** still supported by runtime, but the public deployment is now pure ZION

### Block reward distribution

| Recipient | Share |
|-----------|-------|
| ⛏️ Miners | 89% |
| 🕊️ Humanitarian Tithe | 5% |
| 🔭 L5/L6 Issobella Fund | 5% |
| 🏊 Pool Fee | 1% |

---

## Hardware profiles

| Profile | CPU | RAM | Hashrate* |
|---------|-----|-----|-----------|
| Raspberry Pi 4 | 4× ARM A72 | 4 GB | ~50 H/s |
| Basic VPS | 2× vCPU | 4 GB | ~200 H/s |
| Desktop | Ryzen 5 5600X | 16 GB | ~3,000 H/s |
| Server | EPYC 7742 (64c) | 128 GB | ~25,000 H/s |

*Approximate values for Cosmic Harmony v3*

---

## Option 1: ZION Native Miner

```bash
git clone https://github.com/Zion-TerraNova/2.9.6.git
cd 2.9.6

cargo build --release

./target/release/zion-miner \
  --pool localhost:3333 \
  --wallet "zion1qYOUR_ADDRESS" \
  --worker my-rig \
  --threads 3 \
  --algo cosmic_harmony \
  --group zion
```

---

## Option 2: Docker miner

```bash
git clone https://github.com/Zion-TerraNova/2.9.6.git
cd 2.9.6/docker

docker compose -f docker-compose.testnet.yml --env-file ../.env up -d zion-miner
docker logs -f zion-miner
```

---

## Option 3: Direct connection to the public pool

```bash
./target/release/zion-miner \
  --pool 91.98.122.165:3333 \
  --wallet "zion1qYOUR_ADDRESS" \
  --worker my-rig \
  --algo cosmic_harmony
```

---

## Pool mining

### Public pool server

| Pool | Stratum | Web |
|------|---------|-----|
| Zion2 (public host) | `91.98.122.165:3333` | `http://91.98.122.165:8080` |

### Configuration

```bash
./zion-miner \
  --pool 91.98.122.165:3333 \
  --wallet "zion1qYOUR_ADDRESS" \
  --worker my-rig
```

---

## Solo mining

Run your own node and pool:

```bash
./zion-core --data-dir ./data --network testnet \
  --peers "91.98.122.165:8334"

./zion-pool --node localhost:8444 --stratum-port 3333

./zion-miner --pool localhost:3333 \
  --wallet "zion1qYOUR_ADDRESS"
```

---

## Mining monitoring

```bash
# Hashrate and shares
curl -s http://localhost:8080/api/stats | python3 -m json.tool

# Blockchain status
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_info"}' \
  -H 'Content-Type: application/json'
```

---

## Optimisation

1. **Huge pages** — can improve hashrate by 10-20%:
   ```bash
   sudo sysctl -w vm.nr_hugepages=1280
   ```

2. **CPU affinity** — pin the miner to specific cores:
   ```bash
   taskset -c 0-5 ./zion-miner --pool ...
   ```

3. **Disable hyperthreading** — physical cores usually deliver better performance.

---

## More information

- [Pool Setup →](#pool-setup) — run your own mining pool
- [Advanced Setup →](#setup) — public rehearsal configuration
- [API Reference →](#api) — RPC endpoints
- [GitHub](https://github.com/Zion-TerraNova/2.9.6) — source code

---

*ZION TerraNova v2.9.8 Deeksha*