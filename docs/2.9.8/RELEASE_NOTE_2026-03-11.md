# ZION 2.9.8 — Release Note (2026-03-11)

> Scope: live testnet rollout Ekam Deeksha on the current single-host infrastructure
> Host: 91.98.122.165
> Status: released and validated

## Summary

2.9.8 is now running as the canonical live testnet path with Ekam Deeksha active from genesis.

The public operational topology is no longer the earlier 3-node layout. Current live infrastructure is consolidated on one public host with internal seed containers.

## What changed

- canonical PoW path unified under `cosmic_harmony`
- Ekam Deeksha activation moved to genesis semantics for the reset chain
- core, pool and miner images rebuilt as `2.9.8`
- chain state reset and restarted cleanly on the live host
- deployment workflow normalized to `docker compose --env-file .env`

## Validation outcome

- chain resumed block production after reset
- pool accepted shares with zero observed rejects during rollout validation
- miner reported live hashrate and submitted accepted work
- live stack confirmed on `91.98.122.165` with `zion-core`, `zion-pool`, `zion-miner`, `zion-seed-1`, `zion-seed-2`, `zion-redis`, `zion-website`

## Compatibility note

The active deployment is pure-ZION by default, but the legacy revenue subsystem remains in the codebase and runtime wiring.

This includes:

- pool revenue proxy
- profit switcher
- buyback engine
- external miner integration
- stream scheduler
- miner-side stream and external-pool handling

That means 2.9.8 keeps CHv3 revenue compatibility while using a single canonical Deeksha consensus path for ZION mining.

## Operational note

For current infra truth, use `SERVERS.md`, `LIVESTATS.md`, `DEPLOY_CHECKLIST_2026-03-10.md` and `EKAM_DEPLOY_REPORT_2026-03-11.md`.

Older references to Helsinki, USA and Asia nodes should be treated as historical unless explicitly marked as live.