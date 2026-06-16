# ZION TerraNova v2.9.9 — Pure Code

> Release window: March 2026  
> Role in lineage: cleanup and migration branch ahead of the V3 mainnet track

v2.9.9 is a cleanup release. The goal is not to add features or change consensus output, but to remove legacy baggage and lock in an auditable baseline.

## What matters

- A single PoW profile in runtime (`cosmic_harmony` = Ekam Deeksha).
- One active dispatch path in the miner flow.
- Fewer duplicates and dead fallbacks.
- A clean handoff into the V3 mainnet-track repository.

## Release principles

- Remove, don’t pile on.
- Single source of truth.
- Keep pool compatibility.
- Zero intent to change consensus hash semantics.

## Documents in this line

- `v2.9.9/changelog.md` — change timeline and cleanup scope
- `v2.9.9/migration.md` — mapping for the 2.9.9 → V3 move
