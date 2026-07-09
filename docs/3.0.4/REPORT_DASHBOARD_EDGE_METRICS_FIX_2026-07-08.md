# Report: Dashboard Edge Metriky Fix — v3.0.4

**Datum:** 2026-07-08 (22:25–00:30 CEST)
**Commity:** `0f10ab9f`, `0a4f1a0f`
**Server:** 62.171.141.136 (vmi3425821, Hetzner VPS)
**Lokální stroj:** zionserver-144 (monitoring přes SSH tunel)

---

## 1. Problém

Dashboard běžící lokálně na zionserver monitoroval nový edge server (62.171.141.136) přes SSH tunel. Mnoho API endpointů vracelo chyby nebo prázdná data:

| Endpoint | Před opravou | Příčina |
|----------|-------------|---------|
| `/api/health` | bridge=down, nginx=down | Špatné porty + false-positive `_is_edge_local` |
| `/api/readiness` | 83% (39/47) YELLOW | Bridge down → 8 bodů ztraceno |
| `/api/edge/overview` | `Connection refused` | Očekával port 8888 (neexistuje) |
| `/api/edge/infra` | `Connection refused` | Očekával port 8888 |
| `/api/warp/health` | offline | Port 8453 → actual 9333 |
| `/api/l3/warp/chains` | offline, 0 chains | Port 8453 → actual 9333 |
| `/api/pool/miners` | `Connection refused` | Pool neměl `ZION_ROUTING_METRICS_BIND` |
| `/api/bridge/status` | offline | Bridge metrics port 9101 ne v tunelu + Address already in use |
| `/api/edge-status` | `SSH key not found` | `ssh-key-zion-edge` neexistuje + staré service names |

---

## 2. Root Causes

### 2.1 `_is_edge_local()` False Positive
Funkce detekovala zda dashboard běží na edge serveru pomocí UDP socket connect na `127.0.0.1:8443`. Při SSH tunelu (`-L 8443:127.0.0.1:8443`) je `127.0.0.1:8443` lokálně dostupný → `getsockname()` vrátil `127.0.0.1` == `EDGE_HOST` → `True`. Výsledek: příkazy se spouštěly lokálně na zionserver místo přes SSH na edge server.

**Fix:** Detekce pouze přes hostname (`vmi` pro Hetzner VPS, `edge`, `mainnet`). Odstraněn UDP socket test.

### 2.2 `_run_edge_cmd()` SSH Key Hardcoded
Funkce vyžadovala `REPO_ROOT/ssh-key-zion-edge` — soubor neexistuje. SSH klíč je v `~/.ssh/zion-new-server` s config aliasem `zion-new` v `~/.ssh/config`.

**Fix:** Fallback na `ssh zion-new` alias když `ssh-key-zion-edge` neexistuje.

### 2.3 WARP Port Mismatch
Dashboard kód hardcoded port 8453 pro WARP health/chains/transfers. V3.0.4 WARP server poslouchá na portu 9333 (built-in default, env var `ZARP_BIND` má typo — `ZARP` místo `ZION_WARP`).

**Fix:** Všechny WARP endpointy (health, chains, transfers) → port 9333.

### 2.4 Edge Overview/Infra — Port 8888
Dashboard očekával unified edge API na portu 8888. Na v3.0.4 serveru běží jednotlivé systemd služby bez unified API.

**Fix:**
- `/api/edge/infra`: TCP probe všech portů (8443, 8444, 8450, 9333, 9101, 9100, 443, 8766)
- `/api/edge/overview`: Agregace z `build_status()` + `_build_health_map()`

### 2.5 Pool Metrics — Chybějící Env Var
Pool binary podporuje `ZION_ROUTING_METRICS_BIND` pro Prometheus metrics endpoint, ale env var nebyla nastavena v `/root/zion/edge-environment.sh`.

**Fix (server-side):** Přidáno `ZION_ROUTING_METRICS_BIND="127.0.0.1:8455"` + restart poolu.

### 2.6 Bridge Metrics — Address Already In Use
Bridge se restartoval 10x při startu (config file chyběl → `No such file or directory`). Po úspěšném startu metrics server selhal: `Metrics server bind failed on 127.0.0.1:9101: Address already in use` — port držel předchozí zombie proces.

**Fix:** `systemctl restart zion-bridge` → metrics endpoint `http://127.0.0.1:9101/metrics` opět funkční.

### 2.7 Systemd Service Names
Dashboard používal staré názvy: `zion-edge-node1`, `zion-pool-server`, `zion-edge-dao`, `zion-edge-warp`, `zion-edge-bridge`. Nové v3.0.4 názvy: `zion-node`, `zion-pool`, `zion-dao`, `zion-warp`, `zion-bridge`.

**Fix:** Aktualizováno v `get_edge_server_status()`, `run_edge_action()`, `_build_health_map()`.

### 2.7 Nginx/Web-Next Health Check
`_build_health_map()` kontrolovala nginx na portu 443 a web-next na 3001 přes TCP — ale tyto porty nejsou v SSH tunelu (nginx běží jen na edge serveru).

**Fix:** Nginx a web-next health check přes SSH `systemctl is-active` na edge serveru.

---

## 3. Commity

### `0f10ab9f` — fix(dashboard): opravit edge metriky pro v3.0.4 nový server

Soubor: `ZION_OS/dashboard/app.py` (94 insertions, 84 deletions)

Změny:
- `_is_edge_local()`: hostname-only detekce (odstraněn UDP socket false positive)
- `_run_edge_cmd()`: SSH fallback na `zion-new` config alias
- `get_edge_server_status()`: nové systemd service names + nginx v seznamu
- `clear_edge_disk()`: odstraněn SSH key early return
- `run_edge_action()`: aktualizované restart příkazy pro v3.0.4
- `get_edge_backup_path()`: SCP fallback na `zion-new` alias
- `_build_health_map()`: nginx/web-next přes SSH systemctl check
- `/api/edge/infra`: TCP probe všech portů místo port 8888 API
- `/api/edge/overview`: agregace z build_status() + health map
- `/api/warp/health`: port 8453 → 9333
- `/api/l3/warp/chains`: port 8453 → 9333
- `/api/l3/warp/transfers`: port 8453 → 9333

### `0a4f1a0f` — chore(deps): metal backend macOS-only + bincode removed + heed features

Soubory: `V3/Cargo.toml`, `V3/Cargo.lock`, `V3/L1/miner/Cargo.toml`, `V3/scripts/security-audit.sh`

Změny:
- `metal`/`block`/`objc` gated behind `cfg(target_os = "macos")` — `paste` transitive out of Linux tree
- `bincode` dependency removed (RUSTSEC-2025-0141 resolved)
- `heed`: explicit features `["serde", "serde-json"]`, `default-features = false`
- `security-audit.sh`: RUSTSEC-2025-0141 ignore removed, RUSTSEC-2024-0436 comment updated

---

## 4. Server-Side Změny (62.171.141.136)

### `/root/zion/edge-environment.sh`
```diff
+ ZION_ROUTING_METRICS_BIND="127.0.0.1:8455"
```

### Restartované služby
- `zion-pool` — metrics endpoint na 8455 aktivní
- `zion-bridge` — metrics endpoint na 9101 opět funkční (Address already in use vyřešeno)

---

## 5. Výsledek — Stav po opravě

### Health (`/api/health`)
| Služba | Stav |
|--------|------|
| edge-node | **up** |
| pool-edge | **up** |
| bridge | **up** (dříve down) |
| dao | **up** |
| warp | **up** |
| nginx | **up** (dříve down) |
| dashboard | **up** |
| miner | down (lokální CPU miner, GPU běží na rigu) |
| web-next | down (maintenance mode — správně) |

### Readiness (`/api/readiness`)
- **Score: 100% (GREEN)** — 47/47 weight (dříve 83% YELLOW, 39/47)
- Všechny 8 služeb alive: pool-edge(10), miner(10), bridge(8), dao(8), warp(4), oasis(3), free-world(2), issobella(2)

### Pool Miners (`/api/pool/miners`)
- **ok=True**, 1 aktivní miner
- **vega-smos**: 17.95 KH/s, 114 valid shares, 5 blocks found, 0 rejected

### Explorer (`/api/explorer`)
- **Chain height:** 95 (rostoucí)
- **Accepted blocks:** 96
- **Block reward:** 5,400.067 ZION
- **Circulating supply:** 16,780,513,006 ZION
- **Genesis:** `4f75a0dfe6dde3b1...`

### Bridge (`/api/bridge/status`)
- **Online:** True (dříve offline)
- **Validators:** 5/5 threshold
- **Contract verified:** True
- **Chains:** ZION L1 + Base Mainnet

### WARP (`/api/warp/health`)
- **Online:** True, port 9333, v3.0.4 (dříve offline)
- **Chains:** 21 (Bitcoin, Sui, TON, ZionL1, Linea, EVM chains...)

### Edge Status (`/api/edge-status`)
- **CPU:** 2.4% (load 0.24)
- **RAM:** 3,351 / 7,941 MB (42%)
- **Disk:** 13%
- **Services:** node=active, pool=active, dao=active, warp=active, bridge=active, nginx=active

### Checklist (`/api/checklist`)
- **12/13 passed (92.3%)**
- Failing: Edge Node 2 (Follower) — not deployed (single-server topology)

### Blockers (`/api/blockers`)
- **10 total:** 2 done, 8 open (5 critical)
- Ready for launch: **No**

### Mining Rig — SMOS (Rig #518837)
- **Name:** ZionRig | **Group:** ZionLiteFire
- **Online:** True | **IP:** 109.81.87.10
- **GPU:** 1x RX Vega 64 (HBM 8GB Samsung)
- **OC:** Core 1250 MHz, Mem 950 MHz, Vddc 900mV, PowerLimit 3
- **Teploty:** GPU 48°C, CPU 35°C, Fan 40%
- **CPU:** Intel Pentium G4560 @ 3.50GHz
- **OS:** SMOS v1367, Kernel 5.15.80, Driver amd21.50.2
- **Process uptime:** 3,988s (~66 min)
- **SMOS alerts:** hashrate (kosmetické — SMOS neumí parsovat custom miner output)

---

## 6. SSH Tunel — Port Map

```
ssh -fN \
  -L 8443:127.0.0.1:8443 \   # Node RPC
  -L 8444:127.0.0.1:8444 \   # Pool Stratum
  -L 8445:127.0.0.1:8445 \   # Node WebSocket
  -L 8450:127.0.0.1:8450 \   # DAO API
  -L 8455:127.0.0.1:8455 \   # Pool Prometheus Metrics
  -L 9100:127.0.0.1:9100 \   # Node Prometheus Metrics
  -L 9101:127.0.0.1:9101 \   # Bridge Prometheus Metrics
  -L 9333:127.0.0.1:9333 \   # WARP Relay API
  zion-new
```

---

## 7. Známá omezení (ne-bugy)

1. **Miner down v health** — lokální CPU miner na zionserver neběží; GPU miner běží na rigu přes SMOS (pool vidí vega-smos)
2. **Web-next down** — maintenance mode (statická HTML stránka, správně)
3. **Hiran inference offline** — LLM backend nenasazen
4. **Atomic swap offline** — service nenasazena
5. **CEX listings offline** — edge website v maintenance
6. **NCL jobs error** — Hiranyagarbha orchestrator běží ale 0 agentů
7. **SMOS hashrate alert** — kosmetické, SMOS neumí číst custom miner output; pool reálně přijímá shares
8. **Bridge EVM watcher warnings** — BSC/Polygon public RPC rate-limited (ne-kritické, vyžaduje Ankr premium API key)
9. **WARP DB** — in-memory (cesta `data/warp.db` neexistuje), persistuje po restartu
10. **Edge Node 2** — nenasazen (single-server topologie)

---

## 8. Soubory upravené v této session

| Soubor | Commit | Popis |
|--------|--------|-------|
| `ZION_OS/dashboard/app.py` | `0f10ab9f` | 12 oprav portů/SSH/detekce |
| `V3/Cargo.toml` | `0a4f1a0f` | metal macOS-only, bincode removed, heed features |
| `V3/Cargo.lock` | `0a4f1a0f` | dependency tree update |
| `V3/L1/miner/Cargo.toml` | `0a4f1a0f` | metal deps target-gated, crossterm |
| `V3/scripts/security-audit.sh` | `0a4f1a0f` | audit ignore list update |

**Server-side (necommitováno — na 62.171.141.136):**
- `/root/zion/edge-environment.sh` — `ZION_ROUTING_METRICS_BIND="127.0.0.1:8455"`
