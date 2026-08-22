# L2 Multichain E2E Smoke Test Report — 2026-08-22

## Summary

Local end-to-end smoke test of the unified `zion-multichain` (`warpd`) binary
was performed against a fresh SQLite database and a local ZION L1 node on
`127.0.0.1:9445`.  The goal was to exercise the WARP bridge, ZionDex quote /
intent / bid / settlement flow, and atomic-swap HTLC API end-to-end without
external mainnet RPC credentials.

**Overall result:** WARP health / chains / heights are green, DEX quote and
synthetic bridge execution are green, intent auction (create / bid / settle) is
green, HTLC `lock` works in offline-fallback mode.  Intent `execute` and HTLC
`claim` / `refund` require real chain signing keys or a configured mock adapter
and therefore returned `400 Bad Request` in this local-only run.

## Environment

| Component | Value |
|-----------|-------|
| Binary | `V31/L2/multichain/src/bin/warpd.rs` (`zion-multichain` package) |
| Build command | `cargo build --release -p zion-multichain --bin warpd` |
| Config | `warp.example.toml` copied to `warp.toml` |
| Enabled chains | `base` (EVM pilot), `zion-l1` |
| Disabled chains | All non-EVM chains with explicit `disabled_reason` |
| L1 RPC | `http://127.0.0.1:9445` (local ZION V31 node) |
| WARP API port | `9333` |
| DEX / multichain API port | `9334` (`listen_port + 1`) |

## Build and startup

```bash
cp V31/L2/multichain/warp.example.toml warp.toml
cargo build --release -p zion-multichain --bin warpd
./target/release/warpd --config warp.toml
```

Server started successfully.  Startup logs confirmed:

- L1 adapter registered for `zion-l1`.
- Base EVM adapter initialized against `https://mainnet.base.org`.
- Database `data/warp_multichain.db` created fresh.
- DEX API listening on `0.0.0.0:9334`.
- WARP API listening on `0.0.0.0:9333`.

## Test results

### 1. Health and chain discovery

| Endpoint | Result | Notes |
|----------|--------|-------|
| `GET /health` | `200 OK` | `{"base":true,"zion-l1":true}` |
| `GET /v1/multichain/health` | `200 OK` | `{"base":true,"zion-l1":true}` |
| `GET /v1/multichain/chains` | `200 OK` | `{"chains":[{"base",...},{"zion-l1",...}]}`; disabled chains omitted from runtime registry |
| `GET /v1/multichain/height` | `200 OK` | `{"base":50311392,"zion-l1":12851}` |
| `GET /v1/multichain/contracts` | `200 OK` | wZION and bridge placeholders present for base/zion-l1 |

### 2. DEX quote / execute

| Endpoint | Result | Notes |
|----------|--------|-------|
| `GET /v1/swap/pools` | `200 OK` | `[]` (empty pool list) |
| `POST /v1/swap/quote` | `200 OK` | Base ZION → Zion L1, `expected_out: 498500000` for `1e18` input |
| `POST /v1/swap/quote/multi` | `200 OK` | Multi-route quote with a single synthetic bridge edge |
| `POST /v1/swap/execute` | `200 OK` | `out: 498500000` via synthetic bridge |

Quote request used the canonical wZION contract address
`0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` and the `zion1test` recipient.

### 3. Intent lifecycle

| Step | Endpoint | Result | Notes |
|------|----------|--------|-------|
| Create intent | `POST /v1/swap/intent` | `200 OK` | `intent_id: 50c9fe6c-da83-412f-a6d3-9ab6063eb871` |
| Register solver | `POST /v1/swap/intent/solver/register` | `200 OK` | `{"registered":true}` (solver must be whitelisted before bidding) |
| Submit bid | `POST /v1/swap/intent/:id/bid` | `200 OK` | `{"accepted":true}` with a bridge `PathHop` |
| Settle | `POST /v1/swap/intent/:id/settle` | `200 OK` | Returned the winning `SolverBid` |
| Execute | `POST /v1/swap/intent/:id/execute` | `400 Bad Request` | `Executor` requires a non-empty path and real outbound execution on the bridge; local keyring has no funded EVM validator wallet, so the bridge `submit` fails |

The first intent (`6020...`) failed to accept bids until the solver registry
endpoint was discovered at `/v1/swap/intent/solver/register` rather than the
guessed `/v1/swap/solver/register`.  After registration the bid was accepted
and the intent moved to `settled`.

### 4. WARP bridge submit

| Endpoint | Result | Notes |
|----------|--------|-------|
| `POST /v1/bridge/submit` (burn base → zion-l1) | `200 OK` | `{"transfer_id":"...","hash":"...","status":"completed"}` |

The transfer completed immediately because no real deposit/burn event was
required in this local configuration; the bridge used the placeholder path and
returned a synthetic hash.  This is expected behaviour for an unsynced / test
WARP node without validator keys.

### 5. Atomic swap (HTLC)

| Step | Endpoint | Result | Notes |
|------|----------|--------|-------|
| Lock (base → zion-l1) | `POST /v1/multichain/swaps/htlc/lock` | `400 Bad Request` | EVM `ChainAdapter::execute_outbound` only supports `LockMint` / `BurnRelease`, not `Htlc` |
| Lock (bitcoin → zion-l1) | `POST /v1/multichain/swaps/htlc/lock` | `200 OK` | Bitcoin adapter not in registry, so `HtlcSwap` fell back to a synthetic lock hash |
| Get record | `GET /v1/multichain/swaps/htlc/:hash` | `200 OK` | Record returned with `state: pending` |
| Claim | `POST /v1/multichain/swaps/htlc/claim` | `400 Bad Request` | Target `zion-l1` adapter rejects `Htlc` direction |
| Refund | `POST /v1/multichain/swaps/htlc/refund` | `400 Bad Request` | Same reason: target adapter does not implement HTLC |

HTLC `lock` succeeds when the source chain has no registered adapter (offline
fallback).  `claim` and `refund` fail because the only registered adapters
(`base`, `zion-l1`) do not implement `execute_outbound` for `TransferDirection::Htlc`.

## Issues found

1. **EVM adapter lacks HTLC support**
   - `V31/L2/multichain/src/chain/adapters/evm.rs` `execute_outbound` matches only
     `LockMint` and `BurnRelease`.  It should either implement an HTLC lock
     contract call or return `Unsupported` and let `HtlcSwap` use the offline
     fallback for all directions.

2. **Zion L1 adapter lacks HTLC support**
   - `V31/L2/multichain/src/chain/adapters/zion_l1.rs` `execute_outbound` only
     handles `BurnRelease`.  HTLC claim / refund to `zion-l1` therefore cannot
     be executed.

3. **Intent execution fails on cross-chain bridge hops**
   - `V31/L2/multichain/src/swap/dex/executor.rs` calls `Bridge::submit` for
     `is_bridge = true` hops.  `Bridge::burn_release` then tries to call
     `target.execute_outbound`, which on `zion-l1` works only for `BurnRelease`
     and requires an EVM validator proof signed by the keyring.  The local
     keyring is randomly generated and not a validator, so the call fails.

4. **Solver registration endpoint is not obvious from the code comments**
   - The correct path is `POST /v1/swap/intent/solver/register` (not
     `/v1/swap/solver/register`).  This should be documented in the DEX API
     docs or `warp.example.toml`.

## Recommendations

- For local E2E, add a `MockChainAdapter` that registers for a test chain and
  accepts all `TransferDirection`s, returning deterministic synthetic hashes.
  This would let `claim` / `refund` / `execute_intent` return `200 OK` in CI.
- Extend `HtlcSwap` to gracefully fall back to offline mode when the target
  adapter returns `MultichainError::Unsupported`, not only when the adapter is
  missing.
- Document the DEX and WARP HTTP surface in a single OpenAPI / markdown file
  under `docs/3.1/`.

## Verification commands

All commands were run manually with `curl`.  Example transcript:

```bash
# Health
curl -s http://127.0.0.1:9333/health

# Chains
curl -s http://127.0.0.1:9334/v1/multichain/chains

# Quote
curl -s -X POST http://127.0.0.1:9334/v1/swap/quote \
  -H 'Content-Type: application/json' \
  -d '{"from_chain":"base","from_ticker":"ZION","from_contract":"0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6","to_chain":"zion-l1","to_ticker":"ZION","amount_in":1000000000000000000}'

# Bridge submit (burn base → zion-l1)
curl -s -X POST http://127.0.0.1:9334/v1/bridge/submit \
  -H 'Content-Type: application/json' \
  -d '{"from":"base","to":"zion-l1","direction":"burn","amount":1000000,"source_address":"0x...","target_address":"zion1..."}'
```

## Commit reference

- `7dfd279f0` — `fix(desktop-agent): align UTXO builder and wallet send with V31 native transaction format`

## Next steps

- Add mock adapter for full L2 CI.
- Implement HTLC in EVM and Zion L1 adapters or add offline fallback for
  unsupported directions.
- Re-run E2E after `WARP_EVM_RELAY_KEY` and a funded validator wallet are
  configured for real Base wZION burn/mint events.

---

*Report generated by Devin during the 3.2.0 "One Love" Mainnet Stable prep.*
