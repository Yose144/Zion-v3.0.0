# WARP Beta — Audit Prep & Findings Log

> **Current safety hold (2026-09-20):** Edge BTC swap flow je vypnutý (`WARP_BTC_SWAP_ENABLED=0`). Při vypnutí nebyl aktivní žádný swap; po restartu je multichain služba healthy a list vrací `enabled:false`.
>
> **Historický baseline 2026-09-19:** 655 library testů + cross-leg/refund/restart regtest E2E + live-ZION mainnet leg. **Historický 2026-09-20 rehearsal:** 6/6 regtest E2E přes `bitcoind+rpc://`. Safety hardening je nasazený na Edge (2026-09-20, backup `warpd.bak-20260920-hardening`): full suite 677 lib + integrační testy green, offer endpoint ověřen fail-closed 503; flow zůstává disabled.
>
> Rozsah: `BtcSwapFlow`, BTC HTLC/signer/adapter/bitcoind backend, ZION coordinator, API/auth/rate limiting, persistence a solvency reporting.

## Findings — current

### P0 — User-controlled exchange terms could cause operator asset loss

Offer endpoint přijímal od ZIS uživatele současně `btc_sats` i `zion_flowers`. Nebyl navázaný na server-side quote, operátorské schválení ani cenový limit poměru. Autentizovaný uživatel tak mohl navrhnout ekonomicky nepřiměřené podmínky a po splnění svého malého legu přimět operator wallet zamknout nepřiměřené protiplnění.

**Produkční mitigace:**

- `WARP_BTC_SWAP_ENABLED=0` na Edge od 2026-09-20 12:13 UTC.
- Při disable `active=0`; pouze jeden terminální failed rehearsal.
- Service restart + local/public `enabled:false` ověřeny.

**Fix nasazen 2026-09-20** (hardened `warpd`, live ověřeno 503 fail-closed):

- `POST /swaps/btc/offer` vyžaduje samostatný `WARP_BTC_SWAP_OFFER_KEY` přes `X-Warp-Key`.
- ZIS session ani obecná uživatelská autentizace sama offer neautorizuje.
- Missing server key vrací fail-closed 503; missing/wrong header 401.
- CLI používá dedicated operator header a preferuje key z env.

**Residual:** statický operator key je pouze interní autorizace. Není to veřejný quote protokol a nevaliduje cenu. User-facing offer zůstává blokovaný, dokud nebude implementovaný server-side signed quote/pricing/approval design.

### P1 — BTC observation errors were converted to absence

`poll_one` používal `unwrap_or(0)` a `unwrap_or(None)` pro BTC tip, lock a spend detection. Backend outage/decode chyba se tak mohla tvářit jako legitimní absence chain evidence a vést k chybnému timeout/transition rozhodnutí.

**Lokální fix:** chyby se propagují přes `?`; `poll_once` je zachytí jako `Wait` s diagnostikou a record nemění.

### P1 — bitcoind watch import race and empty-success masking

Watch-only adresa se mohla importovat až po fundingu s `timestamp="now"`. Po resetu wallet mohl lokální backend vrátit validní prázdný výsledek a zastavit failover, přestože veřejný backend funding viděl.

**Lokální fix:**

- každá bitcoind wallet musí HTLC adresu importovat před fundingem,
- `getaddressinfo` ověřuje postcondition `iswatchonly || ismine`,
- chybný `WARP_BITCOIN_IMPORT_SINCE` je fail-closed,
- validní empty address/UTXO odpověď pokračuje na další backend,
- historicky funded operator wallet vyžaduje správný import-since review.

### P2 — Backend credentials could leak in errors

Chybové zprávy interpolovaly celý `WARP_BITCOIN_API`, včetně `bitcoind+rpc://user:pass@...`. Error mohl skončit v API odpovědi nebo logu.

**Lokální fix:** backendy jsou označené pouze indexem, reqwest chyby mají odstraněnou URL a untrusted broadcast response body se nevrací v erroru.

### P2 — Rate-limit bypass through source-port rotation

Per-IP map byla klíčovaná `SocketAddr`, takže nový source port vytvářel nový bucket.

**Lokální fix:** map key je `IpAddr`; regresní test ověřuje, že stejná IP s jiným portem sdílí burst.

### P2 — Invalid network fallback and WIF mismatch

Neznámý `BITCOIN_NETWORK` tiše padal na mainnet a WIF network family se nekontrolovala.

**Lokální fix:** přijímají se pouze `mainnet|bitcoin|testnet|signet|regtest`; mainnet/test-family WIF mismatch je odmítnut.

### P2 — Insolvent assets disappeared from admin report

Enforced `SolvencyGuard::check` vracel error a `check_all` insolventní entry zahodil. Operace byly správně fail-closed, ale admin endpoint neposkytl deficitní položku.

**Lokální fix:** calculation je oddělená od enforcement; reporting vrací i `solvent:false`, zatímco withdrawals/swaps zůstávají odmítnuté.

## Historical findings — fixed before safety hold

| Finding | Fix / evidence |
|---|---|
| Unverified user ZION lock | On-chain script/hashlock/claimant/refund/timeout/amount + depth verification před BTC lockem |
| Crash-recovery double-lock | persist/adopt/idempotent coordinator paths |
| Missing coordinator hydration | `HtlcSwap::load_from_db` + `BtcSwapFlow::load_from_db` |
| Immature ZION coinbase UTXOs | maturity filter před selection |
| Broken ZION confirmations RPC | správný `txid` parametr |
| Shared ZION hot-wallet race | dedicated WARP ZION keyring/adapter/coordinator |
| Offer TTL | stale `AwaitingUserLock` uvolní active slot |
| Public esplora single point | multi-endpoint failover + local bitcoind backend |

## Preimage persistence assessment

- BTC flow nepersistuje unrevealed preimage; hashlock není secret.
- Po claimu může coordinator/snapshot držet revealed preimage kvůli restart recovery. V té chvíli je preimage veřejný na chainu.
- Aktuální Edge nemá `ZION_HTLC_PREIMAGE_KEY`.
- Existující `enc:` XOR storage není authenticated encryption a nesmí být dokumentována jako dokončené silné šifrování.
- Authenticated at-rest encryption je defense-in-depth audit item, nikoli blocker pro ochranu dosud unrevealed secretu.

## Auditor checklist

- [ ] HTLC script branch correctness na ZION i BTC
- [ ] SHA-256 hashlock/preimage konzistence
- [ ] Timeout ordering a 6h margin assumptions
- [ ] Confirmation/reorg policy
- [ ] UTXO selection, dust/change a fee policy
- [ ] Native ZION transaction acceptance validation
- [ ] Refund safety obou directions
- [ ] Restart/recovery a SQLite corruption handling
- [ ] Idempotency všech broadcast/adopt cest
- [ ] Admission limits a TOCTOU review
- [ ] Operator offer authorization + key rotation/runbook
- [ ] Server-side signed quote/pricing/approval protocol
- [ ] API rate limiting za nginx; trusted client IP handling
- [ ] Error classification/retry bez silent `.ok()` swallowing
- [ ] Backend credential/log redaction
- [ ] bitcoind descriptor import, prune a recovery behavior
- [ ] WIF/network separation
- [ ] Preimage persistence wording a optional authenticated encryption
- [ ] Solvency/reconciliation semantics

## Pre-mainnet checklist

1. [x] Edge flow disabled; active swaps 0; rollback backup vytvořen.
2. [x] Full `cargo test -p zion-multichain` na aktuálním working tree — 677 lib testů + integrační testy, 0 failed.
3. [x] `cargo clippy -p zion-multichain --all-targets` čistý kromě zdokumentovaného pre-existing warning baseline (unused imports v `intent.rs`, `AMM_TOKEN1_SIG`, Solana `cluster`/`block_time`, test-only linty); `-D warnings` není dosažitelné bez samostatného baseline cleanupu.
4. [x] Hardened `warpd` build/deploy + smoke (2026-09-20): Edge binary odpovídá hardened working tree, `/health` ok, list `enabled:false`, offer 503 fail-closed, solvency report kompletní.
5. [ ] Externí audit passed.
6. [ ] Server-side signed quote/pricing/approval protocol.
7. [ ] `WARP_BTC_SWAP_OFFER_KEY` bezpečně provisioned a rotation/runbook ověřen.
8. [ ] Mainnet bitcoind IBD complete; snapshot nyní 608706/967828, 34.35 %.
9. [ ] `WARP_BITCOIN_API` local-first + `WARP_BITCOIN_IMPORT_SINCE` review.
10. [ ] Produkční `WARP_BTC_RELAY_KEY`, network/address verification.
11. [ ] Confirmation/margin/amount cap review.
12. [ ] Monitoring contact point a on-call routing.
13. [ ] Capped pilot výslovně schválen; funding a transakce nejsou součástí tohoto safety fixu.

## Go / No-Go

Aktuální rozhodnutí: **NO-GO** pro BTC swap re-enable a mainnet pilot. Historických 6/6 E2E dokládá funkční happy/refund/restart paths, ale neuzavírá P0 ekonomickou autorizaci ani výše uvedené production blockery.
