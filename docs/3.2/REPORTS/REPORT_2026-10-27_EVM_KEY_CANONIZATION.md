# REPORT — V2 Key Canonization (2026-10-27) — COMPLETE

Kanonizace `V31_PREMINE_V2_KEYS_2026-08-06.json` (genesis reset 6. 8.) napříč všemi
vrstvami ekosystému. Audit → oprava souboru → config rotace → on-chain rotace → revoke.

## 1. Audit V2 souboru — 36/36 záznamů konzistentních

- 14 premine / 5 canonical / 3 admin / 7 guardians / 5 evm_validators / 1 escrow
- Ed25519: mnemonic → BIP39 seed → BLAKE3 → sk → pk → zion1 addr (custom base32+cksum) ✅
- EVM: mnemonic → BLAKE3(seed||"evm") → secp256k1 sk → adresa ✅
- 0 duplicit (addr/sk/mnemonic napříč souborem); premine pokrývá všech 14 kanonických
  `PREMINE_OUTPUTS` slotů; admin = canonical `ADMIN_L1_ADDRESSES` 3-of-3.
- Verifier: `/tmp/verify_keys.py` → **39/39 PASS**.

### Oprava souboru (commitnuto do working copy, gitignored)
`gen-all-keys-mnemonic.rs::keccak256()` je SHA-256 **stub** → `evm_address` pole byla
nefunkční sha256-placeholdery. Opraveno:
- `evm_address` = reálná `keccak256(pk_u)[-20:]` (EIP-55)
- `evm_address_legacy_sha256` = původní hodnota (= `v3_compat::ADMIN_*_EVM_ADDRESS`,
  jen L1 metadata — nikde ecrecover, konstanty ponechány)
- `evm_validators.validator_1` → `role: "evm_contract_admin"` + `_meta` záznamy
- Backup: `.bak-pre-keccak`

## 2. Kanonický admin: `evm_validators.validator_1`

| | |
|---|---|
| EVM adresa | `0x13D06bEfcd28A06616C3CE2C6C7F5cdE5f02BB2b` |
| Backup | 24-slovní mnemonic + `evm_secret_key_hex` v souboru |

## 3. On-chain audit (Base mainnet) — před rotací

Jediný starý klíč `0xdde17506…` (= `/etc/zion/keys/validator.key`, generace 6. 7.)
držel `DEFAULT_ADMIN`/`owner()`/`GUARDIAN_ROLE` na **všech** kontraktech.

## 4. Rotace — 35 transakcí, všechny on-chain verified

### Fáze 1 — admin granty → V2 validator_1 (10 tx)
| Kontrakt | Operace | Tx |
|---|---|---|
| wZION `0x0c49…` | grantRole DEF_ADMIN | `0x9c22daac…` |
| ZIONBridge `0x72c8…` | grantRole DEF_ADMIN | `0x6b3f7fe8…` |
| ZIONStaking `0xbd5c…` | grantRole DEF_ADMIN | `0x76231c2c…` |
| ZIONFarm `0x167B…` | grantRole DEF_ADMIN | `0x4b30960a…` |
| AtomicSwap `0x3DE9…` | grantRole DEF_ADMIN | `0x9ce3ca3f…` |
| ArtifactNFT `0x70f1…` | grantRole DEF_ADMIN | `0xfc84f4e2…` |
| ArtifactNFT | grantRole MINTER | `0x8cacd6d1…` |
| Marketplace `0x5965…` | grantRole DEF_ADMIN | `0x64b1754d…` |
| ZIONGovernance `0xB77e…` | transferOwnership | `0x6bd9337f…` |
| ZIONTreasury `0x455f…` | transferOwnership | `0x217e9fb1…` |

### Fáze 2 — ZIONBridge validator set (11 tx + fund)
ZIONBridge má **interní validator registry** — `BridgeValidator` kontrakt
(`0x9C138dC6…`, 5-of-5) je samostatný pomocný multisig, immutable
(`removeGuardian` vyžaduje `count > threshold` → nelze rotovat; volitelný redeploy).

- fund v1 gas: `0xadb4630e…` (0.00008 ETH)
- `addValidator` ×5 V2: `0xb2377230…`, `0x649ff1b5…`, `0x398650e0…`, `0x3706e73e…`, `0x2408fc9c…`
- `updateThreshold(3)`: `0xa502178b…`
- `removeValidator` ×5 old: `0xa992638e…`, `0x1e135eca…`, `0x8ba4db6b…`, `0xd8a5e0d2…`, `0x27b3501a…`
- `grantRole(GUARDIAN_ROLE, v1)`: `0xbfa43da9…`
- **Final: threshold 3, count 5, VALIDATOR 5/5 V2 + 0/5 old** (verified `eth_call`)

### Fáze 3 — revoke starého `0xdde17…` (14 tx)
wZION DEF_ADMIN+BRIDGE+GUARDIAN `0x9ec7b0ed…`/`0x3ca60c7f…`/`0xb2d4fc21…`;
Bridge DEF_ADMIN+GUARDIAN `0x08fddc36…`/`0xa078f55f…`;
Staking `0x6a8f4d68…`/`0x4f6a81d7…`; Farm `0x44d13f46…`/`0xb6238236…`;
AtomicSwap `0xbef44064…`/`0x03b4078b…`; NFT DEF_ADMIN+MINTER `0x4f8f7bd2…`/`0x7fa76412…`;
Marketplace DEF_ADMIN `0x8637976f…`.
**`0xdde17…` má 0 rolí** — plně vyřazen z EVM vrstvy.

## 5. Config rotace (EDGE2)

- `/etc/zion/dao-mainnet.toml` + `config/` → **V2 guardians** (7/7, pk↔addr verify);
  `zion-v31-dao` restart → `GET /api/dao/guardians` = V2 set, 5-of-7 ✅
- `/etc/zion/edge-environment.sh`: `ZION_SWAP_ESCROW_KEY` → V2 escrow;
  `ZION_BRIDGE_VALIDATOR_PUBKEYS` → 5× V2 compressed secp256k1 pk;
  `zion-v31-node` restart (L1 allowlist live V2)
- `bridge-mainnet.toml` + `config/`: `validator_addresses` → 5× V2 keccak;
  `/etc/zion/keys/validator.key` → V2 validator_1 sk (fp `447a548e09ea`, backup `.bak-v2canon-*`)
- repo `PUBLIC/V3/L2/dao/config/dao-mainnet.toml` → V2 set (PUBLIC je gitignored)
- Zálohy všech upravených: `*.bak-v2canon-20261027-105051`

## 6. Finální mapa

| Vrstva | Stav |
|---|---|
| L1 premine / admin 3z3 / canonical | ✅ V2 canonical |
| DAO guardians 5z7 | ✅ V2 live |
| L1 bridge validator allowlist | ✅ V2 |
| Swap escrow | ✅ V2 |
| V2 soubor (EVM adresy) | ✅ keccak opraveno |
| Base — admin 9 kontraktů | ✅ V2 validator_1 |
| Base — bridge validators | ✅ 3-of-5 V2 |
| Starý `0xdde17…` | ✅ 0 rolí všude |

## 7. WARP relay canonizace (EDGE2, `zion-v31-multichain`)

`/etc/zion/edge-environment.sh` (backup `.bak-warpv2-20261027`):

| Env | Před | Po |
|---|---|---|
| `WARP_EVM_RELAY_KEY` | `0xdde17…` (starý deployer — **revokován všude**) | V2 validator_1 evm sk (`0x13D06bEf…`) |
| `WARP_VALIDATOR_KEYS` | 1× `val1:` ed25519 (stará generace) | `val1..val5:` V2 ed25519 sks (odvozeno z V2 mnemoniců, blake3 seed) |
| `WARP_L1_RELEASE_KEYS` | unset | **zůstává unset** — manual release mode by design; při zapnutí auto-release použít ≥3 V2 evm sks (L1 allowlist = V2 cpks, threshold 3) |

`warpd` restartován: čistý boot, watchers base+zion-l1 registrovány, inbound releaser v
manual módu. POZOR: `execute_burn_release` v legacy `zion_l1.rs` adapteru podepisuje
unlock proof přes `WARP_EVM_RELAY_KEY` — dřív by jeho pubkey odmítla L1 allowlist;
teď = V2 allowlist člen ✅.

## 8. Non-Base chainy — inventura + částečná rotace

Kontrakty `wZION 0x0c49…` + `ZIONBridge 0xa5a09b2C…` nasazené na 5 chainech (deterministic
adresy). Stav před rotací: všude threshold 5, validators 5 (starý set), starý `0xdde17…`
má `DEF_ADMIN+GUARDIAN+VALIDATOR` na bridge a `DEF_ADMIN+GUARDIAN` na wZION; v1 nic.

| Chain | Gas old | Gas v1 | Stav rotace |
|---|---|---|---|
| BSC (56) | 0.000010 | 0 | 🔴 blokováno fundingem |
| **Polygon (137)** | 0.166→0.036 | 0 | 🟡 **částečně** — Phase 1 ✅ (v1 má DEF_ADMIN+GUARDIAN na bridge+wZION), addValidator 4/5 ✅ (v1-v4); threshold 5, count 9. Došel gas. |
| Arbitrum (42161) | 0.000002 | 0 | 🔴 blokováno |
| Optimism (10) | 0.000004 | 0 | 🔴 blokováno |
| Avalanche (43114) | 0.000007 | 0 | 🔴 blokováno |

Polygon tx (verified): grants `0x583d74bb…`, `0x3a00f8a2…`, `0xb76598c2…`, `0x19c66730…`;
addValidator `0x2de0c0fd…`, `0x79be25b3…`, `0x2bd358c4…`, `0x190c3ae9…`.

### 👤 Funding potřebný k dokončení

| Chain | Fund | Částka | Pak |
|---|---|---|---|
| Polygon | v1 `0x13D06bEf…` | ~0.15 POL | v1 dokončí: addValidator(v5), threshold(3), remove×5, revoke old (v1 už má DEF_ADMIN) |
| BSC | old `0xdde17…` | ~0.003 BNB | celá rotace executorem old vč. self-revoke |
| Arbitrum | old `0xdde17…` | ~0.0005 ETH | stejně |
| Optimism | old `0xdde17…` | ~0.0005 ETH | stejně |
| Avalanche | old `0xdde17…` | ~0.05 AVAX | stejně |

Script: `/opt/zion/APP&WEB/MarketPlace/rotate_poly.mjs` na EDGE2 (parametrizovatelný,
state-polling místo receiptů — publicnode blokuje receipt archivy).

## 9. Zbývá / poznámky

- **Provozní klíče** `MINTER_PRIVATE_KEY`→`0xbF82…` (NFT minter), `WALLET_SEED_KEY`→`0x9469…`
  zůstávají — service keys, ne governance; rotace = 👤 rozhodnutí (nové canonical entries).
- **BridgeValidator `0x9C13…`** — legacy immutable multisig; volitelný redeploy 3-of-5.
- **`gen-all-keys-mnemonic.rs`** — `keccak256()` stub opraven na `sha3::Keccak256` ✅
  (budoucí generace už budou mít reálné EVM adresy). Verifier v repu: `scripts/ops/verify_v2_keys.py`.
- Starý `validator.key.bak-v2canon-*` na EDGE2 = archiv; V2 klíče jsou jediný kanonický zdroj.
