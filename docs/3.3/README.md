# docs/3.3 — plánovací dokumenty NIRVANY

> **Od 13. 11. 2026** je živý stav v [`../../3.3.0/CODE_VS_DOCS.md`](../../3.3.0/CODE_VS_DOCS.md) a master v [`../../3.3.0/v3.3Nirvana.md`](../../3.3.0/v3.3Nirvana.md). Soubory v tomto adresáři jsou plány a snapshoty z října a začátku listopadu. [`PLAN.md`](../../PLAN.md) v rootu je historický snapshot k 11. 11.
>
> **Co tu je:** všechny plánovací dokumenty v3.3 „NIRVANA" z doby, kdy se plánovalo ve starém rootu. Do **2. 11. 2026** ležely v rootu repa; při úklidu root dokumentace se sem přesunuly (commit `ee1503423`).
>
> **Kam co patřilo do 12. 11.:**
> - **root** → [`PLAN.md`](../../PLAN.md) byl vstupní bod starého rootu; od 13. 11. je to historický snapshot. Provozní pravidla starého stromu zůstávají v [`AGENTS.md`](../../AGENTS.md). Ukazatel na živý stav je [`../../CODE_VS_DOCS.md`](../../CODE_VS_DOCS.md).
> - **`docs/3.3/`** → plány, mapy, checklisty té doby (tenhle adresář)
> - **`docs/3.2/`** → stav 3.2 ([`StatusV3.md`](../3.2/StatusV3.md)), roadmapy
> - **`docs/3.2/REPORTS/`** → reporty po každé vlně/incidentu 3.2
> - **`docs/plans/`** → dílčí infra plány (OPS-CONSOLE, INFRA-SPLIT, VASTAI-MINING…)
>
> **Údržba:** při přesunu dokumentu sem nezapomeň přepsat odkazy — cesty psané od rootu (`docs/3.2/…`, `canon/…`, `V31/…`) z `docs/3.3/` nefungují, potřebují prefix `../../`.

---

## 1. Plánování v3.3 (jádro)

| Dokument | Co obsahuje |
|---|---|
| [`NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md`](NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md) | **Hlavní plán.** Vlny W0–W6, brány KS-1…KS-9, registr rozporů, kritická cesta. Od 2. 11. v `docs/3.3/` (dřív root). |
| [`NIRVANA-V3.3-MAP.md`](NIRVANA-V3.3-MAP.md) | Navigační mapa nad všemi plány — co existuje, co platí, crosswalk N/M/R/V33/W/3.2.x, závislosti. |
| [`NIRVANA-V3.3-CHECKLIST.md`](NIRVANA-V3.3-CHECKLIST.md) | Execution checklist N0–N7 + fronta autonomních úkolů. |
| [`NIRVANA-V3.3-PLAN.md`](NIRVANA-V3.3-PLAN.md) | Původní komplexní execution plán (2026-10-21) — historický základ, MAP ho zastřešuje. |
| [`NIRVANA-V3.3-UNIFICATION.md`](NIRVANA-V3.3-UNIFICATION.md) | Unifikační plán „velkého sjednocení" (2026-10-30). |
| [`NIRVANA-V3.3-KAPITOLA.md`](NIRVANA-V3.3-KAPITOLA.md) | Kapitola „loď Království srdce" — mapa povrchů (hostname → appka → stack). |
| [`DOC_VS_CODE_ANALYSIS_2026-11-02.md`](DOC_VS_CODE_ANALYSIS_2026-11-02.md) | Analýza rozporů dokumentace vs. kód (2026-11-02). |

## 2. Nirvana — klient, scény, render

| Dokument | Co obsahuje |
|---|---|
| [`NIRVANA-SHELL.md`](NIRVANA-SHELL.md) | „Nirvana — jeden klient": shell, portály, okna, sloty scény. |
| [`NIRVANA-RENDER-AAA.md`](NIRVANA-RENDER-AAA.md) | Plán AAA kvality renderu pro 13 L5 scén + rozpočty (draw calls, tris, fps). |
| [`OASIS-RENDER-CANON.md`](OASIS-RENDER-CANON.md) | Render canon pro OASIS (závazná pravidla scén). |
| [`Oasis Render.md`](Oasis%20Render.md) | Pracovní poznámky k OASIS renderu. |
| [`3D-SCENY-PLAN.md`](3D-SCENY-PLAN.md) | Dokončení 3D scén — web i Nirvana. |
| [`MATRIX.md`](MATRIX.md) | Matrix — lunární svět (scéna, soundtrack, interiér). |
| [`ARCHA-NOEMOVA.md`](ARCHA-NOEMOVA.md) | Archa Noemova / „Království srdce" — 13. uzel L5, plavidlo, paluby. |
| [`ENGINE-SRDCE.md`](ENGINE-SRDCE.md) | Strojovna lodi — `zion-compute` (specifikace, mimo DoD 3.3). |
| [`ENGINE-WEB.md`](ENGINE-WEB.md) | Výběr scénového enginu pro Království. |

## 3. Hiran / AI

| Dokument | Co obsahuje |
|---|---|
| [`AIhiran.md`](AIhiran.md) | AI Hiran — ZION AI stack, modely a pipeline. |
| [`HIRAN-FULL-TRAINING-PREP.md`](HIRAN-FULL-TRAINING-PREP.md) | Příprava full tréninku Hiran (strategie 2026-11-01). |
| [`VAST-HIRAN-TRAINING-PLAN.md`](VAST-HIRAN-TRAINING-PLAN.md) | Trénink na existující vast.ai instanci (2026-10-31). |

## 4. Ops / infra / klienti

| Dokument | Co obsahuje |
|---|---|
| [`VAST-OPS.md`](VAST-OPS.md) | Vast rigs — jak se dostat na fleet a co dál (runbook `infra/tools/vast/vastctl.py`). |
| [`POOL-HEROMINERS-PARITY-PLAN.md`](POOL-HEROMINERS-PARITY-PLAN.md) | Pool UI — dosažení parity s HeroMiners. |
| [`DESKTOP-AGENT-COMPLETE-PLAN.md`](DESKTOP-AGENT-COMPLETE-PLAN.md) | Desktop agent — kompletní plán (VIP + Public), GPU build. |

## 5. Handoffy

| Dokument | Co obsahuje |
|---|---|
| [`Nedele.md`](Nedele.md) | Neděle — plán pokračování z lokálního backup PC. |
| [`nedele1.md`](nedele1.md) | Neděle 1 — herní Nirvana, handoff pro přesun na lokální PC. |

## 6. Kontinuita a nástupnictví

| Dokument | Co obsahuje |
|---|---|
| [`TRUSTEE-CONTINUITY.md`](TRUSTEE-CONTINUITY.md) | **Provozní a kontinuitní manuál pro správkyni** (Erika Imlaufová, zástupkyně Petra Tkácová). Psáno pro ne-technika: první 72 hodin, co nikdy nedělat, mapa světa, přístupy, pravidelné kontroly, rozhodovací stromy, skutečné příkazy, peněžní pravidla, blokátory. **INTERNAL — nikdy do `public/` mirroru.** |
| [`ARCHA-ZACHRANNA-MISE.md`](ARCHA-ZACHRANNA-MISE.md) | Záchranná (SAR) mise lodi Království srdce — interní analýza, minimální kritérium = záchrana dětí. Veřejná vize zůstává `vision` v [`ARCHA-NOEMOVA.md`](ARCHA-NOEMOVA.md). |

---

## Historie přesunu (2026-11-02)

Z rootu sem bylo přesunuto 21 souborů (`git mv`, beze změny obsahu):

```
3D-SCENY-PLAN.md            AIhiran.md                  ARCHA-NOEMOVA.md
DESKTOP-AGENT-COMPLETE-PLAN.md  HIRAN-FULL-TRAINING-PREP.md  MATRIX.md
NIRVANA-RENDER-AAA.md       NIRVANA-SHELL.md            NIRVANA-V3.3-CHECKLIST.md
NIRVANA-V3.3-KAPITOLA.md    NIRVANA-V3.3-KRALOVSTVI-SRDCE-PLAN.md
NIRVANA-V3.3-MAP.md         NIRVANA-V3.3-PLAN.md        NIRVANA-V3.3-UNIFICATION.md
Nedele.md                   nedele1.md                  OASIS-RENDER-CANON.md
Oasis Render.md             POOL-HEROMINERS-PARITY-PLAN.md
VAST-HIRAN-TRAINING-PLAN.md VAST-OPS.md
```

`ENGINE-SRDCE.md` a `ENGINE-WEB.md` tu byly už dřív.
