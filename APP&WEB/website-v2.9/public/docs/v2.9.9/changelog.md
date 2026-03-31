# Changelog — v2.9.9 (Pure Code)

## Delta proti v2.9.8

- Legacy code cleanup v miner/pool/runtime souborech.
- Sjednocení pojmenování a odstranění mrtvých dispatch větví.
- Redukce duplicitních fallback cest.
- Dokumentovaná migrační strategie směrem k čistému V3 tracku.

## Co se nemění

- Consensus záměr: beze změny hash semantics.
- Veřejná launch politika: launch gate zůstává pod closure důkazy.
- Runtime kontext: v2.9.8 canonical path zůstává referenční základ.

## Why this matters

Pure Code fáze zvyšuje auditovatelnost, snižuje provozní riziko a zjednodušuje přenos do V3 bez historického balastu.
