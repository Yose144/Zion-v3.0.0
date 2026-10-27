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

### ⚠️ Post-mortem addendum — regrese při 2.S2 fixu (fixnuto `996162bf7`, deployed `f5364566`)

První 2.S2 revize (`ae2a09489`) zavedla kontraktní bug: `submit_utxo_transaction`
unwrapovala `result`, ale `parse_payout_submit_response` očekává celý
envelope → **každý accepted submit** se četl jako "no result" → indeterminate
→ input-probe viděl spent inputy → entries dropped as-landed.

- **Okno 00:19–08:56 UTC:** ~94 payout tx — **všechny on-chain accepted**
  (minery placené přesně 1×, at-most-once invariant **držel**), ale ledger
  rows chybí + `sent_payouts` neoznačeno. Live důkaz zachycen v journalu:
  `payout submit indeterminate and inputs spent ... tx_id=...`.
- **Fix:** `submit_utxo_transaction` vrací raw envelope; parser klasifikuje
  (`f5364566` od 08:56 UTC — payout flow + rows resumed, 0 indeterminate).
- **Unrecorded backfill (provedeno 27. 10.):** 99 unikátních tx_ids z
  journal warn řádků → `getTransaction` na node :9446 → **99/99 resolved,
  0 missing, 288 recipient outputs, ~551 364 ZION**. Candidate SQL uložen
  na EDGE `/root/backfill-unrecorded-payouts.sql` (288 INSERTů;
  `height`=inclusion height — rewarded height ≈ inclusion−1..2, caveat
  zdokumentován; `miner_id`=address). **Aplikace = 👤 operátorské
  rozhodnutí** — script `/root/backfill-unrecorded-payouts.py` je
  read-only a re-runnable.
- **Lekce:** kontrakt envelope-vs-result testovat přes `parse_...` unit
  test s REÁLNÝM node response (shape `{"result":{"accepted":true,
  "model":"v31-native","tx_id":...}}` nyní v test suite pokryt přes
  `parse_submit_accepts_canonical_object` v deferred tests).
