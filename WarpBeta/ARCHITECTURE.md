# WARP Beta — Architektura

> Technický design ZION ↔ BTC HTLC atomic swapu. Stav: návrh v0.1 (2026-09-17).

## 1. ZION L1 HTLC (existuje, mainnet)

Konsensem vynucovaný HTLC output — `V31/L1/core/src/utxo.rs::verify_input`.

### Output script (105 B)

```
[1B 0x01][32B hashlock][8B timeout][32B claimant_pubkey][32B refund_pubkey]
```

| Pole | Velikost | Význam |
|---|---|---|
| prefix | 1 B | `0x01` = HTLC typ (empty script = standardní P2PKH) |
| hashlock | 32 B | `SHA-256(preimage)` — **stejný digest jako BTC `OP_SHA256`** |
| timeout | 8 B | u64 LE, **UNIX timestamp** (porovnává se s `block_timestamp`) |
| claimant_pk | 32 B | Ed25519 pubkey strany, která smí claimnout s preimage |
| refund_pk | 32 B | Ed25519 pubkey strany, které se vrací prostředky po timeoutu |

### Input scripts

```text
CLAIM  (128 B): <32B preimage><64B signature><32B pubkey>
REFUND (96 B):  <64B signature><32B pubkey>
```

### Konsensus pravidla

| Cesta | Podmínky |
|---|---|
| CLAIM | `SHA256(preimage) == hashlock` ∧ `block_timestamp < timeout` ∧ validní Ed25519 sig claimant_pk ∧ tx má **přesně 1 output** na `derive_address(claimant_pk)` |
| REFUND | `block_timestamp >= timeout` ∧ validní Ed25519 sig refund_pk ∧ tx má přesně 1 output na refund adresu |

Vynucení cílové adresy na úrovni konsensu = claimant/refund nemůže být přesměrován.

### Buildery

`zion_core::v31_wallet::{build_htlc_lock, build_htlc_claim, build_htlc_refund}` — používá je `zion_l1.rs` adapter (`htlc_lock`/`htlc_claim`/`htlc_refund`, routováno přes `transfer.id` prefixy `htlc-lock-`/`htlc-claim-`/`htlc-refund-`).

### HTTP API (warpd, `127.0.0.1:8454`)

```
POST /v1/multichain/swaps/htlc/lock
POST /v1/multichain/swaps/htlc/claim
POST /v1/multichain/swaps/htlc/refund
GET  /v1/multichain/swaps/htlc/pending
GET  /v1/multichain/swaps/htlc/escrow
GET  /v1/multichain/swaps/htlc/:hash
```

**E2E důkaz (2026-08-23, Edge):** lock 100 ZION → pending → block confirmation → claim s 32B preimage → claimed. Detail: `docs/3.2/NATIVE_L1_HTLC_REPORT.md`.

---

## 2. Bitcoin HTLC (návrh — CHYBÍ, k implementaci)

Bitcoin nemá account model — HTLC se realizuje **P2WSH witness scriptem** (SegWit v0; per-swap adresa, ne fixní watch address).

### Navrhovaný script

```text
OP_IF
    OP_SHA256 <H> OP_EQUALVERIFY
    <claimant_pubkey> OP_CHECKSIG
OP_ELSE
    <timeout> OP_CHECKLOCKTIMEVERIFY OP_DROP
    <refund_pubkey> OP_CHECKSIG
OP_ENDIF
```

- `claimant` = Bobův BTC pubkey (ten, kdo odhalí S)
- `refund` = Alicin BTC pubkey (vlastník BTC legu) — pozor na **opětovné použití rolí**: v každém legu swapu jsou role obrácené
- `<timeout>` jako CLTV block height (ne timestamp — determinističtější pro signet/testnet i mainnet)
- Output adresa: `P2WSH = SHA256(witnessScript)` → `bc1q…` / `tb1q…`; per-swap, únikátní pro každou dvojici (H, pk_claim, pk_refund, timeout)

### Kompatibilita hashlocku

ZION používá `SHA-256(32B preimage)` — identické s `OP_SHA256`. **Stejný preimage otevírá oba legs.** To je jádro atomarity.

### Timeout alignment

| Leg | Typ timeoutu | Poznámka |
|---|---|---|
| ZION | UNIX timestamp (s), `block_timestamp` | miner timestamp — drift řeší `TIMELOCK_DRIFT_TOLERANCE_SECS=120` v `HtlcRecord::is_expired` |
| BTC | CLTV block height nebo MTP timestamp | **doporučeno: block height**; konverze z ZION timestampu přes ~10min/block odhad + safety margin |

**Pravidlo bezpečnosti:** BTC leg timeout musí vypršet **později** než ZION leg (jinak griefing: refund na BTC + claim na ZION). Konvence: `T_btc = T_zion + Δ`, `Δ ≈ 6 h` (36 bloků). Alternativně „initiator has shorter timeout" — viz ROADMAP §risk.

---

## 3. Swap flow (ZION → BTC směr „Alice prodává ZION za BTC")

```text
Alice (ZION)                                  Bob (BTC)
   │                                             │
   │  0. off-chain: dohodnou amount, rate,       │
   │     addr, timeouts (T_zion, T_btc)          │
   │                                             │
   │  1. Alice: S = random32, H = SHA256(S)      │
   │     (S drží v tajnosti)                     │
   │                                             │
   │  2. Bob lock: BTC → P2WSH(H, pkA, pkB,      │
   │     T_btc)  ────────── BTC tx ──────────►   │
   │                                             │
   │  3. warpd vidí BTC lock (adapter watch,     │
   │     ≥1 conf), parsuje H ze scriptu          │
   │                                             │
   │  4. Alice lock: ZION → HTLC(H, pkB_claim,   │
   │     pkA_refund, T_zion)  (nativní L1)       │
   │                                             │
   │  5. Bob claim ZION: odhalí S on-chain       │
   │     → ZION leg claimed                      │
   │                                             │
   │  6. warpd/Alice extrahuje S z claim inputu  │
   │     → Alice claim BTC: witness [S, sigA,    │
   │     script]                                 │
   │                                             │
   └── done: Alice má BTC, Bob má ZION ──────────┘

   Abort path: kdokoliv nic nedělá →
   T_zion refund ZION Alici, T_btc refund BTC Bobovi.
```

Obrácený směr (Alice má BTC, chce ZION) je symetrický — iniciátor drží S.

### Role `warpd`

`warpd` není custodian — je to **koordinátor/watchtower**:
- generuje/ukládá per-swap `HtlcRecord` (SQLite)
- sleduje oba chainy (ZION RPC `getTransaction`/`getUtxos`; BTC mempool.space/esplora)
- extrahuje preimage z claim witness/input scriptu
- u initiator-legu udržuje S v keyringu (nikdy neleaks předčasně)
- refund sweep po timeoutu

Důvěra v `warpd` je omezená na **liveness**, ne na **solvency** — o prostředcích rozhodují scripty na obou chainech.

---

## 4. Memo / protokol

Existující L1 memo formát (account tx):

```
SWAP:LOCK:<hash_hex>:<timeout_min>:<chain>:<addr>[:<claimant_zion>]
SWAP:CLAIM:<hash_hex>:<preimage_hex>
SWAP:REFUND:<hash_hex>
```

Pro BTC leg OP_RETURN memo (deposit watcher už parsuje):

```
WARP_INBOUND:bitcoin:<hash_hex>:<zion_recipient>
```

Pro atomic swap se doporučuje **HTLC-native discovery**: BTC lock se detekuje přímo ze scriptu (známe H a oba pubkey z off-chain dohody / order booku), OP_RETURN slouží jen jako convenience metadata.

---

## 5. Bezpečnostní poznámky

1. **Preimage grinding** — preimage musí být 32 B náhodné (CSPRNG); hotovo v `SwapPreimage::random()`.
2. **Timeout griefing** — protistrana může nechat prostředky zamčené do timeoutu; mitigace = reputace/orderbook, ne kryptografie.
3. **Fee estimation** — BTC claim/refund musí mít dostatek sat/vB předem odhadnutých; `btc_signer::estimate_vbytes` existuje, pro P2WSH je potřeba přepočítat (witness script ~90 B → větší vsize).
4. **Dust/ekonomika** — minimální swap musí pokrýt BTC fees ×2 (lock+claim) + ZION fee.
5. **Adresa vs pubkey** — ZION HTLC ukládá raw 32B Ed25519 pk, BTC HTLC compressed 33B secp256k1 pk — mapování identit je off-chain záležitost swapu.
6. **Timestamp vs height** — viz §2; v0.1 doporučeno CLTV-height na BTC, timestamp na ZION, `Δ ≥ 6 h`.

---

## 6. Rozdíl oproti současnému „bridge" modelu

| | Současný EVM bridge | WARP Beta (HTLC) |
|---|---|---|
| BTC leg | fixní watch address + OP_RETURN | per-swap P2WSH script |
| Důvěra | 4/5 validator multisig | žádná (kryptografická atomarita) |
| Failure mode | validator collusion | timeout → refund, worst-case locked funds |
| wZION mint | ano (wrapped) | ne — přímý swap vlastnictví |
| Use-case | L1↔L2 peg | P2P výměna ZION↔BTC |

Oba modely koexistují: bridge pro wrapped likviditu (wZION na Base), HTLC swap pro trustless P2P výměnu.
