# ZION 2.9.7 — Mainnet Go/No-Go Tabulka

> Datum: 2026-03-05  
> Zdroj pravdy: `docs/2.9.7/MAINNET_READINESS_UNIFIED.md`

## Rozhodnutí (aktuální)

| Oblast | Kritérium | Stav | Důkaz / Odkaz | Poznámka |
|---|---|---|---|---|
| Stabilita 168h | 168h bez kritických incidentů | PASS | `docs/2.9.7/STABILITY_LOG.md` | Operator-reported, dashboard green |
| Build/Test baseline | L1/L2/L3 build + klíčové testy zelené | PASS | `docs/2.9.7/2.9.7.md` | Pre-mainnet baseline připravena |
| CHv4 produkční upgrade | GPU kernely + Python dispatch + E2E run | PASS | `tests/chv4_e2e.rs` 11/11 ✅ | B-CRIT-01 UZAVŘEN 2026-03-03 |
| Revenue produkční aktivace | Wallets + buyback limity + 72h canary | IN PROGRESS | `docs/2.9.7/E07_CANARY_RUN.md` | B-CRIT-02, canary běží, konec 2026-03-06T21:37Z |
| Genesis/freeze artefakty | Genesis hash sign-off + freeze podpisy | BLOCKED | `docs/2.9.7/MAINNET_READINESS_UNIFIED.md` | B-CRIT-03, čeká na audit uzavření |
| Release sign-off | Kompletní podpis release checklistu | BLOCKED | `docs/2.9.7/CODE_FREEZE.md` | Čeká na uzavření blockerů |
| P2P síť | peers_connected counter + ephemeral port bug | FIXED | commit `773c931` 2026-03-05 | Hot-patch aplikován na USA+Asia |

## Go/No-Go Výrok

- **Aktuální rozhodnutí:** **NO-GO**
- **Důvod:** Otevřené kritické blokery `B-CRIT-02` (revenue canary IN PROGRESS, konec 2026-03-06T21:37Z), `B-CRIT-03` (genesis ceremony čeká).
- **Podmínka pro GO:** Revenue canary 72h PASS + genesis ceremony provedena + release checklist podepsán.

## Sign-off tabulka

| Role | Jméno | Rozhodnutí | Datum | Podpis |
|---|---|---|---|---|
| Tech Lead | TBD | NO-GO | 2026-03-03 | - |
| Protocol/Consensus | TBD | NO-GO | 2026-03-03 | - |
| Pool/Miner Ops | TBD | NO-GO | 2026-03-03 | - |
| Revenue/Ops | TBD | NO-GO | 2026-03-03 | - |
| Security/Release | TBD | NO-GO | 2026-03-03 | - |

## Poznámka

- Po uzavření blockerů změnit rozhodnutí na **GO**, doplnit jména, datum a podpisy.