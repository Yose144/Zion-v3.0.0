# ZION TerraNova — Master Plan (v3.3 "Nirvana")

> **Datum:** 2026-11-11
> **Stupeň:** 3.2.0 Mainnet Beta → cíl 3.2.0 RC → 3.2.0 Mainnet Stable → 3.3.0 Nirvana
> **Vstupní bod:** tento soubor je jediný aktivní plán v rootu. Detaily v `docs/3.2/`, `docs/3.3/`.
> **Historie:** staré root MD plány přesunuty do `docs/3.3/`. Operativní pravidla v `AGENTS.md`.

---

## 1. Aktuální stav (snapshot 11. 11. 2026)

### Infrastruktura
- **EDGE2** (207.180.217.100) = primary node (9445) + web ingress + app stack (L2–L6)
- **EDGE** (62.171.141.136) = pool stratum (8444) + follower nodes (9446/9447) + ops/monitoring
- **G8 run #7** `g8-20261106T145125Z` = **99,9241 %**, evidence 100 %, **5× `chain_live` incident 60 s** (8.–9. 11., RCA otevřená), konec **6. 12. 14:51Z**. Run #6 archivován `stopped`/`evidence_incomplete` (99,76 %, 12 incidentů).
- **Chain 118 687** (~60 s/blok), pool **`ece8b6965`** (11. 11. rebuild + payout monitoring M2), **74 072 accepted / 0 rejected**, disky 62 % / 58 %
- **G9 externí audit** = posunut (Stable bez data)
- **Deploy projekty:** `V31/deploy/` (aktivní, opraveno 2.11.), `infra/edge-deploy/` (deprecated, guard přidán)
- **Nirvana proto 38** = repo i live ve shodě (`/api/health` `proto:38` + `net.proto:38` + `proto_match:true`, ověřeno 11. 11. 19:00) — client i net deployovat vždy spolu
- **EDGE2 `networkd-wait-online`** vyřešen 11. 11. (netplan `accept-ra:false`+`dhcp6:false`); nginx `listen` options sjednoceny repo-only (`548a50235`, deploy ⏸️)
- **⚠️ Release artefakty:** na disku jsou jen **2 linux tarbally** (`dist/v3.2.0-rc-w1.4/`); aarch64/gpu-metal/windows chybí. macOS buildy vyžadují Mac/Xcode (nebo osxcross), Windows mingw — tento PC (Linux) je neumí. Mac disk už není pracovní prostředí.

### Kód
- **V31 workspace:** 18 crates, verze 3.2.0, protocol handshake `3.1.0-alpha` (záměrně)
- **Apps:** nirvana (multiplayer M0–M2), nirvana-net (WS služba), marketplace, oasis-web, website-v2.9, identity (ZIS), pool-ui, mobile-app, desktop-agent
- **Testy:** cargo test --workspace 2 839/0 fail (pin ad8ab5895), ZIS **60/60** (agent sub-accounts 11. 11.), Foundry 48/48
- **Clippy:** ~110 warnings (pool 32 test-only), fmt drift 25 souborů

### Dokumentace
- Root MD: **10 souborů** — 9 stálých (AGENTS, README, SECURITY, CODE_OF_CONDUCT, CONTRIBUTING, LICENSE, CHANGELOG, ROADMAP, REPO-MAP) + tento `PLAN.md`. **Úklid rootu dokončen 9. 11.** — 6 pracovních plánů → `docs/plans/` (`NIRVANA-LUMI-PLAN`, `PLAN_3D_AVATARI_{1070TI,NIRVANA}`, `PLAN_OASIS_AVATAR_I18N`, `TRANSLATION-PLAN`, `UCETNICTVI-PLAN`, `qtcpool`), 2 reporty → `docs/3.2/REPORTS/` (`REPORT_2026-11-05_SESSION_2`, `REPORT_2026-11-06_I18N_BATCH1`).
- `docs/3.2/`: status, plány, reporty (kanonický stav `StatusV3.md`)
- `docs/3.3/`: plány a mapy NIRVANY (rozcestník `README.md`)
- `docs/plans/`: dílčí plány (audit, infra, pool, Hiran, OASIS, avatar 3D, účtovnictví, překlady, QTC)

### Od snapshotu 2. 11. — dokončené
- **Payout monitoring M2 (11. 11.):** probe + rules + pool rebuild `ece8b6965` → `payouts_api_ok`/`measurement_ok` = 1, `last_payout_age_seconds` živě; alert firing→resolved (end-to-end důkaz), G8 0 nových incidentů.
- **ZIS agent sub-accounts (11. 11.):** Prisma `AgentSubAccount`+`AgentBudget`, `zag_` bearer, scope bez `wallet:withdraw`, audit eventy, `ZIS_AGENTS_ENABLED` default OFF; testy 60/60, tsc 0 — **DB push + deploy + step-up/UI = 👤**.
- **Charta R9 factual (11. 11.):** CoinGecko balíček + veřejné claims ověřeny proti kódu/živým datům; legal + cultural = 👤.
- **OASIS avatáři:** 202/202 finálních portrétů, import + deploy web/OASIS API/OasisWeb/MarketPlace (11/9).
- **ZION Archive EN:** 124 kapitol, 18/18 knih `enCoverage: 100` — pushnuto, **nedeployováno**.
- **Lampion „Druhá lucerna":** flat-pack produkt + příběhová sekce na marketu i webu; cena 490 Kč / 70 560 ZION.
- **Nirvana multiplayer:** `/fleet` (7 lodí z marketu) + `/lumi` coop; **opravena resume díra** v relay hrách (fleet/lumi entity po 12 s ticha už nemaže, jen uspí do ducha — `DORMANT_UNTIL`; `join()` na existujícím id oživí na místě). Deploy `zion-nirvana-net` release `20261109T144402Z`, health OK. Klientská část (FleetScene materiály, `bad_frame` na neznámou hru) jede s příštím deployem nirvana appky.
- **i18n:** `Lang` = 5 jazyků napříč ekosystémem (F2 + dávky avatarů).

---

## 2. Kritická cesta (do 6. 12.)

```
G8 run #7 (do 6. 12. 14:51Z) ──► V33-1 Stabilita
         │
         ├── RC práce (do ~2. 12.): provenance, alerty, DR runbook, artefakty, audit package
         │
         └── 👤 sign-off (poslední 4 dny okna)
         
G9 externí audit (posunut, Stable bez data — neblokuje RC kvalitu)
```

**Pravidlo:** Během G8 okna nic nesmí zasáhnout required služby (`chain_live`, `pool_http`, `pool_stratum`, `multichain`, `dao`, `zis`) bez rollbacku do 15 min.

---

## 3. Autonomní fronta (🤖) — co můžeme dělat teď

### Priorita 1 (blokuje další práci)
1. ✅ **HA stratum fencing analýza** — `pool-promote-guard.sh` implementován (G1-G6), runbook vytvořen (`docs/3.2/ops/POOL-HA-RUNBOOK.md`), 7 gaps identifikováno, staged activation pending 👤
2. ✅ **DR drill dry-run (varianta A)** — 23/23 DBs PASS, config 0 placeholderů, 5 gaps identifikováno, 3 opraveny (binárky optional, GPG encryption optional, offsite timer ověřen). Report: `docs/3.2/REPORTS/REPORT_2026-11-02_DR_DRILL_DRY_RUN.md`
3. **Release artefakty (9.B4)** — na disku **jen 2 linux tarbally** (default + `gpu-opencl`, `dist/v3.2.0-rc-w1.4/`); aarch64/gpu-metal/windows tarbally **nejsou**. macOS buildy vyžadují Mac/Xcode (nebo osxcross), Windows mingw-w64 — tento PC (Linux, bez obou toolchainů) je neumí. **Zbývá:** doplnit chybějící targety na hostu s toolchainem + `RELEASE-MATRIX.json` + rebuild z RC commitu (tag `v3.2.0` = 👤 9.S1). Builder `scripts/ops/build-release-artifacts.sh` hotový.

### Priorita 2 (V33 gates)
4. ✅ **NCL 1 worker + 1 job typ** — V33-5 gate, 2 integrační testy, 44/44 pass
5. ✅ **DeSci papers repo + L1 hash anchor** (6.B4) — backend kompletní (anchor.rs + db + api), 23/23 testů pass, web frontend + proxy existují
6. ✅ **OASIS a11y/privacy scan** (V33-10) — a11y (8 nálezů, 3 opraveny), privacy+security OK
7. **ZionDex on-chain settlement** — QuoterV2/SwapRouter + solvency + funded E2E

### Priorita 3 (kvalita a hygiena)
8. **P0-3** — rotace PRL RPC credentialu + per-service env subsety
9. **Charta R9** — factual ✅ (11. 11., [`REPORT_2026-11-11_CHARTA_R9_FACTUAL_REVIEW.md`](docs/3.2/REPORTS/REPORT_2026-11-11_CHARTA_R9_FACTUAL_REVIEW.md)); legal + cultural = 👤
10. **CoinGecko re-apply package** — 17 prerekvizit

---

## 4. Operátor-only fronta (👤)

| # | Položka | Blokátor |
|---|---|---|
| 1 | G9 externí audit — výběr firmy, budget, NDA, kickoff | posunut |
| 2 | PRL payout flip (DRY_RUN=0) + revenue→oyster | rozhodnutí |
| 3 | QTC treasury deficit — funding | funding |
| 4 | BTC swap pilot scope (capped nebo disabled) | rozhodnutí |
| 5 | Node reward — activation height nebo deaktivace | rozhodnutí |
| 6 | Stable scope L2 — výběr chainů | rozhodnutí |
| 7 | Release tag v3.2.0 — podepsaný + release | schválení |
| 8 | SMOS rig 518837 — oprava/vyřazení | rozhodnutí |
| 9 | Výběr 1 reálného pilotu (Free World) | fyzický svět |
| 10 | Bug bounty + komunitní kanály | rozhodnutí |
| 11 | HW upgrade (RTX 3090+/48 GB pro Hiran) | náklad |
| 12 | HA stratum flip na armed mode | po fencing analýze |

---

## 5. Deferred (do v3.3 nebo horizont)

Viz `docs/3.2/DEFERRED_3.2.md`:
- Aktivace node reward distribution (time-lock 144 000)
- CHv4.2 (fork height u64::MAX)
- Program nezávislých operátorů nodů (M7)
- QTU native payouty (**payout leg OFF od 4. 11.**; re-enable = 👤 funding + flip)
- Persistentní share-dedup (A4.1, DB persist)
- HA stratum auto-promote (aktivováno částečně, manuální)
- Adapter parity — warp_message_hash anchor (non-EVM)
- Fleet OS / zion-rig-agent control plane
- UE5.7, autonomní agenti, ZK Dharma, plná 12-chain WARP, Stratum v2 (HORIZONT)

---

## 6. Struktura dokumentace (kanonizovaná)

| Cesta | Obsah |
|---|---|
| `AGENTS.md` | Operativní příručka (topologie, runbooky, pravidla) |
| `README.md` | Projekt overview |
| `ROADMAP.md` | Forward roadmap |
| `REPO-MAP.md` | Mapa workspace |
| `SECURITY.md` | Bezpečnostní politika |
| `PLAN.md` | **Tento soubor** — master plan |
| `docs/3.2/` | Status, plány, reporty (115+ souborů) |
| `docs/3.3/` | Přesunuté root plány + doc-vs-code analýza |
| `docs/plans/` | Audit, infra, pool, Hiran, OASIS, ops console, vast |
| `V31/` | Aktivní mainnet track (kód + deploy) |
| `apps/` | Weby, mobil, desktop, nirvana, identity, marketplace |
| `infra/` | Edge deploy (deprecated V3 + aktivní V31), nginx, tools |
| `ZION_OS/` | Dashboard, desktop agent, mobile |

---

## 7. Pravidla pro další práci

1. **Jediný vstupní bod plánování:** tento soubor (`PLAN.md`) + `docs/3.2/3.2.1-3.2.9_PLAN.md` (N0 detail)
2. **Hierarchie pravdy:** kód/on-chain/živé sondy > registr důkazů > execution > kanonický rámec > vize > narativ
3. **Autonomní práce (🤖):** kód, testy, dokumenty end-to-end — vždy s důkazem
4. **Příprava (🔀):** autonomní příprava + operátorské schválení/flip
5. **Operátor (👤):** rozhodnutí, peníze, klíče, fyzický svět — nikdy neflipovat bez sign-off
6. **Během G8 okna:** nic nesmí zasáhnout required služby bez rollbacku do 15 min
7. **Money-paths:** produkční flipy až po N0 + G9
8. **L5/L6 granty:** žádný "impact" bez impact packetu a nezávislého ověření

---

## 8. Rychlá autonomní fronta (stav 11. 11.)

1. ✅ **Truth-sync plánů** (11. 11.) — `3.2.1-3.2.9_PLAN`, `DEFERRED_3.2`, `PLAN`, `CHECKLIST`, `MAP`, `KRALOVSTVI` srovnány na run #7 / proto 34 / QTC OFF / hotové položky.
2. **Release artefakty dokončení (9.B4)** — na disku 2 linux tarbally; chybí aarch64/gpu-metal/windows (macOS/Xcode a mingw na PC nejsou), `RELEASE-MATRIX.json` a rebuild z RC commitu (👤 9.S1).
3. 🔀 **ZIS agent sub-accounts** — kód hotový; `prisma db push` + deploy + step-up + UI (👤).
4. 🤖 **L3 sandbox** — Miner↔NCL spike, Dharma policy manifest, Amitabha draft-only UI, red-team.
5. 🤖 **G8 `chain_live` RCA** — read-only analýza, bez deploye probe uprostřed runu.
6. 🔀 **P0-3 env subsety + rotace** — audit hotový, rotace = 👤.

**Dokončeno dříve (neopakovat):** HA fencing G1–G6 ✅ · DR drill dry-run ✅ · NCL V33-5 ✅ · DeSci 6.B4 ✅ · OASIS a11y V33-10 ✅ · PII orderId + atomický sklad + release verifier + proto preflight + archive content root ✅ (9. 11.) · M1 EDGE1 monitoring ✅ · M2 payout monitoring ✅ (11. 11.) · Charta R9 factual ✅ · **G8 probe hardening** (stale-tip selection, future tolerance, per-node metriky) ✅ · **alert `G8PrimaryTipStale` + promtool** ✅ · **watchdog stale-tip helper** (log-only) ✅ · **listener inventura + `zz-primary` drop-in** ✅ · **stratum blip RCA** (pool restart) ✅.

---

*Vytvořeno 2026-11-02. Aktualizovat při každé změně stavu.*