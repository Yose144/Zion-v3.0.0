# Mining průvodce — ZION v2.9.6

Kompletní průvodce těžbou ZION blockchainu s dual-miningem.

---

## Přehled

- **Algoritmus**: Cosmic Harmony v3 (CHv3, CPU-friendly)
- **Block reward**: 5 400,067 ZION → Decade Decay (-20%/10 let), tail 725 ZION
- **Block time**: 60 sekund
- **DAA**: LWMA s oknem 60 bloků, max změna ±25 %
- **Mining horizont**: 100+ let + perpetual tail emission
- **Poplatky**: Spalovány (deflační mechanismus)
- **Dual-mining**: ZION + VRSC (VerusCoin) paralelně

### Block Reward distribuce

| Příjemce | Podíl |
|----------|-------|
| ⛏️ Miners | 89% |
| 🕊️ Humanitarian Tithe | 5% |
| 🔭 L5/L6 Issobella Fund | 5% |
| 🏊 Pool Fee | 1% |

---

## Hardware profily

| Profil | CPU | RAM | Hashrate* |
|--------|-----|-----|-----------|
| Raspberry Pi 4 | 4× ARM A72 | 4 GB | ~50 H/s |
| VPS basic | 2× vCPU | 4 GB | ~200 H/s |
| Desktop | Ryzen 5 5600X | 16 GB | ~3 000 H/s |
| Server | EPYC 7742 (64c) | 128 GB | ~25 000 H/s |

*Orientační hodnoty pro Cosmic Harmony v3*

---

## Varianta 1: ZION Native Miner

```bash
git clone https://github.com/Zion-TerraNova/2.9.5-NativeAwakening.git
cd 2.9.5-NativeAwakening

cargo build --release

# ZION mining (3 vlákna)
./target/release/zion-miner \
  --pool localhost:3333 \
  --wallet "zion1qTVOJE_ADRESA" \
  --worker muj-rig \
  --threads 3 \
  --group zion

# VRSC dual-mining (1 vlákno, volitelné)
./target/release/zion-miner \
  --pool localhost:3333 \
  --wallet "VRSC_ADRESA" \
  --worker muj-rig-vrsc \
  --threads 1 \
  --algo verushash \
  --group vrsc
```

---

## Varianta 2: Docker miner

```bash
git clone https://github.com/Zion-TerraNova/2.9.5-NativeAwakening.git
cd 2.9.5-NativeAwakening/docker

docker compose -f docker-compose.testnet.yml up -d zion-miner
docker logs -f zion-miner
```

---

## Varianta 3: XMRig (RandomX kompatibilní)

```bash
wget https://github.com/xmrig/xmrig/releases/latest/download/xmrig-6.21.0-linux-x64.tar.gz
tar xzf xmrig-*.tar.gz && cd xmrig-*

./xmrig \
  -o stratum+tcp://77.42.31.72:3333 \
  -u zion1qTVOJE_ADRESA \
  -p muj-rig \
  --algo rx/0
```

---

## Pool mining

### Veřejné pool servery

| Pool | Stratum | Web |
|------|---------|-----|
| Helsinki (oficial) | `77.42.31.72:3333` | `http://77.42.31.72:8080` |

### Konfigurace

```bash
./zion-miner \
  --pool 77.42.31.72:3333 \
  --wallet "zion1qTVOJE_ADRESA" \
  --worker muj-rig
```

---

## Solo mining

Spusť vlastní node + pool:

```bash
./zion-core --data-dir ./data --network testnet \
  --peers "77.42.31.72:8334"

./zion-pool --node localhost:8444 --stratum-port 3333

./zion-miner --pool localhost:3333 \
  --wallet "zion1qTVOJE_ADRESA"
```

---

## Monitoring těžby

```bash
# Hashrate a shares
curl -s http://localhost:8080/api/stats | python3 -m json.tool

# Stav blockchainu
curl -s localhost:8444/jsonrpc \
  -d '{"jsonrpc":"2.0","id":1,"method":"get_info"}' \
  -H 'Content-Type: application/json'
```

---

## Optimalizace

1. **Huge pages** — zvyšuje hashrate o 10-20 %:
   ```bash
   sudo sysctl -w vm.nr_hugepages=1280
   ```

2. **CPU affinity** — přiřaď miner ke konkrétním jádrům:
   ```bash
   taskset -c 0-5 ./zion-miner --pool ...
   ```

3. **Bez hyperthreadingu** — fyzická jádra dávají lepší výkon

---

## Další informace

- [Pool Setup →](#pool-setup) — vlastní mining pool
- [Pokročilý Setup →](#setup) — produkční konfigurace
- [API Reference →](#api) — RPC endpointy
- [GitHub](https://github.com/Zion-TerraNova/2.9.5-NativeAwakening) — zdrojový kód

---

*ZION TerraNova v2.9.6*
