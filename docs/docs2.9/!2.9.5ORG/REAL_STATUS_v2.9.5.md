# ✅ ZION v2.9.5 — Real Code Status (Single Source of Truth)

**Datum:** 20. ledna 2026  
**Scope:** Pouze real‑code stav v 2.9.5 (bez doc tvrzení)  
**Testy:** ✅ 108 unit testů prochází (72 core + 36 pool)
**E2E:** ✅ Remote smoke-check (Helsinki + USA) OK; ✅ Rust docker stack na Helsinki běží (core+pool+redis, 18090/18181); ✅ Miner→pool E2E (cosmic_harmony) OK; ✅ ARM64 native libs built (randomx/yescrypt/cosmic_harmony) + load OK; ✅ Externí Stratum test (77.42.31.72:13333) OK; ⚠️ RandomX externí test (180s) nedoběhl do share fáze (dataset init)

---

## 🔢 Line‑count snapshot (bez target/ cache)
- **Celkem Rust**: ~15,350 LOC
- **Core**: ~6,550 LOC (přidáno ~630 LOC security)
- **Pool**: ~6,861 LOC
- **Universal Miner**: ~1,834 LOC

---

## 🧠 Core (zion-native/core)

### Implementováno (ověřeno v kódu)
- **LMDB storage + indexy** (blocks, height, tx→block, utxo): [2.9.5/zion-native/core/src/storage/lmdb.rs](zion-native/core/src/storage/lmdb.rs)
- **Delete block at height (rollback support)**: [2.9.5/zion-native/core/src/storage/lmdb.rs](zion-native/core/src/storage/lmdb.rs)
- **UTXO rollback při reorg** ✅ HOTOVÉ: [2.9.5/zion-native/core/src/storage/lmdb.rs](zion-native/core/src/storage/lmdb.rs) + [2.9.5/zion-native/core/src/blockchain/reorg.rs](zion-native/core/src/blockchain/reorg.rs)
- **State + UTXO apply + mempool cleanup + metriky**: [2.9.5/zion-native/core/src/state/mod.rs](zion-native/core/src/state/mod.rs)
- **Plná TX validace v bloku** ✅ HOTOVÉ: UTXO existence, balance check, ownership verification: [2.9.5/zion-native/core/src/blockchain/validation.rs](zion-native/core/src/blockchain/validation.rs) + [2.9.5/zion-native/core/src/state/mod.rs](zion-native/core/src/state/mod.rs)
- **Block/PoW validace** (verze, výška, prev_hash, timestamp, algo, merkle, diff, PoW): [2.9.5/zion-native/core/src/blockchain/validation.rs](zion-native/core/src/blockchain/validation.rs)
- **Reorg harness** (cumulative_difficulty, is_stronger_chain, rollback_to_height, find_fork_point): [2.9.5/zion-native/core/src/blockchain/reorg.rs](zion-native/core/src/blockchain/reorg.rs)
- **DAA (Difficulty Adjustment Algorithm)** s deterministickými testy (6 testů): [2.9.5/zion-native/core/src/blockchain/consensus.rs](zion-native/core/src/blockchain/consensus.rs)
- **JSON‑RPC** (`getBlockTemplate`, `submitBlock`, `getTx`, …): [2.9.5/zion-native/core/src/jsonrpc/mod.rs](zion-native/core/src/jsonrpc/mod.rs)
- **Mining template blob** ✅ HOTOVÉ: Strukturovaný 165-byte blob s algorithm byte + nonce rezervací: [2.9.5/zion-native/core/src/blockchain/block.rs](zion-native/core/src/blockchain/block.rs)
- **Template blob parsing** ✅ HOTOVÉ: `from_template_blob()` pro submitBlock: [2.9.5/zion-native/core/src/blockchain/block.rs](zion-native/core/src/blockchain/block.rs)
- **REST API základ**: [2.9.5/zion-native/core/src/rpc/methods.rs](zion-native/core/src/rpc/methods.rs)
- **P2P TCP handshake + gossip**: [2.9.5/zion-native/core/src/p2p/mod.rs](zion-native/core/src/p2p/mod.rs)
- **P2P keepalive + tip sync (GetTip/Tip)**: [2.9.5/zion-native/core/src/p2p/heartbeat.rs](zion-native/core/src/p2p/heartbeat.rs)
- **P2P seed nodes discovery** ✅ HOTOVÉ: Hardcoded seed list + connectivity check + DNS resolver: [2.9.5/zion-native/core/src/p2p/seeds.rs](zion-native/core/src/p2p/seeds.rs)
- **P2P peer persistence** ✅ HOTOVÉ: Save/load známých peers (JSON), automatic save každých 5 minut: [2.9.5/zion-native/core/src/p2p/persistence.rs](zion-native/core/src/p2p/persistence.rs)
- **P2P peer reliability tracking** ✅ HOTOVÉ: Best peers sorting (low failures, recent activity): [2.9.5/zion-native/core/src/p2p/persistence.rs](zion-native/core/src/p2p/persistence.rs)
- **P2P security hardening** ✅ HOTOVÉ: Rate limiting, blacklist (permanent/temporary), connection limits, misbehavior detection: [2.9.5/zion-native/core/src/p2p/security.rs](zion-native/core/src/p2p/security.rs)
- **Mempool + eviction policy**: [2.9.5/zion-native/core/src/mempool/pool.rs](zion-native/core/src/mempool/pool.rs) a [2.9.5/zion-native/core/src/mempool/eviction.rs](zion-native/core/src/mempool/eviction.rs)

### Nehotovo / chybí
- **P2P encryption** (TLS pro peer connections) - plánováno pro Mainnet

**Verdikt:** Core je nyní produkčně připravený pro TestNet s kompletní TX validací, UTXO rollback a mining template.

---

## 🏊 Pool (zion-native/pool)

### Implementováno (ověřeno v kódu)
- **Stratum v2 server**: [2.9.5/zion-native/pool/src/stratum/server_v2.rs](zion-native/pool/src/stratum/server_v2.rs)
- **Template manager (RPC fetch + notify)**: [2.9.5/zion-native/pool/src/blockchain/template_manager.rs](zion-native/pool/src/blockchain/template_manager.rs)
- **Share validator s vlastním hash výpočtem** ✅ HOTOVÉ: Validator VŽDY počítá hash sám, verifikuje proti miner result: [2.9.5/zion-native/pool/src/shares/validator.rs](zion-native/pool/src/shares/validator.rs)
- **PPLNS + payout pipeline (Redis)**: [2.9.5/zion-native/pool/src/pplns/calculator.rs](zion-native/pool/src/pplns/calculator.rs)
- **Payout manager (send/confirm/timeout)**: [2.9.5/zion-native/pool/src/payout/manager.rs](zion-native/pool/src/payout/manager.rs)
- **Payout scheduler (PostgreSQL)** ✅ HOTOVÉ: Integrován do main.rs s PAYOUT_DB_URL env: [2.9.5/zion-native/pool/src/payout/scheduler.rs](zion-native/pool/src/payout/scheduler.rs) + [2.9.5/zion-native/pool/src/main.rs](zion-native/pool/src/main.rs)
- **HTTP API + Prometheus**: [2.9.5/zion-native/pool/src/main.rs](zion-native/pool/src/main.rs)
- **Validace wallet adresy (Stratum login/authorize)**: [2.9.5/zion-native/pool/src/stratum/server_v2.rs](zion-native/pool/src/stratum/server_v2.rs)
- **NCL (Stratum extension metody) + deterministická verifikace** ✅ HOTOVÉ: `ncl.register/get_task/submit/status` + verifikovatelný `hash_chaining_v1`: [2.9.5/zion-native/pool/src/ncl.rs](zion-native/pool/src/ncl.rs) + [2.9.5/zion-native/pool/src/stratum/server_v2.rs](zion-native/pool/src/stratum/server_v2.rs)

### Nehotovo / chybí
- Žádné kritické nedostatky

**Verdikt:** Pool je produkčně připravený s end-to-end integritou share validace a volitelným PostgreSQL scheduler.

---

## ⛏️ Universal Miner (zion-universal-miner)

### Implementováno (ověřeno v kódu)
- **CPU mining loop (Rayon)**: [2.9.5/zion-universal-miner/src/miner/cpu.rs](zion-universal-miner/src/miner/cpu.rs)
- **Stratum + XMRig JSON-RPC (fallback) client**: [2.9.5/zion-universal-miner/src/stratum/mod.rs](zion-universal-miner/src/stratum/mod.rs)
- **NCL polling loop + submit** ✅ HOTOVÉ: `get_task → compute → submit` (+ `status`): [2.9.5/zion-universal-miner/src/miner/mod.rs](zion-universal-miner/src/miner/mod.rs) + [2.9.5/zion-universal-miner/src/ncl/mod.rs](zion-universal-miner/src/ncl/mod.rs)

### Nehotovo / chybí
- **GPU CUDA/OpenCL** (placeholder implementace)

**Verdikt:** Miner je end‑to‑end funkční pro mining shares proti poolu (ověřeno externě pro `cosmic_harmony`);
RandomX může vyžadovat dataset init (dlouhé cold starty).

---

## 📈 Changelog (18. ledna 2026)

### Core Improvements (Jan 17, 2026 AM)
- ✅ **Plná TX validace**: Implementována UTXO existence, balance check (input ≥ output + fee), ownership verification (address from pubkey = UTXO address)
- ✅ **Template blob pro mining**: 165-byte strukturovaný formát s algorithm byte + nonce rezervací (8 bytes)
- ✅ **Template blob parsing**: `Block::from_template_blob()` pro submitBlock s blob+nonce parametry
- ✅ **UTXO rollback**: `rollback_block_utxos()` implementováno s rekonstrukcí UTXOs z předchozích bloků při reorg
- ✅ **Coinbase reward validation**: Check že coinbase výstup nepřekračuje BASE_REWARD + MAX_CONSCIOUSNESS_BONUS

### Core Improvements (Jan 17, 2026 PM - Security Hardening)
- ✅ **P2P seed nodes discovery**: Hardcoded seed list (4 nodes) + TCP connectivity check (3s timeout) + DNS resolver
- ✅ **P2P peer persistence**: JSON persistence s best peers sorting (low failures, recent activity)
- ✅ **P2P automatic bootstrap**: Pokud není --peers, automaticky discover seeds + load saved peers
- ✅ **P2P peer rotation**: Periodic save každých 5 minut do data/peers.json
- ✅ **P2P rate limiting**: Max 10 attempts per 60s window per IP
- ✅ **P2P blacklist**: Permanent + temporary bans (auto-expire)
- ✅ **P2P connection limits**: Max 100 total connections, max 50 per IP
- ✅ **P2P misbehavior detection**: Ban after 3 invalid messages/blocks or oversized data
- ✅ **REST API test suite**: test_rest_api.sh pro testování endpointů

### Pool Improvements
- ✅ **Vlastní share hash výpočet**: Validator VŽDY počítá hash sám místo spoléhání na miner result
- ✅ **Miner `result` je volitelné/untrusted**: mismatch může být detekován/logován, ale není důvod k hard reject
- ✅ **Payout scheduler integrace**: PostgreSQL scheduler integrován do main.rs s volitelnou PAYOUT_DB_URL

### Core Fixes (Jan 18, 2026)
- ✅ **Template blob parsing**: opraveno mapování `algo_byte` v `from_template_blob()` (sedí na `Algorithm` enum)
- ✅ **Konzistentní TX validace**: coinbase je kontextová (jen první TX v bloku); non-coinbase vyžaduje inputs+outputs
- ✅ **Srozumitelnější validace bloků**: non-genesis bez `prev_block` vrací jasnou chybu

### NCL Contract Hardening (Jan 20, 2026)
- ✅ **NCL Protocol Version 1.0**: Explicitní `version` field v NclTask + message params
- ✅ **NclTaskType enum**: `hash_chaining_v1`, `embedding`, `llm_inference`, `image_classification`
- ✅ **Task validation**: Version check, task_type validation, UUID format, deadline enforcement
- ✅ **Expiration handling**: `NclSubmitOutcome::Expired` status, `cleanup_expired()` periodic cleanup
- ✅ **Retry policy**: `NclRetryPolicy` struct s max_retries, retry_delay_ms, allow_reassignment
- ✅ **Contract documentation**: [2.9.5/docs/NCL_CONTRACT_v1.0.md](docs/NCL_CONTRACT_v1.0.md) s kompletní specifikací
- ✅ **Miner NCL update**: NCLTask struct matching pool contract, version negotiation, task validation

### NCL Economics + Anti-cheat (Jan 20, 2026)
- ✅ **Worker stats tracking**: `WorkerNclStats` struct s tasks_completed, total_compute_ms, total_bonus
- ✅ **Worker scoring**: `score = success_rate * 100 + min(5000/avg_ms, 50)` - odměňuje rychlé a spolehlivé
- ✅ **Rate limiting**: 60 requests/min per worker (sliding window)
- ✅ **Leaderboard API**: GET `/api/v1/ncl/leaderboard?limit=N` - top workers by score
- ✅ **Worker stats API**: GET `/api/v1/ncl/worker/:worker_id` - individuální statistiky
- ✅ **NCL status API**: GET `/api/v1/ncl/status` - registered_workers, tasks_rate_limited metrics
- ✅ **NPU info tracking**: `npu_type`, `npu_tflops` extracted from `ncl.register` params

### Test Updates
- ✅ 72 core unit testů prochází (včetně 9 nových P2P + security testů)
- ✅ 36 pool unit testů prochází (opravený test_duplicate_detection pro computed hash)
- ✅ 108 celkem unit testů passing

**Verdikt:** Core je nyní produkčně připravený pro TestNet s kompletní P2P security infrastrukturou.

---

## ✅ Jediný pravdivý dokument
Tento soubor je kanonický zdroj pravdy pro stav v2.9.5.
