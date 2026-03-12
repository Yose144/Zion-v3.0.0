# ZION v2.9.8 — Cosmic Harmony Deeksha (Unified)

> Status: ACTIVE (single-track)
> Date: 2026-03-05
> Cíl: sjednotit CHv3 revenue + CHv4/4.2 bezpečnost do jedné jednoduché a rychlé větve.

> **Jediná aktivní cesta:** 2.9.8 je source of truth pro roadmapu, implementaci i release verdict.

## Dokumenty

- [DEEKSHA_PHILOSOPHY.md](DEEKSHA_PHILOSOPHY.md) — **FILOZOFIE** (proč): záměr, Oneness, tapas, beautiful state, strom vědomí → strom sítě
- [DEEKSHA_COSMOLOGY.md](DEEKSHA_COSMOLOGY.md) — **KOSMOLOGIE**: pipeline jako kosmogonie, zlatý řez, Sefírotský strom, Indra's Net, Hiranyagarbha genesis seed
- [DEEKSHA_SCIENCE.md](DEEKSHA_SCIENCE.md) — **VĚDA**: kryptografický základ (NIST SHA-3/AES), memory-hard fyzika (roofline model), INT8 MLP (informační teorie), game theory minerů
- [CHV_DEEKSHA_ARCHITECTURE.md](CHV_DEEKSHA_ARCHITECTURE.md) — **ARCHITEKTURA** (co a jak): modul mapa, pipeline, NpuBackend trait, dispatch, fáze implementace
- [COSMIC_HARMONY_DEEKSHA_SPEC.md](COSMIC_HARMONY_DEEKSHA_SPEC.md) — jednotná algoritmická specifikace (konsenzusní parametry)
- [ROADMAP_2.9.8.md](ROADMAP_2.9.8.md) — jednotná realizační roadmapa (single track)
- [REVENUE_UNIFICATION_2.9.8.md](REVENUE_UNIFICATION_2.9.8.md) — zachování CHv3 revenue modelu bez regresí
- [MIGRATION_PLAN_2.9.8.md](MIGRATION_PLAN_2.9.8.md) — implementační kroky, testy, rollout (fáze A→E)
- [DEEKSHA_EKAM_CONCEPT_BRIDGE.md](DEEKSHA_EKAM_CONCEPT_BRIDGE.md) — překlad konceptu Deeksha/Ekam do 5 technických pravidel (A-E)
- [GO_NO_GO_2.9.8.md](GO_NO_GO_2.9.8.md) — uzavírací checklist a release verdict pro 2.9.8
- [EKAM_DEPLOY_REPORT_2026-03-11.md](EKAM_DEPLOY_REPORT_2026-03-11.md) — live rollout report pro single-host Ekam Deeksha reset a ověření na 91.98.122.165
- [RELEASE_NOTE_2026-03-11.md](RELEASE_NOTE_2026-03-11.md) — stručný release note pro live 2.9.8 Ekam rollout a zachování revenue kompatibility

## Řízení release (2.9.8 only)

- Plán práce: `ROADMAP_2.9.8.md`
- Technická specifikace: `COSMIC_HARMONY_DEEKSHA_SPEC.md`
- Rozhodnutí o release: `GO_NO_GO_2.9.8.md`
- Historický kontext 2.9.7: pouze referenční, neřídí 2.9.8 scope

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
