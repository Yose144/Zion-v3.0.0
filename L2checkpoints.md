# L2 Checkpoints — kanonický stav vrstvy 2

> **Ověřeno:** 2026-09-30 (doc-vs-code audit + live Edge dotazy). Zdroj pravdy pro stav L2 = `V31/L2/multichain` + `V31/L2/dao`. Nadřazený gate dokument: `V3.2checklistu.md`.
> **Konvence stavů:** ✅ merged v `main` (commit) · 🚀 nasazeno na Edge · 🔄 kód existuje, produkce/důkaz pending · ❌ otevřené.

---

## 1. Deploy drift — Edge binárky vs `main`

| Služba | Edge build | Pokrývá commity do | Chybějící commity z `main` |
|---|---|---|---|
| `warpd` (`zion-v31-multichain`, :8453) | **2026-09-21** | `0e5628daf` (solvency deposit-address fix) | **10 commitů z 2026-09-29** — signed quote #2, liability caps #8, sanity bounds #7, rescan fail-closed #5, preimage enc FIND-002, stuck-swap #9, offer-key `_PREV`, inbound L1 release, recon deposit-flow fix |
| `zion-dao` (:8456) | **2026-09-25** | `483aedf38` (Parliament UI alignment) | **7 commitů z 2026-09-29** — D3 registry, D4 audit log, D5 param-exec, D6 delegation, D13 caps+rate-limit, crypto treasury pipeline |
| `zion-website` (:3000) | **2026-09-30** | `9fbc3a39e` (HEAD) | — (deployováno s docs revizí; obsahuje DAO UI proposal detail + delegated weight) |

**Důsledek:** Edge API nemá nové endpointy — `GET /api/dao/guardians` → 404, `GET /v1/multichain/swaps/btc/list` → 404 na starém buildu. Drift je čistě deploy-dluh, ne kódový problém; rebuild+deploy je operátorské rozhodnutí (BTC swap flow má zůstat disabled i po deployi dokud neprojdou gaty).

---

## 2. WARP / Multichain — stav komponent

| Komponenta | Stav | Kde / evidence |
|---|---|---|
| Bridge Base↔ZION round-trip | 🚀 | on-chain lock→mint→burn→unlock (`b7f227a6…`, `0xa5148c44…`, `9f3e654e…`); opakovatelný audit+monitoring otevřený |
| 13+ chain adaptéry | 🚀 | `warp/` signers: EVM ×6, solana, tron, stellar, cardano, cosmos, aptos, sui, near, ton, bitcoin, lightning |
| Non-EVM `disabled_reason` | 🚀 | `warp/config.rs`, `ChainRegistry`, `warp.example.toml` (gate G2 ✅) |
| DEX quote API + widget | 🚀 | `/v1/swap/quote`, `/quote/multi`; `/multichain#dex` (CrossChainSwapWidget + DexPoolList + graf) |
| Solver network | ✅ kód / 🔄 produkce | `swap/dex/solver_network.rs`; nezávislí solvéři v produkci zatím ne |
| DEX settlement pro uživatele | 🔄 | `multichain_wallet/`; **chybí funded E2E deposit→swap→withdraw** (checklist E) |
| Solvency guard + deposit addresses | 🚀 | `solvency.rs` — funded deposit adresy se počítají (0e5628daf); live `solvent:true` wZION |
| Reconciliation + excluded_assets | 🚀 | `reconciliation.rs` + `[reconciliation]` TOML sekce; deprecated/test assety nealertují |
| Automated inbound L1 release | ✅ merged, Edge pending | `warp/inbound.rs` — burn→AwaitingFinality→unlock, 2-conf, manuální fallback (06751d37c) |
| Node rewards modul | ✅ kód | `node_rewards.rs`; aktivace 1% slotu = rozhodnutí (v3_state `u64::MAX` = explicitně deaktivováno) |
| Health | 🚀 | `/health` → `{"ok":true,"version":"3.1.0-beta"}` live |

## 3. BTC swap (WARP Beta) — SAFETY HOLD `WARP_BTC_SWAP_ENABLED=0`

Re-enable checklist stav (kanonicky v `WarpBeta/STATUS.md`):

| Bloker | Kód | Edge | Poznámka |
|---|---|---|---|
| Operator-gated offers (`X-Warp-Key`) | ✅ 2947b81c2 | 🚀 | `WARP_BTC_SWAP_OFFER_KEY` env — **na Edge nenastaven** |
| Fail-closed observations / backend redaction / network+WIF strict / import preflight / empty-failover / per-IP limiter | ✅ 2947b81c2 | 🚀 | 9/20 hardening |
| Signed server-side quote (#2) | ✅ 90d8925a5 | ❌ | `sign_quote`/`issue_quote`/`set_quote_signer`; `WARP_BTC_SWAP_ZION_PER_SAT` nenastaven → /quote zůstane disabled |
| Liability caps + operator solvency (#8) | ✅ 4bc801480, a3fb0aeff | ❌ | `max_quote_outstanding_{zion,btc}` |
| Sanity bounds margins/confs (#7) | ✅ df2be579d | ❌ | margin<6, conf<1, min>max → disabled |
| Rescan fail-closed (#5) | ✅ d0e79f6dd | ❌ | `bitcoind_rpc.rs` — listunspent mid-rescan → chyba, ne prázdný set |
| Preimage enc at rest (FIND-002) | ✅ 36e270412 | ❌ | XOR `ZION_HTLC_PREIMAGE_KEY`; key neprovisioned |
| Stuck-swap alerting (#9) | ✅ f6f2637f8 | ❌ | `health_metrics` stale/near-deadline gauges |
| Offer-key rotation grace | ✅ 6c121fa5e | ❌ | `WARP_BTC_SWAP_OFFER_KEY_PREV` |
| **Rebuild+deploy `warpd` z main** | — | ❌ | předpoklad pro vše výše |
| Externí audit | — | ❌ | G9 blokér, scope zahrnuje WARP solvency |
| Keys provisioning mimo repo | — | ❌ | OFFER_KEY(+_PREV), ZION_PER_SAT, HTLC_PREIMAGE_KEY, DAO_TREASURY_KEY — `chmod 600` env |
| bitcoind IBD + local backend | — | ❌ | **live: ~80,4 %, height ~877k** (z 55,5 % 9/21); `WARP_BITCOIN_API` nenastaveno |
| Production WIF/network/address review | — | ❌ | `WARP_BTC_RELAY_KEY` review |
| Capped pilot explicit go | — | ❌ | operátorské schválení |

Historická evidence zůstává: regtest 6/6 (oba směry, refund paths, restart recovery), live-ZION leg SETTLED, `tests/btc_swap_flow.rs`.

## 4. DAO — stav položek

Live produkce (build 9/25): quorum 15 %, voting 14 dní, timelock 72 h, threshold 10M ZION, 5-of-7, treasury 1,5B ZION zamčená do bloku 144 000 + admin unlock (`admin_unlocked=false`, `spendable=false`, chain ~63,7k).

| Položka | Kód | Edge | Evidence |
|---|---|---|---|
| Guardian registry endpoint (D3) | ✅ cb8069e49 | ❌ (404) | `GET /api/dao/guardians`: bootstrap config + on-chain `DAO:guardian` kandidáti; admission 60 % / expulsion 75 % quora |
| Append-only event/audit log (D4) | ✅ c952f7027 | ❌ | `dao_events` tabulka + `GET /proposals/:id/events` |
| Param-execution (D5) | ✅ 17d7f38cb | ❌ | `executor.rs::apply_parameter_change` — quorum/voting_days/threshold/timelock/max_active_per_proposer se přepíší při execute |
| Vote delegation (D6) | ✅ e3e5a5b46 | ❌ | `dao_delegations`/`dao_delegated_votes`, non-transitive, consumed per-proposal; memo `DAO:delegate:<addr>`/`none`; UI delegated weight (b11fc18af) |
| Write rate-limit + proposer cap (D13) | ✅ 0cd07e441, 9a3d76070 | ❌ | `write_rate_limit` middleware + `max_active_per_proposer` (též governable param) |
| Crypto treasury pipeline | ✅ 8477942aa | ❌ | `treasury_tx.rs`: Ed25519 sigy nad `dao:treasury:v1|<op_id>|<sha256(op)>` → threshold → L1 UTXO build+sign+broadcast přes `ZION_DAO_TREASURY_KEY`; bez key → unsigned spec pro externí podpis |
| On-chain vote | ✅ | 🚀 backend | `l1_scanner.rs` — mema `DAO:vote:<id>:<yes|no|abstain>`, balance-at-block, dedup; **vote-by-tx UX modal + QR merged v webu** (D8) |
| Proposal detail UI | ✅ a85a3a270 | 🚀 (od 9/30 deploye) | `/dao/proposals/[id]` timeline, voter table, kvórum progress |
| L5/L6 submit-to-dao | ✅ | 🔄 | `free-world/dao_client.rs`, `issobella/dao_client.rs` — URL 8456 + `ZION_DAO_API_KEY`; env na Edge přítomno; live submit evidence otevřená |
| Treasury lock truth | ✅ | 🚀 | `/api/dao/treasury` — chain_height, unlock_height, time_locked, admin flags, spendable_* |
| Quadratic voting pro granty | ❌ | — | `sqrt` není v `voting.rs`; L5 má vlastní `quadratic.rs` pro QV kola (3.3 scope) |
| Mobile/Desktop sync | 🔄 | — | mapping nových polí neověřen |

## 5. Zbývající L2 beta důkazy (checklist E)

- [ ] **DEX funded user flow** `deposit → swap → withdraw` — jediný zásadní chybějící L2 důkaz.
- [ ] HTLC release evidence pro failure-mode refund — regtest 6/6 refund paths existuje (`btc_swap_flow.rs`), nativní L1 refund zdokumentován v `docs/3.2/NATIVE_L1_HTLC_REPORT.md`; formální release artefakt pending.
- [ ] Bridge: opakovatelný monitoring + další malý round-trip smoke před release.
- [ ] Node reward 1 %: rozhodnout activation height nebo ponechat explicitně deaktivované (dnes `u64::MAX` = deaktivováno; žádný implicitní nárok).
- [ ] Externí audit (G9, BLOKER STABLE): scope L1/UTXO/premine, bridge/HTLC, WARP solvency, DAO treasury, ZIS/WebAuthn, release supply chain.

## 6. Doc dluh vyřešený touto revizí (2026-09-30)

- `WarpBeta/STATUS.md` — doplněn 9/30 snapshot: blockers v kódu vs Edge deploy pending; re-enable checklist aktualizován (IBD ~80,4 %).
- `DAO.md` — treasury sekce opravena z "crypto execution pending" na merged-vs-deployed pravdu; D1/D2 tabulky anotovány stavy.
- `docs/3.2/3.2.1-3.2.9_PLAN.md` — Passkeys ❌→🔄 (backend `webauthn.ts` + 10/10 testů + web UI existují; produkční rollout je 3.3 scope).

## 7. Doporučené pořadí dalších kroků

1. **DEX funded user flow** — poslední velký chybějící L2 důkaz pro 3.2.
2. **Rebuild+deploy `zion-dao` a `warpd`** z `main` (pokud operátor chce nové endpointy/guardian registry live; BTC swap flow zůstává disabled i po deployi).
3. **Node-reward activation rozhodnutí** (administrativní).
4. **Capped-pilot BTC swap** — až po externím auditu + dokončeném IBD + provisioning.
