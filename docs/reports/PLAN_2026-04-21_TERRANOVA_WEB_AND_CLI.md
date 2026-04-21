# Terra Nova Web + CLI Plan

Datum: 21. dubna 2026
Stav: pracovní plán

## Cíl

Srovnat veřejný web tak, aby Terra Nova, Zlatý Kompas a ZION CLI byly prezentované čistě, bez míchání roadmapy, knihy a download surface.

## Pracovní proudy

### 1. Homepage

- zjednodušit homepage Terra Nova promo sekci
- ponechat jen text `Terra Nova · Zlatý Kompas Nové Země`
- pod textem ponechat terminal block
- odstranit vrstvy, timeline a milestone checklisty z homepage
- přidat jasný odkaz na novou sekci `/terranova`
- přidat jasný odkaz na `/download`

### 2. Download

- doplnit `ZION CLI` jako samostatný download artefakt pro všechny OS
- zachovat Miner, Wallet a Node, ale CLI udělat jako první-class operator entrypoint
- sladit copy s reálným V3 CLI surface

### 3. Terra Nova docs

- doplnit a zpřesnit L3 vrstvu napříč veřejnými TerraNova docs
- oddělit L2 a L3 tam, kde jsou smíchané do jedné roadmap fáze
- sladit wording na `AI Native / Hiranyagarbha / NCL / WARP`
- držet konzistentní mapu L1, L2, L3, L4, L5, L6

## Konkrétní edit anchors

- `APP&WEB/website-v2.9/src/components/TerraNovaHomeMilestones.tsx`
- `APP&WEB/website-v2.9/src/components/download/DownloadToolBrowser.tsx`
- `APP&WEB/website-v2.9/src/app/download/page.tsx`
- `docs/TerraNova/public/README.md`
- `docs/TerraNova/public/07-ARCHITEKTURA.md`
- `docs/TerraNova/public/11-KOMPAS.md`

## Pořadí realizace

1. homepage simplification
2. download: ZION CLI for all OS
3. Terra Nova public docs: L3 consistency pass
4. build validation
5. selective commit + push + safe deploy

## Poznámka

Lokální uživatelské Terra Nova textové změny byly už zachycené v samostatném baseline commitu, aby šlo na layout/docs pokračovat bez rizika jejich ztráty.