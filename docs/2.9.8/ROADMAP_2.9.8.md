# ZION v2.9.8 — Unified Roadmap (Single Track)

> Datum: 2026-03-10  
> Status: ACTIVE  
> Horizont: následujících 7-14 dní  
> Cíl: dotáhnout 2.9.8 jako stabilní provozní větev pro single-primary-host, pure-ZION default a Deeksha canonical runtime.

---

## Single Source of Truth

Aktivní práce pro release běží pouze v těchto dokumentech:

1. `docs/2.9.8/INDEX.md` — vstupní rozcestník
2. `docs/2.9.8/COSMIC_HARMONY_DEEKSHA_SPEC.md` — canonical consensus spec
3. `docs/2.9.8/ROADMAP_2.9.8.md` — execution roadmap (tento dokument)
4. `docs/2.9.8/GO_NO_GO_2.9.8.md` — release gate a verdict

Dokumenty z 2.9.7 jsou pro historický kontext, ne pro aktivní plánování 2.9.8.

---

## Aktuální baseline (2026-03-10)

- canonical public host: `91.98.122.165`
- website + desktop + ops dokumentace byly přepnuty na single-primary-host model
- `cargo check -p zion-core -p zion-cosmic-harmony-v3 -p zion-pool -p zion-miner` → PASS
- `node --check APP&WEB/desktop-agent/src/main.js` → PASS
- `node --check APP&WEB/desktop-agent/src/ui/renderer.js` → PASS
- release verdict v `GO_NO_GO_2.9.8.md` je GO, ale repo ještě potřebuje stabilizační cleanup po pullu a sjednocení CI gates

---

## Fáze a stav

| Fáze | Oblast | Stav | Exit kritérium |
|---|---|---|---|
| P0 | Consensus canonicalizace (Deeksha) | ✅ DONE | `with_height(0)` = Deeksha, stabilní testy |
| P1 | Pool/miner/agent sjednocení toku | ✅ DONE | E2E semantika aligned, syntax/build check PASS |
| P2 | Revenue kontinuita | ✅ DONE | CHv3 revenue model kompatibilní bez regresí |
| P2b | Native GPU ABI sjednocení | ✅ DONE | Metal/OpenCL/CUDA wrappers sdílí Deeksha-native symboly + fallback aliasy |
| P3 | Produkční infra gate | ✅ DONE | 24h+ běh, chain growth, shares accepted, GO verdict |
| P4 | Stabilizace po přepnutí topologie | ⏳ IN PROGRESS | desktop/web/pool source-of-truth bez regresí |
| P5 | Release hardening | ⏳ PENDING | CI/typecheck/smoke gates + čistá dokumentace |

---

## Aktuální evidence (2026-03-10)

- `cargo test -p zion-pool --test chv4_e2e` → **11/11 PASS**
- `cargo test -p zion-cosmic-harmony-v3 deeksha::tests::` → **9/9 PASS**
- `node --check APP&WEB/desktop-agent/src/main.js` → **PASS**
- `node --check APP&WEB/desktop-agent/src/ui/renderer.js` → **PASS**
- `cargo check -p zion-core -p zion-cosmic-harmony-v3 -p zion-pool -p zion-miner` → **PASS**
- Desktop canonical GPU entrypoint: `resources/mining/cosmic_harmony_deeksha_gpu.py` (fallback na legacy `cosmic_harmony_v42_gpu.py`)

Kódový scope je zelený, ale ještě zbývá stabilizace po přechodu na nový host a doplnění provozních validací.

---

## 7denní plán

### Dny 1-2: Runtime cleanup

1. Zafixovat regressions po pullu v desktop-agent, website API a config migraci.
2. Udržet `cargo check` a editor diagnostics čisté po každé změně v pool/miner/desktop flow.
3. Sjednotit canonical host constants mezi `desktop-agent`, `website-v2.9`, `SERVERS.md` a `docs/ops/runbook.md`.

### Dny 3-4: Validation gates

1. Zavést minimální smoke gate pro desktop config load a pure-ZION save flow.
2. Doplnit použitelný website typecheck/build gate, aby `route.ts` změny neprocházely jen přes syntax check.
3. Zapsat post-deploy validaci: RPC reachability, `/stats`, accepted shares trend, chain height growth.

### Dny 5-7: Ops hardening

1. Zautomatizovat deploy/check sekvenci pro `91.98.122.165` jako jediný aktivní public target.
2. Zkontrolovat rollback story pro pool/core restart a obnovu seed kontejnerů.
3. Uzavřít rozpor mezi historical docs a current-live docs: staré IP pouze jako archivní kontext.

---

## 14denní plán

### Týden 2: Stabilizace a konsolidace

1. Oddělit release dokumentaci od exploratory web/desktop změn, aby 2.9.8 zůstala provozně auditovatelná.
2. Dopsat jednoduché integrační kontroly pro `health`, `mission-data`, pool metrics a desktop fallback parsing.
3. Provést jeden celý dry-run: deploy -> smoke -> metrics check -> GO evidence refresh.
4. Připravit seznam "must-backport / must-not-backport" mezi 2.9.7 freeze baseline a 2.9.8 runtime větví.

---

## Konkrétní deliverables

### Workstream A — Runtime

- desktop-agent bez config-load regresí
- pure-ZION mode respektovaný v main process i rendereru
- pool/miner build bez nových warningů z posledního pullu

### Workstream B — Web a API

- mission-data a health route bez type regressí
- dashboard používá single-primary-host model bez skrytých předpokladů o 3-node mesh
- website build gate je spustitelný lokálně nebo v CI

### Workstream C — Ops

- jeden kanonický deploy target a jeden kanonický pool endpoint
- ops/runbook + GO/NO-GO + SERVERS.md ve shodě
- jednoduchý post-deploy checklist pro release ownera

### Workstream D — Release engineering

- jasně oddělené 2.9.7 freeze artefakty vs 2.9.8 runtime hotfixy
- žádné nové release rozhodnutí mimo `docs/2.9.8/*`
- příprava na tag/maintenance point bez dokumentačního driftu

---

## Exit kritéria pro konec 1-2 týdnů

1. `cargo check` pro core/cosmic-harmony/pool/miner je čistý a opakovatelný.
2. Desktop pure-ZION config path je smoke-tested a nedělá protiřečivé UI/runtime chování.
3. Website health/mission-data/build validační cesta existuje a je spustitelná.
4. Všechny live docs ukazují stejný primary host a stejný canonical pool endpoint.
5. 2.9.8 může fungovat jako maintenance release branch bez dalšího topologického chaosu.

---

## Pravidlo změn

Od této chvíle:

- nové release rozhodnutí zapisovat jen do `docs/2.9.8/*`,
- 2.9.7 soubory už pouze odkazují na 2.9.8,
- bez paralelních roadmap mimo 2.9.8.
