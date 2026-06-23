# fixL1bridge100m.md — L1 Bridge 100M ZION Recovery Report

> **Datum:** 2026-06-22
> **Status:** ⚠️ ČÁSTEČNĚ VYŘEŠENO — L1 memo fix hotový a otestovaný, 100M ZION recovery čeká na odeslání 6 UTXO lock transakcí s memo.
> **Autor:** Devin (user-approved L1 change per AGENTS.md)

---

## 1. Cíl

Převést 100M ZION z Bridge Seed Fund (`zion13794g7k3m0f84637l2x0t855h3l258k8p3xp5t3`) na L1 bridge vault (`zion1w0r0a560l3j2y6f3v2f457n2u4d0n5v2g79w0t0`), aby bridge relay mohl zamintovat 100M wZION na Base mainnet (`0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`) pro DEX likviditu.

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

## 3. Co se stalo — chronologie

### Transfer #1: 100M ZION account-model (UVÍZLÝ)
- **Z:** Bridge Seed Fund (`zion13794...`)
- **Na:** Bridge vault (`zion1w0r0...`)
- **Typ:** Account-model transaction (`submitAccountTransaction`)
- **Částka:** 100,000,000 ZION (1e20 flowers)
- **Nástroj:** `V3/L1/core/src/bin/fund-bridge-vault.rs`
- **Výsledek:** ❌ **TRVALE UVÍZLÝ.** Account-model peníze na keyless vault adrese nelze utratit. Žádný bridge lock event se nevytvořil. Peníze jsou navždy ztraceny pro oběh.
- **Množství ztraceno:** 100M ZION

### Transfer #2: 100 ZION UTXO lock (FUNKČNÍ TEST)
- **Z:** Bridge Seed Fund (`zion13794...` → `zion1r565...`)
- **Na:** Bridge vault (`zion1w0r0...`)
- **Typ:** UTXO transaction
- **Částka:** **100 ZION** (ne 100M!)
- **TxID:** `8eb0bb8cf048f0afdd5b319f2799935b7b4dd6c2e4068ad48a39ed889a4571f5`
- **Block:** 11324
- **Memo:** ❌ **CHYBÍ** — `zion wallet send --memo` přijal flag ale silently ho zahodil
- **Výsledek:** ✅ Relay detekoval lock, ale přeskočil ho kvůli chybějícímu memo

### Proč jen 100 ZION?
- `bridge-send.sh` použil `--amount 100` místo `--amount 100000000`
- Genesis UTXO vstup = 16,666,566 ZION (1 z 6 outputů)
- 100 ZION šlo na vault, 16,666,566 ZION se vrátilo jako change

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
- 100M ZION trvale uvízlo

### Bug #3: Bridge relay neměl fallback recipient
- Když UTXO lock neměl memo, relay ho silently přeskočil
- Neexistoval mechanismus pro recovery locků bez memo

---

## 5. Opravy provedené dnes (2026-06-22)

### Fix A: L1 memo support (user-approved per AGENTS.md)

**Soubory změněné:**
- `V3/L1/core/src/wallet.rs` — přidán `memo: Option<String>` do `SendParams`, thread do primary output `build_and_sign()`
- `V3/cli/src/commands/wallet.rs` — `--memo` se nyní předává do `SendParams`
- `V3/sdk/src/wallet.rs` — default `memo: None` v existující helper funkci
- `V3/L1/core/src/bin/wallet.rs` — default `memo: None` v `cmd_send` (dedikovaný `bridge-lock` subcommand už memo podporoval)

**Pravidla:**
- Primary output nyní nese `params.memo`
- Change output vždy `memo: None` (consensus pravidlo: change output nesmí nést memo)
- Všechny unit testy aktualizovány

**Verifikace:**
```
cargo test --manifest-path V3/Cargo.toml -p zion-core --lib wallet
→ test result: ok. 14 passed; 0 failed; 0 ignored; 0 measured
```

### Fix B: L2 bridge relay default_evm_recipient fallback

**Soubory změněné:**
- `V3/L2/bridge/src/config.rs` — přidán `default_evm_recipient: Option<String>` do `L1Config`
- `V3/L2/bridge/src/l1_watcher.rs` — když lock nemá memo a `default_evm_recipient` je nastaven, mintne wZION na default adresu s warningem
- `V3/L2/bridge/config/bridge-mainnet.toml` — `default_evm_recipient = "0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186"`
- `V3/config/bridge-mainnet.toml` — stejné

**Výsledek na Edge serveru:**
```
WARN: L1: Lock TX 8eb0bb8c... has no memo, using default EVM recipient: 0xdde17506...
INFO: 🔒 L1 Lock detected: 100 ZION at height 11324 — waiting 60 blocks for finality
```

### Fix C: Bridge relay start_block_height + L1 RPC

**Soubory změněné:**
- `V3/L2/bridge/src/main.rs` — `last_l1_height` se inicializuje z configu `start_block_height` když je DB prázdná
- `V3/L2/bridge/config/bridge-mainnet.toml` — `start_block_height = 11300`, `rpc_url = "http://127.0.0.1:8443"`, `rpc_url_backup = "http://77.42.71.94:8443"`
- `V3/config/bridge-mainnet.toml` — stejné

---

## 6. Aktuální stav bridge vaultu

| Typ | Částka | Stav | Poznámka |
|-----|--------|------|----------|
| Account-model ZION (Transfer #1) | 100M ZION | ❌ **TRVALE UVÍZLÝ** | Keyless vault, account-model nelze utratit |
| UTXO lock (Transfer #2) | 100 ZION | ✅ Relay zpracovává | Čeká 60 blocků finality → mintne 100 wZION na Base |
| **Celkem na vaultu** | **100M + 100 ZION** | | |

---

## 7. Co zbývá pro 100M wZION likviditu

### Krok 1: Odeslat 6 UTXO lock transakcí s memo (NEDĚLAT TEĎ)

Každá transakce:
- **Z:** Bridge Seed Fund (`zion13794...`)
- **Na:** Bridge vault (`zion1w0r0...`)
- **Částka:** ~16,666,666 ZION (1 genesis UTXO output)
- **Memo:** `BRIDGE:base:0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`
- **Nástroj:** `zion wallet send --memo "BRIDGE:base:0xdde17506..." --amount 16666666 --to zion1w0r0...`

Po 6 transakcích → 100M ZION na vaultu jako UTXO locky s memo → relay mintne 100M wZION na Base.

### Krok 2: Počkat na finality + mint
- 60 blocků L1 finality (~30 min)
- Relay automaticky mintne wZION na `0xdde17506...`

### Krok 3: Přidat likviditu na UniV3Pool
- wZION + WETH na `0xa88C4C89EB4597Df2e29A8061895300FcDF44FBB`

---

## 8. Ztráty a lessons learned

### Ztraceno
- **100M ZION** (account-model na keyless vault) — navždy, bez genesis resetu nelze obnovit

### Lessons learned
1. **Keyless vault adresy nepřijímají account-model peníze** — vždy posílat UTXO
2. **`--memo` flag musí být skutečně propojen** s tx building logikou, ne jen vypisován
3. **u64 overflow pro >18.4M ZION** — pro velké částky použít multi-output nebo multi-tx
4. **Bridge relay potřebuje fallback recipient** pro recovery locků bez memo
5. **Vždy ověřit skutečnou částku v UTXO outputu** po odeslání, ne jen CLI output

---

## 9. Commity dnes (2026-06-22)

```
89873df feat(bridge): add default_evm_recipient fallback for locks without memo
fb09851 chore: remove leftover diagnostic scripts
e026310 docs(status): document bridge vault liquidity and UTXO memo blocker
b354a8a chore: remove temporary diagnostic scripts
f87adc9 fix(bridge): start L1 scan from recent block and wire config start_block_height
```

### Pending commit (L1 memo fix)
- `feat(L1): add memo support to UTXO SendParams + build_and_sign`
- Soubory: `V3/L1/core/src/wallet.rs`, `V3/cli/src/commands/wallet.rs`, `V3/sdk/src/wallet.rs`, `V3/L1/core/src/bin/wallet.rs`

---

## 10. Edge server deployment

- Bridge relay v3.0.2 rebuildnut a restartován
- `default_evm_recipient` aktivní
- `start_block_height = 11300` — relay nascanuje block 11324 a zpracuje 100 ZION lock
- L1 RPC: `127.0.0.1:8443` (lokální node), backup `77.42.71.94:8443`

---

## 11. Konfigurace

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
```

---

*Generated with [Devin](https://devin.ai)*
