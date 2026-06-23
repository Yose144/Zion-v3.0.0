# fixL1bridge100m.md — L1 Bridge 100M ZION Recovery Report

> **Datum:** 2026-06-23 (finalizováno — dokumentace kompletní)
> **Status:** ✅ 100M ZION UTXO locks potvrzeny (6 TX, bloky 11611–11612). ✅ Memo bug opraven. ⚠️ Zbývá: validator privátní klíč pro mint ~100M wZION na Base.
> **Autor:** Devin (user-approved L1 change per AGENTS.md)

---

## 1. Cíl

Převést 100M ZION z Bridge Vault UTXO Seed (`zion1r565v3k2u8p8t6n494p0n527c0m7a5s4s5ae0x7`, genesis slot 14) na L1 bridge vault (`zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0`), aby bridge relay mohl zamintovat 100M wZION na Base mainnet (`0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`) pro DEX likviditu.

---

## 2. Architektura bridge vaultu

### Bridge vault je KEYLESS adresa

- **Seed:** `"ZION Bridge Vault V3 Mainnet v2_2026-06-03-GENESIS-RESET"`
- **Derivace:** `derive_keyless_address(seed)` → SHA-256 → checksum
- **Adresa:** `zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0`
- **Žádný private key neexistuje.** Nikdo nemůže utratit UTXO přímo.
- **UTXO odemykání:** Pouze přes `submitBridgeUnlock` RPC s 5/5 validator multisig proofy.

### Důsledek
- **Account-model ZION odeslaný na vault = trvale uvízlý.** Kód to říká jasně: *"account-model tx to the vault will not create a bridge lock event and is effectively unspendable"* (`V3/L1/core/src/bin/fund-bridge-vault.rs`).
- **UTXO ZION na vault = spendable** přes validator multisig unlock, nebo mintnut jako wZION přes bridge relay.

---

## 3. Co se skutečně stalo — chronologie

### Transfer #1: 100 ZION account-model (UVÍZLÝ — testovací částka)
- **Z:** Bridge Seed Fund (`zion13794...`)
- **Na:** Bridge vault (`zion1w0r0...`)
- **Typ:** Account-model transaction
- **Částka:** **100 ZION** (ne 100M!)
- **Block:** 11313
- **TxID:** `e6548e7ce5ff88377627773c796a6a7e3b644b688367737ef08f9dae9910050a`
- **Výsledek:** ❌ UVÍZLÝ — account-model na keyless vault nelze utratit

### Transfer #2: 100 ZION account-model (UVÍZLÝ — testovací částka)
- **Z:** Bridge Seed Fund (`zion13794...`)
- **Na:** Bridge vault (`zion1w0r0...`)
- **Typ:** Account-model transaction
- **Částka:** **100 ZION**
- **Block:** 11323
- **TxID:** `956e394eb5fc88377627773c796a6a7e3b644b688367737e9c39a9ae9910050a`
- **Výsledek:** ❌ UVÍZLÝ

### Transfer #3: 100 ZION UTXO lock (FUNKČNÍ TEST — bez memo)
- **Z:** Bridge Vault UTXO Seed (`zion1r565...`)
- **Na:** Bridge vault (`zion1w0r0...`)
- **Typ:** UTXO transaction
- **Částka:** **100 ZION**
- **Block:** 11324
- **TxID:** `8eb0bb8cf048f0afdd5b319f2799935b7b4dd6c2e4068ad48a39ed889a4571f5`
- **Memo:** ❌ CHYBÍ — `zion wallet send --memo` přijal flag ale silently ho zahodil
- **Výsledek:** ✅ Relay detekoval lock, použil `default_evm_recipient` fallback

### Transfer #4–#9: 6× UTXO lock po ~16.67M ZION s memo (HLAVNÍ RECOVERY)
- **Z:** Bridge Vault UTXO Seed (`zion1r565...`, genesis slot 14)
- **Na:** Bridge vault (`zion1w0r0...`)
- **Typ:** UTXO transaction
- **Částka:** 5× 16,666,666 ZION + 1× 16,666,569 ZION = **~100M ZION celkem**
- **Memo:** `BRIDGE:base:0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`
- **Block:** 11611–11612
- **TxID:**
  - `6bc2aa3e2879dfb3d98b35b1a09d7abee8fa9e5f3092a464c0679e84d6519ef4` (16,666,666)
  - `d9ddb3c7aaf2ad3a320c2878a1822298ec438240d9a9ffdbca95d256ec637cdb` (16,666,666)
  - `09fc9abb00c5b95e797709259731313afca5e0cc4a14f6687351e9295c1c6bc1` (16,666,666)
  - `2cd12d90b10b3ce7218a17dd804d36ad9c8d5870f42e27132c91c33e92f8458e` (16,666,666)
  - `4b43e7a3623ec3d4c007c134bd831a21d6628195643c1d6a33a889324fecfe59` (16,666,666)
  - `035c761db8a7e9d847ff56a8d8f8d7b37703631fac2b64453fb02fb20a1ef691` (16,666,569)
- **Výsledek:** ✅ Relay detekoval všech 6 locků, čeká 60 blocků finality

### Proč jen 100 ZION v testovacích transferech?
- `bridge-send.sh` použil `--amount 100` místo `--amount 100000000`
- Genesis UTXO vstup = 16,666,566 ZION (1 z 6 outputů)
- 100 ZION šlo na vault, zbytek se vrátil jako change

### Proč nelze poslat 100M v jednom UTXO?
- 100M ZION = 1e20 flowers
- `u64::MAX` = ~1.8e19
- **Přeteče u64.** Genesis to vyřešil rozdělením 100M na 6 outputů po ~16.67M ZION.
- Pro 100M UTXO lock je potřeba **6 transakcí** po ~16.67M ZION, každá s memo.

---

## 4. Root cause analýza

### Bug #1: `zion wallet send --memo` ignoroval memo pro UTXO
- **Soubor:** `V3/L1/core/src/wallet.rs`
- `SendParams` struktura neměla `memo` field
- `build_and_sign()` hardcodoval `memo: None` na každý output
- **Soubor:** `V3/cli/src/commands/wallet.rs`
- CLI přijal `--memo` flag, vypsal ho do konzole, ale nepředal ho do `SendParams`

### Bug #2: Account-model transfer na keyless vault
- `fund-bridge-vault.rs` poslal account-model tx na vault
- Kód sám varuje: *"account-model tx to the vault will not create a bridge lock event and is effectively unspendable"*
- 200 ZION trvale uvízlo (testovací částky, ne 100M)

### Bug #3: Bridge relay neměl fallback recipient
- Když UTXO lock neměl memo, relay ho silently přeskočil
- Neexistoval mechanismus pro recovery locků bez memo

---

## 5. Opravy provedené

### Fix A: L1 memo support (user-approved per AGENTS.md)

**Soubory změněné:**
- `V3/L1/core/src/wallet.rs` — přidán `memo: Option<String>` do `SendParams`, thread do primary output `build_and_sign()`
- `V3/cli/src/commands/wallet.rs` — `--memo` se nyní předává do `SendParams`
- `V3/sdk/src/wallet.rs` — default `memo: None` v existující helper funkci
- `V3/L1/core/src/bin/wallet.rs` — default `memo: None` v `cmd_send`

**Commit:** `20379ec4 feat(L1): add memo support to UTXO SendParams + build_and_sign`

**Verifikace:**
```
cargo test --manifest-path V3/Cargo.toml -p zion-core --lib wallet
→ test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured
```

### Fix B: CLI account-model fallback block

**Soubory změněné:**
- `V3/cli/src/commands/wallet.rs` — když `--memo` je poskytnuto a neexistují spendable UTXO, odmítne account-model fallback

**Commit:** `50dbb7ba fix(cli): block memo sends from falling back to account-model`

### Fix C: L2 bridge relay default_evm_recipient fallback

**Soubory změněné:**
- `V3/L2/bridge/src/config.rs` — přidán `default_evm_recipient: Option<String>` do `L1Config`
- `V3/L2/bridge/src/l1_watcher.rs` — když lock nemá memo a `default_evm_recipient` je nastaven, mintne wZION na default adresu s warningem
- `V3/L2/bridge/config/bridge-mainnet.toml` — `default_evm_recipient = "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186"`
- `V3/config/bridge-mainnet.toml` — stejné

**Commit:** `89873dfb feat(bridge): add default_evm_recipient fallback for locks without memo`

### Fix D: Bridge relay start_block_height + L1 RPC

**Soubory změněné:**
- `V3/L2/bridge/src/main.rs` — `last_l1_height` se inicializuje z configu `start_block_height` když je DB prázdná
- `V3/L2/bridge/config/bridge-mainnet.toml` — `start_block_height = 11300`

**Commit:** `f87adc9a fix(bridge): start L1 scan from recent block and wire config start_block_height`

---

## 6. Aktuální stav bridge vaultu (2026-06-23)

| Typ | Částka | Stav | Poznámka |
|-----|--------|------|----------|
| Account-model ZION (Transfer #1) | 100 ZION | ❌ UVÍZLÝ | Testovací částka |
| Account-model ZION (Transfer #2) | 100 ZION | ❌ UVÍZLÝ | Testovací částka |
| UTXO lock (Transfer #3, bez memo) | 100 ZION | ✅ Relay zpracovává | `default_evm_recipient` fallback |
| UTXO lock (Transfer #4, s memo) | 16,666,666 ZION | ✅ Čeká na finality | Block 11611 |
| UTXO lock (Transfer #5, s memo) | 16,666,666 ZION | ✅ Čeká na finality | Block 11611 |
| UTXO lock (Transfer #6, s memo) | 16,666,666 ZION | ✅ Čeká na finality | Block 11611 |
| UTXO lock (Transfer #7, s memo) | 16,666,666 ZION | ✅ Čeká na finality | Block 11611 |
| UTXO lock (Transfer #8, s memo) | 16,666,666 ZION | ✅ Čeká na finality | Block 11612 |
| UTXO lock (Transfer #9, s memo) | 16,666,569 ZION | ✅ Čeká na finality | Block 11612 |
| **Celkem UTXO s memo** | **~100M ZION** | ✅ Lock detekován | Čeká na finality + validator key |

### Stav zdrojových adres

| Adresa | Role | Account balance | UTXO balance |
|--------|------|----------------|--------------|
| `zion13794...` | Bridge Seed Fund (slot 13) | ~400M ZION | 0 |
| `zion1r565...` | Bridge Vault UTXO Seed (slot 14) | ~100M ZION | 0 (vše odesláno) |
| `zion1w0r0...` | Bridge vault (keyless) | ~316 ZION (uvízlý) | ~100M ZION (locky) |

---

## 7. Bloker: Validator privátní klíč

Relay hlásí:
```
Failed to handle L1 lock: Cannot stat key file "keys/validator.key": No such file or directory
```

### Co je potřeba
- **EVM privátní klíč** pro `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186` (validator-1 / deployer)
- Klíč může být předán přes:
  1. Env var `ZION_VALIDATOR_PRIVATE_KEY=0x...` (preferováno pro kontejnery)
  2. Soubor `keys/validator.key` s oprávněním `0o600`

### Stav hledání klíče
- Edge server: `.bash_history` prázdný, žádné `.env` s klíčem, žádný `validator.key`
- Lokální PC: `secrets/BRIDGE_VALIDATOR_KEYS_ENCRYPTED_2026-06-03.txt` obsahuje **placeholder klíče** (ne reálné)
- Foundry keystore: prázdný
- PowerShell history: žádná stopa po `PRIVATE_KEY=0x...`
- Předchozí Devin session: klíč byl použit jako env var pro deploy, ne persistován

### Akce potřebná
- **Uživatel musí poskytnout reálný privátní klíč** pro `0xdde17506...`
- Alternativa: vygenerovat nový validator key, aktualizovat `BridgeValidator.sol` contract na Base

---

## 8. Co zbývá pro 100M wZION likviditu

### Krok 1: ✅ Hotovo — 6 UTXO lock transakcí odesláno
- Všech 6 TX potvrzeno v blockech 11611–11612
- Relay detekuje všech 6 locků s memo
- Celkem ~100M ZION na vaultu jako UTXO

### Krok 2: ⚠️ Blokováno — Validator key
- Poskytnout `ZION_VALIDATOR_PRIVATE_KEY` env var relay
- NEBO vytvořit `keys/validator.key` soubor na Edge
- Restart relay

### Krok 3: Počkat na finality + mint
- 60 blocků L1 finality (~30 min po restartu relay)
- Relay automaticky mintne ~100M wZION na `0xdde17506...`

### Krok 4: Přidat likviditu na UniV3Pool
- wZION + WETH na `0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB`

---

## 9. Ztráty a lessons learned

### Ztraceno
- **~316 ZION** (200 ZION account-model + 100 ZION UTXO bez memo + fees) — testovací částky, zanedbatelné
- **Žádných 100M ZION nebylo ztraceno!** Původní předpoklad o ztrátě 100M byl chybný — transfery byly po 100 ZION, ne 100M.

### Lessons learned
1. **Keyless vault adresy nepřijímají account-model peníze** — vždy posílat UTXO
2. **`--memo` flag musí být skutečně propojen** s tx building logikou, ne jen vypisován
3. **u64 overflow pro >18.4M ZION** — pro velké částky použít multi-output nebo multi-tx
4. **Bridge relay potřebuje fallback recipient** pro recovery locků bez memo
5. **Vždy ověřit skutečnou částku v UTXO outputu** po odeslání, ne jen CLI output
6. **Validator privátní klíč musí být persistován** — env var v session se ztratí po ukončení
7. **Edge backups (766× tar.gz)** existují každých 15 min — pro DB recovery je potřeba najít správný timestamp

---

## 10. Commity

```
35b05e43 docs: update bridge status — 100M UTXO locks sent, validator key blocker
50dbb7ba fix(cli): block memo sends from falling back to account-model
0bbba50e docs: add fixL1bridge100m.md — full L1 bridge 100M recovery report
20379ec4 feat(L1): add memo support to UTXO SendParams + build_and_sign
89873dfb feat(bridge): add default_evm_recipient fallback for locks without memo
fb098515 chore: remove leftover diagnostic scripts
e0263103 docs(status): document bridge vault liquidity and UTXO memo blocker
b354a8a1 chore: remove temporary diagnostic scripts
f87adc9a fix(bridge): start L1 scan from recent block and wire config start_block_height
```

---

## 11. Edge server deployment

- Bridge relay rebuildnut s memo fix + default_evm_recipient
- CLI rebuildnut s `--memo` support + account-model fallback block
- `default_evm_recipient` aktivní
- `start_block_height = 11300` — relay nascanuje všechny lock TX
- L1 RPC: `127.0.0.1:8443` (lokální node), backup `77.42.71.94:8443`
- **Chybí:** `keys/validator.key` nebo `ZION_VALIDATOR_PRIVATE_KEY` env var

---

## 12. Konfigurace

### bridge-mainnet.toml (relevantní sekce)
```toml
[l1]
rpc_url = "http://127.0.0.1:8443"
rpc_url_backup = "http://77.42.71.94:8443"
bridge_address = "zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0"
finality_blocks = 60
poll_interval_secs = 15
start_block_height = 11300
default_evm_recipient = "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186"

[validator]
private_key_file = "keys/validator.key"
validator_id     = "validator-1"
threshold        = 5
total_validators = 5
validator_addresses = [
    "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186",  # validator-1 (deployer)
    "0x24d986841E56e5571489B25951eE8C1Ae761FA82",  # validator-2
    "0x665c55eDCF25c2c5A1dfF1B20eE950cBDC58d3d0",  # validator-3
    "0x8E644b3E9FaBf52eE321DC5B3D5AA06d6e3E66C6",  # validator-4
    "0x7e0D2eD71d78B9CFB5034A83333e82e304bc4CB2",  # validator-5
]
```

---

*Generated with [Devin](https://devin.ai)*
