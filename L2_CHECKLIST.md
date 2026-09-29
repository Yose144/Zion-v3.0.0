# L2 Checklist — co máme vs. co chybí k plně funkčnímu WARP + DAO

> **Vytvořeno:** 2026-10-02 · Audit proti kódu `V31/L2/` + live stav Edge (`vmi3425821`)
> **Kanonické zdroje:** `L2contracts.md`, `DAO.md`, `WarpBeta/STATUS.md`, `WarpBeta/AUDIT_PREP.md`, `V33_GAP_ANALYSIS.md`, `Multichain-Report.md`, `docs/WP-Mainet/MiseAmenti/07-Registr-Dukazu.md`

**Legenda:**

| Značka | Význam |
|--------|--------|
| ✅ DONE | Implementováno, testováno, běží na Edge |
| 🟡 PARTIAL | Kód existuje a částečně funguje — chybí kus k produkci |
| 📄 DOC | Zdokumentováno / naplánováno, kód chybí nebo je stub |
| 🔒 BLOCKED | Funkční, ale úmyslně vypnuté (safety hold) |
| ❌ MISSING | Neexistuje |
| ⚠️ RISK | Funguje, ale s rizikem, které je nutné vyřešit před claims |

---

## 0. Executive summary — 3 věty

1. **Outbound most ZION L1 → Base funguje automatizovaně** (7 dokončených transferů, watcher→executor pipeline). **Inbound Base → ZION L1 má od 2026-10-02 implementovanou auto-release cestu** (`warp/inbound.rs` + `l1_release.rs`, commit `06751d3`) — watcher detekuje burn, releaser počká na source finalitu, sestaví threshold ECDSA proofy z lokálních release klíčů a pošle `submitBridgeUnlock`. **Nenasazeno na Edge** — vyžaduje `WARP_L1_RELEASE_KEYS` (≥3 klíče odpovídající `ZION_BRIDGE_VALIDATOR_PUBKEYS`) + Edge rebuild.
2. **Nativní BTC↔ZION HTLC swap je kompletně naprogramovaný** (1 250 LOC orchestrátor, 6/6 regtest E2E), ale **záměrně vypnutý** — chybí server-side quote/approval protokol, dokončený Bitcoin IBD (~80 %) a bezpečnostní audit.
3. **DAO má funkční lifecycle** (proposal → vote → quorum → timelock → execute) včetně L1 memo hlasování. **Treasury podpisy jsou od 2026-10-02 skutečné Ed25519 podpisy** (`dao/src/treasury_tx.rs`, commit níže v changelogu) — guardian podepisuje `dao:treasury:v1|op_id|sha256(op_json)`, threshold počítá jen verified sigs, execute staví reálnou UTXO tx z `getUtxos` a broadcastuje přes `submitUtxoTransaction` (pokud `ZION_DAO_TREASURY_KEY`, jinak `awaiting_broadcast` + exportovatelný spec). **Custody limit:** L1 nemá m-of-n script — jeden treasury key vykonává, guardian sigs jsou autorizace. Treasury 1.5B ZION do bloku 144 000 stále nesputná (time-lock).

---

## 1. WARP jádro (`V31/L2/multichain/src/warp/`)

| Komponenta | Soubor | Stav | Poznámka |
|-----------|--------|------|----------|
| Runtime orchestrace | `runtime.rs` (602 LOC) | ✅ DONE | Watcher + executor smyčky, 15 s poll, recovery `Detected`/`Executing`/`Failed` po restartu |
| Router | `router.rs` (408 LOC) | ✅ DONE | Route lookup jen přes enabled chainy, fee estimate, timelock >1M ZION, daily limit 10M ZION |
| Protocol / state machine | `protocol.rs` (725 LOC) | ✅ DONE | `Detected→Pending→Executing→AwaitingQuorum→Completed/Failed/Refunded`, pre-signatures, max 5 retries |
| Watcher | `watcher.rs` | ✅ DONE | Poll `watch_bridge_events` na každém enabled adaptéru → `Detected` transfer |
| Executor | `executor.rs` | ✅ DONE | Spouští `execute_mint`/`execute_outbound`, verification loop |
| Persistace | `state.rs`, `db.rs` | ✅ DONE | SQLite `warp_multichain.db`, inbound/outbound fronty, přežije restart |
| HTTP API | `server.rs` | ✅ DONE | `/health /metrics /chains /transfers/:id /pending /outbound /inbound /advance` na :8453 |
| Registry chainů | `registry.rs` | ✅ DONE | `disabled_reason` pro nenasazené chainy (G2/E5 gate) |
| Validator set | `validator.rs` | ⚠️ RISK | Ed25519 proofs + audit log OK, **ale quorum=1 na Edge** a všechny klíče mohou být lokálně (Alpha mód). Není to distribuovaná validace. |
| Auto-advance inbound | `inbound.rs` (nový, 2026-10-02) | ✅ CODE | `InboundReleaser` běží jako runtime task — Detected→source-finality→`submitBridgeUnlock`→Completed. Bez `WARP_L1_RELEASE_KEYS` zůstává transfer bezpečně pending + manuální fallback zůstává. |
| L1 release (mint/unlock) | `l1_release.rs` (nový) | ✅ CODE | `L1Releaser` podepisuje kanonický `unlock\|…` payload secp256k1 klíči z `WARP_L1_RELEASE_KEYS`, threshold kontrola, `submitBridgeUnlock`, trvalé chyby → Failed. `execute_mint` v adaptéru zůstává unsupported — inbound míjí executor pipeline záměrně. |
| Distribuovaní validátoři | — | 📄 DOC | `WarpValidatorSet` umí N validátorů, ale topologie N nodů s oddělenými klíči není nasazená. |

**Live důkaz:** `GET /health` → `transfers_total: 7, pending: 0`, enabled = `zion-l1 + base`, `quorum = 1` v `/etc/zion/warp.toml`.

---

## 2. Per-chain readiness matrix — „máme most?"

Klasifikace tří úrovní: **ChainAdapter** (`chain/adapters/` — plný wallet/deposit/withdraw), **WARP adapter** (`warp/adapter/` — bridge execute_mint + watch), **signer** (`warp/signer/` — jen podpis). Plný most = adapter + signer + relay klíč + nasazený token/kontrakt + finalita + runtime enabled.

| Chain | Signer | WARP adapter | ChainAdapter | Token/kontrakt nasazen | Relay klíč na Edge | Enabled | Reálný stav mostu |
|-------|:------:|:------------:|:------------:|:----------------------:|:------------------:|:-------:|-------------------|
| **ZION L1** | — (keyring) | ✅ | ✅ | nativní | keyring | ✅ | Outbound ✅ / Inbound ✅ v kódu (auto-release, čeká deploy + release klíče) |
| **Base (EVM)** | ✅ | ✅ | ✅ | ✅ wZION `0x0c49…` + ZIONBridge `0x72c8…` | `WARP_EVM_RELAY_KEY` | ✅ | **Jediný funkční koridor** |
| Ethereum/Arb/OP/Polygon/BSC/AVAX | ✅ (sdílený EVM) | ✅ (sdílený) | ✅ | ❌ kontrakty nedeploynuté | stejný klíč | ❌ | Připraveno k deployi — jen `forge` + enable |
| Robinhood (chain 4663) | ✅ (EVM) | ✅ | ✅ | ❌ nedeploynuto, deployer nemá gas | — | ❌ `disabled_reason` | Deploy script hotový; čeká na funding |
| Solana | ✅ | ✅ | ✅ | ⚠️ mint adresa v cfg (pravděpodobně placeholder/real?) | `WARP_SOLANA_RELAY_KEY`? | ❌ | Kód hotový, E2E nedokázáno |
| Bitcoin | ✅ | ✅ (mempool.space watch + send_btc) | ✅ | nativní | `WARP_BTC_RELAY_KEY`? | ❌ | Viz §3 — IBD + safety hold |
| Lightning | ✅ | 🟡 (LND REST stub) | — | — | `WARP_LN_*` | ❌ | Hodiny práce, ne dní |
| Stellar | ✅ | ✅ send_payment | — | ✅ issuer adresa reálná | `WARP_STELLAR_RELAY_KEY`? | ❌ | Blízko — chybí watch + E2E |
| Cardano | ✅ | ✅ | — | ⚠️ policy ID v cfg | `WARP_CARDANO_PAYMENT_KEY`? | ❌ | Blockfrost závislost, E2E chybí |
| Cosmos | ✅ | ✅ | — | placeholder | ? | ❌ | Placeholder kontrakt — nejdřív token |
| Tron | ✅ | ✅ | — | `WARP_TRON_CONTRACT` env | ? | ❌ | Contract addr = `TPlaceholder` v cfg |
| SUI | ✅ | ✅ | — | `WARP_SUI_*` env | ? | ❌ | V33: signer-only per gap analysis, adapter existuje ale bez real package |
| Aptos | ✅ | ✅ | — | env account | ? | ❌ | Stejné jako SUI — signer + scaffold |
| Near | ✅ | ✅ | — | `warp.near` placeholder | ? | ❌ | Placeholder kontrakt |
| TON | ✅ | ✅ | — | jetton master env | ? | ❌ | Placeholder |

**Závěr matice:** „12-chain support" je **HORIZONT**. Reálně funkční = **ZION L1 ↔ Base** (a inbound jen polo-manuálně). Vše ostatní = kód-ready stupeň, žádný další chain nemá on-chain E2E důkaz. Před každým claimem „supported chain" je potřeba samostatná evidence (Registr důkazů §3).

**Blokery pro aktivaci libovolného dalšího chainu:**
1. Nasadit/ověřit token reprezentaci (SPL mint, policy ID, TRC-20, jetton…).
2. Relay klíč nafundit (gas/native).
3. `enabled = true` + `finality_blocks` review + reorg politika.
4. `watch_bridge_events` skutečně implementované (u většiny non-EVM je to tenký/stub polling).
5. Reconciliation pro asset-pár `chain:ticker`.
6. Testnet/regtest E2E → malý mainnet pilot.

---

## 3. Nativní BTC ↔ ZION (atomický swap)

### Co máme

| Komponenta | Soubor | Stav |
|-----------|--------|------|
| Swap orchestrátor (obě směry) | `warp/btc_swap.rs` (1 250 LOC) | ✅ kód |
| HTLC konstrukce (P2WSH, CLTV) | `warp/btc_htlc.rs` (474 LOC) | ✅ kód |
| bitcoind JSON-RPC klient | `warp/bitcoind_rpc.rs` (449 LOC) | ✅ kód |
| BTC signer (WIF→P2WPKH, PSBT claim/refund) | `warp/btc_signer.rs` (572 LOC) | ✅ kód |
| WARP BTC adapter | `warp/adapter/bitcoin.rs` | ✅ kód |
| Regtest E2E | 6/6 testů (obě směry, refundy, restart recovery) | ✅ TESTED |
| Historický live-ZION leg | jednorázově settled | 🟡 jednou, ne pilot |
| State machine | `AwaitingUserLock→Locked→Settled/Refunded/Failed` | ✅ |
| HTTP endpointy | offers/create/accept/status | ✅ (fail-closed když disabled) |

### Live stav

- `WARP_BTC_SWAP_ENABLED=0` — **safety hold** (fail-closed).
- `WARP_BTC_SWAP_OFFER_KEY` **není nastaven** → offer creation nelze ani autorizovat.
- bitcoind na Edge: **pruned, IBD ~79.6 %** (873 429 / 969 140 bloků) — roste, ale není hotový.
- Backend watcher jede přes `mempool.space/api` — ne přes lokální node.

### Blockery před `ENABLED=1` (z AUDIT_PREP + vlastní audit)

| # | Blocker | Stav |
|---|---------|------|
| 1 | Externí bezpečnostní audit HTLC + preimage handling | ❌ (G9/F1 otevřený) |
| 2 | **Server-side quote/pricing protokol** — uživatel dnes volil BTC i ZION amount → operátor loss-path | ✅ CODE+TESTED (viz níže) |
| 3 | `WARP_BTC_SWAP_OFFER_KEY` provisioning + rotace + scope | ❌ |
| 4 | Bitcoin IBD → 100 %, lokální bitcoind jako primární backend | 🟡 ~80 %, roste |
| 5 | Watch-only import review (`WARP_BITCOIN_IMPORT_SINCE`, rescan mezery) | ❌ |
| 6 | WIF/network/adresa separace mainnet vs regtest | 🟡 zkontrolovat |
| 7 | Confirmation/timeout margin review (CLTV deltas oběma směry) | 📄 částečně |
| 8 | Amount caps + solvency check před akceptací | ✅ CODE — `WARP_BTC_SWAP_MAX_QUOTE_ZION`/`_BTC` outstanding-liability caps + oboustranný balance check v `issue_quote` (fail-closed): ZION leg přes L1 `getUtxos`, BTC leg přes confirmed UTXOs signer adresy z BTC backendu (esplora/bitcoind-shape). Deploy pending |
| 9 | Monitoring + on-call routing pro stuck swap | ❌ |
| 10 | Preimage persistence/šifrování at-rest review | ⚠️ ověřit |
| 11 | Explicitní capped pilot (např. ≤ 0.001 BTC) + rollback plán | 📄 zdokumentováno, neschváleno |
| 12 | Mainnet E2E důkaz (regtest ≠ mainnet) | ❌ |

**Pozn.:** statický offer key řeší jen „kdo smí volat API" — **neřeší ekonomiku**. Ekonomiku řeší server-side podepsaný quote (blocker #2 — implementováno níže); zbývající hold = ops/pilot položky (#1, #3–#7, #9–#12).

#### Signed-quote protokol — IMPLEMENTOVÁNO (kód + testy, deploy pending)

`warp/btc_swap.rs` + `server.rs` + `db.rs` + `service.rs`:

- **`POST /v1/multichain/swaps/btc/quote`** (veřejný) — server vydá Ed25519-podepsaný `BtcSwapQuote` za fixní sazbu `WARP_BTC_SWAP_ZION_PER_SAT` (flowers/sat; `0`/unset → endpoint disabled a `/offer` zůstává operator-only). Quote binduje `direction`, `btc_sats`, `zion_flowers`, `expires_at` (`WARP_BTC_SWAP_QUOTE_TTL_SECS`, default 900 s) a nonce `quote_id`; podepisuje dedikovaný ZION swap keyring, domain `warp:btc-quote:v1`.
- **`POST /v1/multichain/swaps/btc/offer`** — autorizace = `X-Warp-Key` (operator/admin fallback) **NEBO** platný quote v requestu. Quote cesta ověří podpis, směr, obě částky a expiraci; uživatel si už nemůže zvolit obě nohy.
- **Replay protection:** `btc_swap_records.quote_id` UNIQUE index (migrace) + `btc_swap_quote_used()` pre-check; `save_btc_swap` přepsán na `ON CONFLICT(swap_id) DO UPDATE` — `INSERT OR REPLACE` by při quote kolizi smazal původní záznam.
- Testy: roundtrip, direction/amount/expiry/signer/tampered-hex rejection, disabled-when-rate-0, band enforcement, DB UNIQUE replay, `verify_offer_quote` binding. 40/40 btc_swap testů.
- **Zbývá:** operator-side risk caps (kolik ZION/BTC smí být najednou v okně quotů), dynamic pricing místo fix sazby, offer-key provisioning, Edge deploy + E2E.

---

## 4. Custodial wallet + DEX vrstva (`multichain_wallet/`, `swap/`)

| Komponenta | Stav | Poznámka |
|-----------|------|----------|
| Per-user deposit adresy (BIP32/SLIP10 derivace z `ZION_WALLET_MNEMONIC`) | ✅ DONE | L1 + Base + další chainy derivovatelné |
| Deposit watcher + finality mapa | ✅ DONE | 30 s poll, per-chain finality (Base 12, BTC 6, L1 1, Solana 32…) |
| Interní ledger (SQLite) | ✅ DONE | credit/debit, nonce mgmt, audit log, rate limiting |
| Withdrawals → on-chain | 🟡 PARTIAL | Funguje, ale hot wallet na Base má **0 ETH / 0 wZION / 0 USDT** → výběry blokované likviditou |
| Reconciler | ⚠️ RISK | Alertuje každých 5 min — **3 otevřené drift alerts** (viz §5) |
| DexRouter (in-memory AMM) | ⚠️ RISK | Ceny z interních rezerv, ne z on-chain. Swap failuje **po** ledger update → solvency riziko. Deprecate ve prospěch on-chain V3 (Multichain-Report §4). |
| V3Dex config (UniV3/PancakeV3 na Base) | 🟡 PARTIAL | Kontrakty v `contracts.rs`, ale `quote_exact_input_single`/`swap_exact_input_single` neimplementované |
| Intent engine + solver network | 🟡 PARTIAL | Kód + auth + testy ✅; **federace solverů neběží** (`[solver] enabled=false`, žádný nezávislý solver) |
| HTLC engine (generický cross-chain) | 🟡 PARTIAL | Implementován; guard pro bridge hopy zapnutý do reálné validace |
| Likvidita wZION/USDT na Base | ⚠️ RISK | Jediný aktivní pool `0x186b…fda2`: **~19 USDT + 151 867 wZION** — fakticky žádná hloubka |

---

## 5. Solvency / reconciliation — živé alerty (k vyřešení před claims)

| Asset | On-chain | Očekáváno | Drift | Klasifikace (forenzika 2026-10-02) |
|-------|----------|-----------|-------|-------------|
| `zion-l1:ZION` | 0 | 20 000 000 | −20M | **Falešný alarm při RPC výpadku** — `zion rpc connect refused` → on_chain=0; expected = pool reserve 20M. Fix: potlačit alert když balance query selhala (notes obsahují `balance query failed`). |
| `base:WETH` | 0 | 33.1 gwei | −33 gwei | Dust — ledger WETH credit bez on-chain protikladu (testovací deposit?). Low priority; zvážit excluded nebo vyšetření. |
| `base:wZION` | 220.0 | 124.495 | **+95.505** | ✅ **VYŠETŘENO — benigní účetní artefakt**: deposits se nesweepují → prodané wZION zůstává fyzicky na deposit adresách. Detail níže. |

### wZION surplus — forenzika (2026-10-02)

On-chain rozpad (wZION `0x0c49…` na Base, service adresy):
- hot wallet `0x3903763b…ceac` = **0** (žádné Transfer eventy na něj — žádný mint do service adresy)
- deposit `0x622e…` (`cmt8k293t`) = 20 · deposit `0xfd44…` (`cmteuhfhn`) = 100 · deposit `0x2fd1…` (`cmtex8jva`) = 100 → **součet 220**

Ledger (`wallet_balances`): 17 + 100 + 0 + 7.495 = **124.495** ✓ soulad s `internal`.

**Mechanismus:** `cmtex8jva` prodal 100 wZION→USDT interním ledger-DEXem (29. 8., executed) a `cmt8k293t` prodal 1 wZION (26. 8.) — ledger správně odepsal, ale **tokeny zůstávají na nesweepovaných deposit adresách**. Reconciler počítá on-chain = všechny service adresy vs expected = ledger ⇒ surplus = „prodané-ale-nesweepnuté" wZION (+95.505 ≈ 101 prodaných − 4.95 buy credit − 1 on-chain withdrawal… přesný rozpad do sat; trend růstu +75.5→+95.5 = další sell 20.0 mezi 21.–29. 9.).

**Verdikt:** žádný unbacked mint ani únik — dluh je v *modelu*, ne ve fondech. Akce:
1. Reconciler pro token assety přepnout na deposit-flow invariant `Σ deposits_credited − Σ withdrawals_onchain ≈ on_chain` (nebo přidat `unswept_float` složku).
2. Dlouhodobě: sweep engine (deposits → hot wallet) — pozor, vyžaduje gas na každé adrese.

→ Reconciler funguje; **žádná položka neindikuje ztrátu fondů**. Před „solvable" claimem zbývá přepsat model alertů (deposit-flow invariant) + WETH dust.

---

## 6. Validátoři & klíčová bezpečnost

| Položka | Stav | Poznámka |
|---------|------|----------|
| WARP Ed25519 validátor quorum | ⚠️ `quorum = 1` | Single-node; `WARP_VALIDATOR_KEYS` = 1 klíč lokálně |
| EVM bridge validátoři (secp256k1) | 🟡 5 pubkey allowlist na L1, threshold 3 | **Edge drží 1 soukromý klíč** (`/etc/zion/keys/validator.key`); E4 round-trip dodal klíče ručně zvenčí |
| ZIONBridge kontrakt (Base) | ✅ | 4/5 validator threshold on-chain |
| Treasury multisig (DAO) | 🟡 | 5-z-7 registry existuje, ale bez crypto execution (§7) |
| Klíčová rotace / HSM / KMS | ❌ | Všechny klíče = env vars / plaintext soubory |
| Guardian rotace | ✅ CODE (2026-10-02, nedesazeno) | `DAO:guardian:register:<pubkey_hex>` → L1 scanner ověří pubkey→adresa odesílatele → `guardian_candidates`; `Admission`/`Expulsion` proposal types aplikují mutaci při execute (60 %/75 % quorum), persist `dao_guardians`, restart replay, fail-closed admission bez registrace |

**Pro „native WARP" plný stav je nutné:** distribuovaná sada ≥3 validator nodů s oddělenými klíči + L1 release path naprogramovaný tak, aby sbíral threshold podpisy (dnes `execute_burn_release` vyrobí 1 proof vs threshold 3).

---

## 7. DAO — co máme vs. komplexní DAO

### Funguje dnes (deployed :8456, UI `/dao`)

| Komponenta | Soubor | Stav |
|-----------|--------|------|
| Proposal lifecycle | `proposal.rs`, `runtime.rs` | ✅ create→active→passed/failed→timelock→executed |
| Typy návrhů | `proposal.rs` | ✅ treasury/param/grant/text s per-type quorum |
| Hlasování (API) | `voting.rs` | ✅ ZIS session auth, balance-weighted, SQLite persist |
| **L1 memo hlasování** | `l1_scanner.rs` | ✅ `DAO:vote:id:yes/no/abstain`, snapshot balance v bloku, anti-dup, dust filter |
| Quorum engine | `quorum.rs` | ✅ 15 % live |
| Timelock | `timelock.rs` | ✅ 72 h live |
| Guardian multisig registry | `treasury.rs`, `api.rs` | ✅ 5-z-7, approval endpointy |
| Treasury UTXO truth | `treasury.rs` | ✅ observed vs spendable vs lock — **1.5B ZION, spendable=0, unlock@144000** |
| Metrics/stats | `api.rs` | ✅ Prometheus + `/api/stats` |
| Proposal threshold | config | ✅ 10M ZION live |

### Částečně / unwired

| Komponenta | Stav | Poznámka |
|-----------|------|----------|
| Treasury execution | ✅ CODE (2026-10-02, nedesazeno) | `execute_treasury_op` staví reálnou UTXO tx z `getUtxos` (`treasury_tx.rs`), deterministicky vybírá vstupy, podepisuje `ZION_DAO_TREASURY_KEY` (env) a broadcastuje `submitUtxoTransaction` → `tx_id` persistováno. Bez klíče → `awaiting_broadcast` + exportovatelný unsigned spec. |
| `treasury_sigs` | ✅ CODE | Od 2026-10-02 obsahují skutečné Ed25519 podpisy (`signature`, `pubkey`, `verified` sloupce; migrace zachovává legacy audit řádky s verified=0). Threshold počítá jen verified. Podpis: `dao:treasury:v1\|op_id\|sha256(op_json)` — vázaný na obsah operace, odolný vůči změně UTXO výběru. |
| Consent engine | 🟡 `consent.rs` napsaný, nenapojený do lifecycle | sociokratická „odůvodněná námitka" |
| Cross-layer veto | 🟡 `cross_layer.rs` nenapojený | L5/L6/L3 veto 80 % v configu |
| Co-admin | 🟡 `co_admin.rs` nenapojený | 4 co-admini v configu |
| Humanitarian/L5 + prizes | 🟡 `humanitarian.rs`, `prizes.rs` nenapojené | grantový flow L5 fondu |
| ZIS bridge auth | 🟡 `zis.rs` | session flow funguje pro vote/create |
| Guardian registration memo | ✅ CODE | scanner validuje pubkey→sender address derivation a perzistuje `guardian_candidates`; admission consume při execute; `GET /api/dao/guardians` exposes active + candidates |
| Proposal/execute memos | ❌ | scanner je explicitně ignoruje → on-chain proposals neexistují |

### Chybí ke „komplexnímu DAO"

| # | Gap | Priorita |
|---|-----|----------|
| D1 | **Skutečný treasury tx pipeline**: unsigned spec → threshold verified sigs → broadcast → tx_id persist. ✅ CODE — k ověření E2E po unlock@144000; custody = jeden `ZION_DAO_TREASURY_KEY` (L1 nemá m-of-n script; guardian sigs = autorizační vrstva, ne on-chain multisig) | ~~P0~~ ✅ DONE (code), E2E pending |
| D2 | Kryptografické guardian podpisy + anti-replay | ~~P0~~ ✅ DONE (code) — Ed25519 nad `dao:treasury:v1` doménou, verified-only threshold, UNIQUE(op,guardian), replay: UTXO double-spend + status + tx_id |
| D3 | On-chain guardian registry + rotace přes governance | ~~P1~~ ✅ DONE (code) — `DAO:guardian:register:<pubkey_hex>` memo (pubkey↔sender binding), `guardian_candidates` + `dao_guardians` tabulky, `Admission` (60 % quorum) přidá guardian a `Expulsion` (75 %) tombstonuje, mutace při execute + replay v `with_db`, admission fail-closed bez L1 registrace, audit eventy `guardian_admitted`/`guardian_expelled`, `GET /api/dao/guardians`. Deploy pending |
| D4 | Proposal event/audit log (immutable historie stavů, hlasů, exekucí) | ~~P1~~ ✅ DONE (code) — append-only `dao_events` tabulka (subject-scoped: `proposal:<id>`, `op:<op_id>`), emitováno z runtime (created/vote/tally/execute/cancel) + treasury handlerů (submitted/signed/executed/awaiting_broadcast); best-effort — selhání logu neblokuje state transition; `GET /api/dao/proposals/:id/events`; UI „Event history" na detailu. Deploy pending |
| D5 | Param-execution: config-driven změny (quorum, timelock…) aplikované bez redeploye | ~~P1~~ ✅ DONE (code) — whitelist 8 governable params (`min_vote_weight`, `proposal_threshold`, `quorum_percent`, `voting_period_days`, `timelock_hours`, `daily_spend_limit`, `multisig_threshold`, `cross_layer_consent_threshold`); validace při create (unexecutability-proof), apply při execute před status flip, persist `dao_params` + replay v `with_db` po restartu; `api_key`/`db_path`/guardians/treasury addrs záměrně mimo whitelist; `/api/dao/stats` emituje whitelist. Deploy pending |
| D6 | Delegace hlasů | P2 |
| D7 | Quadratic voting pro granty (V3.3) | P2 |
| D8 | On-chain vote UX: deep-link/memo generátor z UI, QR pro mobil | ~~P1~~ ✅ DONE (code) — `VoteMemoCard` na `/dao/proposals/[id]`: volba PRO/PROTI/Zdržet se → memo `DAO:vote:<id>:<choice>` + copy + QR (formát = `parse_dao_memo` v daemonu). Deploy pending |
| D9 | Notifikační pipeline (proposal created/voting ends/executed) | P2 |
| D10 | Hiran draft proposals s human sponsor (V3.3) | P3 |
| D11 | ZK Dharma/reputation proofs (V3.3) | P3 |
| D12 | L5/L6 grant integration end-to-end | P2 |
| D13 | Multi-proposal concurrency + spam ochrana (threshold je, review stojí) | P2 |
| D14 | Disaster recovery: dao.db backup→restore→rebuild drill | P2 (backup běží, restore nedrillován) |

---

## 8. DAO UI + `dao.zionterranova.com`

### Co existuje

- `/dao` (1 469 LOC, 5 tabů): **Návrhy / Treasury / Parlament / Guardians / Roadmap** — profesionální copy, live `spendable=false`, truth-first framing.
- API proxy `/api/dao/*` přes website-v2.9; ZIS session auth napříč webem (`J1` ✅).
- `/defi/dao`, `/dashboard/dao-tree`, `/bridge`, `/explorer/bridge`, `/wallet/bridge` sekundární plochy.

### Co UI chybí

| Featura | Stav |
|---------|------|
| Proposal detail page (vlastní route `/dao/proposals/[id]`) | ✅ **CODE 2026-10-02** — full detail + votes + timeline + inline voting, deploy pending |
| Voting interface (cast vote přímo z UI + L1 memo deep-link/QR) | ✅ vote z UI (karta + detail, ZIS session) + `VoteMemoCard` (D8): `DAO:vote:<id>:yes/no/abstain` memo generátor s copy + QR na detailu |
| Quorum progress vizualizace | ✅ **CODE 2026-10-02** — `QuorumProgress` bar (karta + detail); daemon emituje `required_quorum_percent`/`quorum_required_votes`/`quorum_met`/`circulating_supply` v `serialize_proposal` |
| Vote history / audit event feed per proposal | ✅ **CODE 2026-10-02** — backend D4 (`GET /api/dao/proposals/:id/events`) + „Event history" sekce na `/dao/proposals/[id]` |
| Treasury signing workflow UI (guardian console: pending ops → sign → threshold bar) | ✅ **CODE 2026-10-02** — `TreasuryOpsPanel` na `/dao` Treasury tabu: verified-signature progress bar, per-sig verified/unverified list, signing_hash k podpisu, inline sign form (guardian + Ed25519 hex + DAO key → `POST /treasury/:op/sign`), tx_id link do exploreru, status badges vč. `awaiting_broadcast` |
| Guardian dashboard (registry, aktivita, rotace) | ✅ **CODE 2026-10-02** — `/dao` Guardians tab má live „On-chain registr" sekci: aktivní guardianové (jméno/adresa), registrovaní kandidáti čekající na admission, multisig threshold badge — zdroj `GET /api/dao/guardians`. Deploy pending |
| Notifikace (bell/email) | ❌ (backend D9) |
| Vytvoření návrhu z UI (guided form, param typy) | 🟡/❌ |
| Mobilní hlasování (memo QR → wallet app) | ❌ |

### Doporučení k `dao.zionterranova.com`

**Ano, oddělená doména dává smysl — ale fázovaně.**

**Fáze A (teď, ~nízké riziko):** ponechat `/dao` na app.zionterranova.com; doplnit do něj proposal detail route, quorum progress a treasury truth vizuály. `dao.zionterranova.com` zatím jako **301 → `/dao`** (jednoduchý hosting redirect, nulový backend).

**Fáze B (po D1–D5 backendu):** samostatná Next.js app na subdoméně jako **read-only public governance explorer** (proposals, votes, quorum, treasury lock countdown, L1 memo odkazy) + přihlášení přes sdílený ZIS cookie session → vote/guardian console. Výhoda subdomény: governance je institucionální produkt (Bohemia DAO „Zlatý dům"), ne DeFi feature — zaslouží si vlastní povrch, vlastní navigaci, klidnější branding.

**Fáze C:** on-chain signing UX, guardian rotace, notifikace, L5 grant showcase.

**Nedoporučuji** stavět plnou app teď: backend treasury je approval-simulace, event log chybí — UI by dokumentovalo funkce, které nemají pravdu v datech. Fáze A+B správně seřizuje: nejdřív truth (D1–D5), pak chrome.

---

## 9. V3.3 / N1 alignment

V33 GAP analysis uvádí L2 ≈ **50 %** — z auditovaného stavu sedí:

| N1/V3.3 položka | Stav |
|------------------|------|
| WARP relay + Base pilot | ✅ (outbound) / ⚠️ (inbound manuál) |
| 12 signerů | ✅ kód |
| 4 plné chain adaptéry (L1, BTC, EVM, SOL) | ✅ |
| SUI/Aptos adaptéry | 🟡 signer+scaffold, žádný real package |
| Solver federace | ❌ enabled=false, žádný externí solver |
| ZIS auth + derivace | ✅ |
| Passkey/WebAuthn prod | ❌ kód existuje, nenasazeno |
| Likviditní pooly | ⚠️ 1 pool, $19 hloubka |
| BTC HTLC | ✅ kód + regtest / 🔒 hold |
| ZK Dharma proofs | ❌ |
| Agent sub-accounts | ❌ |
| Quadratic grants, Hiran drafts, guardian rotace, notifikace | ❌/📄 |

---

## 10. Doporučené pořadí prací (k plně funkčnímu native WARP + DAO)

**Priorita 0 — uzavřít pravdu o existujícím:**
1. Reconciliation: vyřešit 3 drift alerts (zvlášť +95.5 wZION surplus) → audited solvency statement. **← zbývá**
2. ~~Inbound Base→L1 architektura~~ ✅ **CODE 2026-10-02** — `InboundReleaser` + `L1Releaser` (varianta a: automatický threshold sběr z lokálních release klíčů do `submitBridgeUnlock`). Deploy pending: Edge rebuild + `WARP_L1_RELEASE_KEYS` (≥3 pubkeys v `ZION_BRIDGE_VALIDATOR_PUBKEYS`) + `ZION_BRIDGE_VALIDATOR_THRESHOLD>=3` + malý E2E test.
3. ~~D1+D2: krypto treasury pipeline~~ ✅ **CODE 2026-10-02** — Ed25519 guardian sigs + unsigned UTXO spec + `submitUtxoTransaction` broadcast přes `ZION_DAO_TREASURY_KEY` (nebo `awaiting_broadcast` export). Deploy pending: Edge rebuild + treasury key env + E2E po unlock@144000.

**Priorita 1 — BTC/ZION native:**
4. ~~Server-side signed quote protokol (blocker #2)~~ ✅ **CODE 2026-10-02** — `/quote` endpoint + Ed25519 podpisy + UNIQUE replay + offer auth. Zbývá: rate caps, offer key provisioning, deploy+E2E.
5. bitcoind IBD → 100 %, přepnout backend z mempool.space na lokál.
6. Caps + solvency + monitoring → capped pilot → audit.

**Priorita 2 — další chainy:**
7. EVM rodina (Arb/OP/Polygon): deploy contractů + enable = nejlevnější nové koridory.
8. Jeden non-EVM pilot (Solana nebo Stellar — nejblíž kódu): token + relay key + watch + E2E.
9. Robinhood: funding deployer adresy → deploy → enable.

**Priorita 3 — DAO komplexita:**
10. D3–D5 (registry, event log, param execution) → pak D6–D9.
11. dao.zionterranova.com Fáze B po D1–D5.

**Priorita 4 — V3.3 horizont:** quadratic grants, Hiran drafts, ZK proofs, agent accounts, passkeys prod.

---

## 11. Live truth snapshot (Edge, 2026-10-02)

| Služba | Stav |
|--------|------|
| L1 nody ×3 | synced, height ~62 959, tip `5cee09f7…` |
| `zion-v31-multichain` :8453 | 7 transfers (poslední 2. 9.), 0 pending; enabled `zion-l1`+`base`; quorum 1 |
| `zion-v31-dao` :8456 | 1 proposal (Failed, 0 hlasů); treasury 1.5B ZION lock@144000, spendable=0 |
| `zion-bitcoind` | pruned, IBD ~79.6 % |
| `zion-zis`, `zion-db-sync`, `zion-website` | běží; Postgres sync živý (6 workers / 1 proposal / 7 bridge tx) |
| `/opt/zion/V31` checkout | ⚠️ dirty, `d57f6b979`, 337 commitů za main — rebuild risk |

---

## 12. Changelog (autonomní práce)

| Datum | Commit | Změna |
|-------|--------|-------|
| 2026-10-02 | `fb67421` | Počáteční checklist |
| 2026-10-02 | `06751d3` | **Inbound auto-release**: `warp/inbound.rs`, `warp/l1_release.rs`, `burn_id` v `DepositProof`, `router.set_dest_tx`, `warp.example.toml` env dokumentace. 594 multichain testů ✅, clippy clean. |
| 2026-10-02 | `8477942` | **DAO crypto treasury** (`treasury_tx.rs`): Ed25519 guardian podpisy nad `dao:treasury:v1\|op_id\|sha256(op)`, verified-only threshold, unsigned UTXO spec z live `getUtxos`, broadcast `submitUtxoTransaction` přes `ZION_DAO_TREASURY_KEY`, stavy `awaiting_broadcast`/`executed`, persist `unsigned_tx`/`signing_hash`/`tx_id`, DB migrace zachovává legacy audit rows. 85 dao testů ✅. |
| 2026-10-02 | `6281c6c` | **Reconciliation drift klasifikace**: `classify_drift` — deficit / untracked inflow / benign unswept deposit float (`max(expected, deposits_credited)` bound) / RPC-error suppression / excluded. Forenzika +95.5 wZION = prodané tokeny zaparkované na unswept deposit adresách (benigní). 8/8 testů ✅. |
| 2026-10-02 | `90d8925` | **BTC signed-quote protokol**: `BtcSwapQuote` + `warp:btc-quote:v1` domain Ed25519 sign/verify, `POST /swaps/btc/quote` (veřejný, `WARP_BTC_SWAP_ZION_PER_SAT` fix sazba, TTL 900 s), `/offer` auth = X-Warp-Key NEBO validní quote, `quote_id` UNIQUE replay protection, `save_btc_swap` → upsert (REPLACE by smazal victim row). 40/40 btc_swap testů ✅. Deploy pending. |

| 2026-10-02 | `a85a3a2` | **DAO UI**: `/dao/proposals/[id]` detail route (votes, quorum bar, timeline, inline ZIS voting), `QuorumProgress` komponenta na kartách, `serialize_proposal` nově emituje `required_quorum_percent`/`quorum_required_votes`/`quorum_met`/`circulating_supply`. tsc+eslint clean, 85 dao testů ✅. Deploy pending (Edge web rebuild + daemon restart). |
| 2026-10-02 | `4bc8014` | **Quote liability caps + solvency** (blocker #8): `issue_quote` async — outstanding caps `WARP_BTC_SWAP_MAX_QUOTE_ZION`/`_BTC` (live quotes + AwaitingUserLock liability), L1 `getUtxos` balance check pro `btc_to_zion` (fail-closed na RPC chybu), liability release při consume/expiry. 41/41 btc_swap testů ✅. |
| 2026-10-02 | `a3fb0ae` | **BTC-leg solvency check** (dokončení blockeru #8): `issue_quote("zion_to_btc")` sčítá confirmed UTXOs na signer adrese přes BTC backend (`fetch_utxos`, esplora+bitcoind shape), fail-closed na dead backend / empty wallet / nedostatek sats. `BitcoinAdapter::with_api_urls` test-ctor + mock backend helper. 42/42 btc_swap testů ✅. |
| 2026-10-02 | `850b4f5` | **DAO D8 on-chain vote UX**: `VoteMemoCard` — volitelný choice → memo `DAO:vote:<id>:<choice>` (wire-format dle `parse_dao_memo`), copy + QR (reuse `explorer/QRCode` → `qrcode.react`). tsc+eslint clean. Deploy pending. |
| 2026-10-02 | `17d7f38` | **DAO D5 param-execution**: whitelist 8 governable params, create-time validace (negovernable/invalid návrh odmítnut před hlasováním), execute apply před status flip (chyba = proposal zůstává executable), `dao_params` persist + replay v `with_db` (přežije restart), dynamic bound `multisig_threshold ≤ multisig_total`, `governable_parameters` v `/api/dao/stats`. 89 dao testů ✅. |
| 2026-10-02 | `6420828` | **Guardian treasury console** (DAO UI): `TreasuryOpsPanel` — verified-signature progress bar, per-sig verified marks, signing_hash zobrazení, inline sign form (guardian+sig+DAO key), `TreasuryOp` typ rozšířen (`verified_count`, `signing_hash`, `tx_id`, `unsigned_tx`, detailed `signatures[]`), `signTreasuryOperation` posílá `signature`. Build ✅, tsc+eslint clean. Deploy pending. |
| 2026-10-02 | `cb8069e` | **DAO D3 guardian registry + rotace**: L1 memo `DAO:guardian:register:<pubkey_hex>` se scanner-side pubkey→sender ověřením (fail-closed), `guardian_candidates` + `dao_guardians` persistence, `Admission`/`Expulsion` aplikovány při execute (tombstone maže i config guardiany), replay v `with_db`, audit eventy `guardian_admitted`/`guardian_expelled`, `GET /api/dao/guardians` (active + candidates). 91 dao testů ✅. Deploy pending. |
| 2026-10-02 | `c952f70` | **DAO D4 event/audit log**: append-only `dao_events` (subject `proposal:<id>`/`op:<op_id>`, event_type, actor, data_json, created_at) + index; runtime emituje `proposal_created`/`vote_cast`/`proposal_tallied`/`proposal_executed`/`proposal_cancelled`, treasury handlery `treasury_op_*`; audit selhání = `warn!`, neblokuje transition; nový endpoint `GET /api/dao/proposals/:id/events` (limit 500, parsed `data`); UI „Event history" na `/dao/proposals/[id]`. 87 dao testů ✅, tsc+eslint clean. Deploy pending. |

*Živý dokument — aktualizovat po každé změně (deploy chainu, BTC pilot, DAO D1–D5, drift resolution).*
