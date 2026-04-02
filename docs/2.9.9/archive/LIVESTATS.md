# ZION TerraNova — Live Stats
> **Aktualizováno:** 2026-03-11T11:39 UTC  
> **Síť:** testnet  
> **Host:** `91.98.122.165`  
> **Build:** `zion-core:2.9.8` / `zion-pool:2.9.8` / `zion-miner:2.9.8`  
> **Algoritmus:** Ekam Deeksha přes alias `cosmic_harmony`, aktivní od genesis (`CHV_EKAM_FORK_HEIGHT = 0`)

---

## 🔗 Chain

| Parametr | Hodnota |
|---|---|
| **Status** | ✅ Running |
| **Topologie** | single-primary host + interní `zion-seed-1`, `zion-seed-2` |
| **Height po resetu** | ověřeno `4 → 5 → 7` během validačního okna |
| **Difficulty** | `1209 → 2015` |
| **RPC** | `http://91.98.122.165:8444/jsonrpc` |
| **P2P** | host + 2 interní seed kontejnery |

---

## ⛏️ Pool (`91.98.122.165:3333`)

| Metrika | Hodnota |
|---|---|
| **Pool API** | `http://91.98.122.165:8080/stats` |
| **Hashrate (snapshot)** | `101.63 H/s` |
| **Difficulty (snapshot)** | `1209+` |
| **Accepted shares** | `61` |
| **Rejected shares** | `0` |
| **Acceptance rate** | `100 %` |
| **Blocks found** | `32+` |
| **Pool mode** | pure-ZION, `algo=cosmic_harmony` |

### Fee Split

| Příjemce | Podíl |
|---|---|
| Miner share | 89 % |
| Humanitarian Tithe | 5 % |
| Issobella Fund | 5 % |
| Pool fee | 1 % |

---

## 🌍 Miner

| Parametr | Hodnota |
|---|---|
| **Worker** | `testnet-miner-91` |
| **Binary** | `zion-miner:2.9.8` |
| **Algoritmus** | `cosmic_harmony` |
| **Threads** | `1` |
| **Hashrate** | `1.23 kH/s` |
| **Uptime snapshot** | `00:01:06` při prvním live checku |

Pozorování z logů:

- miner po restartu okamžitě přijímal joby pro height 5+
- pool log potvrdil `Share ACCEPTED` bez rejectů
- pool log potvrdil i `BLOCK FOUND` krátce po restartu

---

## ✅ Rollout 2026-03-11

| Krok | Stav |
|---|---|
| `CHV_EKAM_FORK_HEIGHT = 0` nasazeno | ✅ |
| `core + pool + miner` rebuild na serveru | ✅ |
| clean reset Docker volumes | ✅ |
| start přes `docker compose --env-file .env` | ✅ |
| chain growth ověřen | ✅ |

### Operativní poznámky

- `docker compose` bez explicitního `--env-file .env` nechá `REDIS_PASSWORD` prázdný a Redis spadne na `requirepass wrong number of arguments`
- pool build na serveru odhalil skutečný feature-gated bug v `L1/pool/src/gpu_mining.rs`; po fixu build proběhl čistě
- staré servery `77.42.31.72`, `178.156.240.160`, `5.223.43.93` jsou historické a nejsou live source of truth

---

*Zdroj: live `docker ps`, `docker logs`, `curl /stats`, `get_info` z 2026-03-11.*
