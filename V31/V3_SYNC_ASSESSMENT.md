# V31 — synchronizace s aktuální V3 betou (bez dalšího hard resetu)

> **Cíl:** ověřit, zda `V31/zion-core` může z prvního bloku syncovat s běžící V3 mainnet betou a jak zajistit, aby nová síť byla identická.
> **Provedeno:** `git pull`, `cargo run -p zion-core --bin get-genesis-hash` (V3), `cargo test -p zion-core --lib` (V31).

## 1. Výsledek rychlé kontroly

| Metrika | V3 mainnet beta | V31 aktuálně | Shoda |
|---------|-----------------|--------------|-------|
| `genesis_hash()` | `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e` | `3cb07fdc5d153d4da16637d0cc1d8ece72a54abe58c96c9b61d18c1fab11d1d4` | **NE** |
| `GENESIS_TIMESTAMP` | `1_767_225_600` | `1_767_225_600` | ANO |
| `GENESIS_MESSAGE` | V3 text (s ASCII art, Yose signatura, `Mainet` typo) | V31 zkrácená varianta | NE |
| Premine výstupy | 14 outputů, legacy 1e12 scale | 7 outputů, 1e6 scale | NE |
| Block hash funkce | `cosmic_harmony_ekam_deeksha_v2(header, nonce, height)` | `Keccak256(pow_header \|\| nonce)` | NE |
| Block header layout | `version(4) + prev_hash(32) + merkle(32) + timestamp(8) + bits(4)` | `prev_hash(32) + merkle(32) + height(8) + timestamp(8)` | NE |
| Tx model | Account + UTXO, v1/v2 hash, BLAKE3 | UTXO-only, Keccak256 | NE |
| Merkle root | `derive_template_merkle_root_v2_blake3` nad account+utxo tx ids | BLAKE3 nad UTXO tx hashi | NE |
| PoW konsensus | Ekam Deeksha v2, epoch NPU, výškový fork gating | Ekam Deeksha (v1) | NE |
| Emise/difficulty | LWMA-60, Decade Decay, 89/5/5/1 split | GENESIS_DIFFICULTY konstanta | NE |
| P2P / IBD | plný gossip, sync, checkpoints | listen-only placeholder | NE |

**Závěr:** `V31/zion-core` není v současné podobě schopen syncovat s V3 betou. Genesis hashe se liší a všechny klíčové protokolové komponenty jsou odlišné.

## 2. Proč to nesedí (detail)

### 2.1 Genesis block
V3 genesis používá:
- 14x account-model premine transakcí (13 + 1 UTXO coinbase pro bridge vault),
- `GENESIS_MESSAGE` s plným ASCII artem a signaturou,
- legacy scale `1 ZION = 10¹² flowers` pro samotný genesis block (block-hash kontinuita),
- `MiningHeader` se `version: 3`, `difficulty_bits` (compact target),
- block hash = PoW hash (`cosmic_harmony_ekam_deeksha_v2`) z 80B hlavičky.

V31 genesis používá:
- 7x UTXO outputů,
- zkrácenou zprávu,
- `1 ZION = 10⁶` scale,
- `BlockHeader` s `height` a `difficulty` (u64),
- block hash = `Keccak256` (nezávislé na PoW).

Proto V31 hash = `3cb0...`, zatímco V3 hash = `4f75...`.

### 2.2 Transakce
V3 podporuje dva modely:
- **Account** (`lib.rs::Transaction`) — `tx_id`, `from`, `to`, `amount_zion` (u128 flowers), `fee_zion`, `nonce`, `signature`, `public_key`, `memo`.
- **UTXO** (`tx.rs::Transaction`) — `id` = `BLAKE3` kanonického serializace (v1/v2 verze, SegWit-style, bez podpisů).

V31 má pouze UTXO `Transaction` s `version`, `inputs`, `outputs`, `memo`, hash = `Keccak256` raw concatenace.

### 2.3 Konsensus a PoW
V3 mainnet běží `cosmic_harmony_ekam_deeksha_v2` od genesis. V31 `EkamDeeksha` je označen jako bit-identický s `deeksha_lite_v1`, což je jiný pipeline (64 KiB scratchpad, jiné počty pass/readů). V31 zatím nemá:
- výškové fork gating (v1/v2/v3),
- epoch NPU mixing,
- LWMA-60 difficulty retarget,
- Decade Decay emisi,
- 89/5/5/1 block reward split,
- coinbase maturity, fee burn, atd.

### 2.4 Síť a storage
V3 `chain.rs` má ~7700 řádků runtime: P2P, IBD, orphan handling, checkpoints, LMDB/heed storage, mempool, RPC. V31 `zion-core` je scaffold se SQLite, RPC má jen `status`/`submit`, P2P je placeholder.

## 3. Možné cesty k shodě (bez hard resetu)

### Cesta A — Full V3 core port do V31
Cíl: `V31/zion-node` dokáže stáhnout a validovat celý řetězec 0→tip.

Potřeba:
1. Přenést `V3/L1/core/src/chain.rs`, `bin/node.rs`, `validation.rs`, `emission.rs`, `difficulty.rs`, `storage.rs`, `p2p*.rs`, `ibd.rs` do `V31/L1/core`.
2. Přidat LMDB/heed závislosti (aktuálně V31 má jen `rusqlite`).
3. Implementovat V3 block/tx typy a hashování v `zion-l1-types` nebo `zion-core`.
4. Přidat `cosmic_harmony_ekam_deeksha_v2` do `zion-cosmic-harmony`.
5. Zachovat fork gating pro 3.0.3 decimal fork a account-tx memo fork.

**Náročnost:** vysoká — desítky hodin, F4 report to otevřeně uvádí jako "přepsat celý V3 core do V31 trvá moc dlouho".

### Cesta B — Checkpoint / light-node cutover (doporučeno)
Cíl: `V31/zion-node` začne z trusted snapshotu posledních N bloků (např. z Edge backup node) a dále validuje nové bloky stejnými pravidly jako V3.

Výhody:
- nevyžaduje replay celé historie 0–10913+ (která je částečně ztracena po block-retention incidentu),
- stačí implementovat consensus pro nové bloky, ne celé IBD,
- žádný nový hard reset, protože tip řetězce zůstává stejný.

Potřeba:
1. Snapshot formát: poslední známý block hash, UTXO/account state, uložené heights aktivních forků.
2. V31 musí validovat nové bloky se stejným `MiningHeader`, PoW v2, tx modely, emisí, difficulty.
3. P2P sync musí stahovat pouze hlavičky nových bloků a transakce (light IBD).
4. Fallback: pokud snapshot chybí, node může bootstrapnout z trustovaného seedu a poté přepnout do light režimu.

## 4. Stávající `V31` migrace (`migration.rs`)

`V31/L1/core/src/migration.rs` už řeší přechod z V3, ale **jako snapshot, ne jako synchronizace**:

- Načte export `zion-node-state.db` z V3 (výšku, accepted bloky, account/UTXO stav).
- Vytvoří **migration block na height 0** s finalními zůstatky.
- V31 node se pak spouští s `--no-genesis` nad tímto snapshotem.
- Tím se zachová total supply a zůstatky, ale **ne zachovává historii bloků 0..tip** a je to efektivně **nový genesis / nový řetězec** (hard reset stavu, jen ne zůstatků).

To je v souladu s `ALPHA_BUILD_PLAN.md` §7, ale **nesplňuje požadavek "bez dalšího hard genesis resetu"**. Pokud má zůstat stejný řetězec (stejné block hashe od genesis dále), musí se jít **Cesta A** (full port) nebo **Cesta B** z checkpointu posledního V3 bloku bez vytvoření nového genesis.

## 5. Doporučení

- Pokud je striktní požadavek **"žádný hard reset"** a zároveň **"stejná síť"** (stejná block hashe od 0 dále), jediná možnost je **Cesta A** — full port V3 core do V31. Je to velký kus práce (desítky hodin) a měl by se rozdělit na samostatné fáze.
- Pokud je akceptovatelné **pokračovat od snapshotu posledního V3 stavu** bez replaye historie, je vhodnější **Cesta B** (light-node / checkpoint cutover). To odpovídá plánu v `ALPHA_BUILD_PLAN.md` ("core začít jako light node, ne full replica"), ale musí se upravit tak, aby se nevytvářel nový `migration block` na height 0 — místo toho se importuje snapshot jako `checkpoint` a nové bloky navazují na poslední V3 hash.

Jako první krok navrhuji:

1. Přidat `V31/L1/core/src/v3_compat.rs` s konstantami a typy pro V3 hlavičku, transakci a hashování.
2. Implementovat `MiningHeader` + `cosmic_harmony_ekam_deeksha_v2` pro nové bloky.
3. Upravit `migration.rs` tak, aby nezakládal nový `migration block`, ale snapshot importoval jako checkpoint pod posledním V3 hash.

Dokud nebude Cesta A/B hotová, `V31` zůstává testovací větev a produkční track zůstává `V3/`.

## 6. Reference

- V3 `genesis_hash()`: `V3/L1/core/src/bin/get-genesis-hash.rs`
- V3 genesis logika: `V3/L1/core/src/genesis.rs`
- V3 block/tx typy: `V3/L1/core/src/lib.rs`, `V3/L1/core/src/tx.rs`
- V3 PoW: `V3/L1/cosmic-harmony/src/deeksha.rs`, `algorithms_opt.rs`
- V3 chain runtime: `V3/L1/core/src/chain.rs` (~7700 řádků)
- V31 core: `V31/L1/core/src/{genesis,block,transaction,consensus}.rs`
- F4 report: `V31/F4_VERIFICATION_REPORT.md` (Fáze 5 Cutover)
