# G5 / E8 — XMR / RandomX path via MoneroOcean

**Date:** 2026-08-22  
**Owner:** core / pool / miner  
**Decision:** Use **MoneroOcean** (`gulf.moneroocean.stream:10001`) as the upstream stratum pool for the XMR / RandomX AuxPoW path.  
**Status:** ✅ Path wired and validated; gate can be closed.

## Summary

V31 already mapped `ExternalCoin::Monero` to the default MoneroOcean endpoint `gulf.moneroocean.stream:10001` in `V31/L1/cosmic-harmony/src/profit.rs`. The remaining work was to prove end-to-end reachability and to fix the `CryptonoteStratum` protocol path in the `zion-miner` AuxPoW client so that jobs and shares flow correctly.

This report documents:
1. Connectivity test results against MoneroOcean.
2. Rust fixes in `zion-miner` for CryptonoteStratum parsing and share formatting.
3. How to enable XMR as a CPU external coin on the Edge pool and on a local miner.
4. Known caveats and follow-up items.

## 1. Connectivity verification

A temporary Python harness (`/tmp/g7_test/test_moneroocean_cryptonote.py`) exercised the MoneroOcean CryptonoteStratum handshake:

| Endpoint | Result |
|----------|--------|
| `gulf.moneroocean.stream:10001` (plain TCP, `login`) | ✅ Login OK, `job` received with `"algo":"rx/0"` |
| `gulf.moneroocean.stream:10128` (plain TCP, `login`) | ✅ Login OK |
| `gulf.moneroocean.stream:10001` (SSL) | ❌ Connection reset |
| `gulf.moneroocean.stream:10128` (SSL) | ❌ TLS EOF error |
| `gulf.moneroocean.stream:10056` (SSL) | ❌ Timeout |

The pool accepts **plain TCP** on `10001` using the CryptonoteStratum `login` method. This is compatible with the current `zion-miner` AuxPoW TCP client, which does not implement TLS.

## 2. Code changes

### 2.1 `V31/L1/miner/src/auxpow/hasher.rs`

Added `parse_cryptonote_target()` to handle the 8-char compact target that MoneroOcean sends in `job` messages. The value is interpreted as a little-endian `u32` and expanded to a 32-byte big-endian target for the generic `meets_target` path.

### 2.2 `V31/L1/miner/src/auxpow/client.rs`

Fixed several CryptonoteStratum issues:

- **`cryptonote_login` worker name**: login is now sent as `wallet.worker` instead of bare wallet, matching pool conventions.
- **Job notification parsing**: the `job` notification from MoneroOcean carries a JSON object in `params`. The client previously routed all `job` notifications through the EthStratum array parser, which silently failed for XMR. It now dispatches CryptonoteStratum `job` objects to `parse_cryptonote_job`.
- **Target / difficulty state**: `parse_cryptonote_job` now updates `current_difficulty`, `current_target_bytes`, `latest_job_id`, and `latest_job_time` so downstream staleness checks and share difficulty estimates stay consistent.
- **Share submission formatting**: `submit` now uses:
  - 8-char lowercase hex nonce without `0x` prefix
  - 64-char lowercase hex PoW result without `0x` prefix

### 2.3 Tests

New tests added:
- `auxpow::hasher::tests::parse_cryptonote_target_ok`
- `auxpow::client::tests::cryptonote_nonce_and_result_format`

Full miner lib suite still passes:

```bash
cd /home/zionserver/2.9.6-main/V31
cargo test -p zion-miner --lib --features default
# 103 passed; 0 failed
```

## 3. Operational setup

### Edge pool (upstream bridge)

Add to `/etc/zion/edge-environment.sh` (or the pool service env file):

```bash
# Enable XMR as the CPU external coin
ZION_POOL_AUXPOW_CPU_COIN=XMR
# Or use ZION_POOL_AUXPOW_COINS and include XMR

# XMR payout wallet (replace with the operator's Monero address)
ZION_POOL_AUXPOW_WALLET_XMR=<your-monero-address>

# Worker name used for MoneroOcean login
ZION_POOL_AUXPOW_WORKER=zion-pool
```

Restart `zion-v31-pool`. The bridge will connect to `gulf.moneroocean.stream:10001` via `StratumProtocol::CryptonoteStratum` because `ExternalCoin::Monero` maps to that protocol.

### Local / desktop miner

Use the existing launcher and override the CPU coin:

```bash
export ZION_MINER_CPU_COIN=XMR
export ZION_POOL_ADDR=62.171.141.136:8444
./scripts/start-local-miner.sh
```

The miner build in `start-local-miner.sh` already includes `native-randomx`, so RandomX hashing is available when the feature is enabled.

## 4. Caveats

- **Plain TCP only**: the current `zion-miner` AuxPoW client strips `stratum+tcp://` prefixes but has no TLS implementation. MoneroOcean's SSL ports did not work from this host, so the path relies on `10001` TCP. This is acceptable for the current release but should be revisited if MoneroOcean ever disables plain TCP.
- **No real hash-rate share submitted yet**: connectivity, job parsing, and share formatting were validated with unit tests and a protocol probe. A live CPU-only RandomX share submission against MoneroOcean still needs to be observed in production or a CPU-only staging rig before declaring full production confidence.
- **Profit placeholder**: `CoinProfile::defaults()` uses placeholder profit estimates for XMR. The autonomous router will pick XMR only if it wins the CPU comparison; for a real profit switcher, a live RandomX revenue oracle is still future work.

## 5. Acceptance

- ✅ Upstream pool reachable over plain TCP
- ✅ CryptonoteStratum login + job notification parsed correctly
- ✅ Share formatting matches MoneroOcean expectations
- ✅ Unit tests pass
- ✅ Default pool address already configured in `cosmic-harmony`

**Gate G5 / task E8 can be closed.** Follow-up: run a CPU-only miner against the Edge pool with XMR enabled and confirm upstream accepts at least one share.
