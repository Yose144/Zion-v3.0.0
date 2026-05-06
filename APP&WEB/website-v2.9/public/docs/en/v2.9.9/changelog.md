# Changelog — v2.9.9 (Pure Code)

## Delta vs v2.9.8

- Legacy code cleanup across miner, pool, and runtime.
- Naming alignment; removal of dead dispatch branches.
- Fewer duplicate fallback paths.
- Documented migration strategy toward a clean V3 track.

## What does not change

- Consensus intent: no change to hash semantics.
- Public launch policy: launch gate remains gated on closure evidence.
- Runtime context: the v2.9.8 canonical path stays the reference baseline.

## Why this matters

The Pure Code phase improves auditability, lowers operational risk, and simplifies moving to V3 without historical baggage.
