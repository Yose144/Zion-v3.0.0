# ZION V3.3 "NIRVANA" — Gap Analysis: Code vs Docs

> **Datum:** 2026-09-28
> **Vstup:** [`V33_NIRVANA_MASTER_PLAN.md`](./V33_NIRVANA_MASTER_PLAN.md) vs. stav repozitáře (HEAD) + Edge deployment
> **Metoda:** statická analýza kódu (LOC, struktura, wiring), kontrola systemd služeb na Edge, audit klíčových nároků
> **Verdikt škály:** ŽIVÉ (běží v produkci) / STAVBA (kód existuje, částečně nasazen) / HORIZONT (kód stub nebo koncept) / HYPOTÉZA (jen dokumentace)

---

## 1. Souhrn — velikost implementace

| Vrstva | Soubory | LOC | Stav kódu | Deployed na Edge |
|---|---|---|---|---|
| L1 core + miner + pool | 232 | ~122k | produkční | ✅ `zion-v31-node/pool/miner` |
| L2 multichain + dao | 129 | ~59k | produkční-grade | ✅ `zion-v31-multichain/dao`, `zion-zis` |
| L3 ai-native + ncl | 38 | ~19k | funkční jádro | ❌ žádná služba |
| L4 oasis | 30 | ~9.5k | backend + Three.js web | ✅ `zion-v31-oasis` (Rust backend) |
| L5 free-world | 11 | ~1.7k | funkční tracker | ✅ `zion-v31-free-world` |
| L6 issobella | 11 | ~2.6k | funkční tracker | ✅ `zion-v31-issobella` |

**Nejdůležitější nález:** L5 a L6 backendy (`free-world`, `issobella`) **běží v produkci** — daemon + L1 coinbase scanner + DAO bridge. Plán je podhodnocený pro fund-tracking vrstvy a přehnaný pro AI/metaverse.

---

## 2. Fáze N1–N6 vs. reálný kód

### N1 — L2 Multichain & ZIS (plán: září 2026) — ~50 %

**Existuje (kód + částečně produkce):**
- Chain adaptéry: `bitcoin.rs`, `evm.rs`, `solana.rs`, `zion_l1.rs` (`V31/L2/multichain/src/chain/adapters/`)
- WARP signers pro **12 chainů**: evm, btc, solana, sui, aptos, cardano, cosmos, near, stellar, tron, ton, lightning
- DEX stack: `solver_network.rs`, `intent_engine.rs`, `swap_executor.rs` (UniV3 quote + in-memory AMM fallback + HTLC)
- Produkce: wZION/USDT UniV3 pool na Base live (19 USDT + 151,867 wZION, NFT #5952162), Robinhood Chain deterministicky ověřen (čeká ETH funding deployera)
- ZIS (`APP&WEB/identity`): Ed25519 challenge auth + SIWE + Google OAuth, `/derive` route s DB persistencí per-chain adres
- BTC swap: kompletní HTLC + `bitcoind_rpc` backend, 6/6 regtest E2E PASS — **ale `WARP_BTC_SWAP_ENABLED=0`** (safety hold od 2026-09-20, čeká externí audit + bitcoind IBD)

**Chybí / plán přestřeluje:**
- ❌ WebAuthn/Passkey — žádná závislost (`@simplewebauthn` nenalezeno), žádný biometric route
- ❌ SUI/Aptos **chain adaptéry** — pouze signers, ne plné adaptéry
- ❌ AMM pooly `ZION/BTC`, `ZION/USDC`, `ZION/SOL` — jen wZION/USDT existuje
- ❌ Agent sub-accounts s budgety, Zero-Knowledge Dharma proofs

**DoD:** obousměrný cross-chain swap s auto-settlement → **nesplněno** (BTC off).

### N2 — L3 Hiranyagarbha 2.4 (plán: říjen 2026) — kód ~60 %, deploy 0 %

**Existuje:**
- `maestro.rs` — IntentRouter → Planner → `ExecutionPlan` (DAG) → `LayerAgentRegistry` — skutečný orchestrátor
- `llm_backend.rs` — EchoBackend + RemoteHttpBackend (NVIDIA NIM / OpenAI-compatible `/v1/chat/completions`)
- `health_poller.rs` — 26-service health matrix
- `autotuner.rs`, `planner.rs`, `intent.rs`, `orchestrator.rs`, `hiranyagarbha.rs`
- NCL crate — scheduler, reputation, pricing, store, backend (~2.2k ř.)

**Chybí:**
- ❌ **Není nasazeno** — žádná `zion-ai-native` / `hiran` / `ncl` systemd služba na Edge
- ❌ Miner↔NCL wiring — `V31/L1/miner/src/runtime.rs` nemá žádnou referenci na NCL (mineři AI práci neprovádějí)
- ❌ "Specializovaní agenti" jsou enum stubs (`SubAgent::WalletOps` apod.), ne běžící agenty

### N3 — L3 2.5 Amitabha & Agenti (plán: listopad 2026) — ~10 %

- ❌ **Amitabha — 0 výskytů v kódu** (pouze `roadmap/page.tsx`, `l3-hiran/page.tsx` copy)
- ⚠️ `oasis_bridge.rs` má `Agent{wallet_address}` — jen registry pole, žádné tx signing
- ⚠️ `DharmaValidator` existuje v `hiranyagarbha.rs` — **keyword filter** ("harm"/"deceive" stringy → violation), ne kryptografický mantinel
- ❌ Auto-DeFi arbitráž, self-sovereign wallets, autonomní management — nenalezeno

### N4 — L4 OASIS UE 5.7 (plán: říjen–prosinec 2026) — backend ~40 %, UE5 = 0 %

- ✅ `zion-v31-oasis` Rust backend běží (worlds, quests, combat, territory, raid_team, leaderboard)
- ✅ `OasisWeb` — Three.js / react-three-fiber WebGL preview existuje
- ❌ **UE 5.7 — žádný .uproject / C++** — jediná zmínka je komentář v `L4/oasis/src/api.rs`
- ❌ Pixel streaming (WebRTC), Nanite, Lumen, MetaHuman — nenalezeno

### N5 — L5 Free World (plán: listopad–prosinec 2026) — ~55 %

**Existuje (nasazeno):**
- `zion-v31-free-world.service` active — `l1_scanner.rs` trackuje 5 % coinbase stream on-chain
- API: `/api/v1/grants` (create/approve/submit-to-dao), `/api/v1/projects`, `/fund/balance`, `/ai/analyze-grant`
- `/l5-free-world` web page — `FundBalance` component, live balance, genesis 3.3B kontext
- `dao_client.rs`, `hiran_bridge.rs` — napojení na DAO

**Chybí:**
- ❌ Quadratic voting — žádná implementace nikde
- ❌ Interaktivní planetary mapa, `freeworld.zionterranova.com` subdomain
- ❌ ≥5 ověřených projektů (DB schema existuje, produkční obsah neověřen)

### N6 — L6 Issobella (plán: prosinec 2026) — ~40 %

**Existuje (nasazeno):**
- `zion-v31-issobella.service` active — missions/proposals/observations/spend API + L1 scanner
- `/l6-issobella` web page — station preview, fund balance, genesis 2.5B time-lock 144 000

**Chybí:**
- ❌ Quantum engine / Alcubierre-Ekam metrika — pouze `V31/L6/issobella/docs/*.md`
- ❌ DeSci repozitář `issobella.zionterranova.com`
- ❌ NCL quantum simulace — žádná integrace miner↔NCL

---

## 3. Definition of Done (plán §9) — skóre

| # | Podmínka | Stav | Poznámka |
|---|---|---|---|
| 1 | L1 100 000+ bloků bez zásahu | ❌ | height ~60.5k; 2026-09-27 4× pool wedge (opraveno) |
| 2 | Obousměrný ZION↔BTC↔ETH auto-settle + HTLC rollback | ❌ | BTC pod safety holdem; jen wZION/USDT na Base |
| 3 | Passkey login napříč weby | ❌ | WebAuthn vůbec neexistuje v `identity/` |
| 4 | Maestro řídí ≥3 agenty on-chain s Dharma filtrem | ❌ | L3 nenasazeno; Dharma = keyword filter |
| 5 | OASIS web preview <3 s + pixel streaming | ⚠️ | Three.js existuje; pixel streaming ne |
| 6 | L5 portál + živý 5% tok + ≥5 projektů | ⚠️ | backend+page live; mapa/voting/projekty chybí |
| 7 | L6 quantum model publikován + NCL na GPU | ❌ | pouze docs |
| 8 | `cargo test --workspace` + clippy clean | ✅ | naposled ověřeno 172+107 green |

**Celkový DoD: ~1.5 / 8 splněno.**

---

## 4. Kde je plán nejvíc přestřelený (top mezery)

1. **UE 5.7 metaverse** — žádný kód, asset pipeline, build infra ani licensing strategie; Three.js web je reálný, ale plan marketingově slibuje Nanite/Lumen.
2. **Amitabha + autonomní agenti** — čistý koncept; ani Maestro není nasazen.
3. **WebAuthn/Passkey** — nejobvyklejší produkční požadavek, ale v ZIS zcela chybí.
4. **BTC swap mainnet** — kód hotový a otestovaný, ale blokovaný safety holdem (audit + IBD).

## 5. Kde je plán podhodnocený (skutečnost lepší než docs)

1. **L5 + L6 daemony běží v produkci** (`free-world`, `issobella` services) — plán je označuje za STAVBA/HORIZONT, ale tracker + API + DAO bridge + web stránky jsou live.
2. **12 WARP signers** — víc než plán uvádí (SUI/Aptos/Cardano/TON/Stellar/Near/Lightning).
3. **ZionDex solver network + intent engine** — produkční kód existuje, jen není venku zapnutý.

## 6. Doporučená sekvence (data-driven)

| Priorita | Task | Proč |
|---|---|---|
| 1 | BTC swap re-enable (audit → capped pilot po bitcoind IBD ~65 % → done) | odemyká N1 DoD + jediná blocker je procedurální |
| 2 | L5 planetary mapa + 2-3 pilotní projekty | N5 je nejblíž dokončení (backend hotový) |
| 3 | Passkey/WebAuthn do ZIS | denní UX; knihovny existují (`@simplewebauthn/server`) |
| 4 | `zion-ai-native` service deploy + Maestro E2E na 1 reálný task | L3 existuje jako kód, chybí provoz |
| 5 | L6 quantum model → publikace v DeSci repozitáři (i jako draft) | čistý výzkumný výstup, ne infra |
| 6 | UE5.7 → **realisticky odkládáme** / Three.js preview rozšiřovat | 0 % základy, megaprojekt |

## 7. Poznámky k integritě dat

- Edge checkout `/opt/zion/V31` je na `d57f6b979` (dirty, ~15+ commitů za `main`) — analýza výše je proti **lokálnímu repo HEAD**; Edge runtime může být drobně starší. Reconciliace checkoutu doporučena (viz `AGENTS.md`).
- LOC z `find -name "*.rs"` — nejsou to přesné metriky testů/dokumentace, ale orientační váha implementace.
- `zion-v31-node2/node3` jsou active — legacy jednotky vedle hlavního `zion-v31-node` (více procesů běží současně).

---

*Autor: analýza Devin (Cognition), 2026-09-28. Náklady na ověření: ~30 grep/read operací + 1 SSH sweep Edge.*
