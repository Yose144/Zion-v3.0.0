# V3 vs V31 — Kompletní migrační audit (Master Plan)

**Datum auditu:** 2026-08-04  
**V3 umístění:** `archive/V3/` (archivováno po V31 cutover)  
**V31 umístění:** `V31/` (aktivní mainnet alpha, v3.1.0-alpha.2)  
**Auditor:** Devin (8 paralelních subagentů)

---

## Executive Summary

V31 je **architektonický restart** — zjednodušená, modulární verze V3, která sjednocuje L2 služby do `zion-multichain` a zavádí nový nativní blockchain layout (Keccak256, unified Transaction model). V31 má silnou V3 kompatibilitní vrstvu, ale **mnohé V3 funkce jsou stub, chybí nebo nejsou integrovány**.

**Celkový verdikt:** V31 je **alpha-grade**. Jádro (node, storage, RPC compat, emission, difficulty, crypto) je solidní. Pool, Miner, DAO, DEX a Desktop Agent mají **kritické mezery**.

### Statistiky gapů (počet podle závažnosti)

| Závažnost | Počet |
|-----------|-------|
| CRITICAL | 18 |
| HIGH | 14 |
| MEDIUM | 22 |
| LOW | 12 |
| NONE / IMPROVEMENT | 16 |

---

## 1. Node / Core (L1)

**Verdikt:** V3 kompatibilitní vrstva je komplexní, ale `submitBridgeUnlock` je stub a nativní P2P/mempool jsou alpha-grade.

| Modul | V3 | V31 | Gap | Akce |
|-------|-----|-----|-----|------|
| RPC | 27 metod, produkční | V3 compat + 5 nativních | **HIGH** | Wire `submitBridgeUnlock` → `v3_bridge` |
| Consensus | 10-krokový pipeline | HeightAwareDeeksha | MEDIUM | Accept (jiný design) |
| Block layout | V3 (BLAKE3, version field) | V31 (Keccak256, bez version) | HIGH | Accept (compat layer) |
| Transaction | Hybrid (account+UTXO) | Unified script-based | HIGH | Accept (compat layer) |
| Storage | LMDB | SQLite (dual-chain) | MEDIUM | Benchmark, přidat undo blocks |
| P2P (nativní) | Produkční | Alpha (JSON, žádný scoring) | MEDIUM | Dokončit nativní P2P |
| Mempool (nativní) | Hardened (eviction, fee) | Minimal (Vec, žádná eviction) | MEDIUM | Dokončit nativní mempool |
| Genesis | 14 outputů | 7 outputů | LOW | Accept (jiný design) |
| Emission | Decade decay | Identické | NONE | — |
| Difficulty | LWMA-60 (custom 128-bit) | LWMA-60 (num_bigint) | LOW | — |
| Crypto | Ed25519+BLAKE3 | Identické | NONE | — |
| WebSocket | Full broadcast | Simplified (stub broadcast) | LOW | Dokončit broadcast |
| V3 Compat | N/A | Komplexní (997 řádků) | LOW | Wire bridge unlock |
| Migration | N/A | Snapshot import | LOW | Dokumentovat proces |

**Kritické akce:**
1. **Wire `submitBridgeUnlock`** v V31 RPC → volat `v3_bridge::verify_bridge_proofs()`
2. **Dokončit nativní P2P** — peer scoring, subnet diversity, banning
3. **Dokončit nativní mempool** — fee-rate eviction, size limity

---

## 2. Pool

**Verdikt:** V31 je **minimal viable pool**. API server se vůbec nespouští, PPLNS je zjednodušené (share count vs difficulty-weighted), chybí fee split, auth, multi-pool.

| Komponenta | V3 | V31 | Gap | Akce |
|------------|-----|-----|-----|------|
| API Server | Spouští se | **NESTARTUJE** | **CRITICAL** | Přidat `PoolApi::serve()` do main.rs |
| PPLNS | Difficulty-weighted (500k window) | Share count (10k window) | **CRITICAL** | Přepnout na `v3_pplns.rs` |
| Fee Split | 3-way (humanitarian/issobella/pool) | Single `fee_bps` | **CRITICAL** | Přidat `FeeConfig` |
| Payout Execution | Full pipeline + sweep thread | Žádná exekuce | **CRITICAL** | Přidat sweep thread + wallet |
| Config | 30+ env vars | CLI args only | **CRITICAL** | Přidat env var support |
| Auth | API + Admin keys | Žádná | **CRITICAL** | Přidat Bearer auth |
| Multi-Pool | RevenueScheduler + profit switcher | Žádný | **CRITICAL** | Portovat pokud potřeba |
| Stratum | Full v1 + set_difficulty | Chybí set_difficulty | MEDIUM | Přidat vardiff |
| Metrics | 20+ metrik | 7 metrik | MEDIUM | Doplnit chybějící |
| Template Cache | TTL + graceful degradation | Simple poll (15s) | MEDIUM | Přidat TemplateCache |
| Notifications | Telegram + SMTP | Žádné | LOW | Přidat pokud potřeba |
| Share Forwarding | Full | Full (port) | NONE | — |
| AuxPoW Bridge | Full | Full (port) | NONE | — |
| Storage (SQLite) | Full | Identické | NONE | — |
| Rate Limiting | Present | Present (čistší) | NONE | — |

**Kritické akce:**
1. **Spustit API server** — `PoolApi::serve("0.0.0.0:8080")` v main.rs
2. **Přepnout na `v3_pplns.rs`** — difficulty-weighted PPLNS
3. **Přidat `FeeConfig`** — humanitarian (5%) + issobella (5%) + pool (1%)
4. **Přidat API auth** — `ZION_POOL_API_KEY` + `ZION_POOL_API_ADMIN_KEY`
5. **Přidat env var config** — 30+ proměnných z V3

---

## 3. Miner

**Verdikt:** V31 miner je **STUB**. 312-řádkový binary s žádným GPU, žádným triple-stream, žádným TUI. Kernel zdroje existují v `csrc/` ale jsou **dead code**.

| Komponenta | V3 | V31 | Gap | Akce |
|------------|-----|-----|-----|------|
| Main Binary | 7,780 řádků, full | 312 řádků, stub | **CRITICAL** | Rewrite binary |
| GPU OpenCL | 10,018 řádků, full | 59 řádků, stub | **CRITICAL** | Port gpu_backend.rs |
| GPU CUDA | Partial (12 kernels) | Kernels exist, not integrated | **CRITICAL** | Přidat `cudarc` dep |
| GPU Metal | 2 kernels | 14 kernels, not integrated | **CRITICAL** | Přidat `metal` dep |
| OpenCL Kernels | 60+ via AuXpow | 60+ v csrc/ (dead) | **CRITICAL** | Enable gpu-opencl |
| Triple-Stream | Full + TUI | Enum only | **CRITICAL** | Implementovat |
| AuxPoW Module | Full via AuXpow | Module exists, stub GPU | **CRITICAL** | Fix gpu_miner.rs |
| Profit Switching | Live oracle | Placeholder | **CRITICAL** | Implementovat |
| parallel.rs | Integrated | Commented out | MEDIUM | Přidat zion_auxpow dep |
| Metrics | Prometheus + JSON | Žádné | MEDIUM | Přidat metrics |
| Stratum Client | Full via AuXpow | Advanced, not connected | **CRITICAL** | Připojit k binary |
| CPU Features | Full detection | Identické (not used) | LOW | Integrovat |
| Thread Affinity | Full pinning | Identické (not used) | LOW | Integrovat |
| Reconnect | Exponential backoff | Identické | NONE | — |
| Build System | Full GPU deps | GPU features bez deps | **CRITICAL** | Přidat ocl/cudarc/metal |
| External Coins | 24 coins | 30 coins (not mining) | LOW | Enable mining |

**Kritické akce:**
1. **Přidat GPU dependencies** do Cargo.toml: `ocl`, `cudarc`, `metal`, `objc`, `block`
2. **Nahradit stub `gpu_miner.rs`** full implementací z V3
3. **Rewrite `zion-miner.rs`** — rayon, GPU, triple-stream, TUI, metrics
4. **Enable `parallel.rs`** — přidat `zion_auxpow` dependency
5. **Implementovat profit switching** v `cosmic-harmony/profit.rs`

**Odhad úsilí:** 2-3 týdny full-time vývoje pro V3 parity.

---

## 4. L2 / Multichain + Cosmic Harmony

**Verdikt:** V31 úspěšně sjednotil L2 služby do `zion-multichain`, ale DAO je skeleton, DEX ztratil ZionDex backend, profit oracle nemá live integraci.

| Komponenta | V3 | V31 | Gap | Akce |
|------------|-----|-----|-----|------|
| Bridge | Standalone daemon, height-aware decimals | Unified, simplified | HIGH | Port decimal conversion + validator quorum |
| WARP | 12 chains, standalone | 12 chains, unified | NONE | V31 improved (rate limit, auth) |
| Atomic Swap | Standalone daemon | Unified, enhanced (claimant) | MEDIUM | Add mutex recovery, HTLC endpoints |
| DEX/Swap | ZionDex (intent, solver, SDK) | Basic AMM router | HIGH | Port ZionDex |
| DAO | Full governance daemon | Skeleton only | HIGH | Port voting, treasury, humanitarian |
| Cosmic Harmony | 3 profiles | Canonical Ekam Deeksha | MEDIUM | Verify fork gating |
| Chain Adapters | 13 families | 13 families | NONE | — |
| HTLC Persistence | Dedicated DB | Unified DB | MEDIUM | Add mutex recovery |
| API Endpoints | Multiple services | Unified multichain | HIGH | Add HTLC + DAO endpoints |
| Profit Oracle | NiceHash + WhatToMine | Fallback only | HIGH | Port live oracle |
| GPU Classification | Implicit | Explicit Device enum | IMPROVEMENT | — |
| Tests | ~635 | 1945 | IMPROVEMENT | — |
| SDK | Rust | Rust + multichain | IMPROVEMENT | — |

**Kritické akce:**
1. **Port DAO** — voting engine, treasury multi-sig (5/7), humanitarian (7 kategorií), executor, L1 scanner, HTTP API, SQLite persistence
2. **Port ZionDex** — intent-based settlement, solver network, TypeScript SDK, Solidity contracts
3. **Port live profit oracle** — NiceHash + WhatToMine integrace
4. **Přidat HTLC endpoints** do multichain serveru (lock/claim/refund)
5. **Port bridge validator consensus** — 5/7 quorum logic
6. **Port height-aware decimal conversion** — pre/post-3.0.3 fork handling

---

## 5. Website / Explorer

**Verdikt:** Částečně kompatibilní s V31. Explorer používá V3 RPC (8443) pro blockchain data — funkční. Pool API integrace je největší bloker.

| Oblast | Status | Gap | Akce |
|--------|--------|-----|------|
| RPC client | Metody většinou match | `getPeerInfo`, `getTransactionHistory` formát diff | MEDIUM |
| Pool API | V3 endpoints | V31 pool API nestartuje | **CRITICAL** |
| Network config | Hardcoded V3 | Chybí V31 env vars | MEDIUM |
| Explorer | Funkční na V3 RPC | OK pro teď | LOW |

**Akce:**
1. **Spustit V31 pool API** (viz Pool sekce)
2. Přidat V31 env vars do website config
3. Long-term: port explorer na V31 RPC

---

## 6. Desktop Agent

**Verdikt:** **Neexistuje V31 Desktop Agent.** Aktuální agent bundleuje výhradně V3 binaries.

| Oblast | V3 | V31 | Gap | Akce |
|--------|-----|-----|-----|------|
| Existence | Full Electron app | **NEEXISTUJE** | **CRITICAL** | Vytvořit V31 agent |
| Binary bundling | V3 binaries | N/A | **CRITICAL** | Port na V31 binaries |
| Electron main process | Full | N/A | **CRITICAL** | Port main process |
| CLI args | V3 miner args | V31 miner (jiné args) | **CRITICAL** | Update args |
| Triple-stream logic | Full | N/A | **CRITICAL** | Port triple-stream UI |

**Akce:**
1. **Vytvořit V31 Desktop Agent** — port Electron main process, update binary paths, implement missing CLI args, port triple-stream mining logic

---

## 7. CLI

**Verdikt:** V31 CLI je zásadně odlišné — streamlinované, multichain-focused, odstraňuje mnohé V3 funkce.

| Oblast | V3 | V31 | Gap | Akce |
|--------|-----|-----|-----|------|
| Service lifecycle | Full (deploy, monitor, TUI) | Omezené | HIGH | Portovat service management |
| Wallet file management | Full | Chybí | HIGH | Přidat wallet file ops |
| Transaction sending | Full | Chybí | HIGH | Přidat tx sending |
| Deployment | Full | Odstraněno | MEDIUM | Dokumentovat |
| Monitoring | Full TUI | Odstraněno | MEDIUM | Dokumentovat |
| AI layers | Full | Odstraněno | LOW | Accept (jiný scope) |
| Multichain | Omezené | Full | IMPROVEMENT | — |

**Akce:**
1. **Přidat wallet file management** do V31 CLI
2. **Přidat transaction sending** do V31 CLI
3. **Přidat service lifecycle management** (start/stop/status pro node, pool, miner)

---

## 8. Dashboard

**Verdikt:** Mix V3/V31 dependencies, částečná V31 integrace. Hardcoded RPC porty, chybí V31 miner monitoring.

| Oblast | Status | Gap | Akce |
|--------|--------|-----|------|
| RPC port | Hardcoded 8443 | Chybí V31 env var | HIGH |
| V31 services | Node, pool, miner, multichain active | OK | — |
| V31 miner monitoring | Chybí | Miner je stub (žádné metrics) | **CRITICAL** |
| Pool metrics | Částečně | Pool API nestartuje | **CRITICAL** |
| Env vars | V3 only | Chybí V31 specifikace | MEDIUM |

**Akce:**
1. **Spustit V31 pool API** (vyřeší pool metrics)
2. **Dokončit V31 miner** s Prometheus metrics (vyřeší miner monitoring)
3. **Přidat V31 env vars** do dashboard config
4. **Odstranit hardcoded RPC porty** — použít env vars

---

## Prioritní roadmapa

### Fáze 1 — Critical Fixes (okamžitě)

| # | Akce | Komponenta | Úsilí |
|---|------|-----------|-------|
| 1 | Spustit V31 pool API server | Pool | 1h |
| 2 | Přepnout pool na `v3_pplns.rs` | Pool | 4h |
| 3 | Přidat `FeeConfig` (humanitarian/issobella/pool) | Pool | 4h |
| 4 | Přidat API auth (API key + admin key) | Pool | 2h |
| 5 | Wire `submitBridgeUnlock` → `v3_bridge` | Node | 4h |
| 6 | Přidat GPU deps do miner Cargo.toml | Miner | 1h |

### Fáze 2 — High Priority (1-2 týdny)

| # | Akce | Komponenta | Úsilí |
|---|------|-----------|-------|
| 7 | Přidat env var config do pool | Pool | 1d |
| 8 | Doplnit chybějící pool metrics | Pool | 1d |
| 9 | Nahradit stub `gpu_miner.rs` full implementací | Miner | 3d |
| 10 | Rewrite `zion-miner.rs` (rayon, GPU, TUI, metrics) | Miner | 5d |
| 11 | Enable `parallel.rs` (zion_auxpow dep) | Miner | 1d |
| 12 | Port DAO (voting, treasury, humanitarian, API) | L2 | 5d |
| 13 | Port live profit oracle (NiceHash + WhatToMine) | L1/CH | 3d |
| 14 | Vytvořit V31 Desktop Agent | Desktop | 5d |
| 15 | Přidat wallet file management do CLI | CLI | 2d |
| 16 | Přidat transaction sending do CLI | CLI | 2d |

### Fáze 3 — Medium Priority (2-4 týdny)

| # | Akce | Komponenta | Úsilí |
|---|------|-----------|-------|
| 17 | Dokončit nativní P2P (scoring, diversity, banning) | Node | 3d |
| 18 | Dokončit nativní mempool (eviction, size limits) | Node | 2d |
| 19 | Implementovat triple-stream mining | Miner | 3d |
| 20 | Implementovat profit switching | Miner | 2d |
| 21 | Port ZionDex (intent, solver, SDK) | L2 | 5d |
| 22 | Port bridge validator consensus (5/7) | L2 | 3d |
| 23 | Port height-aware decimal conversion | L2 | 2d |
| 24 | Přidat HTLC endpoints do multichain | L2 | 2d |
| 25 | Odstranit hardcoded RPC porty v dashboard | Dashboard | 1d |
| 26 | Portovat service lifecycle do CLI | CLI | 3d |

### Fáze 4 — Low Priority (volitelné)

| # | Akce | Komponenta |
|---|------|-----------|
| 27 | Přidat VarDiff do stratum | Pool |
| 28 | Přidat TemplateCache s TTL | Pool |
| 29 | Přidat notifications (Telegram/SMTP) | Pool |
| 30 | Port RevenueScheduler (multi-pool) | Pool |
| 31 | Dokončit WebSocket broadcast | Node |
| 32 | Přidat undo blocks pro reorg safety | Node |
| 33 | Integrovat CPU features + thread affinity do miner | Miner |
| 34 | Port V3 TUI do V31 miner | Miner |
| 35 | Port explorer na V31 RPC | Website |
| 36 | TypeScript/Python SDK bindings | SDK |

---

## Co funguje (V31 parita nebo zlepšení oproti V3)

- ✅ **Emission** — identická logika
- ✅ **Crypto** — identické primitivy (Ed25519, BLAKE3, SHA-256, RIPEMD-160)
- ✅ **Difficulty** — LWMA-60, identické konstanty
- ✅ **V3 Compat layer** — komplexní (997 řádků), všechny V3 datové struktury
- ✅ **Share Forwarding** — plně portováno
- ✅ **AuxPoW Bridge** — plně portováno
- ✅ **Pool Storage (SQLite)** — identické
- ✅ **Reconnect Logic** — identické
- ✅ **WARP** — 12 chain families, V31 improved (rate limit, auth, config)
- ✅ **Chain Adapters** — 13 families, plná parita
- ✅ **Cosmic Harmony** — 30 external coins, explicit Device enum
- ✅ **Tests** — 1945 (vs ~635 v V3)
- ✅ **SDK** — Rust + multichain keyring integration
- ✅ **Atomic Swap** — enhanced (claimant address, C1 security)
- ✅ **Rate Limiting** — čistší implementace v V31

---

## Závěr

V31 je **architektonicky nadějnější** (unified multichain, cleaner modular design, více testů), ale **funkčně nedokončené**. Největší blokery pro production cutover:

1. **Miner je stub** — žádné GPU, žádný triple-stream (2-3 týdny práce)
2. **Pool API se nespouští** — 1 hodina práce
3. **PPLNS je zjednodušené** — nevyvážené payouty při scale
4. **DAO je skeleton** — žádné governance funkce
5. **Desktop Agent neexistuje** — uživatelé nemají GUI
6. **Profit oracle nemá live data** — žádné profit switching

**Doporučení:** Začít Fází 1 (critical fixes — 1 den), pokračovat Fází 2 (1-2 týdny), paralelně spustit Fázi 3. Fáze 4 je volitelná.
