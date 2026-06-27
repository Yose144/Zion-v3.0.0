---
description: "Use when working in V3, the clean-room mainnet code line for node, pool, miner, consensus, and runtime scaffolding."
applyTo: "V3/**"
---

# V3 Mainnet Instructions

## Scope And Intent

- `V3/` is the active mainnet-track workspace.
- It is intentionally separated from the legacy 2.9.6 root so new L1 mainnet code can evolve without historical ballast.
- Work inside `V3/` should default to pure-code concerns only: consensus, node, pool, miner, protocol, validation, and test coverage.
- L2/L3 integration is planned but directories do not exist yet — see `V3/PLAN.md` for migration strategy.

## Source Of Truth

- Use `V3/README.md` for the current implemented surface.
- Use `V3/ROADMAP.md` for build order, completion state, and testnet-to-mainnet milestones.
- Use `V3/PLAN.md` for the comprehensive mainnet completion plan (L1 finish + L2/L3 migration strategy + Go/No-Go checklist).
- For migration rationale, follow the documentation lineage:
  - `docs/2.9.7/` = production base and release gates
  - `docs/2.9.8/` = canonical Deeksha runtime and operational simplification
  - `docs/2.9.9/` = pure-code cleanup and v3 migration strategy

## Practical Rules

- Stay inside `V3/` unless the task explicitly requires reading or syncing audited behavior from the legacy tree.
- Do not reintroduce legacy aliases, dead enum variants, duplicate kernels, or historical CHv3/CHv4.2 dispatch paths unless they are needed as temporary migration bridges and clearly marked.
- Prefer one canonical path per operation: one node wire contract, one pool flow, one miner runtime path, one consensus profile.
- If a feature is not yet production-complete, scaffold it in a way that keeps the runtime auditable and testable, rather than hiding partial behavior behind silent fallbacks.

## L2/L3 Migration Rules

- V3/L2 and V3/L3 directories do not exist yet. When they are created, follow the plan in `V3/PLAN.md`.
- **CRITICAL decimal warning**: Legacy L2/L3 code uses 6-decimal atomics (1e6). V3 canonical is now 6 decimals (1e6 flowers) as of the 3.0.3 fork — previously 12 decimals (1e12). All decimal conversion code must be audited before any L2/L3 migration — deploying unfixed code creates a 1,000,000× inflation vulnerability.
- L1 is READ-ONLY after genesis. L2/L3 are off-chain services communicating with L1 via JSON-RPC only. No consensus changes are needed for L2/L3 features.
- When migrating code from legacy `L2/` or `L3/` into `V3/L2/` or `V3/L3/`, copy only audited behavior that fits the clean mainnet line.

## Validation Expectations

- For `V3/L1/core`: run targeted `cargo test --manifest-path ...\V3\L1\core\Cargo.toml` before broad validation.
- For `V3/L1/pool`: run targeted pool tests after wire protocol or submit-flow changes.
- For `V3/L1/miner`: run targeted miner tests and at least one runtime smoke test when changing session behavior.
- Before closing substantial `V3/` work, run `cargo test --manifest-path ...\V3\Cargo.toml`.

## What Not To Mix In Yet

- No website or desktop-agent work unless the task explicitly asks for it.
- No deployment-manifest migration into `V3/` until code-side node/pool/miner flows are stable.
- No documentation drift: if `V3/` scope changes materially, update `V3/README.md`, `V3/ROADMAP.md`, and `V3/PLAN.md` in the same change.