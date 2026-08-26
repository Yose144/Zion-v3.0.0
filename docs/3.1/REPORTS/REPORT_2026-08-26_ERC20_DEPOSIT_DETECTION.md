# Report: ERC-20 wZION Deposit Detection Fix

**Date:** 2026-08-26  
**Scope:** `V31/L2/multichain` — custodial multichain wallet deposit watcher  
**Status:** Code complete, tested, and release-built. Deployment blocked by Edge SSH access.

## 1. Incident

During E2E multichain wallet workflow testing, a user sent **20 wZION** (Base ERC-20) to the generated Base deposit address:

```
Base deposit address: 0x622ecec722b7f3cce9b8c860f423f7ba0a0f0e86
Test ZIS user:        zion162q8j650u6m6f4x0n2x5l7f7x3878833h3gy3j0
User ID:              (created by /tmp/workflow-test.mjs)
Contract:             0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6
Amount:               20.0 wZION (20_000_000_000_000_000_000 wei)
```

The transaction was confirmed on Base, but `/api/multichain/wallet/me` showed an empty balance. The `DepositWatcher` only watched `BridgeMint` / `BridgeBurn` events on the wZION contract and **did not watch ordinary ERC-20 `Transfer` events** sent to per-user deposit addresses.

## 2. Root Cause

- `EvmAdapter::watch_events()` only filtered for bridge events.
- `EvmAdapter::watch_addresses()` had the default trait implementation returning an empty vector.
- `DepositEvent` did not carry the asset that was actually deposited, so `process_event()` always credited the chain native asset (e.g. `base:ETH`) rather than the correct ERC-20.

## 3. Fix

### 3.1 `DepositEvent` carries the deposited asset

`V31/L2/multichain/src/chain/adapter.rs`:

```rust
pub struct DepositEvent {
    pub chain: ChainId,
    pub tx_hash: Hash,
    pub recipient: Address,
    pub amount: Amount,
    pub memo: Option<String>,
    pub confirmations: u64,
    pub asset: Option<Asset>,
}
```

### 3.2 EVM adapter watches wZION `Transfer` events

`V31/L2/multichain/src/chain/adapters/evm.rs`:

- Added `ERC20_TRANSFER_EVENT_SIG`.
- Added `wzion_asset()` helper that builds the correct `Asset::with_contract(...)`.
- Set `asset` in `decode_burn_log` and `decode_mint_log`.
- Added `decode_erc20_transfer_log()`.
- Implemented `watch_addresses()` for `EvmAdapter`:
  - Scans wZION `Transfer(address,address,uint256)` events.
  - Uses `topic2` with `ValueOrArray::Array(...)` to match all tracked deposit recipients.
  - Scans the last **10 000 blocks** (`tip - 10_000`) so recent deposits are not missed if the service was restarting.
  - Builds `DepositEvent` with the wZION `Asset` attached.

### 3.3 Deposit processing uses event asset

`V31/L2/multichain/src/multichain_wallet/deposits.rs`:

```rust
let asset = event
    .asset
    .clone()
    .unwrap_or_else(|| native_asset_for_chain(chain, &wallet_address));
```

This ensures raw ERC-20 deposits are credited as `base:wZION:0x0c493763...` instead of `base:ETH`.

### 3.4 Other adapters updated

All `DepositEvent { ... }` constructors in the crate were updated to include the new `asset` field:

- `chain/adapters/bitcoin.rs` — `BTC`
- `chain/adapters/zion_l1.rs` — `ZION`
- `bridge/mod.rs` test events — `None`
- `multichain_wallet/deposits.rs` test event — `None`
- `tests/service.rs` test event — `None`

## 4. Verification

- `cargo build -p zion-multichain` ✅
- `cargo test -p zion-multichain` ✅ (583 passed, 0 failed)
- `cargo clippy -p zion-multichain --all-targets` — no new warnings
- Built a static Linux x86_64 release binary:
  ```
  V31/target/x86_64-unknown-linux-musl/release/warpd
  ELF 64-bit LSB pie executable, x86-64, static-pie linked, stripped, 16M
  ```
- Confirmed on-chain that the deposit address holds 20 wZION via `eth_call` to `balanceOf` on `mainnet.base.org`.

## 5. Deployment Blocker

The deployment to the Edge server was blocked because the source IP was refused at the SSH layer:

- IPv6: `2a00:102b:5005:3217:c7b:1aa9:d093:477f` → `Connection reset by peer`
- IPv4: `109.81.24.189` → `Connection closed` / `Connection reset by peer`

Likely cause: `fail2ban` or `ufw` block after the high rate of SSH connections during earlier deploy attempts.

A previous attempt to copy a locally built macOS `warpd` binary to Edge produced `Exec format error`, which left `zion-v31-multichain` unable to start. A correct statically-linked x86_64 Linux `warpd` binary is ready, but cannot be copied without SSH.

## 6. Required Next Steps

### 6.1 Unblock SSH

On the Edge server run:

```bash
# Check which jails are active
fail2ban-client status

# Unban the Devin IPs
fail2ban-client set sshd unbanip 2a00:102b:5005:3217:c7b:1aa9:d093:477f
fail2ban-client set zion-p2p unbanip 2a00:102b:5005:3217:c7b:1aa9:d093:477f
fail2ban-client set sshd unbanip 109.81.24.189
fail2ban-client set zion-p2p unbanip 109.81.24.189

# Or add them to ignoreip and reload
# /etc/fail2ban/jail.local
# ignoreip = ... 2a00:102b:5005:3217:c7b:1aa9:d093:477f 109.81.24.189
fail2ban-client reload
```

### 6.2 Deploy the new binary

```bash
scp V31/target/x86_64-unknown-linux-musl/release/warpd root@[2a02:c207:2342:5821::1]:/opt/zion/V31/target/release/warpd
ssh root@2a02:c207:2342:5821::1 'systemctl restart zion-v31-multichain'
```

### 6.3 Verify deposit crediting

Once the service is running, the `DepositWatcher` will poll and the 20 wZION deposit will be credited. Verify with:

```bash
node /tmp/workflow-test.mjs "base:wZION:0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6"
```

or by calling:

```
POST /api/multichain/wallet/me
```

The balance should appear as:

```json
{
  "asset_key": "base:wZION:0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6",
  "amount": "20000000000000000000"
}
```

### 6.4 Withdrawal / swap gas

The deposit address `0x622e...` currently has **0 ETH**. Any on-chain withdrawal or swap settlement from the deposit address will require Base ETH for gas. Options:

1. User sends 0.0005–0.001 ETH to `0x622ecec722b7f3cce9b8c860f423f7ba0a0f0e86`.
2. The operator funds the deposit address from the multichain hot wallet.
3. Implement an automated sweep mechanism (out of scope for this immediate fix).

## 7. Files Changed

| File | Change |
|------|--------|
| `V31/L2/multichain/src/chain/adapter.rs` | `DepositEvent` gains `asset: Option<Asset>` |
| `V31/L2/multichain/src/chain/adapters/evm.rs` | ERC-20 `Transfer` event watching, `watch_addresses()` implementation, wZION asset handling |
| `V31/L2/multichain/src/multichain_wallet/deposits.rs` | `process_event()` uses event asset, fallbacks to native |
| `V31/L2/multichain/src/chain/adapters/bitcoin.rs` | Set `asset` in `DepositEvent` |
| `V31/L2/multichain/src/chain/adapters/zion_l1.rs` | Set `asset` in `DepositEvent` |
| `V31/L2/multichain/src/bridge/mod.rs` | Test `DepositEvent` constructors updated |
| `V31/L2/multichain/tests/service.rs` | Test `DepositEvent` constructor updated |

---

**Prepared by Devin**  
**Generated:** 2026-08-26
