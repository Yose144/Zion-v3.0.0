# ZION 3.1.0 — Pre-Development Audit (Existing Code Inventory)

> **Datum:** 2026-06-27
> **Status:** Audit complete — všechny 4 komponenty už existují, potřebují 3.0.3 fix + completion
> **Cíl:** Zabránit duplikacím — mapovat co máme, co chybí, co potřebuje 3.0.3 fix

---

## Souhrn

| Komponenta | Existuje | 3.0.3 compatible | Co chybí |
|------------|----------|------------------|----------|
| Wallet SDK | ✅ `APP&WEB/zion-wallet-sdk/` | ✅ Fixed (`61ddc587`) | Mobile features (QR, biometrics, BLE) |
| Mobile App | ✅ `APP&WEB/mobile-app/` | ✅ Fixed (`61ddc587`) | QR, biometrics, deep linking, device build |
| TX History RPC | ✅ `getTransactionHistory` v rpc.rs | ✅ Fixed (`77776e48`, Edge deployed) | Address index (optional), height range |
| L4 Oasis | ✅ `V3/L4/oasis/` | ⚠️ Needs audit | Backend completion, UE5 content |

---

## 1. Wallet SDK (`APP&WEB/zion-wallet-sdk/`)

### Co existuje (v1.0.0, 19 source files, 6 test files)

| Modul | Soubor | Status |
|-------|--------|--------|
| Address derivation | `src/core/address.ts` (100 lines) | ✅ zion1 format, SHA-256→RIPEMD-160→base32 |
| Key management | `src/core/keypair.ts` (89 lines) | ✅ BIP39 mnemonic, Ed25519 |
| Encryption | `src/core/crypto.ts` (183 lines) | ✅ AES-256-GCM, PBKDF2 600k iterations |
| Transaction builder | `src/core/transaction.ts` (363 lines) | ✅ UTXO + Account, BLAKE3 hashing |
| RPC client | `src/rpc/zion-rpc.ts` (270 lines) | ✅ JSON-RPC 2.0, failover |
| Wallet manager | `src/wallet/wallet-manager.ts` (465 lines) | ✅ CRUD, encryption, send |
| Storage (Web) | `src/storage/web-storage.ts` | ✅ localStorage |
| Storage (RN) | `src/storage/react-native-storage.ts` | ✅ AsyncStorage |
| Storage (Electron) | `src/storage/electron-storage.ts` | ✅ safeStorage |
| Trezor | `src/hardware/trezor-wallet.ts` (180 lines) | ⚠️ Watch-only |
| Ledger | `src/hardware/ledger-wallet.ts` (174 lines) | ⚠️ Watch-only (Cardano app) |
| Generic HID | `src/hardware/generic-hid-wallet.ts` (123 lines) | ✅ Abstract base |
| Public API | `src/index.ts` (112 lines) | ✅ Exports |

### 3.0.3 Fix — ✅ DONE (commit `61ddc587`)

| Soubor | Co | Status |
|--------|----|--------|
| `src/core/transaction.ts` | `FLOWERS_PER_ZION` 1e12→1e6, `MIN_FEE_FLOWERS` → `1n`, `ACCOUNT_DEFAULT_FEE` → `1n` | ✅ |
| `src/wallet/wallet-manager.ts` | `* 1e12` → `* 1e6`, `/ 1e12` → `/ 1e6` | ✅ |
| `src/rpc/zion-rpc.ts` | `1_000_000_000_000` → `1_000_000` (6 matches) | ✅ |
| `__tests__/ledger-app.test.ts` | Test values updated | ✅ |

### Build status — ✅ DONE

- `npm run build` — ✅ clean compile
- Tests: 35/35 pass (1 pre-existing ledger suite fail — missing optional dep)

### Missing for full mobile integration

- Biometric auth (FaceID/TouchID)
- QR code scan/generate
- BLE hardware wallet transport
- Deep linking (Universal Links / App Links)
- iOS Keychain / Android Keystore storage
- Offline transaction signing
- Push notifications

---

## 2. Mobile App (`APP&WEB/mobile-app/`)

### Co existuje (React Native, 12 screens)

| Screen | Soubor | Status |
|--------|--------|--------|
| Onboarding | `src/screens/OnboardingScreen.js` | ✅ |
| Wallet | `src/screens/WalletScreen.js` | ✅ |
| Send | `src/screens/SendScreen.js` | ✅ |
| Receive | `src/screens/ReceiveScreen.js` | ✅ |
| TX History | `src/screens/TransactionHistoryScreen.js` | ✅ |
| Dashboard | `src/screens/DashboardScreen.js` | ✅ |
| Mining | `src/screens/MiningScreen.js` | ✅ |
| Network | `src/screens/NetworkScreen.js` | ✅ |
| Bridge | `src/screens/BridgeScreen.js` | ✅ |
| DAO | `src/screens/DAOScreen.js` | ✅ |
| AI | `src/screens/AIScreen.js` | ✅ |
| Settings | `src/screens/SettingsScreen.js` | ✅ |

### Context & Services

| Modul | Soubor | Status |
|-------|--------|--------|
| Wallet context | `src/context/WalletContext.js` | ✅ |
| Mining context | `src/context/MiningContext.js` | ✅ |
| Blockchain RPC | `src/services/BlockchainRPC.js` | ✅ 3.0.3 fixed |
| Account builder | `src/services/AccountBuilder.js` | ✅ 3.0.3 fixed |
| Config | `src/constants/config.js` | ✅ (SCALE_FACTOR 1e12 correct for bridge) |
| Blockchain constants | `src/constants/blockchain.js` | ✅ 3.0.3 fixed |

### 3.0.3 Fix — ✅ DONE (commit `61ddc587`)

| Soubor | Co | Status |
|--------|----|--------|
| `src/constants/blockchain.js` | `FLOWERS_PER_ZION`, `ATOMIC_UNITS_PER_ZION`, `BLOCK_REWARD_ATOMIC`, `TAIL_REWARD_ATOMIC` — 1e12→1e6 | ✅ |
| `src/services/BlockchainRPC.js` | `/ 1_000_000_000_000` → `/ 1_000_000` | ✅ |
| `src/services/AccountBuilder.js` | `FLOWERS_PER_ZION`, `* 1e12` → `* 1e6`, `MIN_FEE_FLOWERS` → `1n` | ✅ |
| `src/services/TransactionBuilder.js` | `* 1e12` → `* 1e6` (amount + fee) | ✅ |

**Poznámka:** `config.js` `SCALE_FACTOR: 1e12` je SPRÁVNÉ — to je bridge factor (EVM 18-6=12).

---

## 3. TX History RPC (`V3/L1/core/src/rpc.rs`) — ✅ UTXO + coinbase fix DONE

### Co existuje

| RPC Method | Status | Poznámka |
|------------|--------|----------|
| `getTransactionHistory` | ✅ Fixed (commit `77776e48`, Edge deployed) | ✅ Account + UTXO + coinbase, `tx_model` field |
| `getAddressInfo` | ✅ Existuje | Balance, tx count, UTXO count |
| `getUtxos` | ✅ Existuje | Spendable UTXOs |
| `getBalance` | ✅ Existuje | Account + UTXO hybrid |
| `getBalanceAtHeight` | ✅ Existuje | Historical balance |
| `getTransaction` | ✅ Existuje | Single tx by hash |
| `getAccountTransaction` | ✅ Existuje | Account-model tx |

### ✅ Done — UTXO + coinbase scan (commit `77776e48`)

| Co | Status | Popis |
|----|--------|-------|
| **UTXO txs in getTransactionHistory** | ✅ Done | Scan `block.utxo_transactions`, match output address + derived input address |
| **Coinbase rewards** | ✅ Done | Match `block.miner_address`, include subsidy/reward split |
| **`tx_model` field** | ✅ Done | `"account"` / `"utxo"` / `"coinbase"` v každém tx |
| **Tests** | ✅ Done | 3 nové testy, 47/47 RPC suite |
| **Edge deploy** | ✅ Done | Binary swap, 69,694 txs verified |

### Co zbývá (optional)

| Co | Priorita | Popis |
|----|----------|-------|
| **Address index** | P1 (optional) | `HashMap<String, Vec<(height, tx_hash)>>` v ChainState pro O(1) lookup (linear scan funguje, 69k txs OK) |
| **Height range query** | P2 | `from_height` / `to_height` parametry |
| **Mempool txs** | P2 | Include pending txs v history |
| **Persistent index** | P3 | Disk-persisted address index pro fast startup |

---

## 4. L4 Oasis (`V3/L4/oasis/`)

### Co existuje

#### Rust Backend (22 modules, 25+ REST endpoints)

| Modul | Soubor | Status |
|-------|--------|--------|
| API server | `src/server.rs` | ✅ Axum, 25+ endpoints |
| Player profiles | `src/player.rs` | ✅ XP, achievements |
| Guild system | `src/guild.rs` | ✅ CRUD, membership |
| Territory | `src/territory.rs` | ✅ 8 territories, claim/contest |
| Consciousness | `src/consciousness.rs` | ✅ 9-level Sefirot |
| XP system | `src/xp.rs` | ✅ Daily caps |
| Quests | `src/quests.rs` | ✅ Avatar quest registry |
| Golden Egg | `src/golden_egg.rs` | ✅ 108-clue treasure hunt |
| Combat | `src/combat.rs` | ✅ Turn-based engine |
| Rewards | `src/rewards.rs` | ✅ Prize pool distribution |
| Leaderboard | `src/leaderboard.rs` | ✅ Ranking |
| Challenges | `src/challenges.rs` | ✅ AI quiz |
| Tithe | `src/tithe.rs` | ✅ DAO tracking |
| Raid team | `src/raid_team.rs` | ✅ Group management |
| Metrics | `src/metrics.rs` | ✅ Prometheus |
| WebSocket | `src/websocket.rs` | ⚠️ Hub exists, events not fully wired |
| Rate limit | `src/rate_limit.rs` | ✅ DDoS protection |
| DB | `src/db.rs` | ⚠️ SQLite exists, placeholder data |
| Hiran bridge | `src/hiran_bridge.rs` | ✅ AI integration |

#### UE5 Project (C++ modules + blueprints)

| Modul | Status |
|-------|--------|
| ZionBlockchainBridge | ✅ L1 communication |
| ConsciousnessComponent | ✅ XP tracking |
| GoldenEggManager | ✅ Treasure hunt |
| GuildComponent | ✅ Guild system |
| ZionCharacter | ✅ Player character |
| ZionPlayerController | ✅ Player controller |
| TerritoryManager | ✅ Territory management |
| ZionHUD | ✅ HUD system |
| BP_ZionOasisGameMode | ✅ Game mode |
| LV_MainMenu, LV_World | ⚠️ Empty maps |

#### Documentation (complete)

- `V3/L4/docs/README.md` — overview
- `V3/L4/docs/AVATARS/` — 51 core + 151 extended avatars
- `V3/L4/docs/GAME_SYSTEMS/` — consciousness, golden egg, guilds
- `V3/L4/docs/TECH/` — API spec, UE5 integration

### Co chybí

| Oblast | Co | Priorita |
|--------|----|----------|
| Backend | Wire WebSocket events | P1 |
| Backend | Doplnit data/avatars.json, data/golden_egg.json | P1 |
| Backend | L1 blockchain listener (real-time XP) | P2 |
| Backend | Wallet signature auth | P2 |
| UE5 | Blueprint logic (shells exist) | P2 |
| UE5 | UMG widgets (HUD, quest log, guild panel) | P2 |
| UE5 | 3D assets (MetaHuman, terrain, VFX) | P3 |
| UE5 | Level design (LV_MainMenu, LV_World) | P3 |
| Integration | E2E test UE5 → Rust → L1 | P2 |

---

## 5. Akční plán (3.1.0)

### Fáze 1 — 3.0.3 Compatibility Fix (rychlé)

1. **Wallet SDK:** `1e12`→`1e6` v 6 souborech, build, testy
2. **Mobile App:** `1e12`→`1e6` v 3 souborech (blockchain.js, AccountBuilder.js, BlockchainRPC.js)
3. **Git commit + push**

### Fáze 2 — TX History RPC (střední)

1. Přidat UTXO txs scan do `getTransactionHistory`
2. Test s reálnými UTXO txs na Edge
3. Address index (optional, P1)

### Fáze 3 — L4 Oasis Backend Completion (větší)

1. Wire WebSocket events
2. Doplnit data files (avatars.json, golden_egg.json)
3. L1 blockchain listener
4. Wallet signature auth
5. E2E test

### Fáze 4 — Mobile App Polish (větší)

1. QR code scan/generate
2. Biometric auth
3. Deep linking
4. Build + test na device

---

## Reference

- [`ZION_3.0.3_DECIMAL_FORK_PLAN.md`](ZION_3.0.3_DECIMAL_FORK_PLAN.md) — 3.0.3 fork plan
- [`WEB_V2.9_TO_V3.0.3_UPGRADE.md`](WEB_V2.9_TO_V3.0.3_UPGRADE.md) — web upgrade guide
- [`StatusV3.md`](StatusV3.md) — current status
- [`ROADMAP.md`](ROADMAP.md) — roadmap
- [`ZION_3.0.2_PLAN.md`](ZION_3.0.2_PLAN.md) — L2/L3/L4 plan
