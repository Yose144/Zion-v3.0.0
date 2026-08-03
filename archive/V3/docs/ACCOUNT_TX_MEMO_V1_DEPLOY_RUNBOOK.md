# ZION 3.0.4 — Account-Model Memo v1 Hard Fork Deploy Runbook

**Target:** Edge mainnet (`62.171.141.136`, `ssh zion-new`)
**Deploy commits:** `db137efc` (account-model memo) + `f687d8ac` (runtime-configurable height)
**Activation height:** `0` (active from genesis on fresh chain post 3.0.4 hard reset; no env override needed)
**Status:** Deployed — code complete, memo v1 active from genesis. L2 watcher operationalizace in 3.0.5.
**Network:** Mainnet
**Repository:** `main` branch (`V3/` workspace)

---

## What is being deployed

Account-model transactions can now carry an optional `memo` field (≤256 bytes, ASCII only). The memo is included in the signed transaction ID once the activation height is reached. L2 watchers (bridge, DAO, atomic-swap) scan both `utxo_transactions` and `account_transactions` for protocol memos (`BRIDGE:`, `DAO:`, `SWAP:`, `WARP:`).

This is a **coordinated consensus upgrade**: every node, pool, and L2 watcher must run the same binary version before the activation height. Sending a memo transaction before the activation height will result in an invalid signature on nodes that have not yet upgraded.

---

## Edge contract snapshot (from https://zionterranova.com/defi)

| Contract | Base Mainnet address |
|----------|----------------------|
| wZION | `0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6` |
| ZIONBridge | `0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467` |
| CCA Auction | `0x4eD4Eb…1f93` (check /defi for full address) |
| PancakeSwap V3 pool | `0x46cc…6f47` (wZION/USDT, 0.25%) |

Bridge contract addresses on non-Base chains remain an open owner decision (see `ROADMAP.md` D1). This runbook focuses on the L1/L2 upgrade.

---

## Pre-deploy checklist

- [ ] All PRs for the memo feature are merged to `main`.
- [ ] `cargo test --manifest-path V3/Cargo.toml --workspace` passes on the deploy commit.
- [ ] Choose an activation height `H` such that all operators can restart before `H`.
- [ ] Announce `H` in operator channels / Discord.
- [ ] SSH access to `62.171.141.136` (`ssh zion-new`) confirmed.
- [ ] `secrets.conf` and `bridge-mainnet.toml`, `dao-mainnet.toml`, `swap-mainnet.toml` backups available.

---

## Build

On the build machine (or directly on Edge):

```bash
cd /root/zion-2.9.6-main   # or wherever the repo is checked out
git pull origin main

# Verify the commit
git log --oneline -1

# Build release binaries for the services that need the upgrade
cargo build --release --manifest-path V3/Cargo.toml \
  -p zion-core \
  -p zion-pool \
  -p zion-bridge \
  -p zion-dao \
  -p zion-atomic-swap \
  -p zion-cli \
  -p zion-sdk   # SDK is linked into any tools that rebuild
```

Expected artifacts:

```
V3/target/release/node
V3/target/release/server
V3/target/release/zion-bridge
V3/target/release/zion-dao
V3/target/release/zion-atomic-swap
V3/target/release/zion
```

---

## Set the activation height

The activation height is set at runtime via the `ZION_ACCOUNT_TX_MEMO_V1_HEIGHT` environment variable. It must be set for **every** service that builds or validates account transactions:

- `zion-core` node
- `zion-pool` server
- `zion-cli` (when sending account transactions)
- `zion-sdk` clients (desktop agent, mobile app, web wallet)

Do **not** set it on the bridge/DAO/atomic-swap watchers; they only parse memos and do not sign transactions.

Example for Edge services in `/etc/systemd/system/zion-edge-core.service` (or drop-in `/etc/systemd/system/zion-edge-core.service.d/override.conf`):

```ini
[Service]
# Fresh chain post-3.0.4 hard reset: active from genesis (0).
# For a coordinated hard fork on an existing chain, set to a future height.
Environment="ZION_ACCOUNT_TX_MEMO_V1_HEIGHT=0"
```

For the pool service, add the same variable to its environment file (e.g., `/etc/default/zion-edge-pool` or the systemd unit).

---

## Deploy procedure

### 1. Backup

```bash
ssh zion-new

# State DB
sudo systemctl stop zion-edge-core.service
mkdir -p /root/backups/2026-07-01-memo-hf
sudo cp /root/zion-2.9.6-main/V3/data/zion-node-state.db /root/backups/2026-07-01-memo-hf/
sudo cp /root/zion-2.9.6-main/V3/data/pool.db /root/backups/2026-07-01-memo-hf/
sudo cp /root/zion-2.9.6-main/V3/data/bridge.db /root/backups/2026-07-01-memo-hf/
sudo cp /root/zion-2.9.6-main/V3/data/dao.db /root/backups/2026-07-01-memo-hf/
sudo cp /root/zion-2.9.6-main/V3/data/atomic-swap.db /root/backups/2026-07-01-memo-hf/

# Configs
sudo cp /root/zion-2.9.6-main/V3/L2/bridge/config/bridge-mainnet.toml /root/backups/2026-07-01-memo-hf/
sudo cp /root/zion-2.9.6-main/V3/L2/dao/config/dao-mainnet.toml /root/backups/2026-07-01-memo-hf/
sudo cp /root/zion-2.9.6-main/V3/L2/atomic-swap/config/swap-mainnet.toml /root/backups/2026-07-01-memo-hf/
```

### 2. Install binaries

```bash
cd /root/zion-2.9.6-main
sudo cp V3/target/release/node /usr/local/bin/zion-core
sudo cp V3/target/release/server /usr/local/bin/zion-pool
sudo cp V3/target/release/zion-bridge /usr/local/bin/zion-bridge
sudo cp V3/target/release/zion-dao /usr/local/bin/zion-dao
sudo cp V3/target/release/zion-atomic-swap /usr/local/bin/zion-atomic-swap
sudo cp V3/target/release/zion /usr/local/bin/zion
```

### 3. Update environment and restart

```bash
sudo systemctl daemon-reload
sudo systemctl restart zion-edge-core.service
sudo systemctl restart zion-edge-pool.service
sudo systemctl restart zion-edge-bridge.service
sudo systemctl restart zion-edge-dao.service
sudo systemctl restart zion-edge-atomic-swap.service
```

### 4. Verify

```bash
# Node is running and on the right height
curl -s -X POST http://127.0.0.1:8443 \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getChainInfo","params":{}}' | jq

# Look for: protocol_version includes 3.0.4 memo, chain_height climbing

# L2 services health
sudo systemctl status zion-edge-core.service
sudo systemctl status zion-edge-pool.service
sudo systemctl status zion-edge-bridge.service
sudo systemctl status zion-edge-dao.service
sudo systemctl status zion-edge-atomic-swap.service

# Watcher logs
journalctl -u zion-edge-bridge.service -n 50 --no-pager
journalctl -u zion-edge-dao.service -n 50 --no-pager
journalctl -u zion-edge-atomic-swap.service -n 50 --no-pager
```

### 5. Wait for activation height

Do not broadcast memo transactions until `chain_height >= ZION_ACCOUNT_TX_MEMO_V1_HEIGHT`. Monitor:

```bash
watch -n 30 'curl -s -X POST http://127.0.0.1:8443 -H "Content-Type: application/json" -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getChainInfo\",\"params\":{}}" | jq .result.chain_height'
```

---

## E2E tests after activation

A ready-to-run script is available at [`V3/scripts/ops/account-memo-e2e.sh`](../../V3/scripts/ops/account-memo-e2e.sh). It polls the node until the activation height is reached, then sends three account-model memo transactions and verifies the watchers detect them.

### Prerequisites

Set these environment variables on Edge (e.g., in `/root/zion-e2e.env`):

```bash
export ZION_E2E_PASSWORD="..."
ZION_E2E_WALLET_FILE=/root/...json     # funded wallet JSON (must have account balance)
ZION_E2E_PASSWORD_ENV=ZION_E2E_PASSWORD
ZION_E2E_EVM_ADDRESS=0x...             # your Base EVM address
```

### Run

```bash
cd /root/zion-2.9.6-main
source /root/zion-e2e.env
./V3/scripts/ops/account-memo-e2e.sh
```

### Manual CLI version

#### Bridge lock (account model)

```bash
zion wallet send \
  --from <your-address> \
  --to zion1...bridge_vault... \
  --amount 1 \
  --fee 0.01 \
  --memo "BRIDGE:base:0x<your_evm_address>"
```

Verify:

```bash
curl http://127.0.0.1:8454/api/bridge/locks
```

#### DAO vote (account model)

```bash
zion wallet send \
  --from <your-address> \
  --to zion1...dao_address... \
  --amount 1 \
  --fee 0.01 \
  --memo "DAO:vote:1:yes"
```

Verify:

```bash
curl http://127.0.0.1:8456/api/dao/proposals/1
```

#### Atomic swap lock (account model)

```bash
PREIMAGE=$(openssl rand -hex 32)
HASHLOCK=$(printf "%s" "$PREIMAGE" | xxd -r -p | sha256sum | cut -d' ' -f1)

zion wallet send \
  --from <your-address> \
  --to zion1...swap_escrow... \
  --amount 1 \
  --fee 0.01 \
  --memo "SWAP:LOCK:$HASHLOCK:120:base:0x<counterparty>"

# After the daemon detects the lock, claim:
zion wallet send \
  --from <your-address> \
  --to zion1...swap_escrow... \
  --amount 1 \
  --fee 0.01 \
  --memo "SWAP:CLAIM:$HASHLOCK:$PREIMAGE"
```

Verify:

```bash
curl http://127.0.0.1:8452/swap/$HASHLOCK
```

---

## Rollback

If anything goes wrong **before** the activation height:

```bash
sudo systemctl stop zion-edge-core.service
sudo cp /root/backups/2026-07-01-memo-hf/zion-node-state.db /root/zion-2.9.6-main/V3/data/zion-node-state.db
# Reinstall previous binaries from the previous backup or git checkout
sudo systemctl start zion-edge-core.service
```

If the activation height has already passed, rollback requires a coordinated emergency release with a higher activation height or a new consensus rule. Treat it as a governance decision.

---

## Post-deploy docs update

After the E2E tests pass:

1. Update `StatusV3.md` to mark the hard fork as deployed.
2. Update `V3/ROADMAP.md` and `ROADMAP.md` gate 6.1 to ✅.
3. Update `3.0.4.md` deploy checklist to completed.

---

## Owner decision still open

This runbook does **not** resolve the bridge address inconsistency (D1). Contract addresses on BSC, Polygon, Arbitrum, Optimism, and Avalanche must still be reconciled with the live bridge deployment. See `ROADMAP.md` decision D1.
