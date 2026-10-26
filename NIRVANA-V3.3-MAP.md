# ZION V3.3 „NIRVANA" — Mapa

> **2026-10-26:** public lifecycle sync (Mainnet Beta labely) připraven lokálně — NENASAZENO; otevřené položky beze změny.

> **Datum:** 2026-10-26 · **Autor:** Devin (scan repa + post-audit verifikace EDGE/EDGE2)
> **K čemu:** jedna navigační mapa nad všemi plány v3.3 — co existuje, co platí, jak do sebe zapadají číslování (N / M / R / V33 / W / 3.2.x), na čem co závisí a kde je dnes každá komponenta ekosystému.
> **Sesterské dokumenty:** checklist [`NIRVANA-V3.3-CHECKLIST.md`](NIRVANA-V3.3-CHECKLIST.md) · execution plán [`NIRVANA-V3.3-PLAN.md`](NIRVANA-V3.3-PLAN.md) · cesta k 3.2 Stable [`docs/3.2/3.2.1-3.2.9_PLAN.md`](docs/3.2/3.2.1-3.2.9_PLAN.md)

---

## 0. Hierarchie pravdy

Při rozporu vyhrává vyšší řádek:

1. **Kód, on-chain data, živé sondy** (verifikace 2026-10-26)
2. **Registr důkazů** — [`canon/books/MiseAmenti/07-Registr-Dukazu.md`](canon/books/MiseAmenti/07-Registr-Dukazu.md) (štítky ŽIVÉ / STAVBA / HORIZONT / HYPOTÉZA / MÝTUS)
3. **Execution** — `NIRVANA-V3.3-PLAN.md` (fáze N0–N7, DoD V33-1…9) + checklist + `3.2.1-3.2.9_PLAN.md` (detail N0)
4. **Kanonický rámec** — Exekuční charta 3.3 ([`04-Exekucni-Charta-3.3.md`](canon/books/MiseAmenti/04-Exekucni-Charta-3.3.md): workstreamy M0–M8, release gates R1–R9) + [`05-Autonomie-a-Bezpecnost.md`](canon/books/MiseAmenti/05-Autonomie-a-Bezpecnost.md)
5. **Vize** — [`docs/3.2/V33_NIRVANA_MASTER_PLAN.md`](docs/3.2/V33_NIRVANA_MASTER_PLAN.md) (původní N1–N6, harmonogram září–prosinec 2026 už neplatí)
6. **Narativ** — `canon/books/nirvana/`, `NirvanaCloud/`, `BodhiGaia/`, `Issobella/`… (platí jejich „Kotva pravdy")

Veřejná podoba 3.3 = `apps/website-v2.9/src/lib/nirvana-roadmap.ts` (`/roadmap#nirvana`, `/maitreya#plan-v33`) — nesmí se rozcházet s řádky 1–4.

---

## 1. Registr plánů v3.3 (všechny nalezené dokumenty)

Scan: `docs/`, `canon/`, root, `Hiran/`, `V31/`, `apps/website-v2.9/src` (hledáno `3.3`, `Nirvana`, `V33_`, `Amitabha`, `Hiran 2.5` + navazující sub-plány). Historické (`docs/docs2.9`, `docs/3.0.x`, `archive/`) jen jako reference.

### 1.1 Řízení a execution

| Dokument | Role pro v3.3 | Aktuálnost k 26. 10. | Workstream |
|---|---|---|---|
| [`NIRVANA-V3.3-PLAN.md`](NIRVANA-V3.3-PLAN.md) | fáze N0–N7, DoD V33-1…9, rizika | §1 = snapshot 21. 10. (topologie, G8 run #2, disk) — přepsáno mapou + checklistem | vše |
| [`NIRVANA-V3.3-CHECKLIST.md`](NIRVANA-V3.3-CHECKLIST.md) | proveditelný checklist s vlastníky 🤖/🔀/👤 | ✅ aktualizováno 26. 10. | vše |
| [`docs/3.2/3.2.1-3.2.9_PLAN.md`](docs/3.2/3.2.1-3.2.9_PLAN.md) | N0 detail: ALPHA → BETA → RC → STABLE, 9 sekcí | ✅ přepsáno 26. 10. | N0 |
| [`AUDIT-3.2-BETA-PLAN.md`](AUDIT-3.2-BETA-PLAN.md) | alpha → beta gate | ✅ provedeno (root `3.2.0-beta.1`) | N0 |
| [`AUDIT-REPORT.md`](AUDIT-REPORT.md) | interní audit money-paths, vlny 1–7, residua | ✅ 26. 10. | N0 / N1 / N2 |
| [`POOL-FLEET-EXPANSION-PLAN.md`](POOL-FLEET-EXPANSION-PLAN.md) | pro-pool parity + Fleet OS, vlny W1–W7 | ✅ schválen 26. 10., W1 běží (A1.1 nasazeno, A1.2 v HEAD) | N2 |
| [`docs/3.2/V3.2checklistu.md`](docs/3.2/V3.2checklistu.md) | 3.2 živý checklist | ⚠️ 29. 9. — obsah převzat do 3.2.x plánu | N0 |
| [`docs/3.2/ROADMAP.md`](docs/3.2/ROADMAP.md) + [`V31/PLAN_TO_3.2.md`](V31/PLAN_TO_3.2.md) | gate registr G1–G11, fáze E–J | ⚠️ 28. 9. (G8/G9 texty zastaralé) | N0 |
| [`docs/3.2/RELEASE_ARTIFACTS.md`](docs/3.2/RELEASE_ARTIFACTS.md) + [`V31/RELEASE_RUNBOOK.md`](V31/RELEASE_RUNBOOK.md) | release procedura + provenance | draft, neprovedeno | N0 / N7 |
| [`docs/3.2/EXTERNAL_AUDIT_SCOPE.md`](docs/3.2/EXTERNAL_AUDIT_SCOPE.md) + [`AUDIT_PACKAGE.md`](docs/3.2/AUDIT_PACKAGE.md) | G9 scope + pinned commit | v2.2, neodesláno; pin před vlnou 7 | N0 |

### 1.2 Kanonický rámec

| Dokument | Role | Aktuálnost |
|---|---|---|
| [`04-Exekucni-Charta-3.3.md`](canon/books/MiseAmenti/04-Exekucni-Charta-3.3.md) | M0–M8 workstreamy, R1–R9 release gates, pravidla závislostí | ✅ platí |
| [`05-Autonomie-a-Bezpecnost.md`](canon/books/MiseAmenti/05-Autonomie-a-Bezpecnost.md) | úrovně autonomie L3, zakázané akce, formát agentní odpovědi | ✅ platí |
| [`07-Registr-Dukazu.md`](canon/books/MiseAmenti/07-Registr-Dukazu.md) | registr pravdy | ⚠️ částečně zastaralý — Passkeys (HORIZONT → routes nasazené), Hiran inference (NEDOLOŽENO → běží), premine RPC, NCL, Maestro v2.4 |
| [`03-Zivy-Zaklad-3.3.md`](canon/books/MiseAmenti/03-Zivy-Zaklad-3.3.md) | baseline L1–L6 | ⚠️ stav k 31. 8. |
| `06-Generacni-Kompas-2026-2126.md`, `08-Protokol-Zmen.md` | dlouhodobý kompas, protokol změn kanonu | ✅ platí |
| `canon/l2/dao/plany/*` | ústava Zlaté republiky, sociokracie, Hiran guardian | narativ-governance (inspirace, ne execution) |

### 1.3 Vize a historické analýzy

| Dokument | Role | Aktuálnost |
|---|---|---|
| [`docs/3.2/V33_NIRVANA_MASTER_PLAN.md`](docs/3.2/V33_NIRVANA_MASTER_PLAN.md) | vision blueprint L1–L6, původní N1–N6 + DoD §9 | reference; termíny neplatné; UE5.7/agenti/ZK = HORIZONT |
| [`docs/3.2/V33_GAP_ANALYSIS.md`](docs/3.2/V33_GAP_ANALYSIS.md) | gap scan 28. 9. | superseded execution plánem |
| [`ROADMAP.md`](ROADMAP.md) (root) | navigační rozcestník | ⚠️ „Where we are now" k 31. 8. |

### 1.4 Sub-plány podle workstreamu

| Workstream | Dokumenty | Stav |
|---|---|---|
| **N1 identita** | [`ZIS_WALLET_PLAN.md`](docs/3.2/ZIS_WALLET_PLAN.md) (kanonický), [`ZIS_INTEGRATION_PLAN.md`](docs/3.2/ZIS_INTEGRATION_PLAN.md) (I1–I8 ✅), [`ZionDexZis.md`](docs/3.2/ZionDexZis.md) (superseded), `ZISavatar.md` | ZIS živé; passkey prod E2E chybí |
| **N1 hodnota** | [`ZionDex-OnChain-Settlement-Plan.md`](docs/3.2/ZionDex-OnChain-Settlement-Plan.md) (§7: 5 otevřených rozhodnutí, §8: 7 úkolů), [`L2_CHECKLIST.md`](docs/3.2/L2_CHECKLIST.md), `L2contracts.md`, `Multichain-Report.md`, [`PREMINE_UNLOCK.md`](docs/3.2/PREMINE_UNLOCK.md) | bridge + holdy živé; DEX settlement ne |
| **N1 QTC** | [`QUANTUS-INTEGRATION-PLAN.md`](docs/3.2/QUANTUS-INTEGRATION-PLAN.md) (F0 ✅, F1/F2 🚧, F4 pipeline, F8 rozhodnuto) | native leg živý; most ne |
| **N1/N5 DAO** | [`DAO.md`](docs/3.2/DAO.md) §8 (D1 ✅ merged, D2 většinou merged — část nenasazena, D3 = horizont) | živé |
| **N2 pool/revenue** | `POOL-FLEET-EXPANSION-PLAN.md`, [`MULTI-ALGO-ROADMAP.md`](docs/3.2/MULTI-ALGO-ROADMAP.md) (fáze A–D), `PEARL-POUW-INTEGRATION.md`, `PEARL-OPTIMIZATION.md`, `AUTONOMOUS_PROFIT_ROUTER.md` (E3), `QPOW*.md`, `VASTAI-MINING.md`, `VastRTX.md` | pool živý; W1 běží |
| **N3 Hiran** | `Hiran/2.4/*` (+ `docs/3.0.6/HIRAN_V2.4_DEV_PLAN.md`), `Hiran/2.5/README.md` (+ `HIRAN_EVOLUTION_2.3_TO_2.5_AMATHABOJ.md`), [`HIRAN-MARKETPLACE-PLAN.md`](HIRAN-MARKETPLACE-PLAN.md) (F1 ✅, F2–F4), `Vast-Inference.md`, `docs/3.2/HiranDev.md`, `HiranInterface.md`, `masterAI.md` | Maestro v2.4 živý read-only |
| **N4 OASIS** | [`OasisChecklist.md`](docs/3.2/OasisChecklist.md), [`WebOasis.md`](docs/3.2/WebOasis.md) (G0–G2 ✅, 4 otevřené), `oasis.md`, [`ESHOP_WORKFLOW_PLAN.md`](docs/3.2/ESHOP_WORKFLOW_PLAN.md) | preview živý |
| **N5 Free World** | [`L5_L6_ACTIVATION_PLAN.md`](docs/3.2/L5_L6_ACTIVATION_PLAN.md) (G10), `canon/books/BodhiGaia/` (+ `pilots/GENESIS-ROSE-001.md`), kandidáti `docs/3.2/L5*.md`, `TreeMarias.md`, `UluruFestival.md`, `BohemiaDao.md` | portál živý; scanner ✅ na tipu (P0-1 opraven 26. 10.) |
| **N6 Issobella** | `L5_L6_ACTIVATION_PLAN.md`, `canon/books/Issobella/` (Kotva pravdy), `V31/L6/issobella/docs/` | tracker živý |
| **N7 launch** | [`COINGECKO_REAPPLY_ROADMAP.md`](docs/3.2/COINGECKO_REAPPLY_ROADMAP.md) (17 prerekvizit), `OneLoveV3.2.md`, `docs/F3-IA-MAP.md` | nezahájeno |
| **N0 infra** | [`INFRA-SPLIT-PLAN.md`](INFRA-SPLIT-PLAN.md), [`docs/ECOSYSTEM-REBUILD-PLAN.md`](docs/ECOSYSTEM-REBUILD-PLAN.md) (F0–F6 ✅), `docs/ECOSYSTEM-INVENTORY.md`, [`DASHBOARD-AUDIT-2026-10-26.md`](DASHBOARD-AUDIT-2026-10-26.md), `infra/RUNBOOK.md` | hotovo; provozní dluh v 3.2.8 |

### 1.5 Narativní korpus (není execution, ale musí sedět s registrem)

`canon/books/nirvana/` (13 kapitol + `NIRVANA_GLOBAL_EXPANSION_*`), `canon/books/NirvanaCloud/` (vč. `07-Stoleti-Plan-2026-2126`), `BodhiGaia/`, `Issobella/`, `Lumi/`, `Miriam/`, `MariaCaminho/`, `SurtaSrdce/`, `KralovstviSrdce/`, `Maitreya/` — každý s kapitolou „Kotva pravdy a hranice". Publikované kopie: `apps/website-v2.9/public/docs/korpus/` + `public/docs/books/`.

---

## 2. Stupně: ALPHA → BETA → RC → MAINNET STABLE → 3.3

```text
 ALPHA ✅                BETA 🔄 (nyní)                 RC ⏳                MAINNET STABLE ⏳           3.3 NIRVANA ⏳
 V31 Mainnet Alpha       3.2.0-beta.1 (25. 10.)          3.2.0-rc.N           v3.2.0                      v3.3.0
 genesis 6. 8.           F0–F6 sjednocení                feature freeze       G8 PASS (30 d ≥99.9 %)      N1–N7
 klienty v3.2.0-*        audit vlny 1–7 nasazeny         artefakty+SHA256     G9 uzavřen                  V33-1…9
 G1–G7, G10, G11 ✅      safety holdy aktivní            DR drill             DoD 10 bodů                 charta R1–R9
                         P0-3 ← opravit (P0-1/2 ✅)       audit ⏸️ posunut      = N0 hotovo
```

Detail bran: [`3.2.1-3.2.9_PLAN.md`](docs/3.2/3.2.1-3.2.9_PLAN.md) §2 (Beta exit B-EXIT-1…8, Stable DoD 1–10).

---

## 3. Crosswalk — jak do sebe zapadají číslování

| v3.3 fáze (execution) | Charta (canon) | Veřejný workstream | DoD v3.3 | Sub-plány | 3.2.x sekce |
|---|---|---|---|---|---|
| **N0** Foundation = 3.2 Stable | M0, M7 (DR), R1, R2, R8 | předpoklad „stabilní základ 3.2" | V33-1, V33-2, V33-8 | 3.2.x plán, AUDIT-*, RELEASE_ARTIFACTS, EXTERNAL_AUDIT_SCOPE | 3.2.1–3.2.9 |
| **N1** Identita a hodnota | M1, R3, R4 | `identity` | V33-3, V33-4 | ZionDex, ZIS_WALLET, QUANTUS F1–F3/F5, DAO, PREMINE_UNLOCK | 3.2.3, 3.2.4 |
| **N2** Pool a revenue | — *(v chartě chybí)* | — | V33-9 | POOL-FLEET W1–W7, MULTI-ALGO, PEARL, QUANTUS F4/F8 | 3.2.2 |
| **N3** Hiranyagarbha 2.4/2.5 | M2, M3, R5 | `orchestration`, `intent` | V33-5 | Hiran 2.4/2.5, HIRAN-MARKETPLACE, 05-Autonomie | 3.2.5 |
| **N4** OASIS | M4, R6 | `oasis` | — *(v V33 chybí)* | OasisChecklist, WebOasis | 3.2.5 |
| **N5** Free World | M5, R7 | `earth` | V33-6 | L5_L6, BodhiGaia, DAO §8 | 3.2.6 |
| **N6** Issobella | M6, R7 | `science` | V33-7 | L5_L6, Issobella canon | 3.2.6 |
| **N7** Launch readiness | M7, M8, R8, R9 | — | V33-8 (část) | COINGECKO, public copy | 3.2.9 |

### 3.1 Mezery v crosswalku (k rozhodnutí)

| # | Mezera | Návrh |
|---|---|---|
| X1 | **N2 nemá protějšek v chartě** ani ve veřejných workstreamech | brát N2 jako interní provozní stopu pod M0/M1; pokud má jít do public copy → změna kanonu přes `08-Protokol-Zmen.md` |
| X2 | **N4 nemá DoD v V33-1…9** (původní DoD #5 vypadl) | doplnit **V33-10**: OASIS preview — a11y + security + privacy review + změřený výkon (= exit gate M4 / R6) |
| X3 | **Charta M7 / R8** (nezávislý operátor + restore bez hlavního serveru) jen částečně v N0 (DR drill) | doplnit **V33-11**: reprodukovatelný onboarding nezávislého operátora nodu + restore drill bez EDGE i EDGE2 |
| X4 | **Charta R9** (factual/legal/cultural review public copy) v N7 chybí | přidat položku do N7 |
| X5 | **Charta R2** vyžaduje „jasný stav node rewards" | v N0 = 3.2.x `1.B4` |
| X6 | **POOL-FLEET W1–W7 a V33-9** — V33-9 chce PRL+QTU native payouty live + externí miner na každé legě; W-vlny řeší parity a fleet, ne payout flipy | V33-9 zůstává; W1–W2 jsou jeho prerekvizity (dedup persist, alerting, payout lifecycle) |

---

## 4. Mapa závislostí

```text
                     ┌──────────── 3.2 BETA (nyní) ────────────┐
                     │ P0-1 ✅ · P0-2 ✅ · P0-3 env zůstává      │
                     └───────────────┬──────────────────────────┘
                                     ▼
    provenance · alerting · stale-block RCA · DR drill · feature freeze · artefakty  ──►  RC
                                     │
   G8 run #5 (do 24. 11., rozpočet 43 min) ─────────┐
   G9 externí audit ⏸️ posunut 👤 26. 10. ───────────┼──►  3.2.0 MAINNET STABLE  (= N0 ✅)
                                     ▲              │
   výška 144 000 (~27.–28. 11.): time-lock slotů 6–8 vyprší; spend dál jen 3-of-3 + DAO
                                                    │
        ┌───────────────┬───────────────┬───────────┼───────────────┬────────────────┐
        ▼               ▼               ▼           ▼               ▼                ▼
   N1 identita     N2 pool &       N4 OASIS     N5 Free World   N6 Issobella    (paralelní stopy)
   a hodnota       revenue         preview      pilot           DeSci
   (L2 + ZIS)      (W1–W7, PRL,    (V33-10)     (V33-6)         (V33-7)
        │          QTU payouty)
        ▼
   N3a Maestro v sandboxu (M2: pozorovatel → simulátor → asistent s potvrzením)
        ▼
   N3b Amitabha draft-only (M3: red-team + nezávislý review)
        │
        └─────────────────────────────────────────────► N7 launch (R1–R9 review) ──► 3.3.0 NIRVANA
```

**Pravidla závislostí (charta §2 + execution plán):**
- Produkční flipy N1+ (money-paths, BTC swap, PRL live, disbursement) až **po N0**. Kód, regtest, UI a dokumenty smí běžet paralelně už v betě.
- Žádný agent neovládá finance ani produkci, dokud nejsou hotové M0 + M1 + M2 + security review (M8).
- Žádný L5/L6 grant se neoznačí „impact" bez impact packetu a nezávislého ověření.
- Během G8 okna nic nesmí zasáhnout required služby (`chain_live`, `pool_http`, `pool_stratum`, `multichain`, `dao`, `zis`) bez rollbacku do 15 min.

---

## 5. Ekosystémová matice (stav 2026-10-26)

| Komponenta | Vrstva | Host | Stav | Stable blocker | v3.3 | Plán |
|---|---|---|---|---|---|---|
| zion-node primary | L1 | EDGE2 | ŽIVÉ — 97 006, parita | ano (G8 `chain_live`) | N0 | 3.2.1 |
| node2 / node3 (followeři) | L1 | EDGE | ŽIVÉ — parita, pool failover | ano (redundance) | N0 | 3.2.1 |
| lokální backup node | L1 | operátorská stanice | ŽIVÉ — parita | — | M7 | 3.2.8 |
| premine admin unlock | L1 | všechny nody | ŽIVÉ RPC, `unlocked=[]` | 1.S3 | N1 | 3.2.1 |
| node reward 1 % | L1 | konsensus | STAVBA (`u64::MAX`) | rozhodnutí 1.B4 | N0 | 3.2.1 |
| zion-pool (stratum + API) | L1 | EDGE | ŽIVÉ — build A1.2/A1.4 (26. 10. 11:39), stale 15–21 % | ano (G8 `pool_*`) | N2 | 3.2.2 |
| fallback-miner + v31-miner | L1 | EDGE | ŽIVÉ — liveness | nepřímo (G8) | N0 | 3.2.2 / 3.2.8 |
| zion-miner (veřejný) | L1 | klienti | ŽIVÉ — `v3.2.0-miner` (alfa éra) | release 2.S3 | N2 | 3.2.2 |
| desktop-agent | L1/klient | klienti | ŽIVÉ — 3.2.0 (multi-stream, NVIDIA+dual GPU fixy) | release 3.B7 | N2 | 3.2.2 / 3.2.3 |
| pool-ui (`pool.`) | web | EDGE2 (static) | ŽIVÉ | — | N2 | 3.2.2 |
| aux legy QTU / PRL / EVR / KRX / MEWC / ZANO / VRSC | L1 ext | EDGE2 (quantus, pearl) + upstream | ŽIVÉ — PRL dry-run, QTC deficit | — | N2 | 3.2.2 |
| vast fleet + vastctl + `/vast-rigs/` | ops | stanice → EDGE2 | ŽIVÉ — 1 rig | — | N2 (W3+) | POOL-FLEET |
| warpd (WARP) | L2 | EDGE2 | ŽIVÉ s holdy, sha = audit | ano (G8 `multichain`) | N1 | 3.2.4 |
| bitcoind mainnet / regtest | L2 ext | EDGE2 / EDGE | ŽIVÉ — synced | — | N1 | 3.2.4 |
| DAO | L2 | EDGE2 | ŽIVÉ | ano (G8 `dao`) | N1 / N5 | 3.2.4 |
| ZIS | L2 | EDGE2 | ŽIVÉ — EdDSA, JWKS | ano (G8 `zis`) | N1 | 3.2.3 |
| PostgreSQL 16 | data | EDGE2 | ŽIVÉ | — | N0 | 3.2.8 |
| db-sync | data | EDGE2 | ✅ **P0-2 opraven 26. 10.** — upserty běží | B-EXIT-1 | N0 | 3.2.8 |
| ai-native (Maestro v2.4 + RAG) | L3 | EDGE2 | ŽIVÉ — read-only, mutations off | — | N3 | 3.2.5 |
| Hiran inference | L3 | stanice GPU + EDGE2 CPU fallback | ŽIVÉ | — | N3 | 3.2.5 |
| NCL | L3 | EDGE2 | ŽIVÉ — 0 workerů | — | N3 | 3.2.5 |
| OASIS backend + OasisWeb | L4 | EDGE2 | ŽIVÉ | — | N4 | 3.2.5 |
| website `app.` | web | EDGE2 | ŽIVÉ `3.2.0` | 5.S1 | vše | 3.2.5 |
| IntroPage (apex) | web | EDGE2 (static) | ŽIVÉ | — | N7 | 3.2.5 |
| Marketplace + L1 watcher | L4 / web | EDGE2 | ŽIVÉ; e-shop neověřen | 5.B6 | N4 | 3.2.5 |
| free-world (L5) | L5 | EDGE2 | ✅ **P0-1 opraven 26. 10.** — scanner na tipu | B-EXIT-1 | N5 | 3.2.6 |
| issobella (L6) | L6 | EDGE2 | ŽIVÉ — aktuální | — | N6 | 3.2.6 |
| ops dashboard | ops | EDGE | ŽIVÉ — 33/33 | — | N0 | 3.2.8 |
| G8 probes / evidence / alert sink | ops | EDGE + EDGE2 | ŽIVÉ — run #5 99.73 % | G8 | N0 | 3.2.8 |
| Prometheus / Grafana | ops | EDGE | ŽIVÉ | DoD 9 | N0 | 3.2.8 |
| nginx ingress | infra | EDGE2 (veřejné) + EDGE (ops) | ŽIVÉ — `nginx -t` OK | — | N0 | 3.2.8 |
| zálohy (edge backup + offsite pull) | infra | EDGE → stanice | ŽIVÉ — 26. 10. OK | DR 7.S2 | N0 | 3.2.7 |
| btcunlock coordinator | vedlejší | EDGE2 | ŽIVÉ | — | — | — |
| mobile-app | klient | — | ⚠️ verze 3.0.6 | — | N1 | 3.2.3 |
| zion-wallet-sdk | klient | npm | 2.0.0, publish token expiroval | — | N1 | 3.2.3 |
| CLI | klient | GitHub release | `v3.2.0-cli` | release | N0 | 3.2.8 |

---

## 6. Časové kotvy a kritická cesta

| Datum | Událost | Dopad |
|---|---|---|
| 26. 10. | beta; G8 run #5 den 1 (99.73 %); P0-1+P0-2 ✅; G9 posunut 👤 | P0-3 opravit |
| 28. 10. | expirace posledních legacy HS256 session (7 d od cutoveru ZIS) | 3.B5 |
| 24. 11. 21:57Z | konec G8 run #5 (při čistém běhu) | V33-1 / G8 |
| 25. 11. | expirace certu `auth.` | renew musí proběhnout dřív (8.B6) |
| ~27.–28. 11. | výška 144 000 — time-lock premine slotů 6–8 vyprší | utratitelnost dál jen 3-of-3 admin unlock + DAO (1.S3) |
| ⏸️ | G9 posunut 👤 26. 10. | Stable = pozdější z (G8 PASS, G9 uzavření) → bez data, dokud se audit nepřeplánuje |

**Kritická cesta:** G8 run #5 čistě do 24. 11. + autonomní RC práce (provenance, artefakty, DR, freeze). G9 je posunuté na neurčito — Stable tak nemá datum, ale nic nebrání dodělat RC kvalitu a audit package držet připravený k odeslání.

---

## 7. Rozhodovací fronta operátora (👤), seřazeno podle dopadu

1. **G9** — ⏸️ **posunuto 26. 10.** — firma, budget, NDA, kickoff až operátor znovu rozhodne *(odblokuje Stable, BTC swap, CoinGecko)*
2. **P0** — ✅ P0-1 (L5 restart) + P0-2 (db-sync credentials) opraveny 26. 10.; zbývá rotace PRL RPC credentialu (P0-3)
3. **Node reward** — activation height, nebo explicitní deaktivace ve Stable (1.B4)
4. **Stable scope L2** — BTC swap pilot vs. `disabled` (4.S1); `WARP_L1_RELEASE_KEYS` / `WARP_API_KEY` (4.S2)
5. **PRL** — dry→live flip + revenue→oyster cesta (2.B6)
6. **QTC treasury deficit** — funding / politika (2.B7)
7. **ZionDex** — zdroj wZION, seed stablecoinů, DEX, gas (4.B7)
8. **IA-07/08/09/10** — allowlisty, šifrované zálohy, revoke klíčů z historie, provozní detaily v public repu (7.B3)
9. **Release** — schéma tagů + podpis (9.B3, 9.S1); CI politika (8.B8)
10. **HA stratum** vs. single-pool s RTO (2.S5); **EDGE load** — trade-off mining vs. stabilita (8.B5)
11. **SMOS rig 518837** — oprava / vyřazení (2.B10)
12. **Komunita** — kanály, bug bounty, CoinGecko (9.B7)
13. **3.3** — L5 pilotní projekt (fyzický svět), HW upgrade pro L3, UE5 research (default HORIZONT)

---

## 8. Rozpory dokumentů vs. realita (vstup pro truth-sync 9.B5)

| Dokument | Tvrdí | Realita 26. 10. |
|---|---|---|
| `07-Registr-Dukazu.md` | Passkeys = HORIZONT („nenalezena implementace") | WebAuthn routes nasazené (auth-gated), Playwright E2E s mocky → STAVBA, ŽIVÉ až po prod E2E |
| `07-Registr-Dukazu.md` | Hiran inference na Edge = NEDOLOŽENO | běží: GPU na stanici + CPU fallback na EDGE2, `/api/ai-chat` 200 |
| `07-Registr-Dukazu.md` | DAO treasury `admin_unlock_known=false` (implicitně) | `getAdminUnlocks` live, `admin_unlock_known=true` |
| `NIRVANA-V3.3-PLAN.md` §1 | Edge = primary, G8 run #2 failed, disk 88 % | EDGE2 = primary, run #5 běží (99.73 %), disk 59 % |
| root `ROADMAP.md` | výška 23 640+ (31. 8.) | 97 006 |
| `docs/3.2/ROADMAP.md` | G8 „run #2 not started" | runy #2–#4 failed/archived, #5 běží |
| `REPO-MAP.md`, `AGENTS.md` | `public/` = git subtree pro public repo | tracked `public/` neexistuje (přesun do `archive/PUBLIC/`) → G4/E7 workflow neplatí |
| `V31/release/RELEASE_NOTES.md` | „Mainnet Alpha" | beta |
| `L5_L6_ACTIVATION_PLAN.md` | L5/L6 aktivní na Edge | běží na EDGE2; L5 scanner ✅ na tipu (P0-1 opraven 26. 10.) |
| `docs/3.2/ROADMAP.md` G4 | public subtree diff = 0 ✅ | neověřitelné (viz výše) |
