# L1 Testnet → V3 Mainnet Audit

> Vytvořeno: 2026-03-13
> Účel: Kompletní inventář L1 testnet modulů vs V3 mainnet stav.
> Cíl: Zajistit, že nic kritického z testnet nezapomeneme při mainnet pure-code migraci.

---

## Souhrn

| Metrika | L1 testnet | V3 mainnet |
|---|---|---|
| Zdrojové soubory | ~50 `.rs` ve 14 adresářích | ~20 `.rs` ve 4 crates |
| Celkem LoC | ~17 500 | ~8 300 |
| Testy | ~200+ (odhad) | 135 pass, 0 fail, 1 ignored |
| Persistence | LMDB (7 databází) | JSON snapshot + journal |
| Tx model | UTXO (Bitcoin-styl) | Account-styl (zjednodušený) |
| Kryptografie | Ed25519 + BLAKE3 + RIPEMD160 | Pouze Ekam Deeksha hash |
| Adresy | `zion1...` 44 znaků, checksum | Prosté řetězce |

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
| 9 | `mempool/pool.rs` (515 LoC) | HashMap + RwLock, fee-rate sort, double-spend tracking, byte limit 20MB, size limit 10K, eviction, `MempoolError` enum | `Vec<Transaction>` + `HashMap` index, basic dedup, fee-sorted template selection | Double-spend outpoint tracking, byte/count limits, `MempoolError` enum, eviction policy, `restore_transactions()` pro reorg | **VYSOKÁ** |
| 10 | `blockchain/validation.rs` (556 LoC) | 10-step block validation, tx validation, PoW validation, merkle verify, coinbase maturity check, max block size 1MB, timestamp drift ±2h | `DifficultyTarget::allows(&hash)` PoW check, subsidy validation, difficulty LWMA validation | Merkle root verify, tx signature verify, coinbase maturity (100 blocks), block size limit, timestamp drift check, intra-block double-spend, full tx structural validation | **KRITICKÁ** |
| 11 | `p2p/` (celý, ~2100 LoC) | Async tokio TCP, peer manager, connection pool, handshake, sync state machine, flood-fill relay | Sync TCP accept loop, basic Bootstrap catch-up, `GetBlocksSince` | Async networking, connection pool, outbound relay, multi-peer parallel sync, peer scoring, dead peer detection | **VYSOKÁ** |
| 12 | `rpc/` + `jsonrpc/` (~2700 LoC) | Axum HTTP, ~40 JSON-RPC metod, auth middleware, REST + JSON-RPC 2.0 | 7 RPC metod přes line-delimited JSON/TCP | HTTP server, getBalance, getTransaction, sendRawTransaction, getBlock, getBlockTemplate (standard), ~30 dalších metod | **STŘEDNÍ** |
| 13 | `state/mod.rs` (569 LoC) | `Arc<Inner>` shared state, broadcast channels, block processing lock, reorg lock, metrics integration, UTXO ownership validation | `NodeRuntime` s `ChainState`, `CoreRuntime`, `ChainStore` | Broadcast channels pro real-time events, block processing mutex (race condition ochrana), reorg lock, metrics hookup | **VYSOKÁ** |
| 14 | `blockchain/block.rs` (template blob) | `build_template_blob()` 165B hex, `from_template_blob()` parsing, `calculate_merkle_root()` binary Merkle tree | `derive_template_merkle_root()` XOR-fold, `MiningHeader::to_bytes()` 80B | Standardní binární Merkle tree (BLAKE3 hash pairs), standardní template blob format pro external miners | **STŘEDNÍ** |

### ❌ CHYBÍ — V3 nemá vůbec

| # | L1 modul | LoC | Co dělá | Migrace potřeba? | Priorita pro mainnet |
|---|---|---|---|---|---|
| 15 | **`crypto/keys.rs`** | 260 | Ed25519 keypair, `zion1...` address derivace (SHA256→RIPEMD160→base32+checksum), `verify()`, `is_valid_zion1_address()` | **ANO — KRITICKÉ** | 🔴 P0 |
| 16 | **`tx/mod.rs`** (UTXO model) | 189 | `TxInput` (prev_tx, output_index, signature, pubkey), `TxOutput` (amount u128, address, memo), `Transaction` (inputs, outputs, fee, timestamp), `calculate_hash()` (SegWit-style exkluzion signatur), `verify_signatures()` | **ANO — KRITICKÉ** (rozhodnutí UTXO vs Account) | 🔴 P0 |
| 17 | **`wallet/mod.rs`** | 300 | `SpendableUtxo`, `SendParams`, `BuildResult`, `WalletError`, coin selection (largest-first), `build_and_sign()` s `zeroize`, fee estimation | **ANO — KRITICKÉ** | 🔴 P0 |
| 18 | **`wallet/batch.rs`** | 609 | Multi-recipient batch tx (pool payouts), MAX_BATCH_RECIPIENTS=200, MIN_PAYOUT_AMOUNT=10 ZION | **ANO** (pool PPLNS payouty) | 🟡 P1 |
| 19 | **`blockchain/fee.rs`** | 335 | MIN_TX_FEE=1000 (0.001 ZION), fee-rate per byte, `validate_fee()`, `max_coinbase_output()`, 100% fee burn model | **ANO — KRITICKÉ** | 🔴 P0 |
| 20 | **`blockchain/reorg.rs`** | 226 | `rollback_to_height()` s UTXO restore, `find_fork_point()`, `is_stronger_chain()` (most-work wins), cumulative difficulty tracking | **ANO** | 🟡 P1 |
| 21 | **`blockchain/burn.rs`** | 682 | BURN_ADDRESS, DAO_ADDRESS, revenue split (100% DAO), `BuybackTracker`, BTC↔ZION buyback events | **ČÁSTEČNĚ** — burn address a fee model ano, BuybackTracker je L3+ záležitost | 🟡 P1 |
| 22 | **`blockchain/chain.rs`** (reorg rules) | 553 | `MAX_REORG_DEPTH=50`, `SOFT_FINALITY_DEPTH=60`, `total_work` tracking, `try_reorg()` s work comparison, `is_finalized()` | **ANO** (constitutional requirement G6: max 10-block reorg) | 🟡 P1 |
| 23 | **`storage/lmdb.rs`** | 1136 | LMDB persistent storage, 7 databází (blocks, utxos, tx_index, balance_cache, undo_blocks, height↔hash), atomic save, schema migration | **ANO** (JSON snapshot nestačí pro mainnet) | 🟡 P1 |
| 24 | **`p2p/security.rs`** | 597 | `RateLimiter` (per-IP), `Blacklist` (perm+temp), `ConnectionLimiter`, `MessageRateLimiter` (escalating bans 5m→30m→2h) | **ANO** | 🟡 P1 |
| 25 | **`p2p/sync.rs`** | 276 | IBD state machine (IBD_THRESHOLD=50 blocks behind), batch sync (500 blocks), stall detection (120s timeout, 3 retries), `SyncStatus` tracking | **ANO** | 🟡 P1 |
| 26 | **`p2p/peers.rs`** | 282 | `PeerManager` (scoring, banning, connection tracking, diversity checks) | **ANO** | 🟡 P1 |
| 27 | **`metrics/core_metrics.rs`** | 328 | Atomic counters (blocks, txs, mempool, peers, timing), Prometheus export, health reporting | **NE PRO MVP** | 🟢 P2 |
| 28 | **`p2p/discovery.rs`** | 166 | Peer exchange, DNS seed refresh | **NE PRO MVP** | 🟢 P2 |
| 29 | **`p2p/checkpoint.rs`** | 175 | Known-hash checkpoints pro fast initial sync | **NE PRO MVP** | 🟢 P2 |
| 30 | **`p2p/heartbeat.rs`** | 129 | Keepalive ping/pong, dead peer detection | V3 má Ping/Pong varianty | 🟢 P2 |
| 31 | **`p2p/persistence.rs`** | 131 | Peer list persistence na disk | **NE PRO MVP** | 🟢 P2 |
| 32 | **`security_audit.rs`** | 715 | Runtime security checks (dev tooling) | **NE** | ⚪ Skip |
| 33 | **`load_test*.rs`** | 617 | Load testing utilities | **NE** | ⚪ Skip |
| 34 | **`bin/generate-premine-wallets.rs`** | 321 | Jednorázový utility | **NE** | ⚪ Skip |
| 35 | **`algorithms/`** (multi-algo) | 1249 | RandomX, Yescrypt, Blake3, VerusHash + dispatch | **NE** — V3 záměrně single-algo (Ekam Deeksha) | ⚪ Skip |

---

## Klíčové architektonické rozdíly

### 1. Transakční model: UTXO vs Account

| Aspekt | L1 (UTXO) | V3 (Account) |
|---|---|---|
| Struktura | `TxInput{prev_tx, output_index, sig, pubkey}` + `TxOutput{amount, address, memo}` | `Transaction{tx_id, from, to, amount_zion, fee_zion, nonce}` |
| Amount typ | `u128` (flowers) | `u64` (ZION celé jednotky) |
| Podpisy | Ed25519 per-input, SegWit-style (sig excluded z hash) | Žádné podpisy v V3 |
| Double-spend | UTXO consumption (spent = smazáno) | Nonce-based (Ethereum-style) |
| Change | Explicitní change output | Implicitní (account balance) |

**Rozhodnutí potřeba:**
- **Možnost A — UTXO (jako L1):** Portovat `tx/`, `wallet/`, `storage/` UTXO management. Kompatibilní s existujícím testnete. Složitější, ale battle-tested.
- **Možnost B — Account (zůstat):** Jednodušší kód, ale nekompatibilní s L1 testnet daty. Potřeba navrhnout nový wallet + state model.
- **Doporučení:** UTXO — konzistentní s constitucí, testnete, a kryptografickým modelem L1.

### 2. Kryptografie

| Aspekt | L1 | V3 |
|---|---|---|
| Hashing | BLAKE3 (obecné) + CosmicHarmony (PoW) | Pouze Ekam Deeksha (PoW i obecné) |
| Podpisy | Ed25519 (`ed25519_dalek`) | ❌ Žádné |
| Address derivace | SHA256 → RIPEMD160 → base32 + checksum → `zion1...` (44 znaků) | ❌ Žádná |
| Key management | Ed25519 keypair gen, sign/verify | ❌ Žádné |

**Rozhodnutí potřeba:**
- BLAKE3 pro obecné hashování (tx hash, merkle root) vs Ekam Deeksha?
- Ed25519 je de facto standard, portovat as-is.
- Address format `zion1...` je frozen na testnetu, portovat identicky.

### 3. Persistence

| Aspekt | L1 | V3 |
|---|---|---|
| Engine | LMDB via `heed` | JSON soubory |
| Databáze | 7 (blocks, utxos, tx_index, balance_cache, undo_blocks, height↔hash) | 1 snapshot + journal |
| Atomic ops | `save_block_and_apply_utxos()` — single LMDB transaction | `serde_json::to_string_pretty()` |
| Capacity | 10 GB LMDB map (konfigurovatelné) | Lineárně roste s řetězcem |

**Rozhodnutí potřeba:**
- LMDB je produkční standard. Pro mainnet nutné.
- JSON snapshot funguje pro prototyp/testnet ale neskaluje.

### 4. Fee model

L1 má explicitní 100% fee burn model:
- `MIN_TX_FEE = 1_000` (0.001 ZION)
- `MIN_FEE_RATE = 1` atomic/byte
- `MAX_TX_SIZE = 100_000` bytes
- `MAX_OUTPUT_AMOUNT = 144B × 10^12` (total supply cap)
- Coinbase = reward only; fees are destroyed.

V3 aktuálně:
- `Transaction.fee_zion: u64` existuje ale bez enforcement
- Template fee sort existuje ale bez minimální fee validace
- Žádný fee burn mechanismus

### 5. Reward distribution

L1 má 4-way split:
```
MINER_SHARE:     89%
TITHE:            5% (humanitarian)
ISSOBELLA_FUND:   5% (L5/L6)
POOL_FEE:         1%
```

V3 aktuálně: 100% miner (subsidy = miner_reward).

**Rozhodnutí potřeba:** Implementovat 4-way split v V3? Nebo je to L3+ záležitost?

---

## Audit-Fix reference z L1

Tyto opravy z bezpečnostního auditu L1 MUSÍ být zahrnuty do V3:

| Audit ID | Popis | L1 soubor | Relevance pro V3 |
|---|---|---|---|
| **P0-05** | Atomic block+UTXO save (prevent partial writes) | `storage/lmdb.rs` | Kritické — V3 JSON save není atomic |
| **P0-07** | Fork choice: most-work wins, removed 90% tertiary | `reorg.rs` | V3 nemá fork choice vůbec |
| **P0-08** | Block processing lock (prevent race condition) | `state/mod.rs` | V3 `NodeRuntime` je single-threaded, ale pro async potřeba |
| **P0-09** | Atomic save_block_and_apply_utxos | `storage/lmdb.rs` | Viz P0-05 |
| **P1-01** | Chain: strictly more work wins (`>` not `>=`) | `chain.rs` | V3 nemá total_work tracking |
| **P1-06** | `try_reorg_unchecked` only in test/dev | `chain.rs` | V3 nemá reorg |
| **P1-10** | Escalating ban durations (5m→30m→2h) | `p2p/security.rs` | V3 nemá banning |
| **P1-15** | Mempool byte size limit (20 MB) | `mempool/pool.rs` | V3 mempool nemá byte limit |
| **P1-16** | Deprecated `add_transaction` bez validace | `mempool/pool.rs` | V3 by nemělo mít nevalidovaný vstup |
| **P1-17** | Secret key `zeroize` after signing | `wallet/mod.rs` | V3 nemá wallet |

---

## Doporučený implementační plán

### Fáze A — Kryptografický základ (P0, blokuje vše ostatní)

| Krok | Modul | Zdroj | Odhad LoC | Výstup |
|---|---|---|---|---|
| A1 | `crypto.rs` — BLAKE3 hash, Ed25519 verify, `zion1...` address derivace + validace | `L1/core/src/crypto/` | ~300 | Adresy a podpisy fungují |
| A2 | `tx.rs` — UTXO transakční model: `TxInput`, `TxOutput`, `Transaction`, `calculate_hash()`, `verify_signatures()` | `L1/core/src/tx/` | ~250 | Transakce mají strukturu a validaci |
| A3 | `fee.rs` — Fee model: MIN_TX_FEE, fee-rate, fee burn, `validate_fee()` | `L1/core/src/blockchain/fee.rs` | ~200 | Fee enforcement |

### Fáze B — Wallet a validace (P0, blokuje testnet operace)

| Krok | Modul | Zdroj | Odhad LoC | Výstup |
|---|---|---|---|---|
| B1 | `wallet.rs` — UTXO selection, `build_and_sign()`, `SendParams`, `BuildResult` | `L1/core/src/wallet/` | ~350 | Lze posílat transakce |
| B2 | `validation.rs` — Full block validation (10-step), tx validation, coinbase maturity | `L1/core/src/blockchain/validation.rs` | ~400 | Blokchain je kryptograficky bezpečný |
| B3 | Integrace do `lib.rs` — `validate_peer_block` používá plnou validaci, `Transaction` → UTXO model | lib.rs | ~200 | Vše propojené |

### Fáze C — Chain safety (P1, blokuje mainnet)

| Krok | Modul | Zdroj | Odhad LoC | Výstup |
|---|---|---|---|---|
| C1 | `reorg.rs` — Chain reorg s UTXO rollback, MAX_REORG_DEPTH, fork choice (most-work) | `L1/core/src/blockchain/reorg.rs` + `chain.rs` | ~400 | Řetěz přežije fork |
| C2 | Mempool hardening — double-spend tracking, byte limits, fee-rate eviction | `L1/core/src/mempool/` | ~300 | Mempool odolný vůči spam |
| C3 | P2P security — RateLimiter, Blacklist, ConnectionLimiter, MessageRateLimiter | `L1/core/src/p2p/security.rs` | ~400 | DoS ochrana |
| C4 | `batch.rs` — Multi-recipient payouty (pool) | `L1/core/src/wallet/batch.rs` | ~300 | Pool PPLNS payouty |

### Fáze D — Produkční infrastruktura (P1-P2, blokuje produkční mainnet)

| Krok | Modul | Zdroj | Odhad LoC | Výstup |
|---|---|---|---|---|
| D1 | Storage — LMDB (blocks, utxos, tx_index, undo_logs, balance_cache) | `L1/core/src/storage/` | ~800 | Produkční persistence |
| D2 | P2P sync — IBD state machine, batch download, stall detection | `L1/core/src/p2p/sync.rs` | ~300 | Nový node se synchronizuje |
| D3 | RPC rozšíření — HTTP server, getBalance, getBlock, sendRawTransaction | `L1/core/src/jsonrpc/` | ~500 | Wallet a explorer API |
| D4 | Peer manager — scoring, banning, connection tracking, diversity | `L1/core/src/p2p/peers.rs` | ~300 | Zdravý P2P overlay |
| D5 | Metrics — atomic counters, Prometheus export, health checks | `L1/core/src/metrics/` | ~300 | Monitoring |

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
FLOWERS_PER_ZION        = 1_000_000_000_000
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

### Chain safety (V3 CHYBÍ ❌)
```
MAX_REORG_DEPTH         = 50 (L1) / 10 (constitutional)
SOFT_FINALITY_DEPTH     = 60
COINBASE_MATURITY       = 100 blocks
MAX_BLOCK_SIZE          = 1_048_576 bytes (1 MB)
MAX_TIMESTAMP_DRIFT     = 7_200 s (2 hours, mainnet)
```

### Fee model (V3 CHYBÍ ❌)
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

### Reward distribution (L1 — V3 TBD)
```
MINER_SHARE      = 89%
TITHE            = 5%  (humanitarian DAO)
ISSOBELLA_FUND   = 5%  (L5/L6 development)
POOL_FEE         = 1%
```

### Mempool (V3 částečně)
```
MAX_MEMPOOL_SIZE         = 10_000 txs
MAX_MEMPOOL_BYTES        = 20_971_520 (20 MB)
```

### P2P security (V3 CHYBÍ ❌)
```
Rate limiter:    per-IP connection rate
Blacklist:       permanent + temporary bans
Connection limit: global max connections
Message limiter: escalating bans (300s → 1800s → 7200s)
IBD_THRESHOLD:   50 blocks behind = enter IBD mode
IBD_BATCH_SIZE:  500 blocks per request
IBD_STALL:       120s timeout, 3 retries
```

### Burn addresses (V3 CHYBÍ ❌)
```
BURN_ADDRESS = "zion1burn0000000000000000000000000000000dead"
DAO_ADDRESS  = "zion1dao00000000000000000000000000000treasury"
```

---

## Závěr

V3 je čistý mainnet základ s dobrým pokrytím **consensus** (emission, difficulty, genesis, PoW).

Kritické mezery pro produkční mainnet jsou:
1. **Kryptografický základ** — Ed25519, BLAKE3, `zion1...` adresy
2. **Transakční model** — rozhodnutí UTXO vs Account, pak implementace
3. **Block/Tx validace** — bez ní je řetěz důvěryhodný
4. **Wallet** — bez něj nelze posílat transakce
5. **Fee model** — bez něj může kdokoli spamovat mempool

Tyto 5 bodů blokují jakékoli reálné testnet/mainnet nasazení.
Zbylé mezery (reorg, storage, P2P security, metrics) jsou důležité pro produkci,
ale můžou jít po vyřešení základu.
