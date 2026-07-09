# ZION 3.0.4 Hard Genesis Reset — Kanonicky Postup

> **Verze:** 2.0 — 2026-07-06  
> **Stav:** PRIPRAVENO K EXEKUCI  
> **Genesis hash:** `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`  
> **Predchozi genesis hash:** `7543004c76b11416ef32e2f1f5a4c72f0178f841d4559bf476e29e15a9602728`

---

## 0. Proc existuje tento dokument

Predchozi runbooky (docs/3.0.1Genesis/, docs/GENESIS_REGENERATION_RUNBOOK.md) pokryvaly
pouze L1 node reset. Tento dokument je **KOMPLETNI** — zahrnuje L1 + L2 + L3 + EVM + klice
+ dokumentaci. Nic nechybi.

---

## 1. Zdroj pravdy — adresy

### 1.1 Premine (14 slotu, 16.78B ZION)

Kanonicky zdroj: `V3/L1/core/src/genesis.rs` → `PREMINE_OUTPUTS`

| Slot | Adresa | Ucel | ZION |
|------|--------|------|------|
| 1 | `zion1n3t6v6w3m8g4v6q8g7h7j4j6f7s8q2m7g7un8u0` | OASIS Winner 1 | 1,650,000,000 |
| 2 | `zion16854w6h7a800k6h8n052s0h4k2v625x0w0z2320` | OASIS Winner 2 | 1,650,000,000 |
| 3 | `zion1j8s2d6s6f248j7z3m80676p6m074x2q5p5er3w2` | OASIS Winner 3 | 1,650,000,000 |
| 4 | `zion155k300w6x726p4x0w473s704d5k35865r2q75z8` | OASIS Winner 4 | 1,650,000,000 |
| 5 | `zion1y293r8c6l5p3u0y7j8q8366372t7y070n3rp5r8` | OASIS Winner 5 | 1,650,000,000 |
| 6 | `zion1u5u7k43240d5l4d0x7q5m3c4a838z4k000cv3q0` | DAO Treasury Main | 2,500,000,000 |
| 7 | `zion1m8d235x268h8d887s036m8c3x7s356d3r37k6m6` | DAO Grants | 1,000,000,000 |
| 8 | `zion102s8k4k0w783d657j255z865e47054s342u87v3` | DAO Bootstrap | 500,000,000 |
| 9 | `zion1e8j5z6v8e4c6s5x7r0w7e2r673h8k3a6d4xx877` | Core Dev Fund | 1,000,000,000 |
| 10 | `zion1f7z374q068r3p657m8z220v7y6k045q255xp2d3` | P2P Seed Nodes | 1,000,000,000 |
| 11 | `zion1s2j5s2a6f5k740k4d8s2k3y8v0t8d4k0u6my2k0` | Genesis Projects (Dharma Temple, Piko de Ora + DAO) | 590,000,000 |
| 12 | `zion10797m0k3u356f2l443r062d4e49665f6n20j6x0` | Children Future | 1,440,000,000 |
| 13 | `zion1p3y7w4z7d2m3j0f00657r354y4f3q5k6y8ca0g7` | Bridge Seed | 400,000,000 |
| 14 | `zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7` | Bridge Vault (keyless) | 100,000,000 |
| | | **CELKEM** | **16,780,000,000** |

### 1.2 Kanonicky subsidni adresy

Kanonicky zdroj: `V3/L1/core/src/genesis.rs` → `canonical_*_label` funkce

| Ucel | Adresa | Podil |
|------|--------|-------|
| Humanitarian subsidy | `zion1e0u5q5s660k4m4a634p2c2v358r8g59564054z7` | 5 % |
| Issobella subsidy | `zion1f7y7l5k678y0v408e8s654d2282346k375526t2` | 5 % |
| Pool fee subsidy | `zion1062522x6a083x6r4d24303l5h20698z7j8qk433` | 1 % (burn) |
| Default miner | `zion1d6m0h2r8m7k8k2d8n072y7j3j4m0254323vq0e3` | fallback |
| Pool payout | `zion1e4489793c5x2r0a0a4d8z7r4u5d6k0s4k3ht5m2` | 89 % |

### 1.3 Bridge vault

| Polozka | Hodnota |
|---------|---------|
| Adresa | `zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7` |
| Seed | `"ZION Bridge Vault V3 Mainnet v2 2026-07-06-HARD-RESET"` |
| Zdroj v kodu | `V3/L1/core/src/crypto.rs:BRIDGE_VAULT_SEED` |
| Konstanty v kodu | `V3/L1/core/src/fee.rs:BRIDGE_VAULT_ADDRESS` |
| Genesis slot | 14 (account-model TX 0..12, UTXO coinbase slot 14) |
| Castka | 100,000,000 ZION (6 UTXO outputu) |

### 1.4 DAO Treasury adresy

Kanonicky zdroj: `V3/L2/dao/src/types.rs` → `DAO_TREASURY_ADDRESSES`

| # | Adresa | Zdroj |
|---|--------|-------|
| 1 | `zion1u5u7k43240d5l4d0x7q5m3c4a838z4k000cv3q0` | Premine slot 6 |
| 2 | `zion1m8d235x268h8d887s036m8c3x7s356d3r37k6m6` | Premine slot 7 |
| 3 | `zion102s8k4k0w783d657j255z865e47054s342u87v3` | Premine slot 8 |

DAO_ADDRESS (fee.rs): `zion1u5u7k43240d5l4d0x7q5m3c4a838z4k000cv3q0`  
DAO_TREASURY_LOCK_HEIGHT: `144_000` (~100 dni)

### 1.5 Admin set (3 admin keys)

| Role | L1 Adresa | EVM Adresa |
|------|-----------|------------|
| Rama | `zion1m300z2f424k4m0k6c4l0v6v6w8l6j855s7je6e4` | `0xf354ccae30d6e9787e23e987e893e825f312f5c9` |
| Sita | `zion1d7z398t0n5c7j874a5n8v4h0d5c8j754z78t7m6` | `0x07e720245cdabc33a265df5bcdc504897ddf0b01` |
| Hanuman | `zion1a363k2y366f6w4z2n2q4h2y822f3s5w2w56y3y4` | `0x9ab8ee6b874578e431aeb45bf28f8ca6041e1de6` |

AdminSet se nacita za behu z env/config. Neni hardcodovany v genesis.rs.

### 1.6 DAO Guardians (7)

Kanonicky zdroj: `V3/L2/dao/config/dao-mainnet.toml`

| # | Adresa | Pubkey |
|---|--------|--------|
| 1 | `zion1v330m245u4j2v6z8t485c8f472f8u5z3a82q0y4` | `0c159ab1...` |
| 2 | `zion186r522w0l538v030r0m297w43426z4v094lu5e8` | `e4e6e97f...` |
| 3 | `zion1g40723c645s038p0w7t8h0d7r8d325j7x0gc8j0` | `bcb3d39d...` |
| 4 | `zion1r3m3g8q6y4u2f8r4y2w4c3f02335d8j7v5dy064` | `0fd644a5...` |
| 5 | `zion1u53766x73897r0z0z854c4p2f7v773g3e0z27v7` | `1cc022fb...` |
| 6 | `zion144r475y5u58508y7f0a8d4g5c3a593m5q23e3a2` | `ac34a50d...` |
| 7 | `zion1d8t2e3e3l3a684l578d894w5k8x2h2k3z6e63m7` | `e6a28452...` |

### 1.7 EVM Bridge Validators (5)

Kanonicky zdroj: `V3/config/bridge-mainnet.toml` → `validator_addresses`

| # | EVM Adresa |
|---|------------|
| 1 | `0x9b5b9a6c4ce4bcd4479d8ea6d12cd7bfeb61085f` |
| 2 | `0x8a804afd4c200e95f415df6907da111a0258a578` |
| 3 | `0x694f3b43f4bf77dfbef53224791272d102449218` |
| 4 | `0x64c85af40143484c12316723192a0d71c10e82b8` |
| 5 | `0xe093ff26da65079df435a89834497abc380b59ae` |

Threshold: 5/5

### 1.8 Escrow (Atomic Swap)

| Polozka | Hodnota |
|---------|---------|
| Adresa | `zion192r2p7u427l63545z88538q5t8x0c670k6un3d6` |
| Pubkey | `2ac71bb5be9075d21c6f9b5f9657f6c5914257cd505ee0fca5816973bd67d8c5` |

### 1.9 Klicovavy material

| Soubor | Umisteni | Obsah |
|--------|----------|-------|
| PUBLIC_ADDRESSES.txt | `/home/zionserver/zion-keys-2026-07-06/` | Vsechny verejne adresy + pubkeys |
| Sifrovany archiv | `/home/zionserver/zion-keys-2026-07-06-encrypted.tar.gz.aes` | Mnemonics + SK (AES-256) |
| Offline zaloha | Fyzicky flashdisk | MUSI byt zalohovano offline |

---

## 2. Kompletni seznam souboru k aktualizaci

### 2.1 L1 Core (Rust) — UZ HOTOVO v teto session

| Soubor | Co se meni | Poznamka |
|--------|-----------|----------|
| `V3/L1/core/src/genesis.rs` | 14 premine adres, bridge vault slot | Kanonicky zdroj |
| `V3/L1/core/src/crypto.rs` | `BRIDGE_VAULT_SEED` | Novy seed string |
| `V3/L1/core/src/fee.rs` | `BRIDGE_VAULT_ADDRESS`, `DAO_ADDRESS` | Konstanty |
| `V3/L1/core/src/migration.rs` | DAO treasury fallback adresa | Konzistentni s fee.rs |

### 2.2 L2 Bridge (Rust + TOML)

| Soubor | Co se meni |
|--------|-----------|
| `V3/config/bridge-mainnet.toml` | `bridge_address`, `default_evm_recipient`, `validator_addresses` |
| `V3/L2/bridge/config/bridge-mainnet.toml` | Mirror ^ |
| `V3/L2/bridge/src/config.rs` | Default `bridge_address` + testy |
| `V3/L2/bridge/src/l1_watcher.rs` | Test fixtures `bridge_address` |
| `V3/L2/bridge/src/relayer.rs` | Test `validate_l1_address` |
| `V3/L2/bridge/tests/mainnet_readiness.rs` | Validator address assertions |

### 2.3 L2 DAO (Rust + TOML)

| Soubor | Co se meni |
|--------|-----------|
| `V3/L2/dao/config/dao-mainnet.toml` | 3 treasury adresy, 7 guardian entries |
| `V3/L2/dao/src/types.rs` | `DAO_TREASURY_ADDRESSES` |
| `V3/L2/dao/src/config.rs` | Default treasury adresy |

### 2.4 L2 Contracts (TypeScript)

| Soubor | Co se meni |
|--------|-----------|
| `V3/L2/contracts/hardhat/scripts/deploy-chain.ts` | `DEFAULT_VALIDATORS` array |

### 2.5 L3 WARP (TOML)

| Soubor | Co se meni |
|--------|-----------|
| `V3/L3/warp/config/warp-mainnet.toml` | `l1_vault_address` |

### 2.6 Dokumentace

| Soubor | Co se meni |
|--------|-----------|
| `V3/README.md` | Bridge vault adresa |
| `V3/docs/MAINNET_CONSTANTS.md` | Bridge vault + seed |
| `V3/docs/OPERATIONAL_SERVERS.md` | Premine tabulka slot 14 |
| `V3/docs/ERICKA_MAINNET_GUIDE.md` | Premine tabulka slot 14 |
| `V3/docs/L2_L3_MAINNET_PLAN.md` | Kod priklady + JSON |
| `V3/docs/audits/2026-04-V3_INTERNAL_AUDIT.md` | Audit tabulka |
| `StatusV3.md` | 4 vyskyty bridge vault |
| `AGENTS.md` | Bridge vault reference |
| `3.0.4.md` | Konstanty tabulka |
| `HARDRESETOFFICIAL.md` | Seed + adresa |
| `docs/3.0.3/BRIDGE_MAINNET_READINESS.md` | Vault adresa |
| `docs/3.0.3/L2Complete.md` | 5 vyskytu |
| `docs/3.0.3/fixL1bridge100m.md` | 3 vyskyty |
| `docs/3.0.3/CODE_VS_DOCS_AUDIT.md` | Audit reference |
| `docs/CHANGELOG_2026-04-01.md` | Changelog |

### 2.7 Scripty + Dashboard

| Soubor | Co se meni |
|--------|-----------|
| `scripts/bridge-test-tx.py` | Default vault adresa |
| `scripts/audit/check-amt.py` | Vault adresa filter |
| `ZION_OS/dashboard/app.py` | `bridge_vault` dict |
| `ZION_OS/dashboard/dashboard.html` | 2 vyskyty |

### 2.8 Klicovy material

| Soubor | Co se meni |
|--------|-----------|
| `zion-keys-2026-07-06/PUBLIC_ADDRESSES.txt` | `BRIDGE_VAULT_ADDR` |

---

## 3. Exekucni postup — krok za krokem

### Faze 0: Priprava (pred resetem)

```
[ ] Tailscale DOWN — odpoj od site
[ ] Overit ze ZION sluzby bezi (zatim nestavet)
[ ] Overit ze mame sifrovany archiv klicu
[ ] Git commit vsech zmen pred resetem
```

### Faze 1: Generovani klicu (air-gapped stroj)

```
[ ] Boot offline (zadna sit)
[ ] Spustit gen-all-keys-mnemonic — 14 premine + 5 canonical + 3 admin + 7 guardian + 5 EVM + 1 escrow
[ ] Kazdy klic: 24-word BIP39 mnemonic
[ ] Ulozit PUBLIC_ADDRESSES.txt (verejne adresy)
[ ] Sifrovani: tar + AES-256 + shred plaintext
[ ] Kopie na USB flashdisk (offline zaloha)
```

### Faze 2: Aktualizace genesis.rs + rebuild

```
[ ] Nahradit vsech 14 premine adres v genesis.rs
[ ] Aktualizovat BRIDGE_VAULT_SEED v crypto.rs
[ ] Aktualizovat BRIDGE_VAULT_ADDRESS v fee.rs
[ ] Aktualizovat DAO_ADDRESS v fee.rs
[ ] Aktualizovat DAO_TREASURY_ADDRESSES v dao/types.rs
[ ] Aktualizovat dao migration fallback v migration.rs
[ ] cargo build --release -p zion-core
[ ] cargo test -p zion-core — vsechny musi projit
[ ] Zaznamenat novy genesis hash z testu
```

### Faze 3: Aktualizace L2/L3 konfiguraci

```
[ ] V3/config/bridge-mainnet.toml: bridge_address, validator_addresses, default_evm_recipient
[ ] V3/L2/bridge/config/bridge-mainnet.toml: mirror ^
[ ] V3/L3/warp/config/warp-mainnet.toml: l1_vault_address
[ ] V3/L2/dao/config/dao-mainnet.toml: treasury adresy, guardian entries
[ ] V3/L2/bridge/src/config.rs: default + testy
[ ] V3/L2/bridge/src/l1_watcher.rs: test fixtures
[ ] V3/L2/bridge/src/relayer.rs: test
[ ] V3/L2/bridge/tests/mainnet_readiness.rs: validator assertions
[ ] V3/L2/dao/src/config.rs: default treasury
[ ] V3/L2/contracts/hardhat/scripts/deploy-chain.ts: DEFAULT_VALIDATORS
[ ] cargo test -p zion-bridge — vsechny musi projit
[ ] cargo test -p zion-dao — vsechny musi projit
```

### Faze 4: Aktualizace dokumentace

```
[ ] V3/README.md
[ ] V3/docs/MAINNET_CONSTANTS.md
[ ] V3/docs/OPERATIONAL_SERVERS.md
[ ] V3/docs/ERICKA_MAINNET_GUIDE.md
[ ] V3/docs/L2_L3_MAINNET_PLAN.md
[ ] V3/docs/audits/2026-04-V3_INTERNAL_AUDIT.md
[ ] StatusV3.md
[ ] AGENTS.md
[ ] 3.0.4.md
[ ] HARDRESETOFFICIAL.md
[ ] docs/3.0.3/BRIDGE_MAINNET_READINESS.md
[ ] docs/3.0.3/L2Complete.md
[ ] docs/3.0.3/fixL1bridge100m.md
[ ] docs/3.0.3/CODE_VS_DOCS_AUDIT.md
[ ] docs/CHANGELOG_2026-04-01.md
[ ] scripts/bridge-test-tx.py
[ ] scripts/audit/check-amt.py
[ ] ZION_OS/dashboard/app.py
[ ] ZION_OS/dashboard/dashboard.html
[ ] PUBLIC_ADDRESSES.txt
```

### Faze 5: Revokace starych EVM validatoru (6 chainu)

```
[ ] Base (8453): revokovat stare validatory v ZIONBridge contractu
[ ] BSC (56): revokovat
[ ] Polygon (137): revokovat
[ ] Arbitrum (42161): revokovat
[ ] Optimism (10): revokovat
[ ] Avalanche (43114): revokovat
[ ] Nastavit nove validatory (5/5 threshold)
```

### Faze 6: Priprava noveho serveru

```
[ ] Cisty OS install (Ubuntu 22.04 LTS)
[ ] UFW firewall (SSH, HTTP, HTTPS, Tailscale only)
[ ] SSH key-only auth
[ ] AppArmor profil pro zion-node
[ ] Rust toolchain install
[ ] Clone repo, build workspace
[ ] Systemd services pro vsech 13 sluzeb
```

### Faze 7: Hard reset L1

```
[ ] Zastavit VSECHNY sluzby (Edge + Local)
[ ] Smazat VSECHNY DB soubory:
    - edge-state.db, edge2-state.db (nody)
    - bridge-mainnet.db (bridge)
    - dao-mainnet.db (DAO)
    - warp-mainnet.db (WARP)
    - pool-state.json (pool)
    - peers.json (P2P)
[ ] Izolovany start node1 (bez seed peers!)
[ ] Overit genesis #0:
    - height = 0
    - accepted_blocks = 1
    - tip_hash = genesis hash
    - 13 account TX + 1 UTXO coinbase
    - total premine = 16,780,000,000 ZION
[ ] Obnovit seed peers
[ ] Start node2 (sync z node1)
[ ] Start pool
[ ] Start L2 sluzby (bridge, DAO, atomic-swap)
[ ] Start L3 sluzby (WARP)
```

### Faze 8: Verifikace

```
[ ] Oba nody maji stejny height a tip hash
[ ] getChainInfo na obou: genesis hash sedi
[ ] getBalance na vsech 14 premine adresach: castky sedi
[ ] getBalance na bridge vault: 100M ZION
[ ] Fee split na prvnim vyresenem bloku: 89/5/5/1
[ ] Pool acceptuje connections
[ ] Bridge relay bezi a scanuje L1
[ ] cargo test -p zion-core — 552+ pass, 0 fail
[ ] cargo test -p zion-bridge — 148+ pass
[ ] cargo test -p zion-dao — 25+ pass
```

### Faze 9: Dokumentace a commit

```
[ ] Git commit: "feat(genesis): hard genesis reset 3.0.4 — all keys regenerated"
[ ] Aktualizovat AGENTS.md s novym genesis hashem
[ ] Aktualizovat StatusV3.md
```

### Faze 10: Offline zalohy

```
[x] Sifrovany archiv na USB flashdisk (ESD-USB/ZionKeys/zion-keys-2026-07-06-encrypted.tar.gz.aes)
[x] Fyzicka offline zaloha mnemonics
[ ] Overit ze plaintext klice jsou shredovany
[x] PUBLIC_ADDRESSES.txt na bezpecnem miste (Desktop/ZionKeys/ + USB/ZionKeys/)
```

**USB backup audit — COMPLETED (2026-07-09):**
- 4/4 soubory SHA256 checksumy identické USB ↔ Desktop ✓
- 4/4 GPG podpisy Good (Yose, key `9018F94ACE7C93CF549612E225557B7072678D25`) ✓
- 13/13 premine + 5/5 canonical + 1/1 bridge vault adresy cross-checknuty s `genesis.rs` ✓
- Všechny soukromé soubory `chmod 600` ✓
- Genesis hash `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` nezměněn ✓

---

## 4. Verifikacni skripty

### 4.1 Overit genesis #0

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":{},"id":1}' \
  http://127.0.0.1:8443 | python3 -c "
import sys,json
r=json.load(sys.stdin)['result']
assert r['height']==0, f'FAIL: height={r[\"height\"]} != 0'
assert r['accepted_blocks']==1, f'FAIL: accepted={r[\"accepted_blocks\"]} != 1'
print('Genesis #0 OK')
print('  height:', r['height'])
print('  accepted:', r['accepted_blocks'])
print('  tip_hash:', r['tip_hash'])
"
```

### 4.2 Overit premine balansy

```bash
for ADDR in \
  zion1n3t6v6w3m8g4v6q8g7h7j4j6f7s8q2m7g7un8u0 \
  zion16854w6h7a800k6h8n052s0h4k2v625x0w0z2320 \
  zion1j8s2d6s6f248j7z3m80676p6m074x2q5p5er3w2 \
  zion155k300w6x726p4x0w473s704d5k35865r2q75z8 \
  zion1y293r8c6l5p3u0y7j8q8366372t7y070n3rp5r8 \
  zion1u5u7k43240d5l4d0x7q5m3c4a838z4k000cv3q0 \
  zion1m8d235x268h8d887s036m8c3x7s356d3r37k6m6 \
  zion102s8k4k0w783d657j255z865e47054s342u87v3 \
  zion1e8j5z6v8e4c6s5x7r0w7e2r673h8k3a6d4xx877 \
  zion1f7z374q068r3p657m8z220v7y6k045q255xp2d3 \
  zion1s2j5s2a6f5k740k4d8s2k3y8v0t8d4k0u6my2k0 \
  zion10797m0k3u356f2l443r062d4e49665f6n20j6x0 \
  zion1p3y7w4z7d2m3j0f00657r354y4f3q5k6y8ca0g7 \
; do
  BAL=$(curl -s -X POST -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"getBalance\",\"params\":{\"address\":\"$ADDR\"},\"id\":1}" \
    http://127.0.0.1:8443 | python3 -c "import sys,json; r=json.load(sys.stdin).get('result',{}); print(r.get('balance_flowers','0'))")
  echo "$ADDR: $BAL flowers"
done
```

### 4.3 Overit bridge vault (UTXO)

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getUtxos","params":{"address":"zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7"},"id":1}' \
  http://127.0.0.1:8443 | python3 -c "
import sys,json
r=json.load(sys.stdin).get('result',{})
utxos = r.get('utxos',[])
total = sum(u.get('amount',0) for u in utxos)
print(f'Bridge vault: {len(utxos)} UTXOs, total {total} flowers = {total/1e18:.0f} ZION')
assert len(utxos) == 6, f'FAIL: expected 6 UTXOs, got {len(utxos)}'
"
```

### 4.4 Overit fee split

```bash
HEIGHT=\$(curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"getChainInfo","params":{},"id":1}' \
  http://127.0.0.1:8443 | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['height'])")

curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"getBlockByHeight\",\"params\":{\"height\":\$HEIGHT},\"id\":1}" \
  http://127.0.0.1:8443 | python3 -c "
import sys,json
r=json.load(sys.stdin)['result']
print('Block', r['height'], '- Fee split:')
for tx in r.get('transactions',[]):
    if tx.get('from')=='coinbase':
        print(f'  {tx[\"to\"]}: {tx[\"amount_flowers\"]} flowers')
"
```

---

## 5. Zname pasti

| Past | Pricina | Reseni |
|------|---------|--------|
| Node nema genesis #0 | DB nebyl smazan | Smazat VSECHNY .db soubory |
| Node2 ma jiny chain | edge2-state.db preskocen | Vzdy mazat OBA nody |
| Bridge vault balance = 0 | Spatny BRIDGE_VAULT_SEED | Overit crypto.rs seed = v2 2026-07-06 |
| Bridge relay nekomunikuje | Stary bridge_address v TOML | Overit bridge-mainnet.toml |
| Testy failuji na bridge_address | config.rs default nebyl aktualizovan | Replace all v config.rs |
| Admin operace nefunguje | AdminSet neni nacteny | AdminSet se nacita z env/config, ne z genesis |
| DAO treasury locked | Vyska < 144,000 | Cekat na unlock height |
| Starej genesis hash v testu | rpc.rs test ma hardcoded hash | Aktualizovat test |
| PUBLIC_ADDRESSES.txt nesedi | Bridge vault adresa nebyla aktualizovana | Overit vs genesis.rs |
| EVM validatory nevaliduji | Stare klice v contractu | Revokovat + nahradit na vsech 6 chainech |

---

## 6. Rozdily oproti predchozim runbookum

| Polozka | 3.0.1 (docs/3.0.1Genesis/) | 3.0.4 (tento dokument) |
|---------|---------------------------|------------------------|
| Pokryti | Pouze L1 node | L1 + L2 + L3 + EVM + klice + docs |
| Klice | Ed25519 random | BIP39 24-word mnemonic |
| Bridge vault | Puvodni seed | Novy seed v2 2026-07-06 |
| Admin set | Nereseno | 3 admin keys (Rama/Sita/Hanuman) |
| DAO guardians | Nereseno | 7 guardian entries |
| EVM validatory | Nereseno | 5 novych EVM adres, 5/5 threshold |
| Dokumentace | Casta, neaktualni | Kompletni checklist vsech souboru |
| Verifikace | Zakladni getChainInfo | Skripty pro premine, vault, fee split |
| Decimal fork | Neexistoval | 1e6 flowers_per_zion (3.0.3 migrace) |

---

## 7. Reference na dalsi dokumenty

| Dokument | Cesta | Obsah |
|----------|-------|-------|
| Predchozi genesis runbook | `docs/3.0.1Genesis/GENESIS_HARD_RESET_E2E.md` | L1-only postup (3.0.1) |
| GENESIS_REGENERATION_RUNBOOK | `docs/GENESIS_REGENERATION_RUNBOOK.md` | Draft z 2026-06-03 |
| Decimal fork plan | `docs/3.0.3/ZION_3.0.3_DECIMAL_FORK_PLAN.md` | 1e12 → 1e6 migrace |
| 3.0.4 deploy runbook | `V3/docs/ZION_3.0.4_DEPLOY_RUNBOOK.md` | DeFi deploy na Base |
| Security hardening | `SecurityFirst.md` | F1/F5 fix, UFW, AppArmor |
| Bridge readiness | `docs/3.0.3/BRIDGE_MAINNET_READINESS.md` | Bridge stav |
| PUBLIC_ADDRESSES.txt | `zion-keys-2026-07-06/PUBLIC_ADDRESSES.txt` | Vsechny verejne adresy |

---

*Generovano s pomoci [Devin](https://cli.devin.ai/docs). Posledni aktualizace: 2026-07-06.*
