# L1 Testnet → V3 Mainnet Audit

> Vytvořeno: 2026-03-13 | Poslední aktualizace: 2026-03-16 (po Phase 17)
> Účel: Kompletní inventář L1 testnet modulů vs V3 mainnet stav.
> Cíl: Zajistit, že nic kritického z testnet nezapomeneme při mainnet pure-code migraci.

---

## Souhrn

| Metrika | L1 testnet | V3 mainnet |
|---|---|---|
| Zdrojové soubory | ~50 `.rs` ve 14 adresářích | ~20 `.rs` ve 4 crates |
| Celkem LoC | ~17 500 | ~12 000+ |
| Testy | ~200+ (odhad) | **393+ pass, 0 fail, 1 ignored** |
| Persistence | LMDB (7 databází) | ✅ LMDB via heed (8 databází) |
| Tx model | UTXO (Bitcoin-styl) | ✅ UTXO (TxInput/TxOutput/Transaction) |
| Kryptografie | Ed25519 + BLAKE3 + RIPEMD160 | ✅ Ed25519 + BLAKE3 + RIPEMD160 |
| Adresy | `zion1...` 44 znaků, checksum | ✅ `zion1...` 44 znaků, checksum |

---

## Modul po modulu

### ✅ HOTOVO — V3 už má (reimplementováno čistě)

| # | L1 modul | L1 LoC | V3 ekvivalent | V3 LoC | Poznámky |
|---|---|---|---|---|---|
| 1 | `blockchain/reward.rs` | 388 | `emission.rs` | 237 | Decade Decay, tail emission, flowers. 16 testů. Plně kompatibilní. |
| 2 | `blockchain/consensus.rs` (LWMA) | 456 | `difficulty.rs` | 379 | 60-block LWMA, ±25% clamp, integer-only. 21 testů. |
| 3 | `blockchain/premine.rs` | 391 | `genesis.rs` | 489 | 12 adres, 4 kategorie, DAO lock, genesis block. 17 testů. |
| 4 | `p2p/messages.rs` | 90 | `lib.rs` (P2pMessage enum) | ~100 | Hello, Welcome, Ping/Pong, GetPeers, GetBlocksSince, AnnounceBlock, Blocks |
| 5 | (žádný L1 pool crate) | — | `zion-pool` | 1 397 | Stratum-like pool, share validace, wire protocol. 13 testů. V3 jedinečný. |
| 6 | `miner/` | 217 | `zion-miner` | 552 | Pool/local session, Ekam Deeksha. 4 testy. |
| 7 | `blockchain/block.rs` (partial) | 498 | `lib.rs` (MiningHeader, BlockCandidate, SealedBlock, AcceptedBlock) | ~200 | Header serialization, PoW validace, template assembly. |
| 8 | `blockchain/chain.rs` (partial) | 553 | `lib.rs` (ChainState) | ~400 | In-memory chain, height/hash indexy, snapshot persistence, journal recovery. |

### ⚠️ ČÁSTEČNĚ — V3 má základ, ale chybí klíčové prvky

| # | L1 modul | Co L1 má | Co V3 MÁ | Co V3 CHYBÍ | Priorita |
|---|---|---|---|---|---|
| 9 | `mempool/pool.rs` (515 LoC) | HashMap + RwLock, fee-rate sort, double-spend tracking, byte limit 20MB, size limit 10K, eviction, `MempoolError` enum | ✅ `mempool_v2.rs` — double-spend outpoint tracking, byte/count limits (20 MB / 10K txs), `MempoolError` enum, fee-rate eviction, `restore_transactions()`. 12 testů. | — | ✅ **HOTOVO** |
| 10 | `blockchain/validation.rs` (556 LoC) | 10-step block validation, tx validation, PoW validation, merkle verify, coinbase maturity check, max block size 1MB, timestamp drift ±2h | ✅ `validation.rs` — 11-step block validation pipeline, Merkle root, signatures, coinbase maturity (100 blocks), block size, timestamp drift ±7200s, intra-block double-spend, DAO lock. 25 testů. | — | ✅ **HOTOVO** |
| 11 | `p2p/` (celý, ~2100 LoC) | Async tokio TCP, peer manager, connection pool, handshake, sync state machine, flood-fill relay | ✅ Sync TCP s persistent connections (Phase 10), outbound peer thread, heartbeat Ping/Pong, PeerManager wiring (scoring, banning, diversity), PeerSecurity wiring (rate limiting, escalating bans), flood-fill relay. | Full async (tokio), parallel multi-peer IBD | **STŘEDNÍ** |
| 12 | `rpc/` + `jsonrpc/` (~2700 LoC) | Axum HTTP, ~40 JSON-RPC metod, auth middleware, REST + JSON-RPC 2.0 | ✅ `rpc.rs` — 15 JSON-RPC 2.0 metod (getChainInfo, getNodeInfo, getBlock, getBlockByHeight, getBalance, getAccountBalance, getTransaction, getAccountTransaction, getBlockTemplate, getMempoolInfo, getPeerInfo, sendRawTransaction, submitTransaction, submitAccountTransaction, submitBlock) + 7 simple RPC metod. Auto-detection na portu 8332. 14+11 testů. | HTTP server (axum), auth middleware | **NÍZKÁ** |
| 13 | `state/mod.rs` (569 LoC) | `Arc<Inner>` shared state, broadcast channels, block processing lock, reorg lock, metrics integration, UTXO ownership validation | `NodeRuntime` s `ChainState`, `CoreRuntime`, `ChainStore`, LMDB persistence. Phase 10 přidal PeerManager + PeerSecurity do node binary. | Broadcast channels pro real-time events, block processing mutex, reorg lock | **STŘEDNÍ** |
| 14 | `blockchain/block.rs` (template blob) | `build_template_blob()` 165B hex, `from_template_blob()` parsing, `calculate_merkle_root()` binary Merkle tree | `derive_template_merkle_root()` XOR-fold, `MiningHeader::to_bytes()` 80B | Standardní binární Merkle tree (BLAKE3 hash pairs), standardní template blob format pro external miners | **STŘEDNÍ** |

### ❌ CHYBÍ — V3 nemá vůbec

| # | L1 modul | LoC | Co dělá | Migrace potřeba? | Priorita pro mainnet |
|---|---|---|---|---|---|
| 15 | ~~**`crypto/keys.rs`**~~ | 260 | Ed25519 keypair, `zion1...` address derivace | ✅ **HOTOVO** — `crypto.rs` (260 LoC, 19 testů) | ✅ |
| 16 | ~~**`tx/mod.rs`**~~ (UTXO model) | 189 | UTXO TxInput/TxOutput/Transaction, calculate_hash(), verify_signatures() | ✅ **HOTOVO** — `tx.rs` (220 LoC, 10 testů) | ✅ |
| 17 | ~~**`wallet/mod.rs`**~~ | 300 | SpendableUtxo, coin selection, build_and_sign() s zeroize | ✅ **HOTOVO** — `wallet.rs` (310 LoC, 9 testů, batch payouts 200 recipients) | ✅ |
| 18 | ~~**`wallet/batch.rs`**~~ | 609 | Multi-recipient batch tx (pool payouts) | ✅ **HOTOVO** — integrováno do `wallet.rs` | ✅ |
| 19 | ~~**`blockchain/fee.rs`**~~ | 335 | MIN_TX_FEE=1000, fee-rate, 100% burn | ✅ **HOTOVO** — `fee.rs` (210 LoC, 15 testů) | ✅ |
| 20 | ~~**`blockchain/reorg.rs`**~~ | 226 | rollback, fork choice (most-work), cumulative difficulty | ✅ **HOTOVO** — `chain.rs` (MAX_REORG_DEPTH=10, undo blocks, 14 testů) | ✅ |
| 21 | ~~**`blockchain/burn.rs`**~~ | 682 | BURN_ADDRESS, DAO_ADDRESS, fee burn | ✅ **HOTOVO** — `fee.rs` (BURN_ADDRESS, DAO_ADDRESS, 100% fee burn) | ✅ |
| 22 | ~~**`blockchain/chain.rs`**~~ (reorg rules) | 553 | MAX_REORG_DEPTH, SOFT_FINALITY_DEPTH, total_work, try_reorg() | ✅ **HOTOVO** — `chain.rs` (MAX_REORG_DEPTH=10, SOFT_FINALITY=60, 14 testů) | ✅ |
| 23 | ~~**`storage/lmdb.rs`**~~ | 1136 | LMDB persistent storage, 7 databází, atomic save | ✅ **HOTOVO** — `storage.rs` (8 databases via heed, atomic writes, 12 testů) | ✅ |
| 24 | ~~**`p2p/security.rs`**~~ | 597 | RateLimiter, Blacklist, ConnectionLimiter, escalating bans | ✅ **HOTOVO** — `p2p_security.rs` (350 LoC, 10 testů) + wired do node (Phase 10) | ✅ |
| 25 | ~~**`p2p/sync.rs`**~~ | 276 | IBD state machine, batch sync, stall detection | ✅ **HOTOVO** — `ibd.rs` (13 testů) | ✅ |
| 26 | ~~**`p2p/peers.rs`**~~ | 282 | PeerManager (scoring, banning, diversity) | ✅ **HOTOVO** — `peer_manager.rs` (503 LoC, 13 testů) + wired do node (Phase 10) | ✅ |
| 27 | ~~**`metrics/core_metrics.rs`**~~ | 328 | Atomic counters, Prometheus export, health checks | ✅ **HOTOVO** — `metrics.rs` (10 testů) | ✅ |
| 28 | **`p2p/discovery.rs`** | 166 | Peer exchange, DNS seed refresh | **Částečně** — GetPeers/Peers P2P messages existují, chybí aktivní discovery loop | 🟡 P1 |
| 29 | **`p2p/checkpoint.rs`** | 175 | Known-hash checkpoints pro fast initial sync | **NE PRO MVP** | 🟢 P2 |
| 30 | ~~**`p2p/heartbeat.rs`**~~ | 129 | Keepalive ping/pong, dead peer detection | ✅ **HOTOVO** — Ping/Pong outbound loop (Phase 10), PeerManager idle timeout | ✅ |
| 31 | **`p2p/persistence.rs`** | 131 | Peer list persistence na disk | **CHYBÍ** | 🟡 P1 |
| 32 | **`security_audit.rs`** | 715 | Runtime security checks (dev tooling) | **NE** | ⚪ Skip |
| 33 | **`load_test*.rs`** | 617 | Load testing utilities | **NE** | ⚪ Skip |
| 34 | **`bin/generate-premine-wallets.rs`** | 321 | Jednorázový utility | **NE** | ⚪ Skip |
| 35 | **`algorithms/`** (multi-algo) | 1249 | RandomX, Yescrypt, Blake3, VerusHash + dispatch | **NE** — V3 záměrně single-algo (Ekam Deeksha) | ⚪ Skip |

---

## Klíčové architektonické rozdíly

### 1. Transakční model: UTXO vs Account

| Aspekt | L1 (UTXO) | V3 (Account) |
|---|---|---|
| Struktura | `TxInput{prev_tx, output_index, sig, pubkey}` + `TxOutput{amount, address, memo}` | ✅ `TxInput{prev_tx_hash, output_index, signature, public_key}` + `TxOutput{amount, address}` — `tx.rs` |
| Amount typ | `u128` (flowers) | ✅ `u64` (flowers) |
| Podpisy | Ed25519 per-input, SegWit-style (sig excluded z hash) | ✅ Ed25519, SegWit-style — `tx.rs` |
| Double-spend | UTXO consumption (spent = smazanáno) | ✅ UTXO consumption — `mempool_v2.rs` |
| Change | Explicitní change output | ✅ Explicitní — `wallet.rs` |

**Stav: ✅ VYŘEŠENO** — V3 používá UTXO model (jako L1). Implementováno v `tx.rs`, `wallet.rs`, `fee.rs`.

### 2. Kryptografie

| Aspekt | L1 | V3 |
|---|---|---|
| Hashing | BLAKE3 (obecné) + CosmicHarmony (PoW) | ✅ BLAKE3 (obecné) + Ekam Deeksha (PoW) |
| Podpisy | Ed25519 (`ed25519_dalek`) | ✅ Ed25519 (`ed25519_dalek`) — `crypto.rs` |
| Address derivace | SHA256 → RIPEMD160 → base32 + checksum → `zion1...` (44 znaků) | ✅ Identická — `crypto.rs` |
| Key management | Ed25519 keypair gen, sign/verify | ✅ Identické — `crypto.rs` |

**Stav: ✅ VYŘEŠENO** — BLAKE3 pro obecné hashu (tx, merkle), Ekam Deeksha pro PoW. Ed25519 portován identicky. `zion1...` format frozen.

### 3. Persistence

| Aspekt | L1 | V3 |
|---|---|---|
| Engine | LMDB via `heed` | ✅ LMDB via `heed` — `storage.rs` |
| Databáze | 7 (blocks, utxos, tx_index, balance_cache, undo_blocks, height↔hash) | ✅ 8 (blocks, block_hashes, utxos, tx_index, undo_blocks, mempool, chain_meta, height_to_hash) |
| Atomic ops | `save_block_and_apply_utxos()` — single LMDB transaction | ✅ Atomic writes via heed transactions |
| Capacity | 10 GB LMDB map (konfigurovatelné) | ✅ 10 GB default |

**Stav:** ✅ Plně migrováno na LMDB. 12 testů.

### 4. Fee model

L1 má explicitní 100% fee burn model. **V3 stav: ✅ Plně implementováno v `fee.rs`:**
- ✅ `MIN_TX_FEE = 1_000` (0.001 ZION)
- ✅ `MIN_FEE_RATE = 1` atomic/byte
- ✅ `MAX_TX_SIZE = 100_000` bytes
- ✅ 100% fee burn — `BURN_ADDRESS` + `DAO_ADDRESS` definovány
- ✅ Coinbase = reward only; fees are destroyed
- ✅ 15 testů

### 5. Reward distribution

L1 má 4-way split:
```
MINER_SHARE:     89%
TITHE:            5% (humanitarian)
ISSOBELLA_FUND:   5% (L5/L6)
POOL_FEE:         1%
```

V3 aktuálně: 100% miner (subsidy = miner_reward).

**Otevřená otázka:** Implementovat 4-way split v V3 L1, nebo je to L3+ záležitost? Doporučení: L3+.

---

## Audit-Fix reference z L1

Tyto opravy z bezpečnostního auditu L1 MUSÍ být zahrnuty do V3:

| Audit ID | Popis | L1 soubor | Relevance pro V3 |
|---|---|---|---|
| **P0-05** | Atomic block+UTXO save (prevent partial writes) | `storage/lmdb.rs` | ✅ V3 storage.rs — LMDB atomic writes |
| **P0-07** | Fork choice: most-work wins, removed 90% tertiary | `reorg.rs` | ✅ V3 reorg.rs — fork choice most-work |
| **P0-08** | Block processing lock (prevent race condition) | `state/mod.rs` | ⏳ V3 single-threaded, potřeba pro async |
| **P0-09** | Atomic save_block_and_apply_utxos | `storage/lmdb.rs` | ✅ V3 storage.rs — atomic LMDB txn |
| **P1-01** | Chain: strictly more work wins (`>` not `>=`) | `chain.rs` | ✅ V3 chain.rs — total_work tracking |
| **P1-06** | `try_reorg_unchecked` only in test/dev | `chain.rs` | ✅ V3 reorg.rs — safe reorg only |
| **P1-10** | Escalating ban durations (5m→30m→2h) | `p2p/security.rs` | ✅ V3 p2p_security.rs — 300s→1800s→7200s→perm |
| **P1-15** | Mempool byte size limit (20 MB) | `mempool/pool.rs` | ✅ V3 mempool — MAX_MEMPOOL_BYTES |
| **P1-16** | Deprecated `add_transaction` bez validace | `mempool/pool.rs` | ✅ V3 mempool — validated-only entry |
| **P1-17** | Secret key `zeroize` after signing | `wallet/mod.rs` | ✅ V3 wallet.rs — zeroize on drop |

---

## Implementační plán — STAV (aktualizováno po Phase 10)

Vše z původních fází A–D je implementováno:

| Fáze | Stav | Poznámka |
|---|---|---|
| **A — Kryptografický základ** | ✅ HOTOVO | crypto.rs (BLAKE3+Ed25519+zion1), tx.rs (UTXO model), fee.rs |
| **B — Wallet a validace** | ✅ HOTOVO | wallet.rs (UTXO selection, build_and_sign), validation.rs (10-step), integrace v lib.rs |
| **C — Chain safety** | ✅ HOTOVO | reorg.rs (UTXO rollback, fork choice), mempool hardening, p2p_security.rs, batch.rs |
| **D — Produkční infrastruktura** | ✅ HOTOVO | LMDB storage (8 dbs), IBD sync, JSON-RPC 2.0 (11 methods), peer_manager.rs, metrics.rs |

### Zbývající práce (post Phase 13)

| # | Oblast | Priorita | Stav |
|---|---|---|---|
| 1 | ~~Peer discovery — aktivní GetPeers exchange~~ | ~~P1~~ | ✅ Phase 11 |
| 2 | ~~Peer persistence — uložení known_peers na disk~~ | ~~P1~~ | ✅ Phase 11 |
| 3 | ~~Peer-block PoW verification (header_hex)~~ | ~~P1~~ | ✅ Phase 12 |
| 4 | ~~Peer-block timestamp sanity~~ | ~~P1~~ | ✅ Phase 12 |
| 5 | ~~Peer-block checkpoint enforcement~~ | ~~P1~~ | ✅ Phase 12 |
| 6 | Standard binary Merkle tree (BLAKE3 hash pairs) | P2 | Planned |
| 7 | Block processing lock (concurrent accept safety) | P2 | Planned |
| 8 | Full async P2P — parallel multi-peer IBD | P2 | Planned |
| 9 | CI/CD pipeline | P2 | Planned |
| 10 | E2E multi-node acceptance tests | P2 | Planned |

---

## Konstanty — Frozen reference (L1 → V3 musí souhlasit)

### Kryptografie
```
ZION_BASE32_ALPHABET = "023456789acdefghjklmnpqrstuvwxyz"
Address format     = "zion1" + 35-char body + 4-char checksum = 44 chars
Address derivace   = SHA256(pubkey) → RIPEMD160 → base32(35) → checksum(4)
Signature          = Ed25519 (ed25519_dalek)
General hash       = BLAKE3
PoW hash           = Ekam Deeksha (cosmic_harmony)
```

### Emission (V3 emission.rs — ověřeno ✅)
```
FLOWERS_PER_ZION        = 1_000_000  (updated to 6-decimal in 3.0.3 fork)
TOTAL_SUPPLY            = 144_000_000_000 × FLOWERS_PER_ZION
GENESIS_PREMINE         = 16_280_000_000 × FLOWERS_PER_ZION
BASE_BLOCK_REWARD       = 5_400_067_000_000_000
TAIL_REWARD             = 724_784_723_787_776
BLOCKS_PER_DECADE       = 5_256_000
DECAY = 4/5 per decade, max 10 decades
```

### Difficulty (V3 difficulty.rs — ověřeno ✅)
```
TARGET_BLOCK_TIME       = 60 s
LWMA_WINDOW             = 60 blocks
MIN_SOLVE_TIME          = 30 s
MAX_SOLVE_TIME          = 120 s
MIN_DIFFICULTY          = 1_000
MAX_DIFFICULTY          = u64::MAX / 1_000
CLAMP = ±25%
```

### Chain safety (V3 ✅ — reorg.rs, validation.rs, chain.rs)
```
MAX_REORG_DEPTH         = 50 (L1) / 10 (constitutional)
SOFT_FINALITY_DEPTH     = 60
COINBASE_MATURITY       = 100 blocks
MAX_BLOCK_SIZE          = 1_048_576 bytes (1 MB)
MAX_TIMESTAMP_DRIFT     = 7_200 s (2 hours, mainnet)
```

### Fee model (V3 ✅ — fee.rs)
```
MIN_TX_FEE              = 1_000 (0.001 ZION)
MIN_FEE_RATE            = 1 atomic/byte
MAX_TX_SIZE             = 100_000 bytes (100 KB)
MAX_OUTPUT_AMOUNT       = 144_000_000_000_000_000_000_000
Fee destination         = 100% BURNED (deflationary)
Coinbase                = reward only (no fees)
```

### Premine (V3 genesis.rs — ověřeno ✅)
```
DAO_TREASURY_LOCK_HEIGHT = 525_600
12 addresses, 4 categories:
  oasis_golden_egg:  5 × 1.65B  = 8.25B ZION
  dao_treasury:      3 slots    = 4.00B ZION (locked)
  infrastructure:    3 slots    = 2.59B ZION
  humanitarian:      1 × 1.44B  = 1.44B ZION
                                ----------
  TOTAL:                         16.28B ZION
```

### Reward distribution (V3 ✅ — emission.rs, node.rs)
```
MINER_SHARE      = 89%
TITHE            = 5%  (humanitarian DAO)
ISSOBELLA_FUND   = 5%  (L5/L6 development)
POOL_FEE         = 1%
```

### Mempool (V3 ✅ — mempool.rs)
```
MAX_MEMPOOL_SIZE         = 10_000 txs
MAX_MEMPOOL_BYTES        = 20_971_520 (20 MB)
```

### P2P security (V3 ✅ — p2p_security.rs, peer_manager.rs)
```
Rate limiter:    per-IP connection rate           ✅ PeerSecurity::rate_limiter
Blacklist:       permanent + temporary bans       ✅ PeerSecurity escalating bans
Connection limit: 128 max connections             ✅ PeerSecurity::connection_limiter
Message limiter: escalating bans (300s→1800s→7200s→permanent) ✅
IBD_THRESHOLD:   50 blocks behind = enter IBD mode ✅ ibd.rs
IBD_BATCH_SIZE:  500 blocks per request           ✅ ibd.rs
IBD_STALL:       120s timeout, 3 retries          ✅ ibd.rs
PeerManager:     scoring, subnet diversity (MAX_PER_SUBNET=4), idle disconnect ✅
```

### Burn addresses (V3 ✅ — fee.rs, genesis.rs)
```
BURN_ADDRESS = "zion1burn0000000000000000000000000000000dead"  ✅ fee.rs FEE_BURN_ADDRESS
DAO_ADDRESS  = "zion1dao00000000000000000000000000000treasury" ✅ genesis.rs premine
```

---

## Závěr

V3 mainnet kód po Phase 10 pokrývá **všechny kritické subsystémy**:

- ✅ **Kryptografie:** BLAKE3 + Ed25519 + `zion1...` adresy (crypto.rs)
- ✅ **Transakční model:** UTXO (tx.rs, wallet.rs, batch.rs)
- ✅ **Validace:** 10-step block + tx validace (validation.rs)
- ✅ **Fee model:** deflationary burn, fee-rate enforcement (fee.rs)
- ✅ **Chain safety:** reorg s UTXO rollback, fork choice, coinbase maturity (reorg.rs, chain.rs)
- ✅ **Storage:** LMDB via heed, 8 databází, atomic writes (storage.rs)
- ✅ **P2P:** persistent connections, heartbeat, outbound peer thread (node.rs)
- ✅ **P2P security:** rate limiter, escalating bans, connection limiter (p2p_security.rs)
- ✅ **Peer management:** scoring, subnet diversity, idle disconnect (peer_manager.rs)
- ✅ **RPC:** JSON-RPC 2.0 auto-detect, 11 metod (jsonrpc.rs)
- ✅ **Mining:** Ekam Deeksha PoW, LWMA DAA, pool/miner runtime
- ✅ **Metrics:** atomic counters, Prometheus, health endpoint (metrics.rs)
- ✅ **371 testů** (319 core + 32 cosmic-harmony + 4 miner + 13 pool + 2 pool-server + 1 doc-test)
- ✅ **Phase 11:** peer discovery (GetPeers exchange), peer persistence (known_peers → peers.json) — 376 testů
- ✅ **Phase 12:** block validation hardening — PoW via header_hex, timestamp sanity, checkpoint enforcement — 385 testů (333 core + 32 CH + 4 miner + 13 pool + 2 pool-server + 1 doc-test)
- ✅ **Phase 13:** chain linkage verification — previous_hash_hex v AcceptedBlock, parent-hash enforcement v import, header cross-check — 393 testů (341 core + 32 CH + 4 miner + 13 pool + 2 pool-server + 1 doc-test)
- ✅ **Phase 14:** RPC model surface alignment — RuntimeTransaction adapter, account/UTXO dual routing
- ✅ **Phase 15:** centralized submit boundary — SubmittedTransaction enum, parse_value, zion1 endpoint rejection
- ✅ **Phase 16:** complete UTXO bridge — submit → validate (hash+signatures) → mempool → template → mine → peer validate → journal → snapshot/restore — 12 nových testů
- ✅ **Phase 17:** UTXO RPC + chain validation — getBalance zion1 support, getUtxos endpoint (16 RPC metod), UTXO input existence check, SpendableUtxo, utxo_set/balance/spendable_utxos/utxo_exists — 374 testů core
- ✅ **Phase 18:** Mempool transaction relay — AnnounceTx P2P message, SeenTransactions dedup (8192 cap), plan_tx_relay(), SubmittedTransaction serde, tx propagation stats, node binary relay wiring (P2P + RPC paths) — 10 nových propagation testů
- ✅ **Phase 18b:** E2E multi-node integration tests — 9 testů: block relay, GetBlocksSince sync, tx relay, AnnounceTx serde roundtrip, three-node chain sync, duplicate block handling, tx→mine→sync, status exchange, network mismatch — 393 testů celkem

**Testnet běží na 157.180.41.213** — node, pool, miner containers UP, chain height 110+.

Zbývající práce pro produkční mainnet:
- ~~UTXO balance RPC endpoint (`getBalance` pro `zion1...` adresy)~~ → ✅ Phase 17
- ~~`getUtxos(address)` RPC endpoint pro external wallety~~ → ✅ Phase 17
- ~~UTXO input existence check (propojení lib.rs bridge s storage.rs UTXO set)~~ → ✅ Phase 17
- ~~Mempool transaction relay (P2P `AnnounceTx`/`GetTx`)~~ → ✅ Phase 18
- ~~E2E multi-node acceptance testy~~ → ✅ Phase 18b
- Block processing lock pro concurrent přístup (deferred — requires splitting read/write paths in msg handlers)
- Full async P2P, CI/CD
