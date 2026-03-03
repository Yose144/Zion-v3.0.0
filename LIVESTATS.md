# ZION TerraNova — Live Stats
> **Aktualizováno:** 2026-03-03T21:30 UTC  
> **E-07 Canary:** 🟢 IN PROGRESS — start `2026-03-03T21:00Z` → end `2026-03-06T21:00Z`  
> **Build:** `zion-core:2.9.7` / `zion-miner:2.9.7-amd64` / `zion-pool:2.9.7`  
> **CHv4 (cosmic_harmony_v3):** active from genesis block 0

---

## 🔗 Chain

| Parametr          | Helsinki (ARM64)          | USA (AMD64)               | Asia (AMD64)              |
|-------------------|---------------------------|---------------------------|---------------------------|
| **Status**        | ✅ Running                | ✅ Running                | ✅ Running                |
| **Block Height**  | 1                         | 1 (sync)                  | 1 (sync)                  |
| **Genesis Hash**  | `bacd6027ecb0f5dc…`       | `bacd6027ecb0f5dc…`       | `bacd6027ecb0f5dc…`       |
| **P2P**           | Reconnecting (post-reset) | Reconnecting (post-reset) | Reconnecting (post-reset) |
| **Uptime**        | ~33 min                   | ~33 min                   | ~32 min                   |

> ℹ️ P2P timeouts jsou normální bezprostředně po chain-reset — uzly se postupně znovupřipojí.

---

## ⛏️ Pool (Helsinki `77.42.31.72:3333`)

| Metrika                | Hodnota                         |
|------------------------|---------------------------------|
| **Hashrate (live)**    | 0.104 MH/s                      |
| **Hashrate (1h)**      | 0.104 MH/s                      |
| **Hashrate (24h avg)** | 0.004 MH/s *(chain jen 33 min)* |
| **Difficulty**         | 1 000                           |
| **Active miners**      | 1                               |
| **Total miners**       | 1                               |
| **Valid shares**       | 80                              |
| **Invalid shares**     | 188 *(stale po restartu)*       |
| **Blocks found**       | 0                               |
| **PPLNS window**       | 67 shares                       |
| **Pending payouts**    | 0 ZION                          |
| **Pool version**       | 2.9.6 (binary string cosmetic, build 2.9.7) |

### Fee Split
| Příjemce            | Podíl  |
|---------------------|--------|
| Miner share         | 84 %   |
| Humanitarian Tithe  | 10 %   |
| Issobella Fund      | 5 %    |
| Pool fee            | 1 %    |

---

## 🌍 Minery — Per-Node

| Node        | Algoritmus             | Accepted | Rejected | Accept Rate | Hashes | Uptime |
|-------------|------------------------|----------|----------|-------------|--------|--------|
| **USA**     | `cosmic_harmony_v3`    | 52       | 0        | 100.0 %     | 50.2 K | 33 min |
| **Asia**    | `cosmic_harmony_v3`    | 7        | 1        | 87.5 %      | 26.9 K | 32 min |

> ✅ Oba minerové používají **CHv4 (cosmic_harmony_v3)** — algoritmus aktivní od genesis bloku 0.

---

## 💰 Revenue Orchestration (CH v3)

| Parametr             | Hodnota                               |
|----------------------|---------------------------------------|
| **Mode**             | auto (TimeSplit <4 miners, PerMiner ≥4) |
| **Revenue compute**  | 21.1 % výpočtu                        |
| **Proxy**            | ✅ enabled                            |
| **Scheduler**        | ✅ enabled                            |
| **Profit switch**    | ✅ enabled                            |
| **Buyback**          | ✅ enabled                            |
| **Profit feed**      | WTM + ZPool + NiceHash                |
| **Aktuální coin**    | ZANO (switched from ETC, +588.5 % advantage) |
| **Fallback coin**    | MEWC (ERG/ZANO nedostupné)            |
| **ERG pool**         | de.ergo.herominers.com:1180           |
| **ZANO pool**        | de.zano.herominers.com:1110           |
| **Miner skupiny**    | ZION:2 / Revenue:1 (při startu)       |

---

## ✅ CHv4 (cosmic_harmony_v3) — Status

| Test / Parametr              | Hodnota                          |
|------------------------------|----------------------------------|
| **CHV4_NPU_FORK_HEIGHT**     | 0 (aktivní od genesis)           |
| **CHV3_MEMORY_HARD_FORK_HEIGHT** | 0 (aktivní od genesis)       |
| **E2E testy**                | ✅ 11/11 PASS (49.8 s)           |
| **GPU kernel (OpenCL)**      | ✅ aktivní vždy                  |
| **GPU kernel (CUDA)**        | ✅ aktivní vždy                  |
| **Python GPU wrapper**       | ✅ `chv4_flag = 1`, `mh_flag = 1` |
| **Algoritmus na minerech**   | `cosmic_harmony_v3` (všechny nody) |

### E2E Test Suite — `L1/pool/tests/chv4_e2e.rs`
| Test                                        | Výsledek |
|---------------------------------------------|----------|
| `test_chv4_fork_height_is_zero`             | ✅ PASS  |
| `test_chv4_active_for_all_heights`          | ✅ PASS  |
| `test_chv4_share_accepted_at_genesis_height`| ✅ PASS  |
| `test_chv4_with_height_zero_equals_v4`      | ✅ PASS  |
| `test_chv4_hash_is_deterministic`           | ✅ PASS  |
| `test_chv4_differs_from_chv3`               | ✅ PASS  |
| `test_chv4_differs_from_chv3_legacy`        | ✅ PASS  |
| `test_chv4_validator_returns_correct_hash`  | ✅ PASS  |
| `test_chv4_different_nonces_produce_different_hashes` | ✅ PASS |
| `test_chv4_algorithm_aliases_parse_correctly` | ✅ PASS |
| `test_chv4_alias_share_accepted_at_genesis` | ✅ PASS  |

---

## 🧪 E-07 Canary Run

| Parametr          | Hodnota                          |
|-------------------|----------------------------------|
| **Status**        | 🟢 IN PROGRESS                   |
| **Start**         | 2026-03-03T21:00:00Z             |
| **End**           | 2026-03-06T21:00:00Z             |
| **Elapsed**       | ~30 min (of 72 h)                |
| **Chain reset**   | ✅ genesis `bacd6027`             |
| **Cíl**           | 72h bez kritického selhání       |
| **B-CRIT-02**     | ⏳ čeká na dokončení 72h         |

---

## 🏗️ Infrastruktura

| Server       | IP              | Arch  | Kontejnery                              |
|--------------|-----------------|-------|-----------------------------------------|
| **Helsinki** | 77.42.31.72     | ARM64 | zion-pool, zion-core, zion-website, zion-bridge, zion-mysterium, zion-nkn, zion-grafana, zion-redis |
| **USA**      | 178.156.240.160 | AMD64 | zion-miner, zion-core, zion-xmr-x86, zion-mysterium |
| **Asia**     | 5.223.43.93     | AMD64 | zion-miner, zion-core, zion-xmr-x86, zion-mysterium |

---

## 📌 Milníky (2.9.7)

| ID          | Popis                         | Stav           |
|-------------|-------------------------------|----------------|
| B-CRIT-01   | CHv4 od genesis, E2E 11/11    | ✅ UZAVŘEN     |
| B-CRIT-02   | E-07 canary 72h               | ⏳ IN PROGRESS |
| B-CRIT-03   | Genesis ceremony sign-off     | 🔜 PENDING     |
| F-04        | CHv4 E2E test suite           | ✅ DONE        |
| F-05        | GPU kernels CHv4 NPU Mixing   | ✅ DONE        |
| F-06        | Height dispatch (N/A - fork=0)| ✅ DONE        |

---

*Generováno automaticky — data z pool API + docker logs — 2026-03-03T21:30Z*
