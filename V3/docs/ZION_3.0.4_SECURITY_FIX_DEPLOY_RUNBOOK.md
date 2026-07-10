# ZION 3.0.4 — Security Fix Deploy Runbook (F1 from-address verification + pool guard)

**Target:** Edge mainnet (`100.76.16.108`)  
**Repository:** `main` branch (`V3/` workspace)  
**Status:** ✅ DEPLOYED (2026-07-02) — F1 fix live on Edge, chain height 22188+  
**Network:** Mainnet  
**Consensus impact:** Hard fork — all nodes must run the new binary before any block with a forged account transaction could be mined.  
**Cross-ref:** [`docs/3.0.4/SecurityFirst.md`](../../docs/3.0.4/SecurityFirst.md) (full post-mortem + Edge hardening) · [`docs/3.0.4/SecurityBackup.md`](../../docs/3.0.4/SecurityBackup.md) (forensic timeline) · [`docs/3.0.4/CRITICAL_3.0.4_SECURITY_FINDINGS.md`](../../docs/3.0.4/CRITICAL_3.0.4_SECURITY_FINDINGS.md) (original findings)

> **DEPLOY RECORD (2026-07-02):**
> - F1 fix deployed as commit `9341344d` — `validate_peer_block()` now calls `verify_signature()` for non-coinbase account TX.
> - Pool wallet SK found and `edge-environment.sh` updated.
> - F1 exploit occurred BEFORE deployment — attacker from `109.81.30.165` injected forged account TX via P2P.
> - Chain rolled back to height 22180. F1 fix deployed immediately after.
> - Post-deploy: 12 services active, chain height 22188+, mining functional.
> - Edge server hardened: UFW, bind addresses (13/18 on 127.0.0.1), AppArmor, monitoring cron jobs.
> - See [`docs/3.0.4/SecurityFirst.md`](../../docs/3.0.4/SecurityFirst.md) for full hardening checklist.

---

## What is being deployed

Two coordinated changes:

1. **L1 peer-block from-address verification** (`V3/L1/core/src/lib.rs`)
   - `ChainState::validate_peer_block()` now calls `verify_signature()` for every non-coinbase account transaction.
   - This closes the gap where a malicious miner could include a forged account transaction (`from` = victim address, signed with an unrelated key) in a mined block and have other nodes accept it.

2. **Pool wallet/key fail-fast guard** (`V3/L1/pool/src/bin/server.rs`)
   - The pool server now aborts startup if `ZION_POOL_PAYOUT_SK_HEX` does not derive to `ZION_POOL_WALLET`.
   - Prevents silent rejection of all account-model payouts after the F1 fix is deployed.

3. **Edge environment update** (`edge-deploy/config/edge-environment.sh`)
   - `ZION_POOL_PAYOUT_SK_HEX` updated to the correct key for `zion16825y2v5f3q507e5c2e0j8n666z43558l3zt604`.

---

## Pre-deploy checklist

- [ ] The L1 peer-block fix is merged to `main`.
- [ ] `cargo test --manifest-path V3/Cargo.toml -p zion-core --lib` passes.
- [ ] New regression test `tests::validate_peer_block_rejects_forged_account_transaction` passes.
- [ ] Pool wallet/key configuration is verified (`derive_address(SK) == wallet`).
- [ ] SSH access to `100.76.16.108` confirmed.
- [ ] All dependent nodes (local backup, any remote peers) are scheduled for the same binary upgrade.
- [ ] Bridge/DAO/atomic-swap watchers are confirmed compatible (no binary change required; they only parse memos).

---

## Build

On the build machine (or directly on Edge):

```bash
cd /root/zion-2.9.6-main   # or wherever the repo is checked out
git pull origin main

# Verify the commit
git log --oneline -1

# Build release binaries
# Note: pool depends on lmdb; on Windows builds may be blocked by AppLocker.
# Build must succeed on Edge (Linux) or a clean Linux environment.
cargo build --release --manifest-path V3/Cargo.toml \
  -p zion-core \
  -p zion-pool \
  -p zion-cli
```

Expected artifacts:

```
V3/target/release/node
V3/target/release/server
V3/target/release/zion
```

---

## Backup

```bash
ssh root@100.76.16.108

# State DB
mkdir -p /root/backups/2026-07-02-security-fix
sudo systemctl stop zion-edge-node1 zion-edge-node2 zion-edge-pool
sudo cp /root/zion-2.9.6-main/V3/data/zion-node-state.db /root/backups/2026-07-02-security-fix/ || true
sudo cp /root/zion-2.9.6-main/V3/data/pool.db /root/backups/2026-07-02-security-fix/ || true

# Configs
sudo cp /root/zion-2.9.6-main/edge-deploy/config/edge-environment.sh /root/backups/2026-07-02-security-fix/
sudo cp /root/zion-2.9.6-main/V3/L2/bridge/config/bridge-mainnet.toml /root/backups/2026-07-02-security-fix/ || true
sudo cp /root/zion-2.9.6-main/V3/L2/dao/config/dao-mainnet.toml /root/backups/2026-07-02-security-fix/ || true
sudo cp /root/zion-2.9.6-main/V3/L2/atomic-swap/config/swap-mainnet.toml /root/backups/2026-07-02-security-fix/ || true
```

---

## Deploy procedure

### 1. Sync code and environment

```bash
cd /root/zion-2.9.6-main

# Pull latest main (or use the commit that contains the fix)
git pull origin main

# Copy the updated environment file
cp edge-deploy/config/edge-environment.sh /root/zion-2.9.6-main/edge-deploy/config/edge-environment.sh

# Verify the pool wallet and key are set correctly
grep -E 'ZION_POOL_WALLET|ZION_POOL_PAYOUT_SK_HEX' edge-deploy/config/edge-environment.sh
```

### 2. Build on Edge

```bash
cd /root/zion-2.9.6-main/V3
. /root/.cargo/env

cargo build --release --manifest-path V3/Cargo.toml \
  -p zion-core \
  -p zion-pool \
  -p zion-cli
```

### 3. Install binaries

```bash
cd /root/zion-2.9.6-main
sudo cp V3/target/release/node /usr/local/bin/zion-core
sudo cp V3/target/release/server /usr/local/bin/zion-pool-server
sudo cp V3/target/release/zion /usr/local/bin/zion
sudo systemctl daemon-reload
```

### 4. Restart in order

Restart node1, node2, then pool. This order ensures the pool starts against an upgraded node.

```bash
ssh root@100.76.16.108

sudo systemctl restart zion-edge-node1
sleep 5

sudo systemctl restart zion-edge-node2
sleep 5

sudo systemctl restart zion-edge-pool
sleep 5

# L2 watchers do not need a restart for this fix, but verify they are healthy
sudo systemctl status zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp
```

### 5. Verify pool startup guard

The pool **must not** print a `CRITICAL` line about `ZION_POOL_PAYOUT_SK_HEX` deriving to a different address.

```bash
journalctl -u zion-edge-pool -n 50 --no-pager
```

Expected: pool starts, prints `payout_execution=enabled`, binds to `0.0.0.0:8444`, and accepts miner connections.

If the pool fails with:

```
ZION_POOL_PAYOUT_SK_HEX derives to <addr> but ZION_POOL_WALLET is <wallet>
```

stop immediately and verify the environment file. Do not mine until the mismatch is resolved.

### 6. Verify nodes

```bash
# Node 1 health
curl -s http://127.0.0.1:8443/health

# Node 2 health
curl -s http://127.0.0.1:8446/health

# Dashboard summary
curl -s -u admin:root http://100.76.16.108:8766/api/health | jq
```

Both nodes should report `chain_height` climbing and no errors.

---

## Post-deploy verification

### 1. Pool payout smoke test

After the next block is found, monitor the pool payout path:

```bash
journalctl -u zion-edge-pool -f --since "10 min ago"
```

Look for:

- `payout_account_model` accepted by the node
- No `account transaction rejected` errors

If a payout is rejected, the pool will log the reason. Common causes:

- Pool wallet/key mismatch (guard should have caught this at startup)
- Insufficient pool wallet balance
- Node still running old binary

### 2. Account-model memo E2E

Run the existing account memo E2E script to confirm account transactions still work end-to-end:

```bash
cd /root/zion-2.9.6-main
./V3/scripts/ops/account-memo-e2e.sh
```

### 3. Watcher E2E

Verify bridge, DAO, and atomic-swap watchers still detect account-model memos:

```bash
# Bridge
curl -s http://127.0.0.1:8451/health

# DAO
curl -s http://127.0.0.1:8450/health

# Atomic swap
curl -s http://127.0.0.1:8452/health
```

---

## Rollback

If the pool fails to start or payouts are rejected after the fix:

```bash
ssh root@100.76.16.108

# Stop pool and nodes
sudo systemctl stop zion-edge-pool zion-edge-node2 zion-edge-node1

# Restore previous binaries from the backup taken in this runbook
# or checkout the previous commit and rebuild
sudo cp /root/backups/2026-07-02-security-fix/edge-environment.sh /root/zion-2.9.6-main/edge-deploy/config/edge-environment.sh

# Start again
sudo systemctl start zion-edge-node1
sleep 5
sudo systemctl start zion-edge-node2
sleep 5
sudo systemctl start zion-edge-pool
```

**Important:** because the F1 fix is a hard fork, rolling back the nodes after a new block has been accepted by the upgraded nodes could cause a chain split if the rolled-back nodes accept a forged block the upgraded nodes reject. Coordinate rollback carefully and prefer a forward fix if the network has already advanced.

---

## Post-deploy docs update

✅ **Completed (2026-07-02):**

1. ✅ `StatusV3.md` — updated with security hardening summary (Phase 2)
2. ✅ `ROADMAP.md` — security hardening section added
3. ✅ `AGENTS.md` — SecurityFirst.md reference added
4. ✅ `docs/3.0.4/SecurityFirst.md` — full post-mortem + Edge hardening checklist
5. ✅ `docs/3.0.4/SecurityBackup.md` — forensic timeline + rollback record
6. ✅ `docs/3.0.4/CRITICAL_3.0.4_SECURITY_FINDINGS.md` — status updated to RESOLVED
7. ✅ `V3/docs/SECURITY_CHECKLIST.md` — F1 post-mortem + Edge hardening sections added
8. ✅ `docs/3.0.4/PATCH_L2_SECURITY_2026-07-02.md` — Edge server status section added

---

## Open decisions not resolved by this runbook

- **H1 bridge addresses** — Base vs non-Base bridge contract addresses remain a separate owner decision. See `audit 3.0.4.md` §7.1 and `ROADMAP.md` D1.
