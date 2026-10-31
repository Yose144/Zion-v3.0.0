# L6 DeSci — `/l6-issobella/papers` repozitář + L1 hash anchor design

**Audit item:** 6.B4 (druhá půlka; první = `L5_PROOF_OF_IMPACT.md` ✅ 30. 10.)
**Datum:** 2026-10-31 · **Stav: design — implementace 3.3**

## Cíl

Veřejný repozitář vědeckých výstupů L6 Issobella (papers, datasets, mission
observations) s **kryptografickým důkazem existence a integrity na L1** —
každý paper je timestamp-anchored on-chain, publikovaný obsah nelze zpětně
pozměnit bez detekce.

## Co už existuje

- `Transaction.memo: Vec<u8>` — nativní memo pole (`transaction.rs:47`), wire
  serializované + hashované; SHOPPAY/`bridge_unlock_memo` ukazují produkční
  memo pattern.
- `l1_scanner.rs` — Issobella už skenuje bloky (fund_address outputs);
  rozšiřitelné na memo-pattern detekci.
- `issobella_router` — missions/proposals/fund endpointy; paper surface se
  přidá jako další router skupina.
- `blake3` — kanonický L1 hash (crypto.rs, merkle_root).

## Datový model (SQLite, `issobella-v31.db`)

```sql
CREATE TABLE papers (
    id TEXT PRIMARY KEY,                -- "pap-<ulid>"
    mission_id TEXT,                    -- volitelný FK missions.id
    proposal_id TEXT,                   -- volitelný FK research_proposals.id
    title TEXT NOT NULL,
    authors TEXT NOT NULL,              -- JSON array ["name", ...]
    abstract_text TEXT,
    content_sha256 TEXT NOT NULL,       -- blake3 hex of file bytes
    content_url TEXT,                   -- https / ipfs:// cid / ipns://
    submitted_by TEXT NOT NULL,         -- "zis:<user.id>" (stejný vzor jako QV)
    status TEXT NOT NULL DEFAULT 'submitted',
        -- submitted → anchoring → anchored → published
        --                          ↘ anchor_failed
    anchor_txid TEXT,                   -- L1 tx nesoucí memo anchor
    anchor_height INTEGER,
    anchor_mode TEXT,                   -- 'memo-direct' | 'merkle-batch:<batch_id>'
    merkle_path TEXT,                   -- JSON proof (jen merkle-batch)
    created_at TEXT NOT NULL,
    anchored_at TEXT,
    published_at TEXT
);
CREATE TABLE anchor_batches (
    batch_id TEXT PRIMARY KEY,          -- "iss-<date>-<seq>"
    merkle_root TEXT NOT NULL,
    paper_count INTEGER NOT NULL,
    anchor_txid TEXT,
    anchor_height INTEGER,
    created_at TEXT NOT NULL
);
```

## API (rozšíření `issobella_router`)

| Route | Metoda | Gate | Popis |
|---|---|---|---|
| `/api/v1/papers` | GET | public | published papers (+ `?all=1` admin) |
| `/api/v1/papers` | POST | ZIS session | submit `{title,authors,abstract,content_url,content_sha256}` |
| `/api/v1/papers/:id` | GET | public | detail + anchor info |
| `/api/v1/papers/:id/proof` | GET | public | `{content_sha256, anchor_txid, anchor_height, merkle_path?, verify_hint}` |
| `/api/v1/papers/:id/publish` | POST | admin | submitted→published (vyžaduje anchored) |
| `/api/v1/anchor/run` | POST | admin/cron | spustí anchor sweep nad `submitted` frontou |

Server ověřuje `content_sha256` proti staženému obsahu (pokud `content_url`
fetchable) nebo přijímá pre-computed hash s `verified_hash` flagem.

## L1 anchor — dva režimy

### v1 `memo-direct` (MVP)

Jedna tx per paper: spender = `ISS_ANCHOR_WALLET` (daemon ops key, analog
`ZION_DAO_TREASURY_KEY` custody patternu), memo =
`ISSPAPER:v1:<blake3(content)>` (34 B prefix+hash), 0-value output na sentinel
adresu `zion1issobella-anchor` (burn-style). Po broadcastu: `anchor_txid`,
`anchor_height` (z `get_tx` po finality), status `anchored`.

Náklad: 1 tx + fee per paper — OK při nízkém objemu (<10/den).

### v2 `merkle-batch` (škálování)

Periodicky (cron/`/anchor/run`): vezmi `submitted` frontu → blake3 merkle
root → jedna tx `ISSANCHOR:v1:<root32>`; per-paper `merkle_path` uložena do
`papers.merkle_path`. 1 tx/day nezávisle na objemu. Ověření = path replay
→ root → memo root v anchor tx.

**GRANDPA/finality:** anchor se píše až když tx má `finality_blocks` (stejná
konstanta jako scanner) — reorg-safe.

## Verifikační tok (public)

1. `GET /api/v1/papers/:id/proof` → `content_sha256` + `anchor_txid`
2. Klient stáhne paper, přepočte blake3 → porovná `content_sha256`
3. `GET /api/blockchain/tx/:txid` (existující explorer API) → memo obsahuje
   hash → potvrzeno timestamped existence
4. merkle-batch: navíc replay `merkle_path` → root == memo root

## Web surface `/l6-issobella/papers`

Next.js stránka (website-v2.9): list z `GET /api/v1/papers` — title, authors,
datum, anchor badge (`anchored @height` → explorer tx link), "Verify" link
→ `/proof` JSON. Submission = pozdější fáze (formulář za ZIS login).

## Implementační rozsah (~250 LOC, 3.3)

- `db.rs`: 2 tabulky + CRUD (~80)
- `api.rs`: 6 routes (~90)
- `anchor.rs` nový: memo-direct + batch worker + tx submit přes existující
  `dao_client`/node RPC (~80)
- Website page: 1 stránka + copy

**Gating:** publish/anchor admin-gated (ops), submit ZIS-gated — žádný
permissionless write do anchor path. `ISS_ANCHOR_WALLET` env-configured;
bez klíče status zůstává `submitted`/`pending_anchor` (vzor
`awaiting_broadcast` z `treasury_tx.rs`).

## Rizika / rozhodnutí k review

- **Content custody:** anchor dokazuje existenci+integritu, ne dostupnost —
  `content_url` (ipfs doporučeno) je mimo scope L1.
- **Anchor cost:** memo-direct 1 fee/paper; batch pokud >~10/den.
- **PII:** `authors` je veřejné pole — submit copy musí vyžadovat souhlas.
- Rozhodnutí 👤: `zion1issobella-anchor` sentinel adresa + ops wallet custody.
