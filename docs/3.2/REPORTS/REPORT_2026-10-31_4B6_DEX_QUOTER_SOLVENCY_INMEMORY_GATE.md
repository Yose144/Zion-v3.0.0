# 4.B6 — ZionDex: QuoterV2/SwapRouter evidence, solvency-guard coverage fix, in-memory AMM production gate

**Date:** 2026-10-31 · **Scope:** `V31/L2/multichain/src/{config,service}.rs`, `swap/dex/swap_executor.rs`, `warp/{config,watcher}.rs`, `bin/warpd.rs`, `warp.example.toml` · **Status:** code + tests done, deploy pending next warpd release

## Audit item resolution

Plan line: *"QuoterV2/SwapRouter v `EvmAdapter`, solvency guard, in-memory
AMM pryč z produkční cesty (nebo swap UI vypnout do hotova)"* — resolved via
the **gate** option (in-memory AMM disabled by default; swap execution for
pairs without an on-chain route fails closed).

**(a) QuoterV2/SwapRouter — verified already present:**
`EvmAdapter::v3_quote` calls `quoteExactInputSingle` with the QuoterV2
struct-encoded signature first, falling back to the legacy flat-args
QuoterV1 signature (`evm.rs`). `EvmAdapter::v3_swap` executes
`exactInputSingle` on SwapRouter02. `SwapExecutor::execute_swap` prefers
this on-chain path for same-chain EVM pairs with a configured V3 pool.

**(b) Solvency guard — real coverage gap fixed:**
`SolvencyGuard` existed and was wired (`with_solvency`, `enforce=true`
default), BUT the pre-flight check read **only the in-memory router quote**
(`router.quote_multi`). For V3-only pairs the in-memory router has no
route → the check silently skipped → on-chain settlement without solvency
verification. Now the pre-flight uses `self.quote()` — the same quote path
the execution uses (in-memory → V3 fallback) — so every settlement path is
checked (`swap_executor.rs` ~line 217).

**(c) In-memory AMM out of production path:**
New `[dex]` config section: `inmemory_amm` (bool, **default `false`**).
Wired: `WarpConfig.dex` ([dex] in warp.toml) → `build_multichain_config` →
`MultichainConfig.dex` → `SwapExecutor::with_inmemory_amm`.

Gated paths when disabled (all fail closed — refund input, order → Failed):
- `SwapExecutor::execute_swap` non-V3 branch (non-EVM / multi-hop)
- `SwapExecutor::execute_swap` V3-`Unsupported` fallback (was silently
  falling back to virtual reserves even for EVM pairs)
- `MultichainService::dex_swap` (admin `/v1/swap/execute`)
- `MultichainService::execute_intent` — solver paths containing a
  non-bridge (same-chain AMM) hop are rejected

Not gated (read-only): `quote()`, `quote_multi`, `/v1/swap/pools`,
intent creation/bidding/settlement bookkeeping.

Dev/test compat: `SwapExecutor::new` keeps `inmemory_amm = true` unless
`.with_inmemory_amm(false)` — existing tests unaffected; `warp.example.toml`
documents `[dex] inmemory_amm = false` explicitly.

## Tests

- `inmemory_amm_disabled_fails_closed` — swap errors `Unsupported`, input
  refunded in full, zero output credit, order Failed
- `inmemory_amm_disabled_still_quotes` — read-only quote unaffected

`cargo test -p zion-multichain --lib` → **814 passed, 0 failed, 4 ignored**
(network-gated). Targeted `config:: + swap::dex` → 36/36.

## Deployment note

Fail-closed additive config: existing warp.toml files without `[dex]`
deserialize to `inmemory_amm=false` — the audit-required state with **no
prod config change needed**. Deploy with the next warpd release. If an
operator environment legitimately needs the virtual-reserves engine
(e.g. internal ledger demo), set `[dex] inmemory_amm = true` explicitly.

Note: with the gate off, `/v1/swap/execute*` on pairs lacking a V3 pool
or solver bridge path returns HTTP 400 `Unsupported` — that IS the audit's
"swap UI vypnout do hotova" outcome for non-settleable pairs.
