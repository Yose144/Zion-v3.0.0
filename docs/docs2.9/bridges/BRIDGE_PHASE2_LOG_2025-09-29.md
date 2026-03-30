# BRIDGE PHASE 2 LOG – 2025-09-29

## 🔗 Stav Integrace Legacy ZION CryptoNote Daemonu
Tato fáze přináší funkční HYBRID mezi novou TypeScript architekturou (2.6.5 testnet core) a původním C++ daemonem (legacy zion-cryptonote). Cílem je NEPŘEPSAT konsensus, ale přemostit a postupně přenést pouze nutné části.

## ✅ Dokončeno v této fázi
- DaemonBridge modul (RPC proxy + cache + retry)
- Integrace Bridge do: `MiningPool`, `RPCAdapter`, `BlockchainCore`, `server.ts`
- Pool nyní preferuje REAL block template (bridge → local rpc → synthetic fallback)
- BlockchainCore přestal generovat fiktivní height/difficulty – čte periodicky (5s) z `get_info`
- RPC endpointy (`get_info`, `get_height`, `get_block`, `get_block_template`, `submit_block`) přesměrovány na legacy daemon pokud zapnut EXTERNAL_DAEMON_ENABLED
- Endpoint `/api/bridge/status` pro health check
- Force refresh po `submit_block`
- Konfigurační proměnné: `EXTERNAL_DAEMON_ENABLED`, `DAEMON_RPC_URL`, `TEMPLATE_WALLET`, `BRIDGE_TIMEOUT_MS`, `TEMPLATE_RESERVE_SIZE`

## 🧪 Chování
- Při aktivním bridge: real chain height / difficulty se propaguje do všech API
- Při výpadku: fallback na mock odpovědi (log varování `[bridge] ... fallback`)
- Pool logging: `[bridge] ✅ template height=... diff=...`

## 🧩 Co JEŠTĚ CHYBÍ pro FULL "zion-cryptonote" integraci
| Oblast | Stav | Potřeba |
|--------|------|---------|
| Share Validation (RandomX / CryptoNight hashing) | Fallback placeholder | Přidat skutečný hash pipeline + difficulty verifikaci (pow) |
| Mempool integration | Nepropojeno | Přidat RPC most pro tx relay (send_raw_transaction) + mapovat tx_pool_size |
| Transaction submit v TS vrstvě | Mock | Forward `submitTransaction` → legacy daemon RPC (sendrawtransaction / relay) |
| Difficulty adjust introspekce | Read-only (get_info) | Pokud bude potřeba vlastní metriky, přidat adaptér na wide_difficulty → normalized form |
| Event streaming (nový blok) | Není | Long-poll / periodic poll + websockets broadcasting do FE / pool adaptace |
| Wallet RPC bridging | Není | Samostatný WalletBridge (balance, transfer, get_address) | 
| P2P peer status | Hard-coded mock | Přidat mapování `get_connections` (pokud podporované) + health počítání |
| Persistence TS vrstvy | Žádná | Zatím nepotřebné (legacy drží databázi) – pozdější caching / metrics store |
| Secure auth / rate-limit pro RPC | Základ | Přidat optional HMAC / JWT gating pro veřejné nasazení |
| Docker Compose integrace full chain | Částečně | Přidat service `legacy-daemon` + volume pro blockchain data a healthcheck |
| Build pipeline test | Není | Přidat smoke test skript: ověřit /api/bridge/status + /api/rpc/json_rpc get_info |
| Monitoring / Metrics | Chybí | Prometheus exporter (height, diff, peers, template latency) |
| Failover více daemonů | Není | Rozšířit Bridge o seznam URL (round-robin / priority / failover) |

## 🗺 Navržené FÁZE pokračování
1. Phase 3 – Real Share Validation
   - Implementace hash worker modul (Native addon / externí bin) pro RandomX / CryptoNight
   - Validace targetu na pool submit
2. Phase 4 – TX / Mempool Relay
   - Endpoint `/api/tx/submit` → bridge RPC
3. Phase 5 – Event Layer
   - WebSocket: push `new_block`, `chain_tip` + integrace do frontendu
4. Phase 6 – Wallet Bridge
   - Samostatná adaptace wallet RPC (balance, incoming transfers) + payout integration
5. Phase 7 – Multi-Daemon Failover + Metrics
   - Prometheus + round-robin fallback
6. Phase 8 – Harden & Security
   - Auth tokens, request quotas, structured audit log

## 🔐 Konfig Příklad (.env)
```
EXTERNAL_DAEMON_ENABLED=true
DAEMON_RPC_URL=http://legacy-daemon:18081
TEMPLATE_WALLET=Z3_POOL_ADDRESS_HERE
TEMPLATE_RESERVE_SIZE=8
BRIDGE_TIMEOUT_MS=5000
```

## 💡 Architektonická Poznámka
Bridge pattern nám umožňuje:
- Izolovat riziko: nemusíme hned refaktorovat C++ Core
- Iterativně přenášet jen to, co dává smysl (mempool, events, hashing)
- Ponechat validaci a konsensus tam, kde už funguje

## 🚩 Known Limitations (Rizika)
- Fallback na mock může maskovat skutečné chyby – přidat var log alert count
- Žádné timeout / circuit breaker okno – zvážit exponential backoff a trip state
- Submit block neověřuje synchronizační lag (možný orphan risk) – lze doplnit `info.top_block_hash` pre-check

## 📌 Rychlá Kontrola Aktivace
```
GET /api/bridge/status    -> enabled:true + height > 0
GET /api/rpc/json_rpc {"method":"get_info"} -> skutečná výška roste
GET /api/pool/stats       -> minersActive, sharesAccepted
```

## 📝 Commit Obsah této fáze (shrnutí změn)
- `server.ts` – injekce DaemonBridge do RPC + Pool + BlockchainCore, endpoint `/api/bridge/status`
- `daemon-bridge.ts` – cache & retry
- `mining-pool.ts` – hierarchical template fetch (bridge → local → synthetic)
- `rpc-adapter.ts` – real RPC fallback na mock
- `blockchain-core.ts` – real chain sync loop (5s), odstraněné synthetic incrementy
- `tsconfig.json` update (types node)

## ❓ Co dál ohledně „celé zion cryptonote integrace?“
ANO – plná integrace ještě není hotová. Aktuálně máme pouze READ / SUBMIT vrstvy. Chybí:
- Přímé napojení transakční logiky a mempoolu
- Reálné ověření share (proof-of-work)
- Wallet RPC adaptér
- Peers / network topology reporting
- Notifikační/event vrstva

Tyto části jsou rozplánované (viz fáze výše).

---
_Log vytvořen: 2025-09-29  (Bridge Phase 2)_
