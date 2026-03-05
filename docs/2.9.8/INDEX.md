# ZION v2.9.8 — Cosmic Harmony Deeksha (Unified)

> Status: DRAFT (stability-first)
> Date: 2026-03-05
> Cíl: sjednotit CHv3 revenue + CHv4/4.2 bezpečnost do jedné jednoduché a rychlé větve.

## Dokumenty

- [DEEKSHA_PHILOSOPHY.md](DEEKSHA_PHILOSOPHY.md) — **FILOZOFIE** (proč): záměr, Oneness, tapas, beautiful state, strom vědomí → strom sítě
- [CHV_DEEKSHA_ARCHITECTURE.md](CHV_DEEKSHA_ARCHITECTURE.md) — **ARCHITEKTURA** (co a jak): modul mapa, pipeline, NpuBackend trait, dispatch, fáze implementace
- [COSMIC_HARMONY_DEEKSHA_SPEC.md](COSMIC_HARMONY_DEEKSHA_SPEC.md) — jednotná algoritmická specifikace (konsenzusní parametry)
- [REVENUE_UNIFICATION_2.9.8.md](REVENUE_UNIFICATION_2.9.8.md) — zachování CHv3 revenue modelu bez regresí
- [MIGRATION_PLAN_2.9.8.md](MIGRATION_PLAN_2.9.8.md) — implementační kroky, testy, rollout (fáze A→E)
- [DEEKSHA_EKAM_CONCEPT_BRIDGE.md](DEEKSHA_EKAM_CONCEPT_BRIDGE.md) — překlad konceptu Deeksha/Ekam do 5 technických pravidel (A-E)

## Jednověté rozhodnutí

2.9.8 zavádí jeden canonical PoW profil `cosmic_harmony` (Deeksha), který preferuje síťovou stabilitu a jednoduchost: 
- light memory-hard parametry,
- deterministický výstup na všech platformách,
- NPU jako akcelerace, ne oddělená consensus větev,
- revenue systém převzatý z CHv3 beze ztráty funkcí.

## Design principy 2.9.8

1. **Stability first** — žádné experimentální větvení v consensus hot path.
2. **Single canonical path** — jeden algoritmus, jeden parser aliasů, jeden pool validator flow.
3. **Revenue continuity** — CHv3 streamy (CPU revenue + GPU revenue + NCL) zůstávají aktivní.
4. **Simple ops** — snadný deploy, jasná observability, rychlý rollback.
5. **No surprise forks** — jednoznačná activation policy, bez dokumentačních rozporů.
