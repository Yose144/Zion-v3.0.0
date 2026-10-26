# ZION V3.3 „NIRVANA" — Execution Checklist

> **Datum:** 2026-10-26 (aktualizace verze z 21. 10.) · **Doplněk k:** [`NIRVANA-V3.3-PLAN.md`](NIRVANA-V3.3-PLAN.md)
> **Mapa (registr plánů, crosswalk, závislosti, ekosystém):** [`NIRVANA-V3.3-MAP.md`](NIRVANA-V3.3-MAP.md) · **N0 detail (3.2 ALPHA → BETA → STABLE):** [`docs/3.2/3.2.1-3.2.9_PLAN.md`](docs/3.2/3.2.1-3.2.9_PLAN.md) — ID typu `2.B1` / `7.S1` / `P0-1` odkazují tam.
> **Značky vlastníka:** 🤖 = autonomní (kód/testy/dokumenty end-to-end) · 🔀 = autonomní příprava + operátorské schválení/flip · 👤 = operátor (rozhodnutí, peníze, klíče, fyzický svět)
> **Pravidlo:** Devin nikdy neflipuje produkční money-paths, nevydává verze, nevybírá dodavatele — vždy připraví PR/artefakt/důkaz a počká na 👤 sign-off.
> **Topologie:** EDGE2 = primary node + web ingress + app stack · EDGE = pool (reálné IP minerů) + followeři + ops. Detail v `AGENTS.md`.

---

## Stav v kostce (2026-10-26)

| Oblast | Stav |
|---|---|
| Stupeň | **3.2 BETA** (`3.2.0-beta.1`, beta gate 25. 10.) → další brána RC |
| G8 | run #5 `g8-20261025T215746Z` — **99.733 %**, 0 kritických, rozpočet 43 min (spotřebováno 2), konec 24. 11. |
| G9 | ⏸️ **posunuto rozhodnutím 👤 26. 10.** — audit package + scope připravené k odeslání; Stable bez data |
| Interní audit | vlny 1–7 nasazené a živě ověřené (warpd = audit build, holdy aktivní, payouty potvrzené on-chain) |
| Code gates (pin `ad8ab5895`) | `cargo test --workspace` **2 839 / 0 fail**, check OK, Foundry 48/48, ZIS 46/46 · ⚠️ clippy ~110 warnings, fmt drift 25 souborů · ❌ npm critical v 5 webových appkách + mobile, `cargo audit` chybí |
| P0 defekty | **1 otevřený** — P0-1 ✅ + P0-2 ✅ opraveny 26. 10.; zbývá P0-3 sdílený env (viz N0) |
| DoD v3.3 | 0/9 splněno · 5 rozpracovaných (tabulka níže) |

---

## N0 · Foundation Closure = 3.2 Mainnet Stable

Detail všech položek: [`3.2.1-3.2.9_PLAN.md`](docs/3.2/3.2.1-3.2.9_PLAN.md). Zde jen brány.

- [x] Beta gate — ekosystém F0–F6 sjednocený, web cutover na EDGE2 (22. 10.), root `3.2.0-beta.1` ([`AUDIT-3.2-BETA-PLAN.md`](AUDIT-3.2-BETA-PLAN.md))
- [x] Interní audit money-paths vlny 1–7 nasazené + live verifikace 26. 10. ([`AUDIT-REPORT.md`](AUDIT-REPORT.md))
- [~] **P0** produkční defekty z verifikace 26. 10. — 2/3 opraveny téhož dne
  - [x] 🔀 P0-1 ✅ 26. 10. — L5 scanner restartován, catch-up 6 732 bloků na tip 97 064, zápis ověřen; recovery dump smazaného inode v `/data/zion/` (0 ztráta) (6.B1)
  - [x] 🔀 P0-2 ✅ 26. 10. — db-sync credentials sjednoceny s rolí `zion`, 0 chyb od restartu, upserty `MiningWorker` běží (8.B1)
  - [ ] 🔀 P0-3 rotace PRL RPC credentialu (👤) + per-service env subsety (7.B6)
- [ ] **G8 — 30 dní ≥99.9 %, žádný incident ≥900 s**
  - [x] 🤖 RCA run #2 + live stall 21. 10. → fixy (pool RPC timeout 4→12 s, pool-side pre-orphan pryč, watchdog 30 s/3-fail) nasazené ([`REPORT_2026-10-21_G8_STALL_RCA.md`](docs/3.2/REPORTS/REPORT_2026-10-21_G8_STALL_RCA.md))
  - [x] 🤖 RCA run #3 (SPOF tunelu v sondě) → probe na lokální followery + vlastní probe na EDGE2
  - [x] 👤 Start run #5 (25. 10.)
  - [ ] 🤖 Alert sink firing test + 40d retence doložit (8.B9)
  - [ ] 🤖 Run #5 PASS (1.S1) — nic nesmí zasáhnout required služby bez rollbacku do 15 min
- [~] **G9 — externí audit** ⏸️ **posunuto rozhodnutím 👤 26. 10.** (v aktuálním okně se neobjednává)
  - [x] 🤖 Audit package (pin `4108a52d0`, reprodukovatelný build) + scope v2.2 — připraveno k odeslání
  - [ ] 🤖 Přepinovat na RC commit (wave 7 + W1 posunuly pool scope) (7.B1)
  - [ ] 👤 Výběr firmy, budget, NDA, kickoff — **odloženo**, Stable bez data
- [ ] **BTC swap hold**
  - [x] 🤖 Server-side signed quote + offer key + caps (kód), klíče provisioned, hold `ENABLED=0` aktivní
  - [x] 🤖 bitcoind mainnet synced (tip 973 225, 26. 10.)
  - [ ] 👤 Stable scope: capped pilot po G9, nebo explicitně `disabled` (4.S1)
- [ ] **Provoz a hygiena**
  - [x] 🤖 Disk audit + cleanup s archivy (EDGE 88 → 59 %, EDGE2 54 %) — rozšíření volume aktuálně nepotřeba
  - [x] 🤖 fail2ban fix (self-heal drop-in), nginx `.bak` pryč ze `sites-enabled` (IA-16)
  - [ ] 🤖 Deploy provenance manifest — checkout na EDGE neodpovídá nasazeným binárkám (8.B3)
  - [ ] 🤖 Health checky zápisových cest a lagu (8.B4) — P0-1/P0-2 byly „active", ale nefunkční 5 dní (opraveno 26. 10.)
  - [ ] 🤖 Plný DR drill — restore celého stacku na čistém hostu do syncu (7.B7)
  - [ ] 👤 EDGE load (~12/4 jádra): CPU mining pro liveness vs. stabilita (8.B5)
- [ ] **RC → v3.2.0**
  - [x] 🤖 Post-audit code verifikace 26. 10. — 0 regresí (3.2.x plán §1.2)
  - [ ] 🤖 Code gates zelené na RC commitu: npm critical/high triáž + upgrade, clippy politika, fmt, `cargo audit` do gate (B-EXIT-2, 7.B4)
  - [ ] 🤖 `DEFERRED_3.2.md` (feature freeze) + `RELEASE_NOTES_3.2.0.md` (9.B1, 9.B2)
  - [ ] 🤖 Release artefakty Linux/Windows/macOS + SHA256SUMS (9.B4)
  - [ ] 🤖 Public repo sync workflow předefinovat (tracked `public/` subtree zanikl) (8.B7)
  - [ ] 👤 Podepsaný tag `v3.2.0` + release (9.S1)

## N1 · Identity & Value Transfer (L2 + ZIS)

- [ ] 🔀 BTC swap re-enable → `WARP_BTC_SWAP_ENABLED=1` capped (po N0 + G9)
- [ ] **ZionDex on-chain settlement** ([`ZionDex-OnChain-Settlement-Plan.md`](docs/3.2/ZionDex-OnChain-Settlement-Plan.md))
  - [ ] 👤 §7 rozhodnutí: zdroj wZION pro hot wallet, seed USDT/USDC, volba DEX, ETH na gas (4.B7)
  - [ ] 🤖 QuoterV2/SwapRouter v `EvmAdapter` + solvency guard (4.B6)
  - [ ] 🤖 In-memory AMM pryč z produkční cesty
  - [ ] 🤖 Funded E2E deposit → swap → withdraw s on-chain receipty (charta M1.2) → V33-3
- [ ] **Passkeys**
  - [x] 🤖 Playwright E2E `e2e/passkey.spec.ts` (CDP virtual authenticator, mocked routes)
  - [ ] 🤖 ZIS threat model + privacy review — dle charty prerekvizita passkeys (3.B2)
  - [ ] 🤖 Produkční E2E na ≥3 webech (app/market/freeworld) → V33-4 (3.B1)
- [ ] 🤖 QTU/PRL attestation — address squatting fix před payout-gated linky (3.B3)
- [ ] 🤖 Custody disclosure v UI (web custodial / desktop non-custodial) (3.B4)
- [ ] 🤖 ZIS agent sub-accounts — Prisma schema + budgety (design + migrace draft)
- [ ] 🤖 QTC integrace ([`QUANTUS-INTEGRATION-PLAN.md`](docs/3.2/QUANTUS-INTEGRATION-PLAN.md)): F1 adapter (gated testnet) → F2 keyring → F3 watchtower → F5 wallet pod ZIS
- [ ] 🔀 DAO: guardian registry deploy, treasury sign flow + 👤 klíč, QV rozhodnutí (4.B8, 4.B9)
- [ ] 🔀 Premine unlock dry-run na regtestu před výškou 144 000 (~27.–28. 11.) (1.B5)
- [ ] 👤 Nové chain piloty (Solana watcher v kódu) — každý přes M1.6 gate

## N2 · Pool & Revenue Engine (+ [`POOL-FLEET-EXPANSION-PLAN.md`](POOL-FLEET-EXPANSION-PLAN.md) W1–W7)

- [x] 🤖 PRL dry-batch review tooling `scripts/prl-payout-review.sh`
- [x] 🤖 Pearl `FWD_MAX` fix (share loss 17.5 % → 0 dropů)
- [x] 🤖 Wave 7 pool security (P-01…P-06) + hotfix validace proti job targetu (accept 44 % → 95.7 %)
- [x] 🤖 W1 A1.1 — hashrate externích coinů (nasazeno 26. 10. 08:27)
- [x] 🤖 W1 A1.2 (částečně: per-stream accept rate) + A1.4 luck/effort se sdíleným `BlockTracker` (nasazeno 26. 10. 11:39)
- [x] 🤖 W1 A1.2 reason buckets (commit `0796497e2`) + A1.5 est. earnings (nasazeno, `est_daily`/`window_share` ve veřejném API) + A1.3 timeseries (`fcbf2aec0`: `hashrate_by_coin` + `miner_history` tabulka, `/public/v1/miner/{coin}/{wallet}/history`)
- [ ] 🤖 W1 zbytek: A3.2 pending estimate; luck persistence přes restart (2.B4)
- [x] 🤖 **Stale-block RCA uzavřena 26. 10.** — `REPORT_2026-10-26_POOL_ORPHAN_RCA.md`: 21,4 % = interní souběhy na stejnou výšku (Poisson), externí ztráty 0/24 h, ekonomika ~0. Reálný bug = `confirmed`→`orphaned` downgrade → sticky fix `0796497e2` + reg. test (deploy pending 🔀). Metrika předefinována na external-loss rate
- [ ] 🤖 W2: dedup persist (A4.1), drain restart + canary deploy gate (A4.3 / 2.B2), alerting (A4.4/A4.5), payout lifecycle UI (A3.1)
- [ ] 🔀 PRL payout `DRY_RUN=0` — 🤖 dry-batch report, 👤 flip (2.B6)
  - [ ] 👤 Revenue→oyster: sweep z BIP86 vs. přesměrování upstream walletu
- [ ] 👤 QTC treasury deficit (`treasury_free=0`, 918 odložených payoutů) (2.B7)
- [ ] 🤖 PRL miner enablement: docs (SM75+/RDNA+), `gpu=PRL` pref na nepodporovaných kartách
- [ ] 🤖 QTU native payout path produkčně (batch z quantus walletu)
- [ ] 🤖 W3 Fleet agent MVP + control plane (`vastctl serve`) → W4 flight sheets → W5 miner UX → W6 HA/OC/profit-switch → W7 ekosystém
- [ ] 🔀 HA stratum (A4.2) nebo „single pool + RTO" (2.S5)
- [ ] 👤 ≥1 externí miner na každé nativní legě (V33-9; HW SM75+/RDNA+ pro PRL)

## N3 · Hiranyagarbha 2.4/2.5 (L3, sandboxed)

- [x] 🤖 `zion-ncl` daemon + SQLite persistence + unit — live (42 testů), 0 workerů
- [x] 🤖 Maestro v2.4 nasazen **read-only** (`/v2/info|classify|plan|orchestrate|health-matrix`, `mutations_enabled=false`, approval token nenastaven, audit dir)
- [x] 🤖 Inference: GPU primár (stanice) + CPU fallback (EDGE2), konstituční prompt, RAG 39 docs / 138 chunků
- [ ] 🤖 Maestro první read-only E2E úloha (intent→plan→health_poller→report) + audit log — M2.1 (5.B2)
- [ ] 🤖 Citace + retrieval confidence gate + faktický eval set (5.B1)
- [ ] 🤖 NCL: registrace 1 workeru + 1 pilotní job typ → V33-5
- [ ] 🤖 Miner↔NCL spike: `ZION_NCL_*` opt-in pull-job loop v `L1/miner` (off default, reward jen regtest)
- [ ] 🤖 Dharma: keyword filter → policy manifest (povolené typy akcí + human-approval gate) — kryptografické mantinely = HORIZONT
- [ ] 🤖 Amitabha draft-only UI (plán s náklady/příjemci/riziky/zrušením, bez exekuce) — až po M2
- [ ] 🤖 Red-team (prompt injection, confused deputy, privilege escalation, tx substituce) — exit M3
- [ ] 🤖 [`HIRAN-MARKETPLACE-PLAN.md`](HIRAN-MARKETPLACE-PLAN.md) F2 gateway `/v1/models` + F4 provoz
- [ ] 👤 HW upgrade (RTX 3090+/48 GB) — bez něj 8B model + RAG

## N4 · OASIS (L4)

- [x] 🤖 OasisChecklist live a11y/privacy scan + fixy (sr-only `h1`, `role=img`/`aria-label`), load ~1.0 s
- [x] 🤖 WebGPU preview G0–G2 nasazeno (`?gpu=webgpu`)
- [ ] 🤖 Plný axe + device matrix + privacy policy → navrženo **V33-10** (5.B5)
- [ ] 🤖 WebGPU parity gaps (4 otevřené v [`WebOasis.md`](docs/3.2/WebOasis.md))
- [ ] 🤖 Marketplace↔OASIS reverse-sync edge cases
- [ ] 🤖 E-shop: E2E checkout, nebo platební cestu vypnout (5.B6)
- [ ] 🤖 On-chain parcel/artefakt anchoring — design + regtest pilot
- [ ] 👤 UE5.7 research — default HORIZONT, žádný commitment

## N5 · Free World (L5)

- [x] 🤖 QV voting UI live (`QvSection`, ZIS gate, otevřené kolo s 6 granty)
- [x] 🤖 Planetary map + projektový registr live
- [x] 🤖 **P0-1** scanner stall opraven 26. 10. (6.B1)
- [ ] 🤖 alert na lag scanneru (6.B2)
- [ ] 🤖 QV: Sybil model, eligibility, privacy analýza **před** prvním reálným ballotem (6.B3)
- [ ] 🤖 Proof-of-impact workflow + impact packet šablona (6.B4)
- [ ] 👤 Výběr 1 reálného pilotu + nezávislé ověření (fyzický svět) → V33-6
- [ ] 🔀 První E2E grant advisory → DAO → guardian multisig; disbursement tx flow (dnes summary-only) (6.B5)

## N6 · Issobella (L6)

- [ ] 🤖 DeSci repozitář `/l6-issobella/papers` + L1 hash anchor (6.B4)
- [ ] 🤖 Alcubierre-Ekam jako publikovatelný matematický draft — HYPOTÉZA, falsifikační kritéria (charta M6)
- [ ] 👤 Nezávislé review → V33-7
- [ ] 🔀 NCL vědecký pilot (po miner↔NCL spike)

## N7 · Launch Readiness

- [ ] 🤖 Truth-sync dokumentace + refresh Registru důkazů (9.B5; seznam rozporů = mapa §8)
- [ ] 🤖 Public copy `/roadmap`, `nirvana-roadmap.ts`, `/maitreya#plan-v33` sladit s mapou (9.B6)
- [ ] 🤖 Charta R9: factual/legal/cultural review veřejných textů
- [ ] 🤖 CoinGecko re-apply package ([`COINGECKO_REAPPLY_ROADMAP.md`](docs/3.2/COINGECKO_REAPPLY_ROADMAP.md), 17 prerekvizit)
- [ ] 👤 Bug bounty + komunitní kanály
- [ ] 👤 Publikace „v3.3 Nirvana" — jen po DoD

---

## DoD v3.3 — stav

| Gate | Měření | Stav 26. 10. |
|---|---|---|
| V33-1 Stabilita | G8 ≥99.9 % (`g8_run.json` + Prometheus) | 🔄 run #5 99.73 %, do 24. 11. |
| V33-2 Externí audit | report + mitigace | ⏸️ posunuto 👤 26. 10. |
| V33-3 Value transfer | BTC swap lock→claim + refund on-chain; ZionDex deposit→swap→withdraw | ❌ holdy / settlement nehotový |
| V33-4 Identita | passkey E2E na ≥3 produkčních webech | 🔄 routes + mocked E2E |
| V33-5 L3 sandbox | Maestro 3 reálné úlohy s audit logem + approval gate; NCL ≥1 job typ | 🔄 Maestro read-only live, NCL bez jobů |
| V33-6 L5 dopad | ≥1 pilot s veřejným rozpočtem a výsledkem | ❌ (P0-1 ✅, scanner na tipu) |
| V33-7 L6 repro | dokument s L1 anchorem | ❌ |
| V33-8 Kvalita | `cargo test --workspace` + clippy + `npm/cargo audit` 0 critical | 🔄 testy ✅ 2 839/0; clippy 0 errors/~110 warnings; npm critical ❌ (website 2, MarketPlace 1, OasisWeb 1, IntroPage 1, pool-ui 1, mobile 3); `cargo audit` chybí |
| V33-9 Pool produkce | PRL + QTU native payouty live, ≥1 externí miner per leg | ❌ PRL dry-run, QTC deficit |
| *V33-10 (návrh)* | OASIS preview: a11y + security + privacy review + změřený výkon (charta M4/R6) | 🔄 částečný scan |
| *V33-11 (návrh)* | nezávislý operátor nodu + restore bez EDGE i EDGE2 (charta M7/R8) | ❌ |

## Finální release gates — Exekuční charta R1–R9

- [ ] **R1 Pravda** — release tag, changelog, výsledky testů, compatibility matrix (9.S2)
- [ ] **R2 L1 bezpečnost** — consensus/security review, monitoring, backup/restore drill, jasný stav node rewards (1.B4, 7.S2)
- [ ] **R3 L2 settlement** — funded E2E v deklarovaném scope, reorg/retry/reconciliation testy, custody disclosure (V33-3, 3.B4)
- [ ] **R4 ZIS** — security/privacy review, session/recovery flow; passkeys jen pokud nasazené a otestované (3.B1, 3.B2)
- [ ] **R5 L3 autonomie** — human approval model, audit log, sandbox, kill switch, red-team evidence (N3)
- [ ] **R6 L4 kultura** — bezpečný a přístupný preview; UE/streaming jen v reálně dodaném rozsahu (V33-10)
- [ ] **R7 L5/L6 odpovědnost** — auditovatelný fondový/pilotní workflow + reproducibility policy (V33-6, V33-7)
- [ ] **R8 Decentralizace** — nezávislý operátor/restore test, aktuální runbooky, incident disclosure (V33-11)
- [ ] **R9 Komunikace** — factual/legal/cultural review, HORIZONT/HYPOTÉZA viditelně označené (N7)

---

## Rychlá autonomní fronta (další kroky)

1. 🔀 P0-3 — rotace PRL RPC credentialu (👤) + per-service env subsety; P0-1/P0-2 ✅ 26. 10.
2. 🤖 Provenance manifest + build z čistého `git archive` (8.B3)
3. 🤖 Health checky zápisových cest + lag alerty L5/L6/db-sync/payout sweep (8.B4, 6.B2)
4. 🤖 Stale-block RCA nad A1.2 metrikami (2.B1)
5. 🤖 Alert sink firing test + důkaz retence (8.B9)
6. 🤖 Drafty `DEFERRED_3.2.md` + `RELEASE_NOTES_3.2.0.md` (9.B1, 9.B2)
7. 🤖 Truth-sync dokumentace + Registr důkazů (9.B5)
8. 🤖 Nový public repo sync workflow + secret scan (8.B7)
9. 🤖 Premine unlock dry-run na regtestu (1.B5)
10. 🤖 Plán + provedení plného DR drillu (7.B7)

## Operátor-only fronta

Seřazený seznam rozhodnutí: [`NIRVANA-V3.3-MAP.md`](NIRVANA-V3.3-MAP.md) §7 (G9 · P0 schválení · node reward · Stable scope L2 · PRL flip · QTC deficit · ZionDex · IA-07/08/09/10 · release tagy + CI · HA stratum · EDGE load · SMOS rig · komunita · 3.3 pilot/HW/UE5).

## Archiv — hotovo z autonomní fronty 21. 10.

1. ✅ G8 RCA run #2 + live stall 21. 10. → 3 fixy nasazené
2. ✅ Disk audit (`REPORT_2026-10-21_EDGE_DISK_AUDIT.md`) → cleanup F6
3. ✅ fail2ban fix (sshd + zion-p2p jails, restart drop-in)
4. ✅ `zion-ncl` daemon + persistence + unit — live
5. ✅ PRL dry-batch review tooling (+ nález QTC `treasury_free=0`)
6. ✅ QV voting UI — už existovalo a je live
7. ✅ BTC signed-quote kód complete (hold zůstává)
8. ✅ Planetary map UI — live na `/l5-free-world`
9. ✅ Passkey Playwright E2E (CDP virtual authenticator)
10. ✅ OasisChecklist perf/a11y gate + 2 fixy
