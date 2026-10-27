# Payout Ledger Reconcile — 2.S2 (2026-10-27)

## Verdikt: ⚠️ reálné on-chain double-payouts v malé míře + ledger stamping bug — P0 fix nasazen

Reconcile `payouts` tabulky (SQLite `pool-store.db`, 210 151 řádků):

### Autoritativní čísla

- `p1 JOIN p2 ON address,height,amount_flowers, tx_id!=tx_id, p1.id<p2.id`:
  **1 500 párů celkem**, z toho **1 441 both-confirmed ≈ 5.9 M ZION**
  (předchozí odhad ~70 M byl artefakt volnějšího joinu — přepočítáno).
- Posledních 7 dní: **37 párů ≈ 120 k ZION**; 26. 10.: 2 páry.
- Všechny páry mají `p2.ts − p1.ts ≈ 30 s` (násobky ~15 min u starších) =
  **jeden sweep interval** → in-process mechanismus, ne restart.

### Dva defekty (oba fixnuty)

1. **Ledger stamping bug** (`payout.rs:190`) — `record_payout` stampoval
   každý řádek `payouts.first().height` (hlava batch) místo vlastní výšky
   položky. Batch může míchat výšky (více `on_block_found` kol mezi sweeps)
   → **phantom duplicity v ledgeru**: dva legitimní výplaty za různé bloky
   se stejnou částkou (konstantní reward × stabilní PPLNS podíl) vypadají
   jako double-pay. Neurčitelný podíl z 1 441 párů je pravděpodobně tento
   artefakt — po fixu je re-count smysluplný.
2. **Ambiguous-submit resubmit** (`payout.rs:176/184`) — `submit_utxo_transaction`
   error přes `?` **tichě zahazoval položky** (ztracená výplata) a ad-hoc
   `tx_id` validace (`64-hex`) při nejednoznačné response **requeue+resubmit**
   → okno pro skutečný double-pay (node mohl tx přijmout).

### Fix (nasazeno)

- Per-entry `height` v `PayoutRecord` (ř.200).
- Submit response se parsuje sdíleným striktním
  `deferred_payout::parse_payout_submit_response` (nyní `pub`).
- Nový invariant: **requeue jen při explicitním rejectu** (`error` field
  nebo `result.accepted=false`) NEBO po `inputs_still_unspent` probe —
  re-fetch pool UTXO set, všechny tx inputy stále unspent ⇒ nic nespadlo,
  resubmit safe. Inputy spent/probe fail ⇒ treat-as-landed, drop + warn
  (fail-closed, at-most-once — 2.S2 invariancia).
- Regresní testy: `payout::tests::{rejected_envelope_allows_requeue,
  indeterminate_envelope_never_counts_as_rejection}` — 17/17 payout modulů OK.

### Historické stavy (neměnné evidence)

- Známé on-chain double-pays (both-confirmed různé tx, stejná amount):
  ~5.9 M ZION před stamping-korekcí — přesný true-positive podíl nelze
  z DB odlišit; ponecháno jako incident evidence, nikoli přepsáno.
- `on_block_found` in-process dedup (`paid_block_heights`) je čistý;
  `on_coin_revenue` zion nemůže produkovat (`native_payout_coins="prl"`);
  `deferred` queue dead-code (žádní produkční enqueueři); multichain
  `execute_payouts` na EDGE2 nikdy nelogovalo `payout executed` (pool=None).

### Gate status

- **2.S2**: gate = 0 duplicit za G8 okno — **FAILS dosud**; post-fix okno
  začíná od nasazení fixu, re-count po stamping fixu dá přesný baseline.
- Operator akce (👤): treasury dopad reálných duplicit (max ~5.9 M ZION);
  žádná DB rekonstrukce (historie = evidence).

### Reprodukce post-fix verify

- 24–48 h po deployi: re-run exact-amount pair dotaz; očekávaný zbytek
  = pouze legit equal-amount consecutive-height řádky (už ne stamped-artefakt,
  protože height teď je per-entry) → ideálně 0 nových párů.
