# ZION TerraNova v2.8.x — legacy Python éra

> **Éra: do listopadu 2025 · Stav: Legacy**

Řada v2.8.x byla Python základ ZION. Ustanovila infrastrukturu poolu, testovací rámec a raný protokolový design, který informoval Rust přepis.

---

## Přehled

v2.8.x bylo postaveno čistě v Pythonu 3.11+ s TypeScriptem pro pool komponenty. Byla to „testovací půda“ — upevnění ekonomického designu, testovací strategie a architektury mining poolu před přepisem jádra blockchainu do Rustu.

### Poslední Python release: v2.8.9 „Polish Sprint“ (10. listopadu 2025)

Finální významné Python vydání dosáhlo:

| Oblast | Výsledek |
|--------|----------|
| Pokrytí testy | 400+ testů (unit + integrace + E2E) |
| Kvalita kódu | black + isort formátování (49 souborů) |
| Typová bezpečnost | 8 jádrových modulů s plnými type hints |
| Bezpečnostní audit | LOW RISK — 0 kritických/vysokých/středních nálezů |
| Výkon | bez regresí oproti baseline v2.8.5 |
| Dokumentace | přidáno 50 000+ řádků dokumentace |

---

## Časová osa v2.8.x

| Verze | Datum | Hlavní změna |
|-------|------|--------------|
| v2.8.5 | zář 2025 | první TypeScript pool, první GPU těžba, adresy Z3 |
| v2.8.9 | 10. list 2025 | Polish Sprint hotov — 400+ testů, bezpečnostní audit, production-ready |

### v2.8.5 — „The Victory“ (září 2025)

v2.8.5 byl první „opravdu to funguje“ moment projektu:

- první provozní **TypeScript Stratum mining pool**
- první GPU těžební session s Cosmic Harmony — nalezeny platné share
- zaveden formát adres Z3 (později nahrazen standardnějším přístupem)
- první nasazení `zionterranova.com`
- 26. září sepsán design dokument algoritmu (ZH-2025) — považován za genesis projektu

Dokumentace zakládajícího dne (`ZION-GENESIS-SACRED-BOOK.md`, `NEW-JERUSALEM-VICTORY-2025.md`) přenáší význam tohoto okamžiku pro zakladatele.

### v2.8.9 — „Polish Sprint“ (listopad 2025)

v2.8.9 byl sprint kvality a testů napříč Python kódem:

**Testovací infrastruktura (400+ testů):**
- unit: WebSocket, cache, historické statistiky, Prometheus, Web3 provider
- integrace: API endpointy, WebSocket toky, agregace dat
- E2E: mining workflow, user journey

**Bezpečnost:**
- 0 kritických, 0 vysokých, 0 středních nálezů
- pip-audit, safety, bandit automatické skenování
- flake8 + mypy strict mode

**Roadmap dokumenty pro v2.9.0 „Quantum Leap“** (7 specializovaných dokumentů, 8 945+ řádků) napsané během tohoto sprintu — položily vícevrstvou architekturu, která se stala současným designem ZION.

---

## Proč přepis

Do prosince 2025 čestný technický audit Python kódu v2.9 odhalil fundamentální blokery:

- v jádru blockchainu 76+ pahýlů `NotImplementedError`
- rozbitá testovací sada (problém závislosti pytest-cov)
- produkční blockchain uvízl na genesis bloku (výška: 1)
- pool v produkci neběžel
- strop výkonu Pythonu byl pro produkční PoW řetězec nedostatečný

Závěr: přepsat jádro blockchainu do Rustu. Hodnota Python kódu byla v **návrhu protokolu** — ekonomický model, specifikace algoritmu, governance architektura — ne v implementaci. Veškerý tento design přešel do v2.9.5.

---

## Co z Python éry zůstalo správně

Tato rozhodnutí z Python éry se přenesla beze změny:

- **tvrdý strop 144B** — invariant celkové emise
- **60sekundový čas bloku** — fundamentální konstanta
- **5 400,067 ZION základní odměna za blok** — matematicky odvozená (i když implementace neběžela)
- **PPLNS rozdělení odměn poolu** — proporcionální mining pool design
- **LWMA úprava obtížnosti** — okno 60 bloků
- **žádná presale** — oficiální Fair Launch ve v2.9.5
- **kategorie genesis premine** — OASIS, DAO, infrastruktura, humanitární (částky finalizovány ve v2.9.5)
- **4-fázová struktura algoritmu CHv3** — navržena 26. září 2025
- **6vrstvá civilizační architektura** — naskicována v roadmapách v2.9.0, formalizována ve v2.9.6
