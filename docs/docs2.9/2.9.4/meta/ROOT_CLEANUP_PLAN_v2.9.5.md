# 🧹 ZION v2.9.5 — Root cleanup plán

**Datum:** 2026-02-03  
**Cíl:** zmenšit kognitivní šum v rootu repa a udělat jasný „entry point“ pro v2.9.5.

## Principy
- Root = jen entry points + build/config.
- Všechny reporty/roadmapy patří do `docs/` (ne do root).
- Nic nemažeme bez náhrady: u přesunutých souborů ideálně nechat krátký stub s odkazem (až budeme přesouvat ve větším).

## Navržená cílová struktura pro reporty

### 1) Session reporty
- `docs/session-reports/2026/SESSION_REPORT_YYYY-MM-DD_*.md`
- `docs/session-summaries/2026/SESSION_SUMMARY_*.md`

### 2) Status reporty
- `docs/status-reports/DEPLOYMENT_STATUS_REPORT_*.md`
- `docs/status-reports/MINING_TEST_REPORT_*.md`

### 3) Strategické dokumenty
- `docs/reports/DEEP_PROJECT_ANALYSIS_*.md`
- `docs/roadmaps/*.md`

## Konkrétní kroky (doporučené pořadí)

1. Přidat kanonický index do docs (hotovo v rámci docs README cleanup).
2. Vytvořit `docs/session-reports/2026/` a přesunout:
   - `SESSION_REPORT_2026-*.md`
   - `SESSION_SUMMARY_2026-*.md`
3. Vytvořit `docs/status-reports/2026/` a přesunout:
   - `*_STATUS_REPORT_*.md`, `*_TEST_REPORT_*.md`, `*_WORK_REPORT_*.md`
4. V rootu nechat jen 1–2 „top“ roadmapy (např. `TESTNET_ROADMAP_2026.md`) a zbytek linkovat z docs.

Aktuální stav: `TESTNET_ROADMAP_2026.md` je přesunutý do [docs/2.9.4/roadmaps/TESTNET_ROADMAP_2026.md](../roadmaps/TESTNET_ROADMAP_2026.md).

## Poznámka
Tento soubor je plán. Přesun souborů uděláme jako samostatný krok, protože je potřeba současně opravit odkazy a zabránit rozbití externích URL.
