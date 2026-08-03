# V31 P2P Sync Report — 2026-08-03

> **Autor:** Devin (GLM-5.2 High) + Yose
> **Datum:** 2026-08-03
> **Verze:** v3.1.0-alpha.2
> **Tag:** `v3.1.0-alpha.2` (commit `2ed6d35c9`)
> **Stav:** ✅ V31 node LIVE na Edge, synchronizuje se s V3 mainnet

---

## 1. Cíl

Přinést V31 Mainnet Alpha codebase do production readiness tím, že se V31 node nasadí jako druhý node na Edge serveru (`62.171.141.136`) a synchronizuje se s V3 mainnet přes V3-compatible P2P protokol. Toto je Fáze D plánu `PLAN_TO_3.1.md`.

---

## 2. Výchozí stav

- V3 produkce běží na Edge (`zion-edge-node1.service`, height ~11175)
- V31 workspace existuje (`3.1.0-alpha.2`), 301+ testů prochází, clippy clean
- V31 nikdy předtím nebyla schopná synchronizovat se s V3 mainnet
- V31 P2P stack měl 5 nekompatibilit s V3

---

## 3. Problémy a řešení

Bylo identifikováno a opraveno **5 kritických nekompatibilit** mezi V31 a V3 P2P protokolem:

### Fix 1: Separate Seed Peers (`node.rs`)

**Problém:** V31 běžela dva P2P sync loopy souběžně — native V31 a V3-compatible. Oba se pokoušely připojit k V3 peerům. Native V31 handshake byl nekompatibilní s V3, což vedlo k `ProtocolViolation` banu od V3.

**Řešení:** `node.rs` upraven tak, aby native V31 P2P sync loop používal prázdný peer list, zatímco V3-compatible sync používá V3 seed peers. Native V31 handshake se tak nikdy nepošle V3 uzlům.

**Soubor:** `V31/L1/core/src/node.rs`

### Fix 2: NetworkId Serialization (`v3_p2p.rs`)

**Problém:** V3 očekávala `NetworkId` serializovaný v PascalCase (`"Mainnet"`), ale V31 ho posílala v snake_case (`"mainnet"`) kvůli `#[serde(rename_all = "snake_case")]`.

**Řešení:** Odstraněn `rename_all` atribut z `NetworkId` v `v3_p2p.rs`.

**Soubor:** `V31/L1/core/src/v3_p2p.rs`

### Fix 3: from_height Off-by-One (`v3_p2p.rs`)

**Problém:** V3's `accepted_blocks_since` používá striktně větší filtr (`block.height > from_height`). Pokud V31 požádala o bloky od height `N`, V3 poslala bloky začínající od `N+1`. V31 pak hlásila "parent block missing".

**Řešení:** `v3_p2p.rs` upraven tak, aby posílala `from_height = tip.height` (místo `tip.height + 1`). Stejná úprava provedena v sync loopu pro inkrementální fetching.

**Soubor:** `V31/L1/core/src/v3_p2p.rs`

### Fix 4: Block Hash Algorithm (`v3_compat.rs`, `v3_checkpoint.rs`)

**Problém:** V31's `V3Block::header_hash()` používala `cosmic_harmony_with_height` (algoritmus `cosmic_harmony_ekam_deeksha_v2`) pro všechny bloky. V3 ale používá height-aware dispatch:
- height 0 (genesis): `cosmic_harmony_with_height` (speciální případ v `genesis.rs`)
- height 1–4499: `deeksha_lite` (profile `deeksha_lite_v1`)
- height 4500–4999: `deeksha_chv3` (deleguje na `deeksha_lite`)
- height ≥ 5000: `deeksha_lite_fire`

V31 hash se neshodoval s V3 hash, což způsobovalo "previous hash mismatch".

**Řešení:**
1. `V3Block::header_hash()` upraven na height-aware dispatch odpovídající V3.
2. Přidán `stored_hash: Option<[u8; 32]>` field do `V3Block` — když blok přijde z V3 peer nebo checkpoint, hash se trustuje (stejně jako V3 trustuje `hash_hex` z wire, nepřepočítává).
3. `into_v3_block()` (wire → storage konverze) nastavuje `stored_hash` z `hash_hex`.
4. `Checkpoint::to_v3_block()` nastavuje `stored_hash` z `block_hash_hex`.

**Soubory:** `V31/L1/core/src/v3_compat.rs`, `V31/L1/core/src/v3_checkpoint.rs`, `V31/L1/core/src/v3_state.rs`, `V31/L1/core/src/v3_template.rs`

### Fix 5: Difficulty Validation (`v3_p2p.rs`)

**Problém:** V31 počítala LWMA difficulty z okna bloků. Po checkpoint importu měla v DB jen 1 blok (checkpoint), takže LWMA window neměla dost dat. V31 odmítala bloky s "difficulty mismatch".

**Řešení:** Když difficulty window má méně než `LWMA_WINDOW` bloků, V31 trustuje peer-provided difficulty (stejně jako V3, která při importu peer bloků vůbec nevaliduje difficulty).

**Soubor:** `V31/L1/core/src/v3_p2p.rs`

---

## 4. Nasazení na Edge

### 4.1 Build

V31 release binary buildnuta přímo na Edge serveru (Linux x86_64):

```bash
ssh root@2a02:c207:2342:5821::1
source ~/.cargo/env
cd /opt/zion/V31
cargo build --release -p zion-core
```

Binary: `/opt/zion/V31/target/release/zion-node` (5.1 MB)

### 4.2 Checkpoint Creation

V3 state export → V31 checkpoint JSON:

```bash
python3 /opt/zion/V31/scripts/v3-state-to-checkpoint.py /data/zion/state /opt/zion/data/v31/v3-checkpoint.json
```

Checkpoint obsahuje: V3 tip block header, final UTXO set, account balances.

### 4.3 systemd Service

Vytvořen `/etc/systemd/system/zion-v31-node.service`:

```ini
[Unit]
Description=ZION V31 Alpha Node (V3-compatible P2P sync)
After=network-online.target zion-edge-node1.service
Requires=zion-edge-node1.service

[Service]
Type=simple
User=zion
Group=zion
ExecStart=/opt/zion/V31/target/release/zion-node \
    --db-path /opt/zion/data/v31/node.db \
    --rpc 127.0.0.1:9445 \
    --p2p 0.0.0.0:8335 \
    --human zion1v31human \
    --issobella zion1v31issobella \
    --v3-checkpoint /opt/zion/data/v31/v3-checkpoint.json \
    --peer 127.0.0.1:8333
Restart=always
RestartSec=10
```

Environment: `/etc/zion/edge-v31-environment.sh`

### 4.4 Porty

| Služba | P2P | RPC |
|--------|-----|-----|
| V3 node1 | 8333 | 9443 |
| V3 node2 | 8334 | 8448 |
| **V31 Alpha** | **8335** | **9445** |

---

## 5. Verifikace

### 5.1 Checkpoint Sync

V31 se úspěšně synchronizovala z V3 checkpointu:

```
INFO zion_core::node: importing V3 checkpoint snapshot
INFO zion_core::node: V3 checkpoint import complete
INFO zion_core::v3_p2p: starting V3 sync from_height=11175
INFO zion_core::v3_p2p: V3 peer has no more blocks
```

V31 DB tip: height 11175, hash `0000044187DFC1BA11623165E39C3CEE0EF802ADEAA961197E0EF791989569A1`
V3 state tip: height 11175, hash `0000044187dfc1ba11623165e39c3cee0ef802adeaa961197e0ef791989569a1`

**Hash se shoduje.**

### 5.2 Live Block Sync

V31 přijímá nové bloky z V3 v reálném čase:

```
INFO zion_core::v3_p2p: V3 block accepted height=11184 synced=1
INFO zion_core::v3_p2p: V3 sync batch complete peer=127.0.0.1:8333 synced=1
```

V31 pravidelně polluje V3 (každých ~30s) pro nové bloky.

### 5.3 systemd Service Status

```
● zion-v31-node.service - ZION V31 Alpha Node (V3-compatible P2P sync)
     Active: active (running)
   Main PID: 1917297 (zion-node)
     Memory: 1.3M
```

Service je `enabled` (startuje po rebootu) a `active (running)`.

---

## 6. Modifikované soubory

| Soubor | Změny |
|--------|-------|
| `V31/L1/core/src/node.rs` | Separate seed peers pro native V31 vs V3 sync |
| `V31/L1/core/src/v3_p2p.rs` | NetworkId serializace, from_height, difficulty validation |
| `V31/L1/core/src/v3_compat.rs` | Block hash algorithm (height-aware dispatch + stored_hash) |
| `V31/L1/core/src/v3_checkpoint.rs` | Trust checkpoint hash_hex via stored_hash |
| `V31/L1/core/src/v3_state.rs` | stored_hash: None pro test bloky |
| `V31/L1/core/src/v3_template.rs` | stored_hash: None pro template bloky |

Commit: `2ed6d35c9` — 6 files changed, 83 insertions(+), 14 deletions(-)

---

## 7. Test Results

```
cargo test -p zion-core --lib
test result: ok. 301 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

Všechny 301 testů prochází, včetně:
- `v3_compat::tests::v3_genesis_hash_matches_mainnet` ✅
- `v3_p2p::tests::sync_v3_genesis_from_mock_peer` ✅
- `v3_checkpoint::tests::import_genesis_checkpoint` ✅
- `v3_validation::tests::*` (25 testů) ✅

---

## 8. Edge Server Konfigurace

### Nové soubory na Edge

| Cesta | Popis |
|-------|-------|
| `/etc/systemd/system/zion-v31-node.service` | systemd service pro V31 node |
| `/etc/zion/edge-v31-environment.sh` | Environment variables |
| `/opt/zion/data/v31/node.db` | V31 SQLite database |
| `/opt/zion/data/v31/v3-checkpoint.json` | V3 checkpoint snapshot |
| `/opt/zion/V31/target/release/zion-node` | V31 release binary |

### Service management

```bash
systemctl status zion-v31-node    # status
systemctl restart zion-v31-node   # restart
journalctl -u zion-v31-node -f    # live log
```

---

## 9. Co zbývá (next steps)

| Úkol | Stav | Poznámka |
|------|------|----------|
| A1.4 Key rotation | ⏳ PENDING | Air-gapped, vyžaduje user action |
| ANKR API key rotation | ⏳ PENDING | User action na Ankr dashboard |
| V31 pool + miner E2E | ⬜ | Pool a miner na V31 (Fáze B.2/B.3 completion) |
| V31 7d continuous run | ⬜ | 7d monitoring bez incidentu |
| V31 cutover (V3 → V31) | ⬜ | Rolling blue/green, V3 archivace |
| v3.1.0-beta release | ⬜ | GitHub release s binárkami |

---

## 10. Architektura po Fázi D

```
┌─────────────────────────────────────────────────────────────┐
│                    Edge Server (62.171.141.136)              │
│                                                             │
│  ┌──────────────┐  P2P 8333  ┌──────────────┐              │
│  │ V3 node1     │◄──────────►│ V3 node2     │              │
│  │ (primary)    │  P2P 8334  │ (follower)   │              │
│  │ RPC 9443     │            │ RPC 8448     │              │
│  └──────┬───────┘            └──────────────┘              │
│         │ P2P 8333                                         │
│         ▼                                                  │
│  ┌──────────────┐                                          │
│  │ V31 Alpha    │  V3-compatible P2P sync                  │
│  │ (zion-v31-   │  P2P 8335, RPC 9445                      │
│  │  node.svc)   │  Height 11184+                           │
│  └──────────────┘                                          │
│                                                             │
│  V3 pool (8444) │ V3 bridge │ V3 DAO │ V3 WARP │ V3 DEX    │
└─────────────────────────────────────────────────────────────┘
```

---

*Generated with [Devin](https://devin.ai) — 2026-08-03*
