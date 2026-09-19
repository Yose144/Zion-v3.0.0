# WARP Beta — přehled

> Stav: **2026-09-20** · HEAD `63cc8f7d4` · Edge deployed `50df05d54` (⚠️ postrádá R2 TTL `d8fe0f97d` + R4 failover `d16922977` — redeploy potřeba před pilotem)
> Swap: **TESTNET rehearsal STALLED** — faucety nedoručily funding (0 tx na HTLC i wallet); doporučen **mainnet dust pilot** · ZION wallet funded 500 ZION · BTC wallet vygenerován (mnemonic na Desktopu)
> Detaily: [`WarpBeta/STATUS.md`](./WarpBeta/STATUS.md) · [`WarpBeta/AUDIT_PREP.md`](./WarpBeta/AUDIT_PREP.md)

Nativní trust-minimized atomické swapy **ZION L1 ↔ BTC** přes HTLC na obou
chainech. Orchestrátor `BtcSwapFlow` + koordinátor `HtlcSwap`, SQLite
persistence, HTTP + CLI lifecycle. Edge: `62.171.141.136:2222`.

---

## ✅ Hotovo — code + testy + deployed

| Oblast | Stav |
|---|---|
| ZION L1 HTLC (konsensus) | script `0x01`, SHA-256 hashlock, timestamp timeout, claim/refund — ověřeno E2E na mainnetu |
| BTC P2WSH HTLC | 13-op witness script, claim/refund, BIP143 sighash, strict parser + round-trip |
| Swap orchestrátor | `decide()` transition table, `poll_once`, oba směry (BTC→ZION, ZION→BTC) |
| Preimage propagace | extrakce z BTC claim witness → claim na ZION legu |
| Persistence | `btc_swap_records` SQLite + restart hydration (recordy i coordinator) |
| API | `POST /swaps/btc/offer` (fail-closed auth), `GET /list`, `GET /:id` — Edge :8454 |
| CLI | `zion warp btc-swap offer\|list\|status` |
| Multi-endpoint esplora | `WARP_BITCOIN_API` comma-list, rotating primary, failover na všech cestách; defaults mempool.space + blockstream.info |
| Dedikovaný operator wallet | `WARP_BTC_SWAP_ZION_SECRET` → vlastní keyring/adapter/coordinator — **funded 500 ZION** (tx `abe521fc…`, blok 49544) |
| Offer TTL | `WARP_BTC_SWAP_OFFER_TTL_SECS` (default 4 h) — expirace `AwaitingUserLock` → `Failed`, uvolní `max_active_swaps` |
| Hardening | min/max sats, max_active, dup-hashlock, admission guards |

### Audit fixy (self-audit)

| # | Bug | Fix |
|---|---|---|
| P1 | Unverified user ZION lock → ztráta BTC | `verify_user_zion_lock` — on-chain kontrola scriptu/timeout/amount + `min_zion_lock_confs` depth |
| P2 | Crash-recovery double-lock / stuck | persist před conf-check, adopt paths, idempotentní registry, coordinator-state aware `decide` |
| P3 | Coordinator hydration po restartu | `warpd` volá `service.htlc().load_from_db()` |
| — | Immature coinbase UTXOs | filter `age ≥ 100` v adapteru + CLI (live incident: tx evicted, CLI rebuild) |
| — | `confirmations()` broken | `getTransaction` param `hash`→`txid` |
| — | Solvency withdrawal double-count | `verify_withdrawal` → `check(ZERO)` |
| — | Offer API bez auth | fail-closed 403 bez ZIS/API key |

### Test baseline

**655 lib testů zelených** + integrační E2E:

- regtest: cross-leg oba směry, refund paths, restart recovery
- **live mainnet leg**: ZION→BTC swap SETTLED (`d77f837a` lock → `8c60d064` claim)

---

## ❌ Chybí — před mainnet enablem

| # | Item | Stav | Poznámka |
|---|---|---|---|
| 1 | **Externí security audit** | ⏳ čeká | `AUDIT_PREP.md` připraven (findings log + checklist) |
| 2 | **`WARP_BTC_RELAY_KEY`** | ⏳ nenastaven | produkční mainnet BTC WIF — potřeba pro ZION→BTC směr |
| 3 | Privátní esplora/bitcoind | doporučeno | Edge 93 G free; pruned node ~15 G + IBD. Public failover funguje, beta-grade |
| 4 | Signet/testnet E2E | dead-end | faucety nedoručily funding — nahradit mainnet dust pilotem (regtest + live-ZION leg pathy pokryly) |
| 5 | `WARP_BTC_SWAP_ENABLED=1` | ⛔ gated | až po 1+2 (+3 doporučeno) |

## 🧪 Testnet rehearsal (2026-09-19 → STALLED 2026-09-20)

| | |
|---|---|
| Operator BTC wallet | `tb1qmy6cztgerzdqa5dmufkfa29tek52ruf2thk0w6` (BIP84 `m/84'/1'/0'/0/0`; mainnet `bc1q53gn9gf5uh7ashhadyryaulc6wq5apdfaz5n6k` ready) |
| Mnemonic | `~/Desktop/warp-btc-wallet.txt` (operator machine, chmod 600) |
| Edge env | `WARP_BTC_RELAY_KEY` (testnet WIF) + `BITCOIN_NETWORK=testnet` + `WARP_BTC_SWAP_ENABLED=1` |
| Test offer | `dbc91da92e750cbcc49a9509f6111fcf5991ad37174f0785553e845d90ce10b5` — 10 000 sats → 10 ZION, injectnut do `warp_multichain.db` (obchází ZIS-gated offer endpoint — operator test), hydratován po restartu |
| HTLC adresa | `tb1qwps3v5wqj82k5j45wjan5gwfj4v8vx6xvrjkmqg25ehtavu0flgsjjz4fp` (CLTV 5149593) — **funding nedorazil; mempool.space testnet API potvrdilo 0 tx na HTLC i operator walletu (2026-09-20). Offer po 4h TTL → `Failed`** |
| Další krok | testnet3 faucety jsou dead-end → **mainnet dust pilot**: nabít `bc1q53gn9…5n6k` ~100k sats, produkční `WARP_BTC_RELAY_KEY`, `BITCOIN_NETWORK` unset, offer s dust amount → stejný flow |

## ⚠️ Známé residuals (auditor checklist)

- **R1** ms-window crash mezi broadcast a persist (refundovatelný)
- **R5** UTXO-set hit ≠ finalita — mitigováno `min_zion_lock_confs=2`
- **R6** BTC dust/change limit v `lock_htlc` UTXO select
- **R7** deterministický claim rebroadcast — krytý adopt path

## Enable checklist (C7)

```
[ ] externí audit passed
[ ] WARP_BTC_RELAY_KEY = produkční mainnet WIF (ověřit adresu)
[x] WARP_BTC_SWAP_ZION_SECRET nastaven + wallet funded
[x] warpd binary = HEAD na Edge
[x] swap endpointy auth-gated, swap disabled
[ ] bitcoin.enabled=true + WARP_BTC_SWAP_ENABLED=1
[ ] smoke: offer → AwaitingUserLock → BTC lock detect → LockZion → settle
```

---

*Generováno: Devin · Edge SSH `root@62.171.141.136 -p 2222 -i ~/.ssh/zion-edge-post-wipe-2026-07-29`*
