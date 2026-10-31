# ZION V31 — Hard Genesis Reset Playbook

> **Canonical procedure for a complete key rotation + genesis reset on ZION V31 mainnet.**
>
> **Last executed:** 2026-08-06 (v3.2 One Love genesis reset — from 2026-08-06 V31 cutover chain, with BIP39 mnemonic keys).
> **Authority:** This document is the single source of truth for future hard resets. Read it end-to-end before starting.

---

## 0. When to do a hard reset

A hard genesis reset is a **destructive, irreversible** operation. It discards the entire chain history and reissues the 16.78 B ZION premine to freshly generated addresses. Only do this when:

- **Private keys are compromised** (or suspected compromised) — full rotation is the only safe path.
- **Genesis allocation needs to change** (e.g., adding/removing premine slots, adjusting amounts).
- **A consensus-level bug** requires a fresh chain (e.g., the 2026-07-20 block-retention bug that pruned blocks 0–~10913).
- **A governance vote** mandates a reset (post-public-launch, this is the only legitimate trigger).

> **⚠️ Post-public-launch (after postponed (TBD)):** A hard reset is no longer acceptable. Use on-chain key rotation, governance proposals, and bridge validator re-keying instead. This playbook is for the **pre-public-launch alpha/beta** window only.

---

## 1. Pre-flight checklist

Before starting, verify:

- [ ] **Local dev PC** is clean (no malware, no screen-sharing, no keyloggers).
- [ ] **Both boxes reachable via SSH** — produkce je dvouboxová (viz §F.1):
  - **EDGE2** `207.180.217.100` (`ssh zion-edge2`) — primary node + web ingress + L1–L6 daemony + ZIS + MarketPlace
  - **EDGE** `62.171.141.136:2222` (`ssh zion-new` or `ssh -6 -p 2222 -i ~/.ssh/zion-edge-post-wipe-2026-07-29 root@2a02:c207:2342:5821::1`) — pool + node2/node3 followeři + miner + Prometheus
- [ ] **Backup** of **both** boxes taken (`ZION_OS/infra/scripts/backup-edge.sh` on EDGE → `sync-edge-backups.sh` locally; EDGE2: `/opt/zion/data/v31` chain + `zion_marketplace`/`zion` PG + `/etc/zion/` env + `/opt/zion/shared/.env`). The old chain will be destroyed — this backup is the only record.
- [ ] **All V31 services** baseline na obou: EDGE2 `systemctl status zion-v31-{node,multichain,dao,oasis,l5-fund,issobella} zion-zis zion-marketplace nginx`; EDGE `systemctl status zion-v31-{pool,miner} zion-v31-node{2,3} zion-edge-python-dashboard prometheus`.
- [ ] **Git working tree** is clean (`git status` — commit or stash any in-progress work).
- [ ] **Key storage location** ready: `~/Desktop/ZION_KEYS_NEW_GENESIS_<DATE>/` (chmod 700, owner-only).
- [ ] **Offline backup medium** ready (USB drive / encrypted volume) for key file copies.

---

## 2. Generate new keys

All key generators live in `V31/L1/core/src/bin/gen-*.rs`. They use `generate_keypair()` (OS random + BLAKE3 one-way). **No mnemonics are produced** — keys cannot be reverse-derived from the secret key. If you want BIP39 mnemonics for future resets, use `gen-all-keys-mnemonic.rs` instead (24-word BIP39 alongside the raw keys).

### 2.1 Build the key generators

```bash
cd ~/2.9.6-main/V31
cargo build --release -p zion-core --bins
```

### 2.2 Generate each key set

Run each generator and capture stdout. **Redirect to files in the key storage directory, never to the repo.**

```bash
KEYDIR=~/Desktop/ZION_KEYS_NEW_GENESIS_$(date +%Y-%m-%d)
mkdir -p "$KEYDIR"
chmod 700 "$KEYDIR"

# Premine wallets (14 slots)
./target/release/gen-premine-wallets > "$KEYDIR/PREMINE_WALLETS.txt"

# Canonical subsidy wallets (5: humanitarian, issobella, pool_fee, default_miner, pool_payout)
./target/release/gen-canonical-wallets > "$KEYDIR/CANONICAL_WALLETS.txt"

# Admin keys (3-of-3 multisig: Rama, Sita, Hanuman — L1 + EVM)
./target/release/gen-admin-keys > "$KEYDIR/ADMIN_KEYS.txt"

# DAO guardians (7)
./target/release/gen-dao-guardians > "$KEYDIR/DAO_GUARDIANS.txt"

# EVM bridge validators (5) + atomic swap escrow
./target/release/gen-evm-validators > "$KEYDIR/EVM_VALIDATORS_AND_ESCROW.txt"

# Pool wallet (signing key for pool payouts)
./target/release/gen-pool-wallet >> "$KEYDIR/CANONICAL_WALLETS.txt"

# Pool payout wallet (if separate generator exists)
./target/release/gen-pool-payout-wallet >> "$KEYDIR/CANONICAL_WALLETS.txt"
```

### 2.3 Build the public-addresses file

Extract **only public addresses + pubkeys** (no secret keys) into a shareable file:

```bash
# Manually compile PUBLIC_ADDRESSES.txt from the above files.
# Format: tables with Address, Pubkey, Amount — NO secret keys.
# This file is safe to commit to git.
```

### 2.4 Lock down key files

```bash
chmod 600 "$KEYDIR"/*.txt
chmod 700 "$KEYDIR"
ls -la "$KEYDIR"  # verify: all files -rw-------, dir drwx------
```

### 2.5 Offline backup

Copy the entire `$KEYDIR` to an offline medium (USB, encrypted volume). **Do not push key files to git, cloud, or any network share.**

---

## 3. Update code constants

Every address must be updated in the codebase. The following files contain hardcoded addresses that must match the new keys.

### 3.1 Genesis + premine (V31)

| File | What to update |
|------|---------------|
| `V31/L1/core/src/genesis.rs` | `premine_outputs()` — all 14 slot addresses + amounts |
| `V31/L1/core/src/v3_compat.rs` | `V3_GENESIS_HASH` constant (after genesis hash is computed, §5) + `PREMINE_OUTPUTS` array (all 14 entries: address, pubkey, amount) |

### 3.2 Canonical subsidy wallets

| File | What to update |
|------|---------------|
| `V31/L1/core/src/coinbase.rs` (or wherever coinbase fee split lives) | `humanitarian_subsidy`, `issobella_subsidy`, `pool_fee_subsidy`, `default_miner` addresses |
| `V31/L1/pool/src/config.rs` (or pool config) | `pool_payout` address + signing key |
| `V31/L1/pool/src/fee.rs` (or fee split module) | 89% / 5% / 5% / 1% split addresses |

### 3.3 Admin keys

| File | What to update |
|------|---------------|
| `V31/L1/core/src/admin.rs` (or admin multisig module) | Rama, Sita, Hanuman L1 addresses + pubkeys |
| `V31/L2/multichain/src/bridge/*.rs` | EVM admin addresses for bridge multisig |
| `V31/L1/core/src/v3_compat.rs` | Admin pubkeys if referenced in compat layer |

### 3.4 DAO guardians

| File | What to update |
|------|---------------|
| `V31/L4/dao/src/guardians.rs` (or DAO config) | 7 guardian addresses + pubkeys |
| `V31/L4/dao/src/config.rs` | Guardian quorum threshold |

### 3.5 EVM bridge validators

| File | What to update |
|------|---------------|
| `V31/L2/multichain/src/bridge/validators.rs` | 5 validator EVM addresses |
| `V31/L2/multichain/src/bridge/escrow.rs` | Atomic swap escrow L1 address + pubkey |
| Smart contracts (Base/BSC) — `V31/L2/contracts/` | Validator set in contract storage (requires on-chain rotation tx) |

### 3.6 Local scripts + website

| File | What to update |
|------|---------------|
| `scripts/start-backup-node.sh` | `ZION_MINER_ADDRESS`, `HUMANITARIAN_WALLET`, `ISSOBELLA_WALLET` |
| `scripts/backup-node.env` | Same 3 addresses |
| `scripts/launch-local-backup.ps1` | Same 3 addresses |
| `scripts/deploy_zion_smos.py` | Pool wallet address |
| `scripts/audit/pool_payout_consistency.py` | `pool_wallet` |
| `apps/website-v2.9/src/lib/constants.ts` | `HUMANITARIAN_WALLET`, `ISSOBELLA_WALLET`, `POOL_WALLET` |
| `apps/website-v2.9/src/app/l5-free-world/page.tsx` | `HUMANITARIAN_WALLET` |
| `apps/website-v2.9/src/app/l6-issobella/page.tsx` | `ISSOBELLA_WALLET` |
| `apps/website-v2.9/src/components/GuardianDashboard.tsx` | 4 fee split addresses |
| `apps/website-v2.9/src/components/DashboardMain.tsx` | 4 fee split addresses |
| `apps/website-v2.9/public/docs/legal/token-disclosure.md` | DAO treasury + canonical wallet addresses |
| `ZION_OS/desktop/src/api/wallets.ts` | `canonicalPool` address |

> **Note:** `.next/` compiled JS and `ZION_OS/desktop/dist/` will still have old addresses. They are cleared on the next rebuild/deploy (§7).

### 3.7 Address mapping table (old → new)

Always record the old→new mapping for audit trail. Example from 2026-08-06 V2 reset (old 2026-07-06 V3 addresses → `V31_PREMINE_V2_KEYS_2026-08-06.json`):

| Role | Old address | New address |
|------|------------|-------------|
| default_miner | `zion1u4a82230m0a267r785m822u5a3g7n753d7eu5n0` | `zion1074344t7k686j6n8a0l6t0f4c8d828y083xh4m2` |
| humanitarian | `zion136m4u7f8s5w3l0e00342s7a4r282275442vm2w3` | `zion1y3w4z0c755v4y7t3f0k6s54390x0h3k3y5hv8c8` |
| issobella | `zion173g835z228z6u303z59603y236r5e854l36g604` | `zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0` |
| pool_payout | `zion1k4g2d8s3y4m5v238k0l3v6y5n48894n357uv064` | `zion1d2k5v0p6p2z667l7g522v2z0w0y6e7w742zq8k6` |
| pool_fee | `zion1e6r72872w0y5w6c3h4e6z847g8z4z7l0n4rj607` | `zion1l0h428f536s6u3x7h5f0d5c2z644j7t8u8va3x0` |
| Rama (admin L1) | `zion1u2r4n87572t2f3n8f2j006f2a540y7r8m84p887` | `zion1s4t4y2s4v0a4l4h28423h266f2y7h406d3s0847` |
| Sita (admin L1) | `zion1r4t6v7a8j6v4u86208d3g8k6t6q4q4g5y0kc3p8` | `zion1l6p5g466r047v7x39623n467v545p2m4l8v30v2` |
| Hanuman (admin L1) | `zion19086w6d026y8z2f7u7v2x68054g8d4y5n3e70q4` | `zion18693c577h054s7v866e686f8m3z0y8s7s5gl2l7` |

*(Full 14-premine + 5-canonical + 3-admin + 7-guardian + 5-validator mapping kept in the key directory's `PUBLIC_ADDRESSES.txt`.)*

---

## 4. Compute the new genesis hash

After updating `genesis.rs` and `v3_compat.rs`, compute the new genesis hashes:

```bash
cd ~/2.9.6-main/V31
cargo build --release -p zion-core

# V31 native genesis hash
cargo run --release -p zion-core --bin print-genesis-hash 2>/dev/null || \
  echo "Use the genesis_hash() function in a test or REPL to get the hash."

# V3 compat genesis hash (must match V3 chain if doing compat cutover)
# This is V3_GENESIS_HASH in v3_compat.rs — update it AFTER computing.
```

The V31 native genesis hash is `genesis_hash()` in `V31/L1/core/src/genesis.rs` (Keccak256 of the PoW header + nonce). The V3 compat hash is the V3 chain's actual block-0 hash, which must be set in `V3_GENESIS_HASH` after the V3 node recomputes it with the new premine.

**v3.2 One Love genesis hashes (2026-08-06):**
- V31 native: `96109423298542a836edc10b9ba5ff9b29a1970418db543c2ee5cd952fe35bdb`
- V3 compat: `4cf7560f9140deb9376fa6567e76eacaa8bd1b733ca3c91b00830a08f332ef71`

**Record both hashes** — they go into `StatusV3.md`, `AGENTS.md`, `README.md`, and `v3_compat.rs`.

---

## 5. Build + test

```bash
cd ~/2.9.6-main/V31
cargo test --workspace        # all tests must pass
cargo clippy --workspace      # must be clean
```

If any test fails because it hardcodes an old address, update the test. Do not skip tests.

---

## 6. Deploy to Edge server

> **⚠️ Two-box mapping (since 3.2 topology — see §F.1):** příkazy níže používají `zion-new` jako
> placeholder. Per-service substitution:
> - **`ssh zion-edge2`** (`207.180.217.100`) — `zion-v31-node` (primary), `zion-v31-multichain`,
>   `zion-v31-dao`, `zion-v31-oasis`, `zion-v31-l5-fund`, `zion-v31-issobella`, `zion-zis`,
>   website (`deploy-web2.9.sh`), nginx
> - **`ssh zion-new`** (`62.171.141.136:2222`) — `zion-v31-pool`, `zion-v31-miner`,
>   `zion-v31-node2`/`zion-v31-node3` (followeři), dashboard, Prometheus
>
> Chain-data wipe (§6.2) platí na **obou** boxech — node DB na EDGE2 + EDGE (node2/node3 chain
> data + pool db na EDGE). Binárky: EDGE2 nemá source tree → build na EDGE/lokále, `scp` na oba.

### 6.1 Stop all V31 services

```bash
# EDGE2 (primary node + L2–L6 daemony)
ssh zion-edge2 "systemctl stop zion-v31-node zion-v31-multichain zion-v31-dao zion-v31-oasis zion-v31-l5-fund zion-v31-issobella"
# EDGE (pool + miner + followeři)
ssh zion-new "systemctl stop zion-v31-pool zion-v31-miner zion-v31-node2 zion-v31-node3"
```

### 6.2 Wipe old chain data

```bash
# Back up first! (§1 pre-flight). Data paths per §F.1: /opt/zion/data/v31 on both boxes.
# EDGE2 — primary node + L2/L5/L6 daemon data:
ssh zion-edge2 "cd /opt/zion/data/v31 && for f in v31-node.db dao.db oasis.db l5_fund.db issobella.db warp.db peers.json; do [ -e \$f ] && mv \$f \$f.pre-reset-\$(date +%Y%m%d); done"
# EDGE — pool + follower chains:
ssh zion-new "cd /opt/zion/data/v31 && for f in v31-node.db v31-pool.db pool-pplns.json pool-store.db peers.json; do [ -e \$f ] && mv \$f \$f.pre-reset-\$(date +%Y%m%d); done"
# Also wipe warp.db, pplns-state.json wherever present — they reference old chain
```

### 6.3 Build + deploy new binaries

```bash
cd ~/2.9.6-main/V31
cargo build --release   # (nebo build na EDGE /opt/zion-rel build worktree — EDGE2 source tree nemá)

# EDGE2 — node + L2–L6 daemony (web deploye přes scripts/deploy-web2.9.sh)
for b in zion-node multichain dao oasis l5-fund issobella zis; do
  scp target/release/$b zion-edge2:/opt/zion/V31/target/release/$b
done
# EDGE — pool + miner + node pro followery
for b in zion-node zion-pool zion-miner; do
  scp target/release/$b zion-new:/opt/zion/V31/target/release/$b
done
```

### 6.4 Update Edge config files

All env/config files with hardcoded addresses must be updated — **per host**:

```bash
# EDGE2 (/etc/zion/ + /opt/zion/shared/.env — node/dao/oasis/L5/L6/ZIS env, web .env)
ssh zion-edge2
vi /etc/zion/config/dao-v31.toml          # DAO guardian addresses, treasury
vi /etc/zion/warp.toml                    # bridge validator addresses
vi /opt/zion/shared/.env                  # canonical subsidy + RPC addrs (P0-3 subsety)

# EDGE (/etc/zion/edge-*.sh — pool/miner/follower env)
ssh zion-new
vi /etc/zion/edge-environment.sh          # ZION_MINER_ADDRESS, HUMANITARIAN_WALLET, ISSOBELLA_WALLET
vi /etc/zion/edge-v31-pool-environment.sh # POOL_WALLET, fee split addresses
vi /etc/zion/xmr-pool-environment.sh      # if XMR pool references ZION addresses
vi /etc/zion/edge-node2-environment.sh    # node2 miner address
vi /etc/zion/edge-env-no-auxpow.sh        # auxpow-disabled env
vi /etc/zion/config/dao-mainnet.toml      # if still referenced (check first)
```

### 6.5 Restart services

```bash
# EDGE2 — primary node first (chain head), then daemony
ssh zion-edge2 "systemctl start zion-v31-node"
sleep 5
ssh zion-edge2 "systemctl start zion-v31-multichain zion-v31-dao zion-v31-oasis zion-v31-l5-fund zion-v31-issobella zion-zis"
# EDGE — followeři se připojí na primary, pak pool + miner
ssh zion-new "systemctl start zion-v31-node2 zion-v31-node3"
sleep 5
ssh zion-new "systemctl start zion-v31-pool"
sleep 3
ssh zion-new "systemctl start zion-v31-miner"
```

### 6.6 Verify all services active

```bash
ssh zion-edge2 "systemctl is-active zion-v31-node zion-v31-multichain zion-v31-dao zion-v31-oasis zion-v31-l5-fund zion-v31-issobella zion-zis"
ssh zion-new   "systemctl is-active zion-v31-node2 zion-v31-node3 zion-v31-pool zion-v31-miner"
# Expected: active per service on each box
```

---

## 7. Verify the new chain

### 7.1 Genesis hash matches

```bash
# On Edge, query the node RPC for block 0
ssh zion-edge2 "echo '{\"jsonrpc\":\"2.0\",\"method\":\"chain_get_block\",\"params\":[0],\"id\":1}' | nc 127.0.0.1 9445"
# The returned hash must match the V31 native genesis hash from §4.
```

### 7.2 Premine balances correct

```bash
# Query each premine address balance — must match the amounts in genesis.rs
ssh zion-edge2 "echo '{\"jsonrpc\":\"2.0\",\"method\":\"address_get_balance\",\"params\":[\"zion1s0t7f8q680t4h6v7g240p4k7g2s0a4z8g3cc5h5\"],\"id\":1}' | nc 127.0.0.1 9445"
# Expected: 1,650,000,000 ZION (slot 1, OASIS+GoldenEgg — 1 of 3 OASIS slots; total OASIS = 4.95B; Slots 4 & 5 repurposed to L5 Free World Projects)
```

### 7.3 Pool fee split correct

Start a miner and submit a share. The pool must split the coinbase 89% / 5% / 5% / 1% to the new addresses:

```bash
# Check pool logs for fee split
ssh zion-new "journalctl -u zion-v31-pool --since '5 min ago' | grep 'share accepted'"
```

### 7.4 OASIS connects to RPC

```bash
ssh zion-edge2 "journalctl -u zion-v31-oasis --since '2 min ago' | grep 'chain_height'"
# Expected: L1BlockListener initial chain_height=0 (then increasing)
```

> **Bug note (2026-08-06):** OASIS `blockchain_listener.rs` was using `reqwest` (HTTP) to connect to V31 RPC, but V31 RPC is **raw TCP JSON-RPC**. Fixed by replacing `reqwest::Client` with `tokio::net::TcpStream` + `parse_rpc_addr()` + `jsonrpc_tcp_call()` (same pattern as `V31/L1/pool/src/rpc_client.rs`). If OASIS fails to connect after a reset, check this first.

---

## 8. Update documentation

After verification, update all root docs:

| Doc | What to update |
|-----|---------------|
| `StatusV3.md` | Genesis hash line(s), add hard reset update blockquote at top |
| `README.md` | Genesis hash, "Last updated" date, add reset note in Status section |
| `AGENTS.md` | Top blockquote: new genesis hashes, key storage path, mnemonic note, link to this playbook |
| `ROADMAP.md` | If genesis hash is referenced, update it |
| `V31/STATUS.md` | If genesis hash is referenced, update it |
| `V31/AGENTS.md` | If genesis hash or addresses are referenced, update them |

**Historical docs** (`docs/3.0.4/`, `docs/3.0.5/`, old incident reports in `AGENTS.md`) are left as-is — they are archival records of past state.

---

## 9. Commit + push

```bash
cd ~/2.9.6-main
git add -A
git status  # review carefully — no key files should be staged
git commit -m "Hard genesis reset <DATE>: new premine + canonical + admin + guardian + validator keys

- New V3 compat genesis: <hash>
- New V31 native genesis: <hash>
- All addresses updated in code, scripts, website, Edge configs
- OASIS RPC fixed (raw TCP)
- All 5 Edge services verified active

See HARD_RESET_PLAYBOOK.md for full procedure.

Generated with [Devin](https://cli.devin.ai/docs)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>"

git push origin main
```

> **⚠️ Before `git add -A`:** verify that `~/Desktop/ZION_KEYS_*/` is NOT inside the repo and that `.gitignore` covers `.env`, `.env.local`, `*.key`, `secrets/`, `keys/`. Run `git status` and eyeball every staged file.

---

## 10. Post-reset actions

### 10.1 Rebuild web + desktop

Old addresses persist in compiled artifacts. Rebuild and redeploy:

```bash
# Website
cd ~/2.9.6-main/apps/website-v2.9
npm run build
# Deploy per apps/website-v2.9/AGENTS.md §1

# Desktop
cd ~/2.9.6-main/ZION_OS/desktop
npm run build
# Deploy per desktop deploy docs
```

### 10.2 Local backup node

Update `scripts/start-backup-node.sh` + `scripts/backup-node.env` with new addresses, restart the local backup node. It will sync from the new genesis.

### 10.3 EVM bridge validator rotation (if applicable)

The Base/BSC bridge contracts store validator addresses in on-chain storage. Rotating them requires a multisig transaction from the **old** validator set to update to the **new** set. If the old validators are still available:

1. Call `rotateValidators(newValidatorSet)` on the bridge contract from the old admin multisig.
2. Verify the new validator set is active.

If the old validators are compromised/unavailable, the bridge must be paused and redeployed with a new contract referencing the new validator set.

### 10.4 DAO guardian keys integration

The 7 DAO guardian keys must be loaded into the DAO governance runtime config (`/etc/zion/config/dao-v31.toml` on Edge) and the `zion-dao` binary must be restarted. Verify guardians can submit/vote on proposals.

### 10.5 Security hardening (recommended)

- Rebind local L2 services from `0.0.0.0` to `127.0.0.1` (they are LAN-accessible but not internet-exposed behind NAT; binding to loopback is safer).
- Enable UFW firewall on the local dev PC: `ufw default deny incoming && ufw allow 22 && ufw enable`.
- Rotate SSH keys if any suspicion of compromise.
- Rotate dashboard Basic Auth credentials.
- Rotate Contabo root password (via Contabo panel) and store in 1Password.

---

## Appendix A — Key generation scripts reference

| Script | Output | Keys |
|--------|--------|------|
| `gen-premine-wallets.rs` | 14 premine keypairs | OASIS (3), L5 Free World Projects (2, repurposed from OASIS Slots 4 & 5), DAO treasury (3), Infrastructure (3), Humanitarian (1), Bridge (2) |
| `gen-canonical-wallets.rs` | 5 subsidy keypairs | humanitarian, issobella, pool_fee, default_miner, pool_payout |
| `gen-admin-keys.rs` | 3 admin keypairs (L1 + EVM) | Rama, Sita, Hanuman |
| `gen-dao-guardians.rs` | 7 guardian keypairs | Guardian-1 through Guardian-7 |
| `gen-evm-validators.rs` | 5 EVM validator keypairs + 1 escrow | Validator-1 through Validator-5 + atomic_swap_escrow |
| `gen-pool-wallet.rs` | 1 pool wallet keypair | Pool signing key |
| `gen-pool-payout-wallet.rs` | 1 pool payout keypair | Pool payout signing key |
| `gen-all-keys-mnemonic.rs` | All of the above + BIP39 24-word mnemonics | Use this for future resets to have mnemonic backup |

All generators use `generate_keypair()` → OS random + BLAKE3 (one-way). **Secret keys cannot be reverse-derived.** If you lose the key file, those funds are gone forever.

---

## Appendix B — Bridge Vault (keyless)

The Bridge Vault address is **deterministic from a seed string**, not a keypair. It has no private key — funds are controlled by bridge validator consensus.

```
Seed: ZION Bridge Vault V3 Mainnet v2 <DATE>-HARD-RESET
Address: derived via SHA-256 → derive_address()
```

Update the seed string in `v3_compat.rs` and the bridge config for each reset.

---

## Appendix C — Edge service topology (post-reset)

| Service | systemd unit | Port | Purpose |
|---------|-------------|------|---------|
| V31 Node | `zion-v31-node` | P2P 8335, RPC 9445 | L1 chain (public RPC 8443 → 9445 via nginx) |
| V31 Pool | `zion-v31-pool` | Stratum 8444, API 8080 | Mining pool (89/5/5/1 fee split) |
| V31 Multichain | `zion-v31-multichain` | 8453 (warpd), 8454 (DEX) | Bridge + warp + atomic swap + ZionDex |
| V31 DAO | `zion-v31-dao` | 8455 (API) | Governance runtime + L1 memo scanner |
| V31 OASIS | `zion-v31-oasis` | 8094 | OASIS game + L1 block listener |

All services use `127.0.0.1:9445` (V31 node RPC) internally. Public exposure is via nginx TCP/HTTP proxies only.

---

## Appendix D — Mnemonic recovery note

**Keys generated before 2026-08-06 (v1) do not have mnemonics.** They were produced by `generate_keypair()` (OS random → BLAKE3 one-way). There is no way to recover them from the secret key or any other data.

**Keys generated on 2026-08-06 (v3.2 One Love reset) DO have mnemonics.** They were produced by `gen-all-keys-mnemonic.rs` which generates BIP39 24-word mnemonics alongside the raw Ed25519 + EVM keys. All 35 keypairs have mnemonics stored in `~/Desktop/ZION_KEYS_GENESIS_V2_2026-08-06/all_keys.json` and individual `.txt` files.

For all future resets, **always use `gen-all-keys-mnemonic.rs`** which produces BIP39 24-word mnemonics alongside the raw keys. Store the mnemonics **separately** from the key files (ideally on paper in a physical safe, or metal plate for fire resistance).

If a key file is lost but the mnemonic exists, all keys can be re-derived from the 24-word mnemonic. If neither the key file nor the mnemonic exists, the funds at that address are **permanently unrecoverable**. This is why the pre-flight checklist (§1) requires an offline backup.

---

## Appendix E — Key management architecture (2026-08-06 audit)

### E.1 Two key systems in ZION

ZION has **two independent key systems** that serve different purposes:

| System | Used by | Key format | Mnemonic? | Recovery |
|--------|---------|-----------|-----------|----------|
| **L1 Wallet CLI** (`V31/L1/core/src/bin/wallet.rs`) | Node, pool, miner, CLI `wallet send/bridge-lock` | Raw Ed25519 secret key (32 bytes / 64 hex) | **No** | SK is the only recovery material |
| **Multi-Chain Keyring** (`V31/L2/multichain/src/wallet/mod.rs`) | SDK, bridge, swap, DAO governance via SDK | BIP39 24-word mnemonic → derive Ed25519 + EVM | **Yes** (24-word BIP39) | Mnemonic recovers all derived keys |

### E.2 How the 2026-08-06 v3.2 One Love keys were generated

The 2026-08-06 v3.2 One Love hard reset used **`gen-all-keys-mnemonic.rs`** which generates BIP39 24-word mnemonics and derives both Ed25519 (L1) and EVM (secp256k1) keys from each mnemonic. All 35 keypairs have mnemonics.

Evidence:
- `~/Desktop/ZION_KEYS_GENESIS_V2_2026-08-06/all_keys.json` — every wallet has a `mnemonic` field with 24 BIP39 words.
- `gen-all-keys-mnemonic.rs` uses `bip39::Mnemonic::generate(24, Language::English)` → BLAKE3 derive Ed25519, secp256k1 derive EVM.
- Both L1 and EVM keys are derived from the **same mnemonic** per wallet, enabling full Multi-Chain Keyring compatibility.

Previous (v1) keys from the 2026-08-06 first reset used `gen-premine-wallets.rs` (no mnemonics). Those have been superseded by the v3.2 One Love keys.

### E.3 What this means for wallet access

| Key type | What we have | Sufficient for L1? | Sufficient for L2 multi-chain? |
|----------|-------------|--------------------|-------------------------------|
| Premine (14) | Ed25519 SK + pubkey + **BIP39 mnemonic** | **Yes** — `wallet.rs` uses SK directly | **Yes** — Keyring can derive from mnemonic |
| Canonical (5) | Ed25519 SK + pubkey + **BIP39 mnemonic** | **Yes** | **Yes** |
| Admin (3) | Ed25519 SK + EVM SK + **BIP39 mnemonic** (both derived from same mnemonic) | **Yes** for L1; EVM SK works for bridge signing | **Yes** — `WalletClient::from_mnemonic()` works |
| DAO Guardians (7) | Ed25519 SK + pubkey + **BIP39 mnemonic** | **Yes** | **Yes** |
| EVM Validators (5) | EVM SK + address + **BIP39 mnemonic** | N/A (EVM-only) | **Yes** — mnemonic derives both EVM and Ed25519 |

### E.4 Practical impact

- **L1 operations (node, pool, miner, send ZION, bridge lock):** Ed25519 SK is sufficient. The `wallet.rs` CLI loads SK from `ZION_WALLET_SK_HEX` or `ZION_WALLET_KEY_FILE` and signs directly. No mnemonic needed.
- **EVM bridge operations:** EVM SK is sufficient for signing bridge transactions. The `ethers` library can construct a `LocalWallet` from raw SK bytes.
- **Multi-Chain SDK (`WalletClient`):** Requires a BIP39 mnemonic. **Now works** with the v3.2 One Love keys — all 35 keypairs have 24-word BIP39 mnemonics. Use `WalletClient::from_mnemonic()` to construct a Keyring that derives both L1 (Ed25519) and EVM (secp256k1) keys.

### E.5 Recommendation for future resets

**Always use `gen-all-keys-mnemonic.rs`** for future hard resets. It produces:
- 24-word BIP39 mnemonic for each wallet (paper-recoverable)
- Ed25519 SK + pubkey (for L1 wallet CLI)
- EVM SK + address (for bridge validators/admins)

This ensures both key systems work: L1 CLI uses raw SK, Multi-Chain Keyring uses mnemonic. Store mnemonics on paper in a physical safe; store SK files encrypted offline.

### E.6 Key file inventory (2026-08-06 v3.2 One Love)

All key files are in `~/Desktop/ZION_KEYS_GENESIS_V2_2026-08-06/` (chmod 700):

| File | Contents | Count |
|------|----------|-------|
| `all_keys.json` | All 35 keypairs with BIP39 mnemonics, Ed25519 SK/pubkey, EVM SK/address | 35 |
| `PREMINE_*.txt` (14 files) | Individual premine wallet: mnemonic + Ed25519 SK + pubkey + address | 14 |
| `CANONICAL_*.txt` (5 files) | Individual canonical wallet: mnemonic + Ed25519 SK + pubkey + address | 5 |
| `ADMIN_*.txt` (3 files) | Individual admin: mnemonic + Ed25519 SK + pubkey + L1 address + EVM SK + EVM address | 3 |
| `DAO_GUARDIAN_*.txt` (7 files) | Individual guardian: mnemonic + Ed25519 SK + pubkey + address | 7 |
| `EVM_VALIDATOR_*.txt` (5 files) | Individual validator: mnemonic + EVM SK + address | 5 |
| `ATOMIC_SWAP_ESCROW.txt` | Escrow: mnemonic + Ed25519 SK + pubkey + address | 1 |

**Total: 35 keypairs, 35 BIP39 mnemonics (24-word each).**

---

*This playbook was created on 2026-08-06 following the third hard genesis reset in ZION's history. The first was 2026-07-20 (block-retention bug), the second was 2026-08-06 (V31 cutover, no mnemonics), and the third was 2026-08-06 (v3.2 One Love, with BIP39 mnemonic keys). This document ensures future resets follow a verified, repeatable procedure.*

---

## F. DR restore drill — dvouboxová topologie (7.B7 / D-10, draft 2026-10-28)

Genesis reset (§0–E) ≠ restore drill. Tato sekce = postup obnovy celého
produkčního stacku na čistém hostu — ověřeno proti živému stavu 28. 10.

### F.1 Topologie + data, která se musí přežít

| Box | Role | Kritická data |
|---|---|---|
| **EDGE2** `207.180.217.100` | primary node + web ingress (nginx :80/:443) + L1–L6 daemony + ZIS + MarketPlace/website + tunely | `/opt/zion/data/v31` (node chain), `zion_marketplace` + `zion` PG, `/etc/zion/` env, `/opt/zion/shared/.env`, `/opt/zion/data/l3-audit`, `/opt/zion/data/v31-pool-standby/` (pool standby kopie) |
| **EDGE** `62.171.141.136:2222` | pool + node2/node3 followeři + miner + Prometheus/Alertmanager + dashboard + wedgewatch | `/opt/zion/data/v31` (pool `pool-pplns.json`, `pool-store.db`, payout ledger, node chain), `/opt/zion/scripts`, env `/etc/zion/edge-environment.sh` |

Secrets NEJSOU v repu — bez zálohy `/etc/zion/` + `/opt/zion/shared/.env`
+ ssh klíčů (`edgetunnel`, `hirantunnel`, `~/.vast-agent-token`,
`~/.ssh/id_ed25519` pro tunely) restore není možný.

### F.2 Restore pořadí (čistý host)

**EDGE2:**
1. OS user `zion`, dirs `/opt/zion/{V31,bin,data,scripts,shared}`,
   `/etc/zion/`, ssh klíče tunnel userů.
2. Binárky: `rsync -a <build-host>:/opt/zion/V31/target/release/ /opt/zion/V31/target/release/` — EDGE2 žádný source tree nemá (build na EDGE).
3. Chain data: restore `/opt/zion/data/v31` z `zion-edge-backup` archivu,
   nebo nechat resync z P2P (primary: full sync ~hodiny; followeři rychleji).
4. Env: `/etc/zion/*` + `/opt/zion/shared/.env` + unit soubory
   `V31/deploy/systemd/` → `/etc/systemd/system/`, `daemon-reload`.
5. Start order: `zion-v31-node` (počkat sync tip) → `zion-db-sync` →
   L2 (`zion-v31-multichain`, `zion-v31-dao`, `zion-zis`) → L3–L6 →
   `zion-website`, `zion-marketplace` → nginx → tunely → probí/timery.
6. PG restore před db-sync/marketplace (`zion`, `zion_marketplace` db).

**EDGE:**
1. Totéž skeleton + git checkout (build host) — POZOR: produkční checkout
   je divergovaný (`6fae7b60d` + kumulativní rsync overlaye, 7k+ dirty);
   restore manifestu `docs/3.2/DEPLOY-PROVENANCE-*.jsonl` určuje
   nasazené sha256 — build z tags/checkoutu nemusí dát stejnou binárku.
2. Pool data: restore `pool-pplns.json` + `pool-store.db` + payout ledger
   — **nebo z EDGE2 standby** `/opt/zion/data/v31-pool-standby/`
   (RPO ≤15 min pplns, ≤1 h store.db — replikace `zion-pool-state-replicate.timer`).
3. Start: node2/node3 → wait sync → `zion-v31-pool` → miner/fallback →
   wedgewatch + watchdog timery + Prometheus/Alertmanager.

### F.3 Failover poolu (EDGE → EDGE2 standby)

Existující HA standby (`POOL-HA-STANDBY.md`): unit `zion-v31-pool.service`
na EDGE2 gated `ConditionPathExists=…/ACTIVATED`. Promote = zastavit
primary → vytvořit ACTIVATED → start. **Nikdy oba najednou** — double-pay
hazard (ledger žije v store.db; standby má kopii ≤1 h starou → po promote
probe `inputs_still_unspent` rozhodne resubmity, viz 2.S2 hardening).

### F.4 Verifikační gate po restore

- `curl :9445/jsonrpc getStatus` = chain tip roste (≤900 s)
- `curl :8080/health` + `/stats` <3 s (pool), stratum :8444 connect
- `zion_g8_probe_success` = 1 všech služeb (probe na :9105)
- `/public/v1/payouts?limit=1` age <1 h (payout write path)
- provenance: `scripts/ops/deploy-provenance.sh` diff vs poslední baseline

### F.5 Co drill zatím NEPOKRYVÁ (otvřené)

- Full restore na čistém hostu nikdy neproběhl end-to-end (jen komponenty:
  standby replica ověřena read-only 27.10, integrity ok, ledger max=tip)
- PG dumps (`zion`, `zion_marketplace`) — ověřit existenci čerstvé zálohy
- Secrets backup scope (kdo drží `/etc/zion/*` offline kopii — 👤)
- Časový rozpočet: chain resync je dominantní položka (RTO hodin, ne minut)

### F.6 Partial rehearsal — provedeno 2026-10-28 ✅

Boot test standby dat na EDGE2 (izolovaný `/tmp/dr-rehearsal-*`, staging
porty `18444`/`18080`, **bez wallet klíčů** → payout submit nemožný =
žádný double-pay hazard):

- Standby artefakty: `pool-store.db` integrity **ok**, schema v11,
  218 020 payout rows; `pool-pplns.json` + `.payouts.json` ledger
  (`paid_block_heights`/`sent_payouts`/`pending_payouts`) parsovatelné;
  snapshot ~6 min fresh (15min timer)
- `zion-pool` binary (EDGE2 rsync) **nabootoval nad standby daty**:
  `/health` ok, `/stats` servíruje plnou API → restore→boot→serve path
  funguje end-to-end. Post-run `integrity_check` znovu ok
- **Verdikt:** pool DR standby cesta je ověřená reálným bootem, ne jen
  read-only. Repro: viz §F.3 + env `-i` bez `ZION_POOL_WALLET*`
- Zůstává nepokryté: plný chain resync, PG restore, secrets restore —
  potřebují čistý host (👤 náklad)
