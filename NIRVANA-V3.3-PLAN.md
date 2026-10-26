# ZION V3.3 "NIRVANA" — Komplexní Execution Plán

> **Datum:** 2026-10-21 · **Autor:** Devin (hluboký scan repo + Edge)
> **Vstup:** [`docs/3.2/V33_NIRVANA_MASTER_PLAN.md`](docs/3.2/V33_NIRVANA_MASTER_PLAN.md) (vision/blueprint, fáze N1–N6), [`docs/3.2/V33_GAP_ANALYSIS.md`](docs/3.2/V33_GAP_ANALYSIS.md) (snapshot 2026-09-28), [`docs/3.2/StatusV3.md`](docs/3.2/StatusV3.md), [`V31/AGENTS.md`](V31/AGENTS.md), [`apps/website-v2.9/src/lib/nirvana-roadmap.ts`](apps/website-v2.9/src/lib/nirvana-roadmap.ts) (kanonické veřejné workstreamy), živý stav Edge `vmi3425821` ověřen přes SSH.
> **Značky stavu:** **ŽIVÉ** = běží v produkci s důkazem · **STAVBA** = kód existuje, částečně nasazeno · **HORIZONT** = stub/koncept · **HYPOTÉZA** = jen dokumentace.
>
> **⚠️ Aktualizace 2026-10-26:** §1 a §3 níže jsou snapshot k 21. 10. (před dokončením splitu na EDGE2 a před G8 run #5). Aktuální stav, registr všech v3.3 plánů, crosswalk N/M/R/V33/W, ekosystémová matice a rozhodovací fronta: [`NIRVANA-V3.3-MAP.md`](NIRVANA-V3.3-MAP.md). Proveditelný checklist: [`NIRVANA-V3.3-CHECKLIST.md`](NIRVANA-V3.3-CHECKLIST.md). Fáze N0 (cesta 3.2 ALPHA → BETA → Mainnet Stable) je rozepsaná v [`docs/3.2/3.2.1-3.2.9_PLAN.md`](docs/3.2/3.2.1-3.2.9_PLAN.md). Fáze a DoD V33-1…9 tohoto dokumentu platí; navržené doplňky V33-10 (OASIS review) a V33-11 (nezávislý operátor + restore) viz mapa §3.1.
> **Rozpor kód vs. docs:** vždy vítězí kód/on-chain data. Tento dokument je execution plán — Master Plan zůstává vision vrstvou, `nirvana-roadmap.ts` veřejnou podobou.

---

## 1. Verifikovaný stav k 2026-10-21 (code-verified truth)

Změřeno na Edge (`zion-v6`, `vmi3425821`) + lokální repo HEAD `92ef9e1aa`:

| Vrstva | Kód (LOC) | Stav | Produkční důkaz |
|---|---|---|---|
| L1 core+miner+pool | ~200k | **ŽIVÉ** | height **89 940**, 3 nody (9445 primár + 9446/9447 followeři), `node_version=3.2.0`, pool přijímá ZION+QTU shary |
| Pool NG (F1–F6) | v `L1/pool` 29k | **ŽIVÉ** | `https://pool.zionterranova.com` (UI + `/public/v1`), TLS stratum **8445**, L1 RPC failover otestován stop-primary testem |
| L2 multichain+dao | ~69k | **ŽIVÉ (s holdem)** | warpd active, wZION/USDT UniV3 na Base live; **BTC swap `WARP_BTC_SWAP_ENABLED=0`** (safety hold od 2026-09-20); DAO treasury 1.5B ZION time-lock 144 000 |
| ZIS | `apps/identity` | **ŽIVÉ** | Fastify 5, Ed25519+SIWE+Google+**WebAuthn routes nasazeny** (ověřeno: `POST /api/auth/webauthn/register/options` → 401 auth-gate na produkci), session SSO, API keys |
| L3 ai-native+ncl | ~19k | **ŽIVÉ (základ)** | `zion-v31-ai-native` active, uptime 60h+, `/api/ai-chat` public, LLM přes rig tunnel (llama.cpp Qwen3-4B @ GTX 1070 Ti, ~12–14 tok/s), Maestro CLI existuje |
| L4 oasis | ~9.6k + OasisWeb | **ŽIVÉ (Rust backend)** | `zion-v31-oasis` active (worlds/quests/combat/XP/golden-egg), `oasis.zionterranova.com`, marketplace sync live; UE5.7/pixel streaming **= 0 %** |
| L5 free-world | ~4k | **ŽIVÉ** | `zion-v31-free-world` active, 5% coinbase stream trackován — **akumulováno ~24.26M ZION**, `freeworld.zionterranova.com` portal LIVE (nginx vhost), QV balloty přes ZIS session |
| L6 issobella | ~2.6k | **ŽIVÉ (tracker)** | `zion-v31-issobella` active na :8097, `/l6-issobella` stránka, premine slot 6 = 2.5B time-lock |
| G8 30-d run | `g8_evidence.py` | **❌ FAILED (run #2)** | `g8-20261010T063655Z`, elapsed 36.5 %, **uptime 95.27 % < 99.9 %**, `gate_status=failed` (critical_incident) |
| PRL pipeline | pool + edge env | **STAVBA** | `PRL_PAYOUT_ENABLED=1` + `DRY_RUN=1`, revenue oracle sleduje oyster `getbalance` :44207, native payout leg — **0 aktivních PRL minerů**, revenue→oyster wiring neuzavřen |
| Externí audit | `EXTERNAL_AUDIT_SCOPE.md` | **❌** | draft v2.0, nikoho jsme nekontaktovali, žádná firma vybraná |
| BTC IBD | `zion-bitcoind` | **🔄** | pruned node běží (Sep-20: 34 %); RPC nyní pod zátěží odpovídá pomalu/timeout — BTC swap re-enable čeká i na IBD |

### Delta vs. V33_GAP_ANALYSIS (2026-09-28) — co se posunulo

| Položka | 2026-09-28 | 2026-10-21 |
|---|---|---|
| WebAuthn/Passkey | kód hotový, čekal deploy | ✅ **nasazeno na Edge** (routes live, auth-gated) |
| `freeworld.zionterranova.com` | neexistovalo | ✅ dedikovaný vhost, QV balloty se ZIS session |
| Pool public API/UI | plán | ✅ F4–F6 live: `/public/v1`, TLS 8445, L1 failover |
| PRL pipeline | disabled placeholder | ✅ edge wiring: native payout leg + oracle + dry-run |
| G8 run | neprobíhal / run#1 fail | run#2 **failed** (95.27 % uptime) — stabilizace je kritický blocker |
| ZIS | Fastify 4, audit findings | Fastify 5, `npm audit` 0 vuln, session binding opraven |
| Workspace testy | 172+107 green | všechny krity green (zion-core 355, pool 178+→331+, multichain ~666, miner ~163) |
| Disk na Edge | — | ⚠️ **88 % (127/145G, 18G volno)** — nová provozní mezera |
| fail2ban | — | ❌ `failed` unit na Edge (journal rotován — ověřit config) |

---

## 2. Code-vs-Docs gap matrix (v3.3 DoD z Master Plan §9)

| # | DoD podmínka | Stav | Realita |
|---|---|---|---|
| 1 | L1 100k+ bloků bez zásahu | 🔄 | height ~90k — číselně blízko, ale **G8 opakovaně padá na uptime** (95 % < 99.9 %) → stabilita, ne výška, je gate |
| 2 | ZION↔BTC↔ETH auto-settle + HTLC rollback | ❌ | EVM/Base hotovo (E4 round-trip ✅); BTC holdem — kód+testy ready, chybí audit+IBD+signed quote |
| 3 | Passkey login napříč weby | 🔄 | backend+routes nasazeny; chybí E2E ověření na všech webech (app/oasis/market/dashboard/freeworld) |
| 4 | Maestro řídí ≥3 on-chain agenty s Dharma filtrem | ❌ | Maestro CLI funguje (classify→plan), ale `SubAgent::*` = enum stubby; `DharmaValidator` = keyword filter, ne kryptografický mantinel |
| 5 | OASIS web preview <3 s + pixel streaming | ⚠️ | Three.js preview existuje (`OasisWeb` + `/var/www/oasis`); pixel streaming/UE5.7 = 0 % → **de-scope** (veřejná roadmapa už pokročilé 3D označuje za research horizon) |
| 6 | L5 portál + živý 5% tok + ≥5 ověřených projektů | 🔄 | portál+tok **live** (24.26M ZION akumulováno); mapa + ověřené projekty + 1 pilot chybí |
| 7 | L6 DeSci repozitář + NCL na GPU | ❌ | tracker běží; repozitář, publikace, miner↔NCL wiring neexistují |
| 8 | `cargo test --workspace` + clippy clean | ✅ | green (report 2026-10-05); udržovat jako trvalý gate |

**Skóre DoD: ~1.5–2 / 8** (podobné jako 28.9. — posun je v základech: passkey, freeworld, pool NG, PRL wiring).

### Top přestřelené nároky docs (po scanu potvrzeno)
1. **UE 5.7 metaverse** — žádný `.uproject`, žádná asset pipeline; realisticky post-3.3 horizont.
2. **Amitabha autonomní agenti** — 0 řádků v kódu mimo copy; Maestro má intent→plan, ne execution nad chainem.
3. **NCL jako miner-side výpočty** — crate existuje (2.2k LOC: scheduler/pricing/store/backend ONNX|WASM), ale `miner/runtime.rs` o NCL neví a žádná `zion-*ncl` služba na Edge neběží.
4. **ZK Dharma proofs** — čistá HYPOTÉZA.

### Top podhodnocené skutečnosti
1. **Pool NG je dál než roadmapa** — public API+UI+TLS+failover+per-coin accounting nasazeno.
2. **PRL infrastruktura** — pearld+oyster+gateway+LP tunnel na Edge, payout dry-run zapojený.
3. **L5/L6 daemony** — skutečně akumulují on-chain (měřitelné číslo, ne jen "tracker").
4. **12 WARP signerů** — registry širší než dokumentace uvádí.

---

## 3. Blokéry zděděné z 3.2 "One Love" (N0 — povinná brána před N1+)

v3.3 nesmí stavět na nestabilním základu. Před zahájením N-fází **musí** projít:

| Gate | Stav | Akce |
|---|---|---|
| **G8 stabilita** | run#2 failed @95 % | Root-cause critical_incident (pool wedge/node stall), fixnout; run#3 s retention 40d a alert sink firing testem před startem. **Bez ≥99.9 % není v3.3.** |
| **Externí audit (G9)** | draft scope | Vybrat firmu/auditory, pinned commit, scope `EXTERNAL_AUDIT_SCOPE.md`; odemyká BTC swap i "Stable" label. |
| **BTC swap hold** | `ENABLED=0` | Po auditu: server-side signed quote + operátorské schválení + dedikovaný offer key + bitcoind IBD done → capped mainnet pilot (~100k sats). |
| **Edge provozní hygiena** | disk 88 %, fail2ban down | Log/dB retention cleanup, `du` audit na `/opt/zion/data`, restart/fail2ban config fix, systemd-networkd-wait-online cosmetic ignore. |
| **PRL dry→live** | `DRY_RUN=1` | První dry batch review → `PRL_PAYOUT_DRY_RUN=0`; revenue→oyster wiring (sweep z BIP86 `m/86'/808276'/0'/0/0` nebo přesměrovat upstream wallet na oyster); PRL miner enablement (pearlhash vyžaduje SM75+/RDNA+ — miner `gpu=PRL` pref nesubmituje na nepodporovaných kartách). |

---

## 4. Execution fáze v3.3 (přemapováno na realitu)

Původní N1–N6 z Master Planu přeuspořádané podle skutečné připravenosti a blokérů. Veřejná forma = `NIRVANA_WORKSTREAMS` (identity → orchestration → intent → oasis → earth → science).

### N0 · Foundation Closure (precondition)
**Cíl:** 3.2 de-facto stable; audit pipeline rozjetá; Edge zdravý.
- [ ] G8 run#3: fix critical incident, 99.9 % uptime, retention+alerts verified před startem
- [ ] Externí audit: firma vybrána, scope odeslán, audit commit pinnut
- [ ] Edge cleanup: disk <75 %, fail2ban opraven, backup/DR full restore test (ne jen extract)
- [ ] `v3.2.0` GitHub release: tag + multiplatform binárky + SHA256SUMS (workflows ready)

### N1 · Identity & Value Transfer (L2 + ZIS)
**Acceptance (public):** doložený deposit→swap→withdraw s recovery a refundací.
- [ ] BTC swap re-enable per N0 → E2E mainnet pilot → `WARP_BTC_SWAP_ENABLED=1` capped
- [ ] ZionDex on-chain settlement (`ZionDex-OnChain-Settlement-Plan.md`): per-user Base adresy ✅ existují → on-chain UniV3 exec → withdraw; odstranit in-memory AMM z produkční cesty
- [ ] Passkey E2E napříč weby: app + market + dashboard + freeworld (RP `zionterranova.com` pokrývá) — Playwright suite
- [ ] ZIS agent sub-accounts: schema + budget/limity (design → `shared/prisma`), ZK Dharma proofs zůstávají HYPOTÉZA (nezavazovat se)
- [ ] QTC nativní integrace per `QUANTUS-INTEGRATION-PLAN.md` (QTC v ZIS/wallet, ZION↔QTC most — Substrate chain, ML-DSA-87 podpisy, žádný contracts pallet → most přes reward adresy/indexer, ne HTLC)

### N2 · Pool & Revenue Engine (nová fáze — realita předběhla plán)
**Cíl:** `pool.zionterranova.com` = veřejný multi-coin pool s produkčními payouty.
- [ ] PRL payout `DRY_RUN=0` po review první dry batchi; revenue oracle → oyster sweep uzavřen
- [ ] PRL mining enablement: dokumentace minerů (SM75+/RDNA+), public miner release s pearl hash pref, cíl ≥1 aktivní PRL miner
- [ ] QTU native payouty produkčně (batch z quantus wallet — leg žije, payout cesta dovyšet)
- [ ] Pool ops: standby pool host (`V31/deploy/standby/provision-standby.sh`), `/public/v1` rate-limit tuning, wedgewatch dril
- [ ] Stratum v2 / PPS+SOLO / proxy mód = post-3.3 backlog (dokumentované, ne blokery)

### N3 · Hiranyagarbha 2.4/2.5 (L3) — sandboxed, not silent
**Acceptance (public):** omezená oprávnění, log všech akcí, lidské schválení pro reálný dopad.
- [ ] Maestro první reálný E2E task (read-only nad produkcí): intent→plan→`health_poller`→report; audit log all actions
- [ ] NCL MVP deploy: `zion-ncl` service (axum API + SQLite store + ONNX backend) na Edge, registrace 1 workeru, 1 pilotní inference job typ
- [ ] Miner↔NCL spike: `ZION_NCL_*` env + pull-job loop v `L1/miner` (opt-in, off default); reward path jen v regtest
- [ ] Dharma engine upgrade: keyword filter → policy engine (crate-level manifest of allowed action types + human-approval gate pro každou mutaci) — kryptografické ZK mantinely zůstávají HORIZONT
- [ ] Amitabha intent interface: draft-only režim (plán s náklady/příjemci/riziky/zrušením, **žádná autonomní exekuce**) jako web UI nad `/api/ai-chat` + Maestro plan
- [ ] Model quality: pokračovat v kurátorovaném RAG (`V31/L3/ai-native/rag-docs/`); hw upgrade path zdokumentován (RTX 3090+/48GB → Qwen3-30B-A3B; Strata kandidát při ≥12GB VRAM)

### N4 · OASIS (L4) — realistická verze
**Acceptance (public):** a11y/security/privacy review + změřený výkon; advanced 3D = research horizon.
- [ ] Three.js/OasisWeb hardening: perf budget (load <3 s na referenčních zařízeních), a11y audit, privacy review — zavést `OasisChecklist.md` jako gate
- [ ] Marketplace↔OASIS sync UX polish (`/api/oasis/sync` žije — dokončit reverse-sync edge cases)
- [ ] On-chain world state: parcel/artefakt anchoring na L1 (design → pilot v regtest)
- [ ] UE5.7 / pixel streaming: explicitní `HORIZONT` — žádný commitment; pokud research, samostatný `docs/4.0/UE5-SPIKE.md`

### N5 · Free World (L5)
**Acceptance (public):** ≥1 pilot s veřejným rozpočtem, výsledkem a nezávislým ověřením.
- [ ] Planetary map + projektový katalog UI na `freeworld.zionterranova.com` (DB schema existuje — doplnit produkční obsah)
- [ ] QV voting UI nad hotovým backendem (`L5/free-world/src/quadratic.rs`, 30 testů) — balloty přes ZIS session už proxují
- [ ] Pilotní projekt: vybrat 1 reálný projekt (např. z L5* docs série), veřejný rozpočet, proof-of-impact workflow
- [ ] Disbursement path: DAO proposal bridge existuje → první end-to-end grant (advisory → DAO → guardian multisig) — **stále human-approved**

### N6 · Issobella (L6)
**Acceptance (public):** první reprodukovatelný projekt s nezávislým review; quantum/warp = hypotézy.
- [ ] DeSci repozitář: `issobella.zionterranova.com` nebo `/l6-issobella/papers` — L1 hash anchoring publikací (op-return/tx memo)
- [ ] První reprodukovatelný výstup: např. Alcubierre-Ekam metrika jako **publikovatelný matematický draft** s recenzí (ne "funkční warp engine")
- [ ] NCL pilot pro vědecký workload — až po N3 miner↔NCL spike

### N7 · Launch Readiness
- [ ] Public docs sync: `public/` subtree diff = 0, release notes, `/roadmap` aktualizace k realitě
- [ ] CoinGecko re-apply per `COINGECKO_REAPPLY_ROADMAP.md` (po BTC swap + audit news)
- [ ] Bug bounty + community channels (G6/G7 z 3.2 rest)
- [ ] Publikace "v3.3 Nirvana" — jen když DoD §5 splněno

---

## 5. Definition of Done — v3.3 Nirvana (přepracované, měřitelné)

| # | Gate | Měření |
|---|---|---|
| V33-1 | **Stabilita:** G8 run s ≥99.9 % uptime absolvován (ne nutně 100k bloků — evidujeme uptime, ne absolutní výšku) | `g8_run.json` verdict + Prometheus |
| V33-2 | **Externí audit** uzavřen: kritické nálezy mitigovány nebo přijaty s odůvodněním | audit report v `docs/3.3/` |
| V33-3 | **Value transfer:** BTC swap E2E mainnet (lock→claim i refund path) + ZionDex on-chain deposit→swap→withdraw | on-chain TX odkazy |
| V33-4 | **Identita:** passkey login E2E na ≥3 produkčních webech | Playwright evidence |
| V33-5 | **L3 sandbox:** Maestro vykoná 3 reálné úlohy s audit logem + human-approval gate; NCL služba nasazena s ≥1 job typem | logy + service status |
| V33-6 | **L5 dopad:** ≥1 dokončený pilotní projekt s veřejným rozpočtem a výsledkem | freeworld portal + DAO záznam |
| V33-7 | **L6 repro:** 1 publikovaný reprodukovatelný dokument s L1 anchorem | repo URL + on-chain hash |
| V33-8 | **Kvalita:** `cargo test --workspace` + clippy clean + `npm audit`/`cargo audit` 0 critical | CI output |
| V33-9 | **Pool produkce:** PRL+QTU native payouty live (non-dry-run), ≥1 externí miner na každé nativní leg | `/public/v1` metriky |

**Explicitní NON-DoD (odložit mimo 3.3, ne false-promise):** UE5.7/Nanite/Lumen, pixel streaming, autonomní on-chain agenti bez human gate, ZK Dharma proofs, 12-chain plná WARP produkce, kvantový/warp engine hardware, Stratum v2.

---

## 6. Rizika

| Riziko | Mitigace |
|---|---|
| G8 opakovaně padá na infra incidenty (stall, wedge, rebuild downtime) | Targeted fixes před run#3; evidence retention + alerting jako gate před startem okna |
| Audit nalezne kritikum v bridge/payout | 4týdenní buffer; BTC swap zůstane holdem do closure |
| Edge disk 88 % → výpadek DB | Cleanup + retention policy jako součást N0; zvážit volume rozšíření u Contabo |
| PRL upstream závislost (LuckyPool credit) | Fallback: sweep z BIP86 klíče; payout zůstane dry-run dokud není revenue path ověřená |
| Scope creep (UE5.7, agenti) | Tento plán je single source of truth; HORIZONT položky se necommitují |
| LLM kvalita (halucinace 1.7–4B modelu) | Public chat = curated RAG + "operátorský nástroj" label; žádné autonomní rozhodování |

---

## 7. Zdrojový map (všechny relevantní roadmapy/plány v repu)

| Dokument | Role pro v3.3 |
|---|---|
| `NIRVANA-V3.3-MAP.md` + `NIRVANA-V3.3-CHECKLIST.md` | **aktuální mapa + checklist (2026-10-26)** — úplný registr plánů je v mapě §1 |
| `docs/3.2/3.2.1-3.2.9_PLAN.md` | N0: soupis prací ALPHA → BETA → RC → Mainnet Stable (9 sekcí, ID položek) |
| `POOL-FLEET-EXPANSION-PLAN.md` | N2: pro-pool parity + Fleet OS (W1–W7) |
| `AUDIT-REPORT.md` + `AUDIT-3.2-BETA-PLAN.md` | interní audit vlny 1–7 + alpha → beta gate |
| `canon/books/MiseAmenti/04-Exekucni-Charta-3.3.md` | kanonický rámec M0–M8 + release gates R1–R9 |
| `docs/3.2/V33_NIRVANA_MASTER_PLAN.md` | vision/blueprint (N1–N6, DoD draft) |
| `docs/3.2/V33_GAP_ANALYSIS.md` | předchozí gap scan 2026-09-28 (tento dokument jej aktualizuje) |
| `docs/3.2/ROADMAP.md` + `V31/PLAN_TO_3.2.md` | 3.2 gate registry (G1–G11, fáze E–J) |
| `docs/3.2/ZION-POOL-NG-PLAN.md` | pool refaktor F1–F6 (vetšina nasazena) |
| `docs/3.2/QUANTUS-INTEGRATION-PLAN.md` | QTC×ZION most |
| `docs/3.2/MULTI-ALGO-ROADMAP.md` | 33-coin ExternalCoin inventář |
| `docs/3.2/ZionDex-OnChain-Settlement-Plan.md` + `ZionDexZis.md` | DEX settlement |
| `docs/3.2/ZIS_INTEGRATION_PLAN.md` + `ZIS_WALLET_PLAN.md` | identita |
| `docs/3.2/L5_L6_ACTIVATION_PLAN.md` | L5/L6 run-mód (passive trackers → tento plán je rozšiřuje) |
| `docs/3.2/EXTERNAL_AUDIT_SCOPE.md` | audit scope draft v2.0 |
| `canon/books/nirvana/` + `NirvanaCloud/` | narativní korpus (kniha Nirvana, stoletý plán) |
| `apps/website-v2.9/src/lib/nirvana-roadmap.ts` | **kanonické veřejné workstreamy** — public copy se nesmí rozcházet |
| `docs/3.2/REPORTS/INTERNAL_AUDIT_2026-10-05.md` | interní audit IA-01..22 |
| Starší `docs/**/ROADMAP*.md` (~80 souborů) | historické — pouze reference, nekonzultovat pro execution |

---

*Vygenerováno hlubokým scanem 2026-10-21: ~30k LOC inventář, Edge SSH sweep (služby, RPC, API, G8 JSON), repo docs přečteny. Nezávazný plán; reality > docs.*
