# ZION V3 — post-audit / hardfork chain report

**Vygenerováno (UTC):** 2026-05-06T21:59:28Z  
**Git `HEAD`:** `f4772132` (repo root `2.9.6`)

Tento soubor je jednorázové shrnutí po interním auditu V3 a po konsolidaci **tx-hash v2** + **BLAKE3 Merkle body root** (F2 / §3.2), s praktickou kontrolou P2P/směru synchronizace v testech, pool logiky a živého řetězce přes RPC. Není náhradou externího auditu ani provozního runbooku — autoritativní texty zůstávají v odkazovaných dokumentech.

---

## 1. Audit a hardfork — stav v repozitáři

| Oblast | Shrnutí | Zdroj |
|--------|---------|--------|
| Najdůležitější nálezy F1–F6 + §3.2 | Uzavřené / aktivované v produkční větvi; **F3b** vyžaduje rotaci kredencí a (po ní) history scrub | [V3/docs/audits/2026-04-V3_AUDIT_COMPLETION.md](V3/docs/audits/2026-04-V3_AUDIT_COMPLETION.md) |
| Operační playbook 1–7 | Bootstrap P2P, čistý datadir, rehearsal feature | [V3/docs/operational/AUDIT_CLOSEOUT_1_THROUGH_6.md](V3/docs/operational/AUDIT_CLOSEOUT_1_THROUGH_6.md) |
| Mainnet konsensus od genesis | Produční build **bez** `testnet_fork_rehearsal`: `TX_HASH_V2_ACTIVATION_HEIGHT = 0`, `BODY_ROOT_V2_ACTIVATION_HEIGHT = 0` | [V3/L1/cosmic-harmony/src/deeksha.rs](V3/L1/cosmic-harmony/src/deeksha.rs), [StatusV3.md](StatusV3.md) |
| Rehearsal na živém testnet drillu | `cargo build … --features testnet_fork_rehearsal`; skript | [V3/scripts/hardfork-rehearsal-testnet.sh](V3/scripts/hardfork-rehearsal-testnet.sh) |

**Důsledek:** produkční binárky očekávají **nový řetězec od bloku 0**; migrace starého XOR / tx-v1-only stavu není kompatibilní bez dedikovaného release plánu (viz dokumentace výše).

---

## 2. Živý řetězec — RPC kontrola (Mainnet)

**Metoda:** `zion node rpc getChainInfo` přes dočasnou konfiguraci `~`-style TOML s RPC hostem z lokálního `~/.zion/zion.toml` použitého při měření (`91.98.122.165:8443`).

**Výsledek `getChainInfo` (aktuální snapshot):**

```json
{
  "accepted_blocks": 19210,
  "chain_height": 19209,
  "consensus_profile": "cosmic_harmony_ekam_deeksha_v2",
  "mempool_transactions": 1,
  "network": "Mainnet",
  "protocol_version": "zion-v3-node/0.1",
  "tip_hash": "001183c00f43f0f6a1cd49f713a0fe6170d0790c531d195531836a03e2591b90",
  "transaction_model": "account",
  "utxo_validation_available": true
}
```

**Poslední 3 hlavičky bloků (`zion node blocks 3`):**

| Height | Prefix hash | txs |
|-------:|-------------|----:|
| 19210 | `00120df884843420…` | 4 |
| 19209 | `001183c00f43f0f6…` | 4 |
| 19208 | `00148c916f412657…` | 4 |

**Interpretace:** řetězec roste konzistentně (`accepted_blocks ≈ chain_height + 1`), tip hash odpovídá řádku výšky 19209 ve výpisu bloků; konsenzus je **Ekam Deeksha v2**; mempool není nasycený (1 tx).

---

## 3. P2P a synchronizace

**Živý P2P stav (`zion node peers`):** zobrazena položka `91.98.122.165:8333 height=0` — v tomto snapshotu nevypovídá o tom, zda jde o vlastní adresu, seed, nebo zastaralý height v tabulce peerů; pro plnou operační kontrolu synchronizace je potřeba **druhý uzel** s `ZION_SEED_PEERS` směřujícím na koordinátora (viz close-out dok. §7) a ověřit rovnost výšky a tip hash napříč instancemi.

**Automatické testy (provedeno v době reportu):**

| Test | Crate | Výsledek |
|------|-------|----------|
| `tests::p2p_get_blocks_since_returns_accepted_blocks` | `zion-core` | ✅ pass (~162 s — PoW-heavy cesta v dev profilu) |

Test pokrývá sémantiku **`GetBlocksSince` / dovoz kontiguálních bloků** v runtime (základ pro „sync přes žádosti bloků”). Další varianty **`p2p_announce_*`** v `zion-core` existují v lib test suite; úplný běh všech „p2p_*“ nebyl v tomto běhu serializován kvůli délce.

---

## 4. Mining a pool — E2E chování

**Integrace pool logiky:**

```text
cargo test -p zion-pool -- --test-threads=1
→ 29 passed, 0 failed
```

**(Session routing, váhy, Prometheus/log rozšíření, mapování stale/rejected z upstreamu)**

**Miner ↔ pool ↔ node (operativní náhled):** v nedávných ručních bězích proti **`204.168.245.175:8444`** proběhlo navázání stratum (**`welcome`**), práce **`mining job_*`**, řada **`share_status="Accepted"`** a řízení obtížnosti ze strany poolu. Tento report neukládá konkrétní peněženky ani výkonové hodnoty z těch běhů.

---

## 5. Hardfork gate — regresní testy (produkční default)

Ověřeno, že v **produkčním** profilu (`not(testnet_fork_rehearsal)`) zůstávají aktivace od genesis:

```text
cargo test -p zion-cosmic-harmony deeksha::tests::tx_hash_v2_active_from_genesis -- --exact --test-threads=1   → ok
cargo test -p zion-cosmic-harmony deeksha::tests::body_root_v2_activation_height_is_genesis -- --exact --test-threads=1 → ok
```

---

## 6. Nedostupy / limity tohoto běhu

- **`204.168.245.175:8443`** z prostředí generování reportu: **Connection refused**. Primár bootstrap z dokumentace tedy **nebyl** z této instance dosažitelný; živý snapshot řetězce pochází z hosta **`91.98.122.165`** (aktuální uživatelská `zion` konfigurace).
- Dedikovaný soubor **`L1/pool/tests/chv4_e2e.rs`** se v této době **větve repo v `V3/L1/pool`** nenachází; E2E pro legacy název v dokumentaci TIER plan — nahrazeno **29 unit/integration testy** v `zion_pool` crate dle Cargo layoutu.
- Celý **`cargo test --workspace`** přes všechny slow / ignored Pow testy report neobsahuje; pro release sweep viz [StatusV3.md § Clean gate](StatusV3.md).

---

## 7. Závěr

- **Řetězec:** z měřeného RPC uzlu plyne běžící **Mainnet** s **Ekam Deeksha v2**, řádově ~**19k** bloků, konzistence `accepted_blocks` / výšky a tip hash s výpisem bloků.  
- **P2P sync:** kryto alespoň jedním těžkým **sync-semantika** unit testem; meziuzlové ověření vyžaduje druhý uzel podle operační dokumentace.  
- **Mining path:** pool crate testy čistě; ostré běhy miníru úspěšně akceptovány poolem při měření mimo tento snapshot.  
- **Hardfork v produkci:** tx-hash v2 + BLAKE3 body root **od genesis** podporováno přímými **deeksha** testy na tomto stroji.

Pro další kroky: dokončit **P0 rotaci** (`SECURITY_NOTICE_2026-04-28.md`), volitelný **harvest scrub**, a na produkčních hostech spárovat více uzlů s jednotným **`getChainInfo` / tip hash** jako hlavní důkaz přímé P2P synchronizace.
