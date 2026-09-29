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

1. **Outbound most ZION L1 → Base funguje automatizovaně** (7 dokončených transferů, watcher→executor pipeline), ale **inbound Base → ZION L1 není automatizovaný** — burn se detekuje, ale release na L1 vyžaduje ruční `zion-bridge-unlock` + ≥3 validátor klíče, z nichž Edge drží 1.
2. **Nativní BTC↔ZION HTLC swap je kompletně naprogramovaný** (1 250 LOC orchestrátor, 6/6 regtest E2E), ale **záměrně vypnutý** — chybí server-side quote/approval protokol, dokončený Bitcoin IBD (~80 %) a bezpečnostní audit.
3. **DAO má funkční lifecycle** (proposal → vote → quorum → timelock → execute) včetně L1 memo hlasování, ale **treasury „podpisy" jsou jen auditní záznamy v DB — ne kryptografické podpisy ani broadcastnuté transakce**; treasury 1.5B ZION je do bloku 144 000 fakticky nesputná.

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
| Auto-advance inbound | `runtime.rs` | 🟡 PARTIAL | Auto-advance pouští **jen outbound**. Inbound zůstává v `Detected` navždy → manuální zásah. |
| L1 release (mint/unlock) | `adapter/zion_l1.rs:execute_mint` | ❌ MISSING | Explicitní `AdapterError` — „Manual release only in Alpha". Inbound na L1 nemá automatizovanou cestu. |
| Distribuovaní validátoři | — | 📄 DOC | `WarpValidatorSet` umí N validátorů, ale topologie N nodů s oddělenými klíči není nasazená. |

**Live důkaz:** `GET /health` → `transfers_total: 7, pending: 0`, enabled = `zion-l1 + base`, `quorum = 1` v `/etc/zion/warp.toml`.

---

## 2. Per-chain readiness matrix — „máme most?"

Klasifikace tří úrovní: **ChainAdapter** (`chain/adapters/` — plný wallet/deposit/withdraw), **WARP adapter** (`warp/adapter/` — bridge execute_mint + watch), **signer** (`warp/signer/` — jen podpis). Plný most = adapter + signer + relay klíč + nasazený token/kontrakt + finalita + runtime enabled.

| Chain | Signer | WARP adapter | ChainAdapter | Token/kontrakt nasazen | Relay klíč na Edge | Enabled | Reálný stav mostu |
|-------|:------:|:------------:|:------------:|:----------------------:|:------------------:|:-------:|-------------------|
| **ZION L1** | — (keyring) | ✅ | ✅ | nativní | keyring | ✅ | Outbound ✅ / Inbound ⚠️ jen manuálně |
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
| 2 | **Server-side quote/pricing protokol** — uživatel dnes volil BTC i ZION amount → operátor loss-path | ❌ MISSING |
| 3 | `WARP_BTC_SWAP_OFFER_KEY` provisioning + rotace + scope | ❌ |
| 4 | Bitcoin IBD → 100 %, lokální bitcoind jako primární backend | 🟡 ~80 %, roste |
| 5 | Watch-only import review (`WARP_BITCOIN_IMPORT_SINCE`, rescan mezery) | ❌ |
| 6 | WIF/network/adresa separace mainnet vs regtest | 🟡 zkontrolovat |
| 7 | Confirmation/timeout margin review (CLTV deltas oběma směry) | 📄 částečně |
| 8 | Amount caps + solvency check před akceptací | ❌ |
| 9 | Monitoring + on-call routing pro stuck swap | ❌ |
| 10 | Preimage persistence/šifrování at-rest review | ⚠️ ověřit |
| 11 | Explicitní capped pilot (např. ≤ 0.001 BTC) + rollback plán | 📄 zdokumentováno, neschváleno |
| 12 | Mainnet E2E důkaz (regtest ≠ mainnet) | ❌ |

**Pozn.:** statický offer key řeší jen „kdo smí volat API" — **neřeší ekonomiku**. Quote musí být server-side podepsaný, jinak zůstane loss-path. To je blocker #2 a hlavní důvod holdu.

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

| Asset | On-chain | Očekáváno | Drift | Klasifikace |
|-------|----------|-----------|-------|-------------|
| `zion-l1:ZION` | 0 | 20 000 000 | −20M | Pool reserve semantics — zdokumentovat nebo přesunout do excluded_assets |
| `base:WETH` | 0 | 33.1 gwei | −33 gwei | Dust — pravděpodobně excluded |
| `base:wZION` | 220 000 | 124 495 | **+95 505** | ⚠️ **Reálný surplus** — wZION mintnuté mimo tracked ledger (CCA/farm/staking pozice?). Vysvětlit nebo zaúčtovat. |

→ Reconciler funguje, ale **soulad on-chain vs ledger není prokázán**. Před „solvable" claimem: uzavřít všechny 3 položky (buď opravou accountingu, nebo auditovaným vysvětlením).

---

## 6. Validátoři & klíčová bezpečnost

| Položka | Stav | Poznámka |
|---------|------|----------|
| WARP Ed25519 validátor quorum | ⚠️ `quorum = 1` | Single-node; `WARP_VALIDATOR_KEYS` = 1 klíč lokálně |
| EVM bridge validátoři (secp256k1) | 🟡 5 pubkey allowlist na L1, threshold 3 | **Edge drží 1 soukromý klíč** (`/etc/zion/keys/validator.key`); E4 round-trip dodal klíče ručně zvenčí |
| ZIONBridge kontrakt (Base) | ✅ | 4/5 validator threshold on-chain |
| Treasury multisig (DAO) | 🟡 | 5-z-7 registry existuje, ale bez crypto execution (§7) |
| Klíčová rotace / HSM / KMS | ❌ | Všechny klíče = env vars / plaintext soubory |
| Guardian rotace | 📄 | `DAO:guardian:register:` memo existuje v scanneru, end-to-end nenapojeno |

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
| Treasury execution | ⚠️ **KRITICKÉ** | `execute` jen změní status v DB. **Nebuduje, nepodepisuje, nebroadcastuje L1 tx.** |
| `treasury_sigs` | ⚠️ | Jsou to **auditní approvals, ne kryptografické podpisy**. Nelze z nich sestavit tx. |
| Consent engine | 🟡 `consent.rs` napsaný, nenapojený do lifecycle | sociokratická „odůvodněná námitka" |
| Cross-layer veto | 🟡 `cross_layer.rs` nenapojený | L5/L6/L3 veto 80 % v configu |
| Co-admin | 🟡 `co_admin.rs` nenapojený | 4 co-admini v configu |
| Humanitarian/L5 + prizes | 🟡 `humanitarian.rs`, `prizes.rs` nenapojené | grantový flow L5 fondu |
| ZIS bridge auth | 🟡 `zis.rs` | session flow funguje pro vote/create |
| Guardian registration memo | 🟡 | scanner parsuje `DAO:guardian:register:`, ale registr se neaplikuje |
| Proposal/execute memos | ❌ | scanner je explicitně ignoruje → on-chain proposals neexistují |

### Chybí ke „komplexnímu DAO"

| # | Gap | Priorita |
|---|-----|----------|
| D1 | **Skutečný treasury tx pipeline**: build unsigned L1 tx → guardian crypto-podpisy (Ed25519/secp) → threshold assembly → broadcast → on-chain confirm → audit | **P0** |
| D2 | Kryptografické guardian podpisy + challenge/anti-replay místo `treasury_sigs` rows | P0 |
| D3 | On-chain guardian registry + rotace přes governance | P1 |
| D4 | Proposal event/audit log (immutable historie stavů, hlasů, exekucí) | P1 |
| D5 | Param-execution: config-driven změny (quorum, timelock…) aplikované bez redeploye | P1 |
| D6 | Delegace hlasů | P2 |
| D7 | Quadratic voting pro granty (V3.3) | P2 |
| D8 | On-chain vote UX: deep-link/memo generátor z UI, QR pro mobil | P1 |
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
| Proposal detail page (vlastní route `/dao/[id]`) | ❌ |
| Voting interface (cast vote přímo z UI + L1 memo deep-link/QR) | ❌ — jen list |
| Quorum progress vizualizace | ❌ |
| Vote history / audit event feed per proposal | ❌ (backend D4 předpoklad) |
| Treasury signing workflow UI (guardian console: pending ops → sign → threshold bar) | ❌ |
| Guardian dashboard (registry, aktivita, rotace) | 🟡 tab existuje, data jsou statické |
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
1. Reconciliation: vyřešit 3 drift alerts (zvlášť +95.5 wZION surplus) → audited solvency statement.
2. Inbound Base→L1: rozhodnout architekturu — (a) distribuované validátory ≥3 s automatickým threshold sběrem do `submitBridgeUnlock`, nebo (b) explicitní ops-runbook s `zion-bridge-unlock` jako dokumentovaným krokem. Bez toho není „bridge", je „one-way mint".
3. D1+D2: krypto treasury pipeline — jinak DAO treasury = demo.

**Priorita 1 — BTC/ZION native:**
4. Server-side signed quote protokol (blocker #2) + offer key provisioning.
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

*Živý dokument — aktualizovat po každé změně (deploy chainu, BTC pilot, DAO D1–D5, drift resolution).*
