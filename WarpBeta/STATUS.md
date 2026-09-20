# WARP Beta — Status / Gap analýza

> Snapshot: **2026-09-20 — SAFETY HOLD**. Edge BTC swap flow je od 12:13 UTC vypnutý (`WARP_BTC_SWAP_ENABLED=0`). Důvodem je P0 autorizační mezera: ZIS uživatel mohl zvolit oba objemy směny bez server-side quote či operátorského schválení. Při disable bylo `active=0`; po restartu je multichain služba active a veřejný i lokální list vrací `enabled:false`. Historických 6/6 regtest E2E zůstává validační evidence. Hardening níže je nasazený (2026-09-20) s green full-suite gate; flow zůstává disabled.

## HOTOVO — produkční mitigace a historický baseline

| Komponenta | Kde | Stav |
|---|---|---|
| Emergency safety disable | Edge env + `zion-v31-multichain` | `WARP_BTC_SWAP_ENABLED=0`; active swaps 0; backup `/etc/zion/edge-environment.sh.bak-warp-disable-20260920T121310Z`; health/list ověřeny |
| L1 nativní HTLC | `V31/L1/core/src/utxo.rs`, `v31_wallet.rs` | SHA-256 lock, timestamp timeout, claim/refund; historický live E2E |
| BTC P2WSH HTLC | `warp/btc_htlc.rs`, `btc_signer.rs` | kanonický 13-op script, BIP143 claim/refund, strict parser |
| Swap orchestrátor | `warp/btc_swap.rs` | oba směry, transition table, persistence, restart hydration |
| bitcoind RPC backend | `warp/bitcoind_rpc.rs` | esplora-compatible překlad, watch-only wallet, public fallback |
| Historický regtest rehearsal | `tests/btc_swap_flow.rs` | 6/6 pass: oba směry, refund paths, restart recovery |
| Historický live-ZION leg | mainnet L1 | SETTLED evidence; není povolením nového mainnet pilotu |
| Monitoring | `/swaps/btc/metrics` | Prometheus/Grafana scrape + alert rules nasazeny |
| Dedicated ZION operator wallet | Edge | historicky funded 500 ZION; swap flow nyní disabled |
| Offer TTL + guardrails | `warp/btc_swap.rs` | amount band, active cap, duplicate hashlock, TTL |

## ROZPRACOVÁNO — nasazený hardening, pending gates

| Oprava | Stav | Poznámka |
|---|---|---|
| Operator-only offer authorization | nasazeno; ověřeno 503 fail-closed | `WARP_BTC_SWAP_OFFER_KEY` přes `X-Warp-Key`; ZIS sám nestačí |
| Fail-closed BTC observations | nasazeno | height/lock/spend chyby se neinterpretují jako absence dat |
| Backend credential redaction | nasazeno | error payloady neobsahují endpoint userinfo ani response body |
| Strict BTC network/WIF | nasazeno | neznámá síť a mainnet/test WIF mismatch jsou odmítnuty |
| Watch-only import preflight | nasazeno | HTLC adresa musí být prokazatelně watched před fundingem |
| Empty-result failover | nasazeno | prázdná lokální wallet odpověď pokračuje na další backend |
| Per-IP limiter | nasazeno | bucket klíčovaný `IpAddr`, nikoli source portem |
| Insolvent asset reporting | nasazeno; ověřeno live | admin report obsahuje `solvent:false`; enforcement zůstává fail-closed |
| Server-side quote/pricing/approval | **chybí** | statický operator key není veřejný quote protocol |
| Edge hardened deploy | **done 2026-09-20** | `warpd` rebuild na Edge z hardened working tree, backup `warpd.bak-20260920-hardening`; smoke: `/health` ok, list `enabled:false`, metrics `warp_btc_swap_enabled 0`, offer → 503 fail-closed, solvency report vrací `solvent:false` položky |
| Full suite + clippy | **green** | `cargo test -p zion-multichain`: 677 lib + všechny integrační testy, 0 failed; clippy čistý kromě zdokumentovaných pre-existing warningů; `cargo check -p zion-cli` clean; `git diff --check` clean |

## HTTP/API stav

| Endpoint | Stav |
|---|---|
| `GET /v1/multichain/swaps/btc/list` | public read; na Edge `enabled:false` |
| `GET /v1/multichain/swaps/btc/metrics` | public non-secret monitoring |
| `GET /v1/multichain/swaps/btc/:id` | public read bez preimage |
| `POST /v1/multichain/swaps/btc/offer` | flow disabled na Edge; lokální kód vyžaduje `X-Warp-Key` z `WARP_BTC_SWAP_OFFER_KEY` |

ZIS autentizace sama není autorizace k vytvoření offeru, který může zamknout operátorská aktiva.

## Bitcoin backend

| Položka | Stav |
|---|---|
| Edge bitcoind | 31.1, mainnet, pruned 20 GiB |
| IBD snapshot | 608706 bloků / 967828 headers, 34.35 %, `initialblockdownload=true` |
| Lokální backend v `WARP_BITCOIN_API` | nenastaven; až po IBD a config review |
| Watch wallet | `warpwatch`; local hardening přidává import postcondition + preflight |
| `WARP_BITCOIN_IMPORT_SINCE` | musí být validní unix timestamp před prvním importem již funded operator adresy |
| Public esplora | fallback, ne jediný production backend |

## BLOCKER před re-enable

1. Externí bezpečnostní audit.
2. Server-side signed quote/pricing/approval design pro user-facing offers.
3. Deploy hardened `warpd` a ověření full `zion-multichain` test + clippy gate.
4. Dedikovaný `WARP_BTC_SWAP_OFFER_KEY` uložený mimo repo v `chmod 600` environmentu.
5. Dokončený bitcoind IBD a lokální backend jako primary, včetně import-since review.
6. Produkční `WARP_BTC_RELAY_KEY`, network/address review a oddělení testnet key.
7. Confirmation, margin a amount-cap review.
8. Explicitní schválení capped mainnet pilotu a rollback postupu.

`WARP_BTC_SWAP_ENABLED=1`, mainnet BTC funding a dust pilot jsou do uzavření všech blockerů zakázané.

## Historická evidence

- Audit baseline 2026-09-19: 655 library testů + regtest cross-leg/refund/restart + live ZION leg.
- Regtest 2026-09-20: 6/6 `btc_swap_flow` E2E přes vlastní `bitcoind+rpc://` backend.
- Testnet3 offer expiroval bez fundingu; faucety byly dead-end.
- Starší Edge redeploy z 2026-09-20 je historický a **není current HEAD** po lokálním safety hardeningu.

## Rizika / otevřené otázky

1. Statický operator key pouze omezuje caller surface; nevaliduje ekonomické podmínky směny.
2. ZION timestamp versus BTC CLTV height vyžaduje audit marginu.
3. Broadcast/persist crash window zůstává refundovatelný residual.
4. Public backend může být neúplný či stale; výsledky se validují, ale lokální full node je production požadavek.
5. Revealed preimage se může persistovat pro restart recovery. Před reveal se v BTC flow nepersistuje; po reveal je veřejný. Edge nemá `ZION_HTLC_PREIMAGE_KEY` a současný XOR není authenticated encryption.

## Re-enable checklist

- [x] Edge flow bezpečně disabled, active swaps 0
- [x] Historický regtest rehearsal 6/6
- [x] Hardened working tree full-test/clippy green (677 lib + integrace, 0 failed; jen pre-existing warnings)
- [x] Hardened `warpd` nasazen a smoke ověřen (2026-09-20; flow zůstává disabled)
- [ ] Externí audit passed
- [ ] Signed server-side quote/pricing/approval protocol
- [ ] `WARP_BTC_SWAP_OFFER_KEY` bezpečně provisioned
- [ ] Mainnet bitcoind IBD complete + local backend configured
- [ ] Production WIF/network/address review
- [ ] Confirmation/margin/limits review
- [ ] Capped pilot explicitně schválen

Do té doby musí endpoint zůstat `enabled:false`.
