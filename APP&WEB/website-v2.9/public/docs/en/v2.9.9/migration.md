# Migration notes — v2.9.9 → V3

## Goal

Keep 2.9.9 as an auditable archival bridge and move the clean runtime baseline into the V3 mainnet track without uncontrolled legacy drift.

## In scope

- Consensus/runtime pieces verified on the canonical path.
- Pool/miner wiring without historical experimental branches.
- Documentation for the launch gate and readiness criteria.

## Out of scope

- Historical experiments and duplicates.
- Unaudited side fallbacks.
- Legacy public messaging that conflicts with current launch policy.

## Outcome

V3 remains the clean operational line for the mainnet track; 2.9.9 remains reference plus audit evidence.
