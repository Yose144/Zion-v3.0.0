# 📚 ZION v2.9.5 — Organizace dokumentace (kanon)

**Datum:** 2026-02-03  
**Cíl:** odstranit chaos mezi legacy (Python/C++/shim) a current (2.9.5 native Rust stack).

## 1) Co je „CURRENT“ pro vývoj v2.9.5

### Jediný zdroj pravdy pro native stack
- `2.9.5/` — Rust workspace (core/pool/miner/NCL/CH3)
- [2.9.5/docs/REAL_STATUS_v2.9.5.md](../../../2.9.5/docs/REAL_STATUS_v2.9.5.md) — kanonický real‑code stav
- [2.9.5/docker-compose.native-2.9.5.yml](../../../2.9.5/docker-compose.native-2.9.5.yml) — produkční docker topologie pro v2.9.5
- [docs/2.9.4/reports/DEEP_ANALYSIS_v2.9.5_2026-02-03.md](../reports/DEEP_ANALYSIS_v2.9.5_2026-02-03.md) — konsolidovaná analýza + rozpory + priority

### Roadmapy pro v2.9.5
- [TESTNET_ROADMAP_2026.md](../roadmaps/TESTNET_ROADMAP_2026.md) — operativní plán TestNet (Feb–Mar 2026)
- [2.9.5/docs/COSMIC_HARMONY_V3_ROADMAP.md](../../../2.9.5/docs/COSMIC_HARMONY_V3_ROADMAP.md) — CH3 engine roadmap
- [docs/roadmaps/MAINNET_READINESS_v2.9.5.md](../roadmaps/MAINNET_READINESS_v2.9.5.md) — MainNet gaps + plán

## 2) Co je „LEGACY“ (nepoužívat jako návod pro v2.9.5)

Tyhle dokumenty jsou důležité historicky, ale míchají porty/stacky:
- `src/` + většina „Python TestNet“ runbooků
- staré mainnet/testnet launch guidy s porty 18080/18081 nebo 8545/8334 clusterem

**Pravidlo:** pokud dokument nemluví explicitně o `2.9.5/` a `zion-native`, ber ho jako legacy.

## 3) Doporučené složky v docs/

- `docs/meta/` — kanonické indexy, porty, pravidla organizace
- `docs/reports/` — hluboké analýzy, audit logy, business reporty
- `docs/roadmaps/` — aktivní roadmapy a stavové reporty
- `docs/guides/` — pouze aktuální návody (u legacy jen označené)

## 4) Root repa (co tam smí zůstat)

V rootu chceme dlouhodobě nechat jen:
- `README.md`, `LICENSE`, `requirements*.txt`, `pyproject.toml`, `package*.json`, `docker-compose*.yml` a 2–3 top-level roadmapy.

Všechny session reporty/analýzy migrovat do `docs/reports/` nebo `docs/session-reports/`.

Podrobně: [docs/2.9.4/meta/ROOT_CLEANUP_PLAN_v2.9.5.md](ROOT_CLEANUP_PLAN_v2.9.5.md)
