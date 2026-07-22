# Mainnet Alpha Roadmap — 3.0.8 → 3.0.9 → 3.1.0

> **Cíl:** Dostat ZION z Mainnet Beta do **Mainnet Alpha** (3.1.0) — všechno funguje, repo je vyčištěné na "pure code", a síť je připravená na veřejný launch 31. 12. 2026.
> **Aktuální verze:** 3.0.7 "Trinity All Green" plánování  
> **Další milníky:** 3.0.8 "Full Stack Stable" → 3.0.9 "Pre-Alpha Hardening" → 3.1.0 "Mainnet Alpha"  
> **Související:** [`3.0.7.md`](./3.0.7.md), [`TRINITY_ALL_GREEN_PLAN.md`](./TRINITY_ALL_GREEN_PLAN.md), [`StatusV3.md`](./StatusV3.md), [`ROADMAP.md`](./ROADMAP.md), [`AGENTS.md`](./AGENTS.md)

---

## 1. Filosofie — od „funguje částečně“ k „funguje všechno“

Současné repo je **míchanice**:
- `V3/` je aktivní mainnet-track kód,
- staré rootové `L1/`, `L2/`, `L3/` jsou legacy reference,
- `APP&WEB/`, `ZION_OS/`, `PoC-lab/`, `HiranV2.x/`, `archive/`, `docs/TerraNova/` a desítky reportů tvoří historický sediment,
- dokumentace je rozházená napříč rootem a `docs/3.0.x/`.

Tento plán říká: **3.0.8 všechno zprovozní, 3.0.9 všechno ztvrdne a vyčistí, 3.1.0 bude čistý Mainnet Alpha.**

### Co znamená „pure code“ repo

| Oblast | Současný stav | Cílový stav 3.1.0 |
|--------|--------------|-------------------|
| Kód | `V3/` + `ZionDex/` + legacy `L1/2/3/` | Pouze `V3/` a `ZionDex/` jako samostatné projekty |
| Dokumentace | Root + `docs/3.0.x/` + `V3/docs/` + filozofické knihy | Root kanonické + `docs/3.0.x/` pro archiv + `V3/docs/` pro engineering |
| Ops | `scripts/`, `edge-deploy/`, `ZionStart/` | Ponechat, ale zdokumentovat v `ops/` nebo `docs/ops/` |
| Filozofie / TerraNova | `docs/TerraNova/`, `docs/Zohar/`, `evoluZionV2.md` | Přesunout do `docs/philosophy/` nebo oddělit do jiného repo |
| Research / PoC | `PoC-lab/`, `HiranV2.x/` | Přesunout do `research/` nebo oddělit do jiného repo |
| Legacy code | `L1/`, `L2/`, `L3/`, `APP&WEB/` staré verze | Archivovat do `archive/` a následně smazat z mainu |

---

## 2. Verzový přehled

| Verze | Název | Cíl | Kdy | Hlavní výstup |
|-------|-------|-----|-----|---------------|
| **3.0.7** | Trinity All Green | Každý aktivní stream má ověřené accepted shares | 2026-07 | [`TRINITY_ALL_GREEN_PLAN.md`](./TRINITY_ALL_GREEN_PLAN.md) |
| **3.0.8** | Full Stack Stable | Všechny služby, coiny a UI fungují; žádné placeholder kernely v aktivní cestě | 2026-08 | [`3.0.8.md`](./3.0.8.md) |
| **3.0.9** | Pre-Alpha Hardening | Security audit, chaos testy, repo purification, public subtree sync | 2026-09 | [`3.0.9.md`](./3.0.9.md) |
| **3.1.0** | Mainnet Alpha | Čistý repo, freeze features, launch readiness, public release | 2026-10 | [`3.1.0.md`](./3.1.0.md) |
| **3.1.x** | Mainnet Beta / Launch | Bugfixy, marketing, onboarding až do 31. 12. 2026 | 2026-Q4 | Public mainnet launch |

---

## 3. Fáze 1 — 3.0.8 „Full Stack Stable“

> **Cíl:** Všechny aktivní komponenty jsou end-to-end funkční. Žádné „TODO“ v hot cestě. Žádné mrtvé odkazy. Žádné placeholder kernely, které se tváří jako integrované.

### 3.1 Mining — všechny coiny mají cestu k accepted share

| # | Úkol | Příjemce | Kritérium |
|---|------|----------|-----------|
| 1.1 | Dokit 3.0.7 All Green | Trinity | VRSC ≥95%, EPIC ≥1 accepted, ZION ≥99%, XMR má fallback |
| 1.2 | Pro každý aktivní external coin buď **funguje E2E**, nebo je **explicitně disabled** s důvodem | `AuXpow`, pool, miner | Tabulka `ExternalCoin::status()` = `enabled` / `disabled_reason` |
| 1.3 | Pearl (PRL) — rozhodnutí | core team | Enable GPU thread nebo oficiálně defer do 3.1.0+ |
| 1.4 | VTC / ZCL host-side — dokončit nebo defer | `AuXpow` | Minimálně kernel init + job parsing; jinak `disabled` |
| 1.5 | Autonomous profit router v mineru | `V3/L1/miner` | Miner si sám vybírá Stream 2/3 coiny podle profitability |
| 1.6 | Cross-platform build matrix | CI/SMOS | Linux x86_64, Windows x86_64, macOS aarch64, SMOS Vega/RDNA |

### 3.2 Pool & bridge — produkční stabilita

| # | Úkol | Kritérium |
|---|------|-----------|
| 2.1 | PPLNS composite key — 30d bez misrouted payout | 0 incidentů |
| 2.2 | Pool reconnect cooldown — žádné reconnect stormy | Max 1 reconnect/min na IP v normálním provozu |
| 2.3 | Bridge vault scale fix — reverzní bridge E2E | 100K wZION round-trip bez rozdílu |
| 2.4 | DAO / multisig — 3/5 guardians live | Proposals submit + execute |

### 3.3 Web & explorer

| # | Úkol | Kritérium |
|------|------|-----------|
| 3.1 | Explorer V4 nasazen na `/explorer` | Block/tx/address detail, SSE live feed, search |
| 3.2 | Dashboard zobrazuje všechny 3 streamy + per-coin revenue | Reálná data z `/api/pool/stats` |
| 3.3 | Website `/pool`, `/defi`, `/dex` bez 500 chyb | 7d uptime 99.5% |

### 3.4 Docs & config

| # | Úkol | Kritérium |
|------|------|-----------|
| 4.1 | Všechny env vars a configy v `edge-environment.sh` zdokumentovány | Žádné `TODO` nebo prázdné hodnoty |
| 4.2 | `AGENTS.md` aktualizován — aktuální servery, build příkazy, rozhodovací matice | Bez protichůdných odkazů |
| 4.3 | `StatusV3.md` automaticky reflektuje 3.0.8 status | Aktualizovat po každém milníku |

### 3.0.8 Go/No-Go

- ✅ Všechny aktivní external coiny mají ověřené accepted shares nebo jsou disabled.
- ✅ 15/15 služeb na Edge běží 7 dní bez restartu z důvodu chyby.
- ✅ Explorer V4 je live.
- ✅ Autonomous profit router funguje na alespoň jednom referenčním rigu.
- ❌ Pokud nějaký coin zůstane v „limbu“ (kernel ready, ale host-side TODO), explicitně ho označíme jako deferred.

---

## 4. Fáze 2 — 3.0.9 „Pre-Alpha Hardening“

> **Cíl:** Bezpečnost, stabilita, auditovatelnost a očištění repa. Žádné staré větve, které matou agenty a vývojáře.

### 4.1 Security hardening

| # | Úkol | Kritérium |
|---|------|-----------|
| 1.1 | Kompletní audit L1 consensus + account model | Interní audit + changelog |
| 1.2 | Fuzzing transaction validation | 24h fuzz, 0 kritických crashů |
| 1.3 | Tailscale ACL nasazen a otestován | Pouze oprávněné IP mají přístup |
| 1.4 | Key rotation — premine, pool, bridge, EVM | Air-gapped procedura, nové adresy zdokumentovány |
| 1.5 | Secrets scan — žádné plaintext klíče v repu | `git secrets --scan` clean |

### 4.2 Chaos & load testing

| # | Úkol | Kritérium |
|---|------|-----------|
| 2.1 | 1000+ minerů připojených k poolu (simulace) | Pool nestárá, memory stabilní |
| 2.2 | Node restart za běhu — sync do 5 min | Chain height catch-up |
| 2.3 | Bridge watcher reconnect — 50x disconnect | Žádné ztracené eventy |

### 4.3 Repo purification — „pure code“

> Detailed V3.1 migration into a clean `V31/` tree (post-3.0.9): [`V3.1_MIGRATION_PLAN.md`](./V3.1_MIGRATION_PLAN.md) — WARP → L2, ZionDex → L2, AuxPoW → miner, L3 → AI/orchestration/automation/NCL/PoC; L4 Oasis / L5 Free World / L6 Issobella stay as superstructures. Native integration seams for the four moves: [`V3.1_INTEGRATION_PLAN.md`](./V3.1_INTEGRATION_PLAN.md).

| # | Úkol | Akce |
|------|------|------|
| 3.1 | Legacy root trees | `L1/`, `L2/`, `L3/` → `archive/legacy-code/` a následně smazat z mainu |
| 3.2 | Filozofické a marketingové knihy | `docs/TerraNova/`, `docs/Zohar/`, `evoluZionV2.md` → `docs/philosophy/` nebo nové repo |
| 3.3 | Research / PoC | `PoC-lab/`, `HiranV2.x/` → `research/` nebo nové repo |
| 3.4 | Staré APP&WEB verze | `APP&WEB/website-v2.9/` → archiv, pokud je nahrazeno novým |
| 3.5 | Duplicitní docs | Sloučit `V3/docs/` a rootové reporty; všechny verzované reporty pod `docs/3.0.x/` |
| 3.6 | Cleanup scripts | Přesunout ops utility pod `scripts/` nebo `ops/` s README |

**POZOR:** Před fyzickým smazáním cokoli z mainu udělat tag `pre-purification-3.0.9` a ověřit, že `public/` subtree nepotřebuje tyto soubory.

### 4.4 Public subtree sync

| # | Úkol | Kritérium |
|------|------|-----------|
| 4.1 | `public/` obsahuje pouze MIT-safe subset | Žádné IP, žádné klíče, žádné interní ops |
| 4.2 | `git subtree push` clean | Diff mezi `V3/` a `public/V3/` = 0 pro MIT-safe soubory |
| 4.3 | Public README reflektuje 3.0.9 stav | Aktualizovat `public/README.md` |

### 4.0.9 Go/No-Go

- ✅ Security audit bez kritických nálezů (nebo všechny mitigovány).
- ✅ Repo má pouze `V3/`, `ZionDex/`, `docs/`, `scripts/`, `edge-deploy/`, `ZionStart/` a rootové kanonické soubory.
- ✅ `git secrets` clean.
- ✅ Chaos testy pass.
- ❌ Pokud nějaká čistá akce je riziková, udělá se až po 3.1.0 s označením `post-launch cleanup`.

---

## 5. Fáze 3 — 3.1.0 „Mainnet Alpha“

> **Cíl:** Síť je stabilní a důvěryhodná natolik, že může být označena jako Alpha a sloužit jako základ veřejného mainnet launchi.

### 5.1 Feature freeze & final QA

| # | Úkol | Kritérium |
|---|------|-----------|
| 1.1 | Feature freeze — žádné nové algoritmy/coiny | Pouze bugfixy a dokumetace |
| 1.2 | Full regression test suite | Všechny crate testy pass, E2E smoke test pass |
| 1.3 | 30d continuous run on Edge | 99.9% uptime pool, 0 block orphanů |

### 5.2 Launch readiness

| # | Úkol | Kritérium |
|---|------|-----------|
| 2.1 | GitHub release v3.1.0-beta | Binaries + SHA256SUMS + release notes |
| 2.2 | SMOS package oficiální | `zion-miner-v3.1.0-mainnet-alpha.zip` |
| 2.3 | Public launch checklist | Dokončit [`LAUNCH_CHECKLIST.md`](./LAUNCH_CHECKLIST.md) (vytvořit) |
| 2.4 | Monitoring & alerting | Grafana/alertmanager nebo ekvivalent, page na downtime |
| 2.5 | Backup & disaster recovery | DB snapshoty, genesis recovery, cold keys |

### 5.3 Communication

| # | Úkol | Kritérium |
|---|------|-----------|
| 3.1 | Aktualizovat všechny README a public docs | Žádné odkazy na 3.0.x v hlavních docs |
| 3.2 | Beta announcement | Blog + Discord/Telegram + mining pool notice |
| 3.3 | Bug bounty program | Nastavit nebo oznámit kanál pro security reports |

### 5.1.0 Go/No-Go

- ✅ 30 dní bez kritického incidentu.
- ✅ Všechny launch checklisty hotové.
- ✅ GitHub release publikován a SMOS package dostupný.
- ✅ Komunita je informovaná a má kanál pro reporty.

---

## 6. Repo purification detail

### 6.1 Navrhovaná top-level struktura 3.1.0

```
.
├── AGENTS.md                 # kanonické pravidla pro agenty
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE
├── PUBLIC_README.md
├── README.md
├── ROADMAP.md
├── SECURITY.md
├── StatusV3.md               # live status
├── 3.0.7.md                  # aktuální verze
├── 3.0.8.md
├── 3.0.9.md
├── 3.1.0.md
├── MAINNET_ALPHA_PLAN.md     # tento dokument
├── TRINITY_ALL_GREEN_PLAN.md
├── V3.1_MIGRATION_PLAN.md    # migrace do V31/ (po 3.0.9)
├── V3.1_INTEGRATION_PLAN.md  # nativní propojení 4 integrací (Bridge↔WARP, AuxPoW→Miner, ZionDex→L2)
├── LAUNCH_CHECKLIST.md       # TODO vytvořit
├── V31/                      # čistý mainnet-track kód (cíl migrace; ZionDex → L2/ziondex)
├── ZionStart/                # bootstrap / launchery
├── edge-deploy/              # server deploy configs
├── scripts/                  # ops utility
├── docs/
│   ├── 3.0.4/                # archiv
│   ├── 3.0.5/
│   ├── 3.0.6/
│   ├── 3.0.7/
│   ├── 3.0.8/
│   ├── 3.0.9/
│   ├── 3.1.0/
│   └── philosophy/           # přesunuté TerraNova/Zohar (optional)
├── public/                   # git subtree public repo
└── archive/                  # legacy code, APP&WEB old, research
    └── (pouze v historii, ne v mainu)
```

### 6.2 Postup čištění

1. **Archivace** — `git mv` legacy trees do `archive/` a commit.
2. **Tag** `pre-purification-3.0.9`.
3. **Smazání z mainu** — `git rm -r L1/ L2/ L3/ ...` a commit.
4. **Sync public subtree** — ověřit, že public repo není rozbit.
5. **Aktualizace build/CI cest** — odstranit odkazy na smazané adresáře.

---

## 7. Rizika a mitigace

| Riziko | Dopad | Mitigace |
|--------|-------|----------|
| Smazání souboru, který potřebuje public subtree | Broken public repo | Před smazáním `git subtree push --dry-run` / diff |
| Feature creep v 3.1.0 | Není ready na launch | Striktní feature freeze a deferred list |
| Bezpečnostní audit najde kritický bug | Posunutí launch | Mít 4 týdny buffer před 31. 12. |
| Pool nestíhá při 1000+ simulovaných minerů | Odmítnutí share | Load test na stagingu, horizontal scaling připraven |
| Závislost na externích poolích | Coiny přestanou fungovat | Fallback pooly, profit router, graceful disable |

---

## 8. Success criteria shrnutí

| Verze | Hlavní signál úspěchu |
|-------|----------------------|
| **3.0.8** | „Všechno, co má být zapnuté, běží.“ |
| **3.0.9** | „Repo je čisté, bezpečnost prošla, chaos testy pass.“ |
| **3.1.0** | „Mainnet Alpha je venku a komunita může těžit.“ |

---

*Generated with [Devin](https://devin.ai) — ZION V3 Mainnet Beta, 2026-07-19.*
