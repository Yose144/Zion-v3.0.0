# H5 — AuxPoW E2E test script

**Date:** 2026-08-22  
**Owner:** core / pool / miner / QA  
**Status:** ✅ Test script created and validated locally.

## Summary

H5 demanded an end-to-end harness for the AuxPoW share path: a local mock upstream, the `zion-pool` bridge, and a CPU-only `zion-miner` in V3 Trinity mode must together demonstrate at least one share flowing **miner → pool → upstream**.

A new Python harness, [`scripts/ops/auxpow_e2e_test.py`](../../../scripts/ops/auxpow_e2e_test.py), was created. It implements a minimal CryptonoteStratum/RandomX mock upstream, starts `zion-pool` with per-coin upstream overrides, and starts `zion-miner` with only Stream 3 (CPU external) enabled. The first successful run observed one share forwarded to the mock upstream with the expected `id`, `job_id`, `nonce`, and `result` fields.

## Test harness

### What it does

1. Picks three free TCP ports.
2. Starts `MockUpstreamCryptonote` on one port. The mock replies to `login` with a session + job, then accepts `submit` messages.
3. Starts `zion-pool` with:
   - `ZION_POOL_AUXPOW_COINS=XMR`
   - `ZION_POOL_AUXPOW_WALLET_XMR=<monero-address>`
   - `ZION_POOL_AUXPOW_POOL_XMR=127.0.0.1:<upstream_port>` (per-coin upstream override)
   - `ZION_POOL_AUXPOW_WORKER=auxpow-e2e`
4. Waits for the pool API to be listening.
5. Starts `zion-miner` in CPU-only, V3 Trinity mode with only the CPU external stream enabled (`ZION_STREAM3_ENABLED=1`, `ZION_STREAM1_ENABLED=0`, `ZION_STREAM2_ENABLED=0`) and `ZION_MINER_CPU_COIN=XMR`.
6. Polls the mock upstream until at least one `submit` message is recorded or the timeout expires.
7. Terminates the miner, pool, and mock server, preserving all logs under `/tmp/auxpow_e2e_<id>/`.

### How to run

```bash
cd /home/zionserver/2.9.6-main
# Build the required binaries
cargo build --release -p zion-pool -p zion-miner --features zion-miner/native-randomx

# Run the harness
python3 scripts/ops/auxpow_e2e_test.py --timeout 180
```

The script assumes a V31 `zion-node` RPC is available at `http://127.0.0.1:8446` so the pool can fetch block templates. Override with `--l1-rpc` if needed.

## Results

Local run on 2026-08-22:

```text
[e2e] shares received from upstream mock: 1
[e2e] PASS: AuxPoW share bridged miner → pool → upstream
[e2e] share: {'id': 'session1', 'job_id': 'job1', 'nonce': '00000000', 'result': '0000000000000000...<64 hex chars>...0'}
```

The pool log shows the share was validated and forwarded; the upstream mock received a correctly formatted CryptonoteStratum `submit` message.

## Supporting code changes

- `V31/L1/cosmic-harmony/src/profit.rs`: added `CoinProfile::with_pool_address()` so a per-coin stratum URL can be injected cleanly.
- `V31/L1/pool/src/auxpow_runtime.rs`: reads `ZION_POOL_AUXPOW_POOL_<COIN>` to override the default upstream pool URL for a specific coin.
- `scripts/ops/auxpow_e2e_test.py`: the harness itself.

## Caveats

- **Mock blob is all-zero**: the harness uses a 152-character all-zero RandomX blob and `target=ffffffff`. This makes every hash a valid share and validates the protocol bridge, but it does **not** exercise real RandomX PoW against a valid Monero block template.
- **No real RandomX production share yet**: a live MoneroOcean share with `native-randomx` enabled still needs to be observed before full production confidence.
- **Plain TCP only**: the current AuxPoW client has no TLS support; the harness uses plain TCP, consistent with the operational path selected for G5/E8.
- **Miner result channel warning**: during the run the miner sometimes logs `V3 pool: external result channel closed`. This is a pre-existing per-coin dispatch quirk (the client has dedicated result channels only for VRSC and ZANO) and did not prevent the share from being forwarded. It can be cleaned up later but is not a 3.2 blocker.

## Acceptance

- ✅ Stand-alone Python harness exists under `scripts/ops/`.
- ✅ It starts mock upstream, local pool, and CPU-only miner automatically.
- ✅ It confirms at least one AuxPoW share reaches the upstream mock.
- ✅ Logs are preserved for post-run debugging.
- ✅ Tests for changed crates pass (`zion-cosmic-harmony`, `zion-pool`).

**Task H5 can be closed.**
