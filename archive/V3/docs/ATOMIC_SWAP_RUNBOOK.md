# ZION Atomic Swap Runbook

**Created:** 2026-06-29
**Updated:** 2026-07-01
**Status:** ✅ Escrow funded + E2E tested + account-model memo support (3.0.4)
**Target:** ZION L1 ↔ Base (EVM) cross-chain HTLC swaps

---

## Overview

ZION Atomic Swap enables trustless cross-chain swaps between ZION L1 and EVM chains (Base).
The daemon watches L1 blocks for HTLC memo transactions, manages an escrow account, and
coordinates with an EVM contract for the counterparty side.

### Architecture

```
Alice (ZION L1)                    Bob (Base EVM)
    │                                  │
    │  1. Generate preimage + hash     │
    │  2. LOCK TX → escrow             │
    │     memo: SWAP:LOCK:<H>:<T>:<chain>:<addr>
    │                                  │
    │  3. Bob sees lock on EVM         │
    │  4. Bob claims on EVM with preimage
    │  5. CLAIM TX → escrow            │
    │     memo: SWAP:CLAIM:<H>:<P>     │
    │                                  │
    │  6. Daemon verifies preimage     │
    │  7. Releases ZION to Bob's L1 addr
    │                                  │
    │  OR (timeout)                    │
    │  8. REFUND TX → escrow           │
    │     memo: SWAP:REFUND:<H>        │
    │  9. Daemon refunds Alice         │
```

### Memo Formats

| Type | Format | Example |
|------|--------|---------|
| LOCK | `SWAP:LOCK:<hash_hex>:<timeout_min>:<chain>:<counterparty_addr>` | `SWAP:LOCK:a1b2c3...:120:base:0xAbc123` |
| CLAIM | `SWAP:CLAIM:<hash_hex>:<preimage_hex>` | `SWAP:CLAIM:a1b2c3...:d4e5f6...` |
| REFUND | `SWAP:REFUND:<hash_hex>` | `SWAP:REFUND:a1b2c3...` |

- `<hash_hex>`: 64-char hex (SHA-256 of 32-byte preimage)
- `<preimage_hex>`: 64-char hex (32 random bytes)
- `<timeout_min>`: lock timeout in minutes (120 = 2 hours)
- `<chain>`: counterparty chain identifier (`base`, `btc`, `sol`)
- `<counterparty_addr>`: counterparty's address on destination chain

---

## Deployment Status (2026-06-29)

### Escrow

| Item | Value |
|------|-------|
| Escrow address | `zion1y0j484d5e8r49785d253e8w0c2x4t3n792m5724` |
| Escrow balance | 100,000 ZION (funded 2026-06-29) |
| Escrow key | `ZION_SWAP_ESCROW_KEY` env var in `secrets.conf` |
| Public key | `206f2e9b1f3b941928e23d18a5e4b4f26c6496d03ac39a15fc5bd41e7d0fa860` |

### Daemon

| Item | Value |
|------|-------|
| Service | `zion-edge-atomic-swap.service` |
| API bind | `0.0.0.0:8452` |
| Binary | `/usr/local/bin/zion-atomic-swap` |
| Config | `/root/zion-2.9.6-main/V3/L2/atomic-swap/config/swap-mainnet.toml` |
| Database | `/root/zion-2.9.6-main/V3/data/atomic-swap.db` |
| L1 RPC | `http://127.0.0.1:8443` |
| EVM contract | `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` (Base Mainnet) |
| Bearer token | `ZION_SWAP_BEARER_TOKEN` env var in `secrets.conf` |

### Config bounds

```toml
[swap]
min_lock_flowers  = 1_000_000             # 1 ZION minimum
max_lock_atomic   = 100_000_000_000       # 100,000 ZION maximum
release_fee_atomic = 10_000               # flat fee per release (0.01 ZION)

[refund]
auto_refund        = true
check_interval_secs = 30
grace_period_secs   = 300                 # 5 min grace before auto-refund
```

---

## API Endpoints

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/swap/escrow-address` | Returns escrow `zion1...` address |
| GET | `/swap/:hash` | HTLC status by hashlock |
| GET | `/swap/pending` | List pending HTLCs |

### Protected (bearer token)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/swap/claim` | Manual claim (body: `{hash, preimage, recipient}`) |
| POST | `/swap/refund` | Manual refund (body: `{hash}`) |

---

## E2E Test Results (2026-06-29)

| Test | Stav | Detail |
|------|------|--------|
| Escrow funding | ✅ | 100,000 ZION sent from Aloha wallet |
| LOCK TX | ✅ | 1 ZION, memo `SWAP:LOCK:<hash>:120:base:0xTest` — accepted to chain |
| CLAIM TX | ✅ | memo `SWAP:CLAIM:<hash>:<preimage>` — accepted to chain |
| Daemon | ✅ | API :8452 healthy, L1 watcher scanning blocks |
| EVM watcher | ✅ | Watching `0x3DE9...` for Locked/Claimed/Refunded events |

### Account-Model Memo Support (3.0.4)

The atomic swap watcher now scans both `utxo_transactions` and `account_transactions`.
Account-model transactions sent to the escrow address with `SWAP:LOCK/CLAIM/REFUND` memos
are detected and processed the same way as UTXO outputs.

Implementation:
- `L1Block` in `V3/L2/atomic-swap/src/types.rs` includes `account_transactions: Vec<L1AccountTransaction>`.
- `watcher.rs` iterates both UTXO outputs and account transactions, with deduplication by `tx_id`.
- Same pattern applied to the bridge and DAO L1 watchers.

---

## Operational Commands

### Check daemon status

```bash
ssh root@100.76.16.108
systemctl status zion-edge-atomic-swap.service
journalctl -u zion-edge-atomic-swap.service -n 50 --no-pager
```

### Check escrow balance

```bash
# Via RPC
echo '{"jsonrpc":"2.0","id":1,"method":"getAddressInfo","params":{"address":"zion1y0j484d5e8r49785d253e8w0c2x4t3n792m5724"}}' | nc 100.76.16.108 8443

# Via swap API
curl http://100.76.16.108:8452/swap/escrow-address
curl http://100.76.16.108:8452/swap/pending
```

### Restart daemon

```bash
ssh root@100.76.16.108
systemctl restart zion-edge-atomic-swap.service
```

### Check HTLC status

```bash
curl http://100.76.16.108:8452/swap/<hash_hex>
```

---

## E2E Test Script

See: `APP&WEB/desktop-agent/atomic-swap-e2e.js` (create ad-hoc or use desktop-agent wallet UI)

Manual E2E flow:
1. Generate random 32-byte preimage → SHA-256 → hashlock
2. Send LOCK TX (1 ZION to escrow, memo `SWAP:LOCK:<hash>:120:base:0xTest`)
3. Wait ~30s for daemon detection
4. Send CLAIM TX (memo `SWAP:CLAIM:<hash>:<preimage>`)
5. Check final HTLC status via API

```bash
# Requires SSH tunnel: ssh -L 8452:127.0.0.1:8452 root@100.76.16.108 -N
curl http://127.0.0.1:8452/swap/<hash_hex>
```

---

## Security Notes

- **Escrow key:** Stored in `secrets.conf` drop-in (not in config file or git)
- **Bearer token:** Required for claim/refund API endpoints
- **Auto-refund:** Enabled with 5-min grace period (allows late claims)
- **Bounds:** Min 1 ZION, max 100,000 ZION per lock
- **Timelock:** 120 min default (configurable per-lock in memo)
