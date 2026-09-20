# WARP Beta — přehled

> Stav: **2026-09-20 — SAFETY HOLD**
>
> Edge služba `zion-v31-multichain` je aktivní, ale BTC swap flow je od 12:13 UTC vypnutý: `WARP_BTC_SWAP_ENABLED=0`. Veřejný i lokální list vrací `{"enabled":false,"swaps":[]}`.
>
> Důvod: offer endpoint dovoloval ZIS uživateli zvolit současně `btc_sats` i `zion_flowers` bez server-side quote nebo operátorského schválení. Při vypnutí nebyl aktivní žádný swap; existoval pouze jeden terminální failed testnet rehearsal záznam.
>
> Hardening je **nasazený na Edge** (2026-09-20, backup `warpd.bak-20260920-hardening`) s green full-suite gate; flow zůstává disabled a offer endpoint je navíc fail-closed bez `WARP_BTC_SWAP_OFFER_KEY` (503). Historických 6/6 regtest E2E a live-ZION leg zůstává validační evidence, nikoli povolení mainnetu.
>
> Detaily: [`WarpBeta/STATUS.md`](./WarpBeta/STATUS.md) · [`WarpBeta/AUDIT_PREP.md`](./WarpBeta/AUDIT_PREP.md)

WARP Beta implementuje nativní trust-minimized atomické swapy **ZION L1 ↔ BTC** přes HTLC na obou chainech. Orchestrátor `BtcSwapFlow` používá koordinátor `HtlcSwap`, SQLite persistence a HTTP/CLI lifecycle.

---

## Aktuální bezpečnostní stav

| Oblast | Stav |
|---|---|
| Edge BTC swap flow | **disabled** (`WARP_BTC_SWAP_ENABLED=0`) |
| Aktivní BTC swapy při disable | 0 |
| WARP/DEX služba | active; ostatní WARP funkce běží |
| Veřejný offer endpoint | neaktivní, protože flow je disabled |
| Lokální hardening | cílené testy green, pending deploy + full-suite gate |
| Mainnet pilot | zakázán do uzavření všech blockerů |
| Mainnet bitcoind | 608706 bloků / 967828 headers, 34.35 % IBD, pruned 20 GiB |
| L1 snapshot | height 50916, `3.1.0-alpha` |

Env backup před safety disable: `/etc/zion/edge-environment.sh.bak-warp-disable-20260920T121310Z`.

## Implementovaný historický baseline

| Oblast | Stav |
|---|---|
| ZION L1 HTLC | SHA-256 hashlock, timestamp timeout, claim/refund; live L1 ověření |
| BTC P2WSH HTLC | 13-op witness script, claim/refund, BIP143 sighash, strict parser |
| Orchestrátor | oba směry BTC→ZION a ZION→BTC, transition table, polling |
| Persistence | `btc_swap_records` + coordinator hydration po restartu |
| Monitoring | JSON + Prometheus metrics, Edge scrape a alert rules |
| Regtest | historicky 6/6 E2E přes nativní `bitcoind+rpc://` backend |
| Dedikovaný ZION operator wallet | nasazen a historicky funded 500 ZION |
| Guardrails | min/max sats, max active, duplicate hashlock, offer TTL |

## Safety hardening — local, pending deploy

1. **Operator-only offer:** `POST /swaps/btc/offer` vyžaduje samostatný `WARP_BTC_SWAP_OFFER_KEY` v hlavičce `X-Warp-Key`; ZIS session sama nestačí.
2. **Fail-closed polling:** chyby BTC height/lock/spend observations už nejsou převáděny na falešné `0`/`None`.
3. **Credential redaction:** chybové zprávy neobsahují credential-bearing BTC backend URL ani reflektované response body.
4. **Strict network/WIF:** neznámý `BITCOIN_NETWORK` je chyba a mainnet/test-family WIF mismatch se odmítne.
5. **Watch import preflight:** bitcoind watch-only wallet musí prokazatelně sledovat HTLC adresu před fundingem.
6. **Data-aware fallback:** validní prázdná odpověď lokální wallet nezastaví kontrolu dalších backendů.
7. **Skutečný per-IP limiter:** bucket je klíčovaný IP adresou, ne `IP:source-port`.
8. **Úplný solvency report:** admin API vrací i insolventní assety s `solvent:false`; samotné enforcement odmítnutí zůstává fail-closed.

## Test baseline

- **Historický baseline 2026-09-19:** 655 library testů + cross-leg/refund/restart regtest E2E + live ZION leg.
- **Historický regtest rehearsal 2026-09-20:** 6/6 `btc_swap_flow` E2E přes `bitcoind+rpc://`.
- **Aktuální lokální změny:** cílené solvency, polling, auth, bitcoind, signer, adapter, rate-limit a CLI testy/checky jsou zelené.
- **Aktuální full-suite recount:** pending; před deployem je povinný celý `zion-multichain` test + clippy gate.

---

## Blokéry před jakýmkoli re-enable

1. Externí security audit kódu a threat modelu.
2. Deploy hardened `warpd` binárky a ověření full test/clippy gate.
3. Dedikovaný `WARP_BTC_SWAP_OFFER_KEY` uložený pouze v chráněném Edge environmentu.
4. Server-side signed quote/pricing/approval protokol. Statický operator key je pouze interní mitigace, ne veřejný offer protokol.
5. Dokončený bitcoind IBD a lokální backend nakonfigurovaný jako primary se správným `WARP_BITCOIN_IMPORT_SINCE`.
6. Produkční `WARP_BTC_RELAY_KEY` a explicitní mainnet network/address kontrola.
7. Review confirmation/margin/amount limitů.
8. Explicitní operátorské schválení capped dust pilotu a rollback postupu.

Dokud nejsou všechny body uzavřené, nesmí se:

- nastavit `WARP_BTC_SWAP_ENABLED=1`,
- fundovat mainnet BTC operator adresu pro pilot,
- spustit mainnet offer nebo dust transakci.

## Historický testnet rehearsal

Testnet3 rehearsal z 2026-09-19 skončil bez fundingu kvůli nefunkčním faucetům a offer po TTL přešel do `Failed`. Byl nahrazen vlastním regtest bitcoind rehearsem. Tento záznam není instrukce k mainnet fundingu.

## Residual risks pro audit

- Broadcast/persist crash window zůstává refundovatelný, ale vyžaduje další idempotency review.
- Timestamp ZION timeout versus BTC CLTV height vyžaduje margin review.
- Public esplora backendy jsou pouze fallback; lokální node musí dokončit IBD.
- Revealed preimage může být uložen pro restart recovery; po reveal je veřejný na chainu. Aktuální Edge nemá `ZION_HTLC_PREIMAGE_KEY` a existující XOR nelze označovat za authenticated encryption.
- Operator-only key neřeší veřejnou cenotvorbu; signed quote/pricing protocol je samostatný blocker.

---

*Edge BTC swap flow zůstává disabled; tento dokument nesmí být použit jako souhlas s mainnet transakcí.*
