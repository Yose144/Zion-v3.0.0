# V31 Pool PPLNS Payout Fix Report

**Date:** 2026-08-10
**Commit:** `458fb5bb9`
**Affected service:** `zion-v31-pool` on Edge (`62.171.141.136` / `vmi3425821.contaboserver.net`)

## Problem

Pool Canonical address `zion1d2k` stopped receiving payouts despite active VEGA mining.

Root causes identified:

1. **PPLNS window size was too small** — systemd service used `--pplns-window-size 10000` while network difficulty was ~25,000, causing every share to be evicted immediately from the window.
2. **Wrong share difficulty recorded** — the pool passed `template.difficulty` (network difficulty) to `record_share_with_diff()` instead of the per-share vardiff target. This further skewed the PPLNS weights.

The combined effect was an empty PPLNS window (`"window": []`, `window_total_difficulty=0`), so `compute_payouts` had no shares to distribute and all block rewards accumulated in the pool wallet.

## Changes

### 1. Pool PPLNS share-difficulty fix

Files changed:

- `V31/L1/pool/src/share.rs`
- `V31/L1/pool/src/pool.rs`
- `V31/L1/pool/src/stratum.rs`

Summary:

- Added `difficulty: u64` to `ShareSubmission`.
- `Pool::record_share` now reads `submission.difficulty` and clamps it to `max(1)`.
- Removed the `difficulty` argument from `submit_zion*()` and `submit_auxpow*()` so callers cannot accidentally pass network difficulty.
- Stratum v1 handler sets `submission.difficulty = ctx.vardiff.current()`.
- V3 TLS handler sets `submission.difficulty = vardiff_config.start_difficulty`.
- V3 plain handler sets `submission.difficulty = vardiff.current()`.
- Unit tests updated to provide `difficulty: 1` and new function signatures.

### 2. PPLNS window size on Edge

Updated `/etc/systemd/system/zion-v31-pool.service` to use `--pplns-window-size 500000000` and restarted the service.

### 3. CLI wallet send

File: `V31/cli/src/main.rs`

- Added `--secret-key-hex` flag to `zion wallet send`.
- When provided, the CLI decodes the raw secret key, derives the sender address from the public key, and signs/spends without requiring a wallet file.

### 4. ANKR API key scrub

Files: `docs/3.0.9/SECURITY_AUDIT_REPORT.md`, `docs/3.0.3/Li.Fi-L2.md`

- Replaced the compromised ANKR API key with placeholders.

## Build and deployment

Cross-compiled `zion-pool` for Linux x86_64 using `zig cc` (Mac arm64 build host) because no `x86_64-linux-gnu-gcc` toolchain was available locally.

```bash
cd V31
CC_x86_64_unknown_linux_gnu=~/.local/bin/zcc-x86_64-linux \
CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER=~/.local/bin/zld-x86_64-linux \
AR_x86_64_unknown_linux_gnu=/usr/bin/ar \
RANLIB_x86_64_unknown_linux_gnu=/usr/bin/ranlib \
cargo build --release -p zion-pool --target x86_64-unknown-linux-gnu
```

Binary deployed to Edge:

```bash
scp -P 2222 target/x86_64-unknown-linux-gnu/release/zion-pool \
  root@62.171.141.136:/opt/zion/V31/target/release/zion-pool.new

ssh -p 2222 root@62.171.141.136 \
  'mv /opt/zion/V31/target/release/zion-pool /opt/zion/V31/target/release/zion-pool.$(date +%Y%m%d%H%M%S).bak && \
   mv /opt/zion/V31/target/release/zion-pool.new /opt/zion/V31/target/release/zion-pool && \
   systemctl restart zion-v31-pool'
```

## Verification

- `systemctl is-active zion-v31-pool` → `active`
- `/miners` API on `http://127.0.0.1:8080/miners` shows `zion1d2k5...vega-smos` connected with:
  - 640 valid shares
  - 7 blocks found
  - hashrate ~803 kH/s
- `pool-pplns.json` updated at 2026-08-10 21:55:13 UTC:
  - `window_len`: 614
  - `window_total_difficulty`: 54,250,000
  - `unpaid`: empty (payout sweep has swept balances)
- `getUtxos` for `zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6` returns **10 UTXOs**, total **48,060.5963 ZION**, confirming payouts are landing on-chain.

## Remaining follow-up

- **ANKR API key rotation:** The compromised key was scrubbed from the repository, but the actual key must still be rotated in the [Ankr dashboard](https://app.ankr.com) and the new key stored in 1Password + `V3/docker/.env` on Edge.
