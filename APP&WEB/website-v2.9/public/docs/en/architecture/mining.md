# Mining architecture — ZION v2.9.5

---

## Mining flow

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

Cosmic Harmony v3 is a multi-algorithm PoW consensus designed to be:

1. **CPU-friendly** — modern CPUs stay competitive
2. **ASIC-resistant** — periodic algorithm rotation (design intent)
3. **Fair distribution** — constant reward with no halving (v2.9.5 era)
4. **Stable block times** — LWMA DAA keeps ~60s intervals

---

## Difficulty Adjustment Algorithm (DAA)

- **Type**: LWMA (Linearly Weighted Moving Average)
- **Window**: 60 blocks
- **Max change**: ±25% per adjustment
- **Min difficulty**: 1000

LWMA responds smoothly to hashrate changes without sudden difficulty spikes.

---

## Stratum protocol

The pool talks to miners over Stratum (TCP, port 3333):

```json
{"id":1,"method":"mining.subscribe","params":["zion-miner/2.9.5"]}
{"id":2,"method":"mining.authorize","params":["zion1qADRESA","worker-1"]}
{"id":3,"method":"mining.submit","params":["zion1qADRESA","job_id","nonce","result"]}
```

---

## Hardware benchmarks

| Hardware | Hashrate | W | H/W |
|----------|----------|---|-----|
| RPi 4 (4c ARM) | ~50 H/s | 5 W | 10 |
| Intel i5-12400 | ~1,500 H/s | 65 W | 23 |
| Ryzen 5 5600X | ~3,000 H/s | 65 W | 46 |
| Ryzen 9 5950X | ~6,000 H/s | 105 W | 57 |
| EPYC 7742 (64c) | ~25,000 H/s | 225 W | 111 |

*Approximate figures; depends on configuration*

---

## Coinbase maturity

- A found block produces a coinbase paying 5,400.067 ZION
- Coinbase becomes spendable after **100 confirmations** (~100 minutes)

---

## Tuning

### Huge pages (Linux)

```bash
sudo sysctl -w vm.nr_hugepages=1280
echo "vm.nr_hugepages=1280" | sudo tee -a /etc/sysctl.conf
```

### CPU affinity

```bash
taskset -c 0-5 ./zion-miner --pool localhost:3333 --wallet ...
```

### NUMA-aware runs

```bash
numactl --cpunodebind=0 --membind=0 ./zion-miner --pool ...
```

---

## Related

- [Architecture overview](./overview.md)

---

*ZION TerraNova v2.9.5*
