# DAO disbursement tx flow — design (6.B5)

**Datum:** 2026-10-31 · **Audit item:** 6.B5 · **Stav: design pro realizaci 3.3**
**Audit poznámka:** „DAO disbursement: exekuce je dnes summary-only — design tx flow s guardian multisigem (realizace 3.3)"

## 1. Současný stav (code-verified)

| Vrstva | Artefakt | Chování dnes |
|---|---|---|
| Proposal execution | `runtime.rs::execute_proposal` | Approved → timelock → `Executed` + **summary string** (`"Treasury: X flowers to Y"`). Žádná transakce, žádná treasury op — **summary-only** (audit zjištění správné) |
| Guardian multisig model | `treasury.rs` | `Treasury{guardians, threshold=5-of-7, pending}`, `submit_operation` (jen guardian), `add_signature` (threshold→execute), `DAILY_SPEND_LIMIT` = 100M ZION |
| **Reálná tx pipeline** | `treasury_tx.rs` | **UŽ EXISTUJE:** guardian Ed25519 sig nad `dao:treasury:v1\|op_id\|sha256(op_json)` → threshold → `fetch_utxos` → `build_unsigned_spec` → `sign_and_broadcast` (`ZION_DAO_TREASURY_KEY`) → `executed`+tx_id; bez klíče → `awaiting_broadcast` + exportovatelný spec |
| API | `api.rs` | `POST /treasury/submit` (guardian-only), `/sign`, `/execute`; `GET /api/dao/guardians` registry |
| Persistence | `db.rs` | `treasury_ops` + `treasury_sigs` tabulky existují |

**Skutečná díra** není „chybí tx pipeline" — ta je hotová. Díra = **chýbí most**: schválený proposal typu `Treasury`/`Grant`/`Humanitarian` se spustí jako summary-string a **nikdy nevytvoří `TreasuryOperation`**. Operátor musí op zadat ručně — žádná vazba proposal→op kromě nepovinného `proposal_id` pole.

## 2. Cílový tok (navržený)

```
proposal (Treasury/Grant/Humanitarian) Approved → timelock uplyne
        │
        ▼  execute_proposal — nová větev pro money-typy
derive_treasury_op(proposal)   // deterministicky ze STORED proposal parametrů
        │  op_id = "prop-{id}-disb"   // idempotent — 1 disbursement per proposal
        ▼
INSERT treasury_ops (op_id, operation_json, status='pending', proposal_id)
        │  duplicita op_id → skip (re-execute safety)
        ▼
event "treasury_op_pending" → guardian notifikace (dao_events bus, UI badge)
        │
        ▼  guardian sign flow (EXISTUJÍCÍ /treasury/sign)
sig over dao:treasury:v1|op_id|sha256(op_json) → treasury_sigs
        │
        ▼  threshold 5/7 → auto-trigger (nové) NEBO operátor /treasury/execute
fetch_utxos(treasury_addr) → build_unsigned_spec →
        │  ZION_DAO_TREASURY_KEY configured?
        ├─ ano → sign_and_broadcast → status='executed', tx_id → event "disbursed"
        └─ ne  → status='awaiting_broadcast' + exportable spec (ruční broadcast)
```

**Beze změny pro ostatní typy:** Parameter/Emergency/Admission/… zůstávají summary (nemají disbursement).

## 3. Bezpečnostní pravidla návrhu

1. **Op je odvozený ze stored proposal** — nikdy re-entered params. Recipient/amount z `proposal.proposal_type` v okamžiku execution (stejná disciplína jako `build_unsigned_spec` — executor odmítne odchylku).
2. **Idempotent op_id** `prop-{proposal_id}-disb` — re-execute proposalu (restart, retry) nemůže vytvořit druhou op; `INSERT OR IGNORE` + existující `UNIQUE` op_id.
3. **Jeden proposal = jeden disbursement** — `Rebalance` zůstává manual-only (nemá proposal_id).
4. **Daily cap se aplikuje při execute**, ne při op-create (`treasury.execute_operation` už checkuje `DAILY_SPEND_LIMIT`).
5. **Guardian sig = autorizace, custody key = exekuce** — obě nutné (existující threat model v `treasury_tx.rs`); proposal approval ≠ podpis — guardians signují až vytvořenou op.
6. **Audit trail**: proposal.executed → op created → sigs → broadcast tx_id — vše persistované v `treasury_ops`/`treasury_sigs`/`dao_events` (public `/api/dao/treasury/ops` ukazuje status+tx_id).

## 4. Touchpoints pro realizaci (3.3)

| Soubor | Změna | Velikost |
|---|---|---|
| `runtime.rs` | `execute_proposal`: po `mark_executed` pro money-typy zavolat `create_treasury_op_from_proposal(&self, proposal)` → insert treasury_ops + event | ~60 řádků |
| `treasury_tx.rs` nebo nový `disburse.rs` | `derive_treasury_op(proposal) -> TreasuryOperation` (map Treasury→Spend, Grant→Spend, Humanitarian→HumanitarianGrant, GoldenEgg→GoldenEggPrize) | ~40 řádků |
| `api.rs` | auto-execute na threshold volitelně (opt-in `ZION_DAO_AUTO_EXECUTE=1` — default ruční `/execute` pro ops kontrolu); `GET /api/dao/proposals/{id}/disbursement` status endpoint | ~50 řádků |
| `db.rs` | `insert_treasury_op` existuje; `get_treasury_op_by_proposal` pro idempotencí check | ~15 řádků |
| migrace | žádná — `treasury_ops`/`treasury_sigs` schéma stačí; `proposal_id` už je v `TreasuryOperation` | 0 |

## 5. Předpoklady mimo kód (👤)

- **4.B8** — guardian registry live deploy (`/api/dao/guardians` 404 fix), treasury sign flow + `ZION_DAO_TREASURY_KEY` custody key — **blokuje end-to-end, ne design**
- Notifikace guardianům o pending ops (dao_events → webhook/UI — existuje event bus, UI badge follow-up)

## 6. Testy při realizaci

- `proposal_treasury_execute_creates_op` — approve+timelock+execute → treasury_ops row `pending` se správným (recipient, amount, proposal_id)
- `execute_twice_is_idempotent` — re-run nevznikne druhá op
- `threshold_then_executed` — 5 sigs → `execute_treasury_op` → tx spec → broadcast path (regtest node jako u 1.S4 harnessu)
- `daily_cap_blocks` — op nad limitem → `DailyLimitExceeded`, ne partial
- `summary_only_for_non_money` — Parameter proposal nestvoří op

## 7. Verdikt

**Design hotový** — pipeline komponenty už existují (`treasury_tx.rs` je produkční-real, ne stub), chybí jen most proposal→op + opt-in auto-execute. Realizace odhad ~165 LOC + testy, gated na 4.B8 ops předpoklady. Nic z návrhu nemění konsensus/governance sémantiku — proposal approval zůstává stejný, disbursement je nova persistovaná exekuční vrstva.
