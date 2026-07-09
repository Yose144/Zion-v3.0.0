# Mining průvodce — ZION

Kompletní průvodce těžbou ZION blockchainu po aktuální veřejné kanonické cestě.

---

## Přehled

- **Algoritmus:** Cosmic Harmony Deeksha (`cosmic_harmony`)
- **Block reward:** 5 400,067 ZION -> Decade Decay (-20 % / 10 let), tail 725 ZION
- **Block time:** 60 sekund
- **DAA:** LWMA s oknem 60 bloků, max. změna +-25 %
- **Mining horizont:** 100+ let + perpetual tail emission
- **Poplatky:** spalovány (deflační mechanismus)
- **Legacy revenue support:** runtime ji stále umí, ale veřejné nasazení je nyní pure-ZION

### Distribuce block rewardu

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
git clone https://github.com/Zion-TerraNova/2.9.6.git
cd 2.9.6

cargo build --release

./target/release/zion-miner \
  --pool localhost:3333 \
  --wallet "zion1qTVOJE_ADRESA" \
  --worker muj-rig \
  --threads 3 \
  --algo cosmic_harmony \
  --group zion
```

---

## Varianta 2: Docker miner

```bash
git clone https://github.com/Zion-TerraNova/2.9.6.git
cd 2.9.6/docker

docker compose -f docker-compose.testnet.yml --env-file ../.env up -d zion-miner
docker logs -f zion-miner
```

---

## Varianta 3: Přímé připojení na veřejný pool

```bash
./target/release/zion-miner \
  --pool seed.zionterranova.com:3333 \
  --wallet "zion1qTVOJE_ADRESA" \
  --worker muj-rig \
  --algo cosmic_harmony
```

---

## Pool mining

### Veřejný pool server

| Pool | Stratum | Web |
|------|---------|-----|
| Zion2 (public host) | `seed.zionterranova.com:3333` | `http://seed.zionterranova.com:8080` |

### Konfigurace

```bash
./zion-miner \
  --pool seed.zionterranova.com:3333 \
  --wallet "zion1qTVOJE_ADRESA" \
  --worker muj-rig
```

---

## Solo mining

Spusť vlastní node a pool:

```bash
./zion-core --data-dir ./data --network testnet \
  --peers "seed.zionterranova.com:8334"

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

1. **Huge pages** — mohou zvednout hashrate o 10-20 %:
   ```bash
   sudo sysctl -w vm.nr_hugepages=1280
   ```

2. **CPU affinity** — přiřaď miner ke konkrétním jádrům:
   ```bash
   taskset -c 0-5 ./zion-miner --pool ...
   ```

3. **Bez hyperthreadingu** — fyzická jádra obvykle dávají lepší výkon.

---

## Další informace

- [Pool Setup →](#pool-setup) — vlastní mining pool
- [Pokročilý Setup →](#setup) — produkční konfigurace
- [API Reference →](#api) — RPC endpointy
- [GitHub](https://github.com/Zion-TerraNova/2.9.6) — zdrojový kód

---

*ZION TerraNova v2.9.8 Deeksha*