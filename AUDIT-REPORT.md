# ZION 3.2 — Kompletní audit report

> **Datum:** 2026-10-25 · **Stav:** remediace nasazeny do produkce, ověřeny live
> **Zdrojový pin:** `4108a52d0b47702dd97fbd1d6f4919ceb1aca6a4`
> **Docs/deployment pin:** `d0e219f1a` (vše pushnuto na `origin/main`)
> **Externí auditor:** neangažován (G9 otevřený) — tento report je interní audit, ne nezávislý posudek.

Tento dokument shrnuje kompletní autonomní audit money-paths repozitáře
provedený ve 6 vlnách (25. 10. 2026): nalezené chyby, opravy, testovací důkazy,
produkční nasazení a zůstávající rizika. Detailní podklady:
[`docs/3.2/AUDIT_PACKAGE.md`](docs/3.2/AUDIT_PACKAGE.md) (reproducible manifest),
[`docs/3.2/REPORTS/AUDIT_RECHECK_2026-10-25.md`](docs/3.2/REPORTS/AUDIT_RECHECK_2026-10-25.md),
[`docs/3.2/REPORTS/DEPLOY_AUDIT_REMEDIATIONS_2026-10-25.md`](docs/3.2/REPORTS/DEPLOY_AUDIT_REMEDIATIONS_2026-10-25.md).

---

## 1. Rozsah a metodika

- **Workspace:** `V31/` (mainnet-track, workspace `3.2.0`).
- **Oblasti:** L1 pool (payouts, deferred queue, PPLNS), L2 multichain
  (WARP bridge executor/inbound/router/db/watcher/validator/timelock,
  chain adapters, ledger/journal, deposits, withdrawals, DEX, HTLC,
  BTC swap, execute_payouts), ZIS identity (auth/link/wallet/apikey/
  session/notifications/webauthn), web API routy.
- **Metoda:** manuální code review money-paths (ne static analyza), crash-
  safety analýza (co se stane při pádu mezi persist a broadcast), replay/
  dedup analýza, review response-handling u RPC volání, regresní testy ke
  každé opravě, potom re-audit vlastních závěrů (vlna 6 znovu otevřela
  dříve „čisté" oblasti).
- **Příměří:** žádné opravy nezasahují do L1 consensus kódu (`V31/L1/core`
  validace/emise/genesis beze změny); žádné změny klíčů ani produkčních
  konfigurací.

## 2. Nálezy a opravy podle vlny

### Vlna 1 — baseline remediations (`ebde4bd2a`, `0e1e2e9aa`)

| ID | Nález | Fix |
|---|---|---|
| IA-13 | HTLC preimages „šifrované" XORem — invertible bez klíče | ChaCha20-Poly1305 AEAD (`enc1:`, random nonce, `ZION_HTLC_PREIMAGE_KEY`), legacy `enc:` migrace, tamper/wrong-key fail-closed |
| IA-14 | Payout idempotence jen in-memory → restart = ztráta guardů | Sidecar `<state_path>.payouts.json` perzistuje `paid_block_heights`/`sent_payouts`/`pending_payouts` při každé mutaci |
| IA-18 | `DexRouter::add_pool` duplikoval pooly při double-load | Idempotentní podle pool id |
| IA-22 | `git archive` export nedovedl buildnout kontrakty | Vendrované OZ + forge-std podstromy pod `contracts/lib/` |
| — | Ignorovaný `Result` z `p.restore()` | Warn log místo tichého resetu |

### Vlna 2 — API surface + ZIS (`b49494ed9`, `ddf56ca30`, `63d29ff56`, `f0b129c16`, `1efc5d37c`)

| ID | Nález | Fix |
|---|---|---|
| IA-17 | 12 API rout leakovalo loopback/private peery a `error.message` (interní RPC URL) klientovi | Sanitizace odpovědí, maskování peerů, odstranění echo interních chyb |
| IA-05 | `ncl/status` POST závisel jen na nginx bloku | Env-key gate `ZION_NCL_STATUS_KEY` (unset = deny) + loopback scrub |
| — | ZIS HS256 default secret `'change-me-in-production'` | `JWT_PRIVATE_KEY`/`JWT_SECRET` povinné; EdDSA cookie secret derivovaný z privátního klíče |
| — | `wallet.ts` `BigInt(amount)` → unhandled 500; order-cache kolize `orderId` přepisovala cizí metadata | 400 validace; `userId` guard na upsertech |
| — | QTU/PRL attestation dokazovala libovolný ZION klíč, ne klíč účtu | `zionAddress` v attestation musí být linknutý k volajícímu účtu |

### Vlna 3 — ledger atomicity + payout queue (`5f868dac6`, `13e57f624`, `bffc3d51e`)

| Nález | Fix |
|---|---|
| `request_withdraw` debitoval ledger před `record_withdrawal` — chyba zápisu = tichá ztráta balance | Credit-back kompenzace při selhání record write |
| Deposit `credit` před `record_deposit` — failed write + retry = **double-credit** | Atomická transakce: journal + balance + deposit status najednou |
| `execute_payouts`: (a) **nikdy nevyprazdňoval `pending_payouts`** — latentní double-pay + růst sidecaru, (b) escrow `credit` před `send_payment` bez undo → phantom growth při retry, (c) bez chain filtru — QTU/PRL položky šly přes ZionL1 adapter | `Pool::settle_payout` (atomic settle), chain-scope filtrování, drain queue |

### Vlna 4 — WARP bridge money-path (8 commitů `2add3e93e`…`7cdb330ab`)

| Commit | Nález → fix |
|---|---|
| `a0eeb3b5e` | **`verify_deposit_proof` neověřoval vault platbu** — jakákoli confirmed tx šla vydávat za bridge deposit (amount check četl neexistující pole), `tx_hash` replay volný → on-chain binding na `l1_vault_address` ≥ claim + memo byte-exact + sender match + source_tx dedup. **Nejzávažnější nález auditu.** |
| `61ec0ce01` | **`verify_quorum` duplicate-signer** — 1 podpis opakovaný 3× = quorum-of-3 → dedup po `validator_id` (pokrývá i `bridge/consensus`) |
| `c000a5d3c` | **Outbound double-mint** — mint před persistem `Executing` → crash mezi broadcast a persist = re-mint → advance-first + deterministic nonce/message hash + `Executing` resume path |
| `490df2b71` | Inbound `Executing` po restartu stranded navždy → resume přes `confirm_l1` / operator recovery |
| `d0ce0fe5c` | Každá `release()` chyba → `Failed` i u transport timeout (unlock mohl být broadcast) → `Rejected→Failed`, `Transport→Executing` |
| `0017a5084` | `seen_txs` PK jen `tx_hash` → cross-chain kolize dropovala deposit → composite `(tx_hash, chain)` + idempotentní migrace (nasazena, viz §4) |
| `7cdb330ab` | Timelock měřen od `created_at` → instant release u pozdních vstupů → `updated_at` |
| `2add3e93e` | `BtcToZion` akceptoval near-future `zion_timeout` → min-duration symetricky |

### Vlna 5 — payout response handling + replay (`3d559964c`, `e9088b128`)

| Commit | Nález → fix |
|---|---|
| `e9088b128` | **Deferred payout silent drop (nejzávažnější vlny):** processor četl `tx_id` na top-level envelope místo `result.tx_id` a `error` nekontroloval → **každá odpověď** (úspěch i rejection) dropnula payout při prvním retry. `execute_fee_payout` fabrikoval `Ok("unknown")` identicky → `error` ⇒ keep queued; success = `result.tx_id` + `accepted` |
| `3d559964c` | Public `/transfers/inbound` obcházel watcher dedup → router-level dedup na `burn_id` + `tx_hash` fallback + representation-shift guard |

### Vlna 6 — money-path recheck R6-01…R6-07 (`4108a52d0`)

| ID | Nález | Fix |
|---|---|---|
| R6-01 | EVM inbound unlock neověřoval burn event; parser neseděl na ABI `BridgeBurn`, chyběl převod 18→6 decimals, nonmatching burn ukončil scan | Autoritativní burn verification: receipt status, inclusion block+finality, wZION contract, decoded `BridgeBurn` vazba na sender/amount/recipient/burn_id/memo/tx+block hash, scan všech logů, canonical 32-byte hashe, removed-log reject |
| R6-02 | SQLite persist chyby jen lognuty → kód pokračoval před mint/unlock; outbound sahal na inbound; adaptéry z hardcoded listu | Fail-closed před submitem; `is_outbound` predikát; registry z config (jen enabled non-L1) |
| R6-03/04/05 | Adaptéry počítaly potvrzení z failed/malformed responses, future heights, missing inclusion → 0-conf „success"; TON odečítal logical time od masterchain seqno | Strict success+inclusion evidence napříč Aptos/Bitcoin/Cardano/Cosmos/NEAR/Solana/Stellar/SUI/Tron/ZionL1; TON `AdapterNotImplemented` hold; future-height guard |
| R6-06 | Withdrawal claim nebyl atomický; ambiguous submit → unsafe refund/resend | Atomic debit+record+journal; `pending→executing` claim před broadcast; ambiguous → `executing` bez auto-resend/refund |
| R6-07 | Payout maturity z earning height místo inclusion; submit parser bez regression coverage | Shared strict parser; maturity z actual tx inclusion height |

## 3. Testovací a build evidence

| Gate | Výsledek |
|---|---|
| `cargo test -p zion-multichain --lib` | **802 passed**, 0 failed, 4 ignored, 1 filtered (`test_evm_health_check_integ` — vyžaduje live RPC) |
| `cargo test -p zion-pool --lib` | **356 passed**, 0 failed |
| `cargo check --workspace --locked` | exit 0 |
| ZIS identity suite | 46/46 |
| `git diff --check` | exit 0 |
| rustfmt (dotčené soubory) | clean; workspace fmt hlásí jen pre-existing drift v `V31/L1/core/src/node.rs` (mimo patch, záměrně netčnuto) |
| Live-chain integrační testy | **nespouštěny** — ověřeno místo toho post-deploy live (§4) |

## 4. Produkční nasazení a live ověření (2026-10-25 ~19:30 UTC)

**Build:** `git archive 6c8165d4a V31` → host rustc/cargo 1.97.1 na EDGE,
`cargo build --release --offline --locked -j2`, resource-capped transient
systemd unit; 3 offline crates doplněny s SHA256 verifikací proti `Cargo.lock`.
Rollback snapshoty (binárky + SQLite `.backup`, integrity ok):
`/root/audit-deploy-6c8165d4a-{pool,warp}-*/`.

| Služba | Host | Deployed SHA256 | Důkazy |
|---|---|---|---|
| `zion-v31-multichain` (`warpd`) | EDGE2 | `bbc353c32b…e54f` | `seen_txs` migrace na `(tx_hash,chain)` — všech 7 řádků zachováno (row-set hash shodný se zálohou); health :8453/:8454 = 200; 0 non-terminal transfers před cutoverem |
| `zion-v31-pool` | EDGE | `968f56aae…dc36c` | PPLNS restore 214 minerů / 95 386 roundů; stratum listen 8444/8445; minery reconnect, 24/24 shares accepted |

**Live verification pod produkční zátěží:** miner našel bloky 96143–96147 →
nový payout pipeline projet end-to-end (`sweep→broadcast→submit` s validními
tx_id) → **první payout novým kódem potvrzen on-chain** (`db411a4c…`, 6 confs,
`confirmed=1`); sidecar eviduje reálná data (7 paid heights, 6 sent, pending
queue); 0 deferred drops / check failures / errors. WARP beze změny (7
completed, žádný nový mint/unlock). L1 nody netčnuté.

**Safety holds aktivní v produkci** (záměr, ověřeno v logu): `WARP_API_KEY`
unset → mutating routes disabled; `WARP_L1_RELEASE_KEYS` absent → inbound
`AwaitingFinality` hold; `WARP_BTC_SWAP_ENABLED=0`; `PRL_PAYOUT_DRY_RUN=1`;
non-EVM inbound bez burn verifieru hold; TON confirmations unsupported hold.

## 5. Otevřené položky

**Pro externího auditora (contract/design-level):**
- **Adapter parity:** jen EVM binduje `warp_message_hash` on-chain;
  non-EVM dest programy volají `mint(recipient, amount)` bez replay anchoru
  → contract-level dedup neexistuje, dokud programy msg_hash nepřijmou.
- **IA-14 zůstává PARTIAL:** sidecar writes best-effort, corrupt state →
  empty guard; bezpodmínečné at-most-once není garantováno.
- **Deferred outbox durability** a **daily-volume-cap atomicity** — otevřené.
- **`Executing` withdrawals bez tx hash** = operator settlement by design
  (žádný slepý resubmit); vyžaduje operator reconciliation.
- `MAX_REORG_DEPTH` tři hodnoty (10/64/500); DAO premine `unlock_height`
  144 000 vs admin-lock; pool submit-flood DoS review; watchdog restart-
  loop gaming; `UNIQUE(reference_id)` defense-in-depth.

**Product/design rozhodnutí:**
- **QTU/PRL external-address attestation:** ML-DSA-87/XMSS nemají JS impl —
  dnes dokazuje jen ZION-key vazbu. Impact: address squatting (útočník
  obsadí cizí QTU/PRL adresu → owner 409 navždy). **Must-fix před jakýmkoli
  flow, kde link gatuje payouts/claims.** Skutečný fix = on-chain proof.
- PRL dust ACK-drop (`PRL_PAYOUT_MIN_UNITS`) — design, ledgerováno jako `dust`.

**Operator-owned (IA-07/08/09/10/19):**
- QTC treasury deficit — 918 stalled payoutů, `treasury_free=0` (pre-existing).
- `WARP_L1_RELEASE_KEYS` neprovisionovány → inbound releases čekají
  (fail-closed, ne chyba).
- `WARP_API_KEY` unset → write API disabled (fail-closed).
- PRL payouts dry-run; BTC swap disabled do externího auditu.

## 6. Verdikt

Nejzávažnější třídy nalezené a opravené: **fabricated bridge deposits**
(vault/memo/sender binding), **quorum bypass** (duplicate signer),
**double-mint/double-pay okna** (crash-safety, queue drain, atomicity),
**silent payout drops** (RPC envelope parsing), **replay dedup díry**
(tx_hash/burn_id/composite keys), **slabé confirmation evidence** (fail-
closed přes 12 adaptérů). Všechny opravy jsou fail-closed směrem — kde
důkaz chybí, transfer čeká, nepokračuje.

**Co tento report NENÍ:** nezávislý externí audit (G9), důkaz produkční
bezpečnosti jako celku, coverage live-chain integrace, nebo záruka nad
operátorskými holds. Post-deploy payout lifecycle je ověřen end-to-end;
WARP money-paths jsou ověřeny testy a stabilitou stavu, ne live transferem.
