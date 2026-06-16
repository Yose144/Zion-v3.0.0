# Mining architektura — ZION v2.9.5

---

## Tok těžby

```
Pool                  Node                    Blockchain
 │                     │                        │
 │  getblocktemplate   │                        │
 │ ──────────────────> │                        │
 │  block template     │                        │
 │ <────────────────── │                        │
 │                     │                        │
 │  (distributes to    │                        │
 │   connected miners) │                        │
 │                     │                        │
 │  submitblock        │                        │
 │ ──────────────────> │    validate + add      │
 │                     │ ─────────────────────> │
 │  accept/reject      │                        │
 │ <────────────────── │                        │
```

---

## Cosmic Harmony v3

Cosmic Harmony v3 je multi-algoritmový PoW konsenzus navržený tak, aby:

1. **CPU-friendly** — moderní CPU mají konkurenceschopný výkon
2. **ASIC-resistant** — častá rotace algoritmů
3. **Fair distribution** — konstantní odměna bez halvingu
4. **Stabilní block time** — LWMA DAA udržuje 60s intervaly

---

## Difficulty Adjustment Algorithm (DAA)

- **Typ**: LWMA (Linearly Weighted Moving Average)
- **Okno**: 60 bloků
- **Max změna**: ±25 % za blok
- **Min difficulty**: 1000

LWMA reaguje na změny hashrate plynule — žádné náhlé skoky difficulty.

---

## Stratum protokol

Pool komunikuje s minery přes Stratum protokol (TCP, port 3333):

```json
{"id":1,"method":"mining.subscribe","params":["zion-miner/2.9.5"]}
{"id":2,"method":"mining.authorize","params":["zion1qADRESA","worker-1"]}
{"id":3,"method":"mining.submit","params":["zion1qADRESA","job_id","nonce","result"]}
```

---

## Hardware benchmarky

| Hardware | Hashrate | W | H/W |
|----------|----------|---|-----|
| RPi 4 (4c ARM) | ~50 H/s | 5 W | 10 |
| Intel i5-12400 | ~1 500 H/s | 65 W | 23 |
| Ryzen 5 5600X | ~3 000 H/s | 65 W | 46 |
| Ryzen 9 5950X | ~6 000 H/s | 105 W | 57 |
| EPYC 7742 (64c) | ~25 000 H/s | 225 W | 111 |

*Orientační hodnoty, závisí na konfiguraci*

---

## Coinbase maturity

- Nalezený blok generuje coinbase transakci s odměnou 5 400,067 ZION
- Coinbase je utratitelný po **100 potvrzeních** (~100 minut)

---

## Optimalizace

### Huge pages (Linux)

```bash
sudo sysctl -w vm.nr_hugepages=1280
echo "vm.nr_hugepages=1280" | sudo tee -a /etc/sysctl.conf
```

### CPU affinity

```bash
taskset -c 0-5 ./zion-miner --pool localhost:3333 --wallet ...
```

### NUMA awareness

Na vícesocketových serverech:

```bash
numactl --cpunodebind=0 --membind=0 ./zion-miner --pool ...
```

---

## Související

- [Mining průvodce →](#mining-guide) — praktický návod
- [Pool Setup →](#pool-setup) — provoz poolu
- [Přehled architektury →](#arch-overview) — celková architektura

---

*ZION TerraNova v2.9.5*
