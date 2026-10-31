# REPORT — 4.B3: Deferred outbox durability + atomic daily-volume-cap (2026-10-31)

Audit residual z `EXTERNAL_AUDIT_SCOPE.md` §5 ("Pool durability, deferred
outbox and daily-cap atomicity remain source risks"). Tři nezávislé díry
v money-path, všechny ošetřené fail-closed.

## (a) WARP daily-volume-cap — atomicita (multichain)

**Díra:** `initiate_outbound` persistoval transfer row (`db.save`) a potom
zvlášť bumpoval `daily_volume` (`db.record_daily_volume` — best-effort,
jen `warn!`). Crash mezi oběma zápisy (nebo selhání druhého) zanechal
durable transfer, který se do denního capu nepočítal → po restartu cap
podbil a bridglo se víc než limit.

**Fix:** nová `TransferDb::save_and_record_daily_volume` — `INSERT INTO
transfers` + `INSERT … ON CONFLICT DO UPDATE daily_volume` v JEDNÉ
`conn.transaction()`. Router volá tuto metodu před jakýmkoliv in-memory
publish (původní "persist before publish" pořadí zachováno); selhání =
`Err` → transfer se nepřijme. `record_daily_volume` zůstává pro
samostatné/legacy volání.

**Soubory:** `V31/L2/multichain/src/warp/db.rs`, `src/warp/router.rs`.
**Test:** `test_save_and_record_daily_volume_atomic` — obě strany
commitnuté, akumulace, izolace chainů. Navíc stávající
`test_initiate_fails_closed_on_save_error` teď implicitně ověřuje
rollback obou řádků.

## (b) Pool drain-persist — fail-closed (pool)

**Díra:** `take_pending_payouts`/`take_external_payouts` vydrainovaly
`pending_payouts` v paměti a zavolaly `persist_payout_ledger` **best-effort**
(fail = jen warn). Když zápis selhal a proces spadl mid-submit, restore
ledgeru obsahoval payouty znovu → sweep je poslal podruhé (double-pay
okno, IA-14 residual).

**Fix:** `persist_payout_ledger` → `bool`. Oba drainy při selhání persistu
vrátí položky zpět do fronty a předají sweepu prázdný batch. Memory a
disk zůstávají konzistentní → crash re-sweepne, ne double-payne.
Additivní cesty (`requeue_payouts`, `mark_payout_sent`) zůstávají
best-effort — jejich in-memory stav je správný tak či tak.

**Soubor:** `V31/L1/pool/src/pool.rs`.

## (c) DeferredPayoutQueue — durable outbox (pool)

**Díra:** `DeferredPayoutQueue = Arc<Mutex<Vec<DeferredPayout>>>` byla
čistě in-memory a `queued_at: Instant` ji dělala neserializovatelnou.
Payouty do ní vložené (po drainu z `pending_payouts`) po restartu
zmizely **natrvalo** — ani ztracené, ani re-queued: tichá payout loss.

**Fix:**
- `queued_at: Instant` → `queued_at_unix: u64` + `Serialize/Deserialize`.
- `persist_deferred_queue` / `load_deferred_queue` — sidecar
  `<state_path>.deferred.json`, stejná disciplína jako payout ledger
  (tmp + fsync(file) + rename + fsync(dir)); corrupt → karanténa
  `<path>.corrupt-<unix>` + Err (fail-closed, ne silent-empty).
- `enqueue_deferred` persistuje po push; processor persistuje po
  `remove(0)` (success i giveup).
- `main.rs` na startu frontu restoreuje (missing file = empty; corrupt =
  warn + empty start po karanténě — evidence zůstává, operátor rozhodne;
  naprosto konzistentní s politikou "pool musí sloužit minerům").

**Soubory:** `V31/L1/pool/src/deferred_payout.rs`, `src/main.rs`.
**Testy:** `deferred_queue_survives_restart` (enqueue→persist→load),
`deferred_queue_corrupt_is_quarantined` (corrupt → karanténa, původní
soubor zachován vedle).

## Ověření

| Testy | Výsledek |
|---|---|
| `zion-multichain --lib warp::` | **654/655** ✅ (1 ignored) |
| `test_save_and_record_daily_volume_atomic` | ✅ |
| `zion-pool --lib deferred` | **17/17** ✅ (vč. 2 nových) |
| `zion-pool --lib` (celý) | 428/430 ✅ — 2 fail = pre-existing env flakes (`pearl_stratum_end_to_end` — padá i na čistém HEAD; `tls_config_from_env_some` — env-var race, izolovaně OK) |
| `cargo check --bins` | ✅ čisté |
| `cargo fmt --check` (zion-pool, zion-multichain) | ✅ |

## Residual / poznámky

- **Deploy pending** — source-level fix; nasazení na EDGE až při dalším
  pool/multichain deployi (žádná urgentní hot-path změna).
- `record_daily_volume` zůstává public (samostatné volání / testy) —
  produkční cesta jde přes atomic variant.
- Deferred retry_count se persistuje jen při strukturálních změnách
  (push/remove), ne každý tick — restart resetuje počítadlo, bezpečný
  směr (víc retry, ne méně).
- Daily cap zůstává per-process mapa seedovaná z DB — více warpd instancí
  sdílející DB by cap počítaly lokálně (dnes jediná instance, dokumentováno).
