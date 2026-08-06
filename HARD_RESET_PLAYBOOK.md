# ZION V31 — Hard Genesis Reset Playbook

> **Canonical procedure for a complete key rotation + genesis reset on ZION V31 mainnet.**
>
> **Last executed:** 2026-08-06 (from 2026-07-20 chain).
> **Authority:** This document is the single source of truth for future hard resets. Read it end-to-end before starting.

---

## 0. When to do a hard reset

A hard genesis reset is a **destructive, irreversible** operation. It discards the entire chain history and reissues the 16.78 B ZION premine to freshly generated addresses. Only do this when:

- **Private keys are compromised** (or suspected compromised) — full rotation is the only safe path.
- **Genesis allocation needs to change** (e.g., adding/removing premine slots, adjusting amounts).
- **A consensus-level bug** requires a fresh chain (e.g., the 2026-07-20 block-retention bug that pruned blocks 0–~10913).
- **A governance vote** mandates a reset (post-public-launch, this is the only legitimate trigger).

> **⚠️ Post-public-launch (after 2026-12-31):** A hard reset is no longer acceptable. Use on-chain key rotation, governance proposals, and bridge validator re-keying instead. This playbook is for the **pre-public-launch alpha/beta** window only.

---

## 1. Pre-flight checklist

Before starting, verify:

- [ ] **Local dev PC** is clean (no malware, no screen-sharing, no keyloggers).
- [ ] **Edge server** (`62.171.141.136`) is reachable via SSH (`ssh zion-new` or `ssh -6 -p 2222 -i ~/.ssh/zion-edge-post-wipe-2026-07-29 root@2a02:c207:2342:5821::1`).
- [ ] **Backup** of current Edge state taken (`ZION_OS/infra/scripts/backup-edge.sh` on Edge, then `sync-edge-backups.sh` locally). The old chain will be destroyed — this backup is the only record.
- [ ] **All V31 services** on Edge are running (`systemctl status zion-v31-{node,pool,multichain,dao,oasis}`) so you know the baseline.
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
| `APP&WEB/website-v2.9/src/lib/constants.ts` | `HUMANITARIAN_WALLET`, `ISSOBELLA_WALLET`, `POOL_WALLET` |
| `APP&WEB/website-v2.9/src/app/l5-free-world/page.tsx` | `HUMANITARIAN_WALLET` |
| `APP&WEB/website-v2.9/src/app/l6-issobella/page.tsx` | `ISSOBELLA_WALLET` |
| `APP&WEB/website-v2.9/src/components/GuardianDashboard.tsx` | 4 fee split addresses |
| `APP&WEB/website-v2.9/src/components/DashboardMain.tsx` | 4 fee split addresses |
| `APP&WEB/website-v2.9/public/docs/legal/token-disclosure.md` | DAO treasury + canonical wallet addresses |
| `ZION_OS/desktop/src/api/wallets.ts` | `canonicalPool` address |

> **Note:** `.next/` compiled JS and `ZION_OS/desktop/dist/` will still have old addresses. They are cleared on the next rebuild/deploy (§7).

### 3.7 Address mapping table (old → new)

Always record the old→new mapping for audit trail. Example from 2026-08-06 reset:

| Role | Old address | New address |
|------|------------|-------------|
| default_miner | `zion1d6m0h2r8m7k8k2d8n072y7j3j4m0254323vq0e3` | `zion1u4a82230m0a267r785m822u5a3g7n753d7eu5n0` |
| humanitarian | `zion1e0u5q5s660k4m4a634p2c2v358r8g59564054z7` | `zion136m4u7f8s5w3l0e00342s7a4r282275442vm2w3` |
| issobella | `zion1f7y7l5k678y0v408e8s654d2282346k375526t2` | `zion173g835z228z6u303z59603y236r5e854l36g604` |
| pool_payout | `zion1e4489793c5x2r0a0a4d8z7r4u5d6k0s4k3ht5m2` | `zion1k4g2d8s3y4m5v238k0l3v6y5n48894n357uv064` |
| pool_fee | `zion1062522x6a083x6r4d24303l5h20698z7j8qk433` | `zion1e6r72872w0y5w6c3h4e6z847g8z4z7l0n4rj607` |

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

### 6.1 Stop all V31 services

```bash
ssh zion-new "systemctl stop zion-v31-node zion-v31-pool zion-v31-multichain zion-v31-dao zion-v31-oasis"
```

### 6.2 Wipe old chain data

```bash
# Back up first! (§1 pre-flight)
ssh zion-new "mv /data/zion/v31-node.db /data/zion/v31-node.db.pre-reset-$(date +%Y%m%d)"
ssh zion-new "mv /data/zion/v31-pool.db /data/zion/v31-pool.db.pre-reset-$(date +%Y%m%d)"
ssh zion-new "mv /data/zion/dao.db /data/zion/dao.db.pre-reset-$(date +%Y%m%d)"
ssh zion-new "mv /data/zion/oasis.db /data/zion/oasis.db.pre-reset-$(date +%Y%m%d)"
# Also wipe warp.db, pplns-state.json, peers.json — they reference old chain
```

### 6.3 Build + deploy new binaries

```bash
cd ~/2.9.6-main/V31
cargo build --release

# Deploy each binary to Edge
scp target/release/node     zion-new:/opt/zion/V31/target/release/node
scp target/release/pool     zion-new:/opt/zion/V31/target/release/pool
scp target/release/multichain zion-new:/opt/zion/V31/target/release/multichain
scp target/release/dao      zion-new:/opt/zion/V31/target/release/dao
scp target/release/oasis    zion-new:/opt/zion/V31/target/release/oasis
```

### 6.4 Update Edge config files

All Edge env/config files with hardcoded addresses must be updated:

```bash
# Edit on Edge directly (or scp updated versions)
ssh zion-new
vi /etc/zion/edge-environment.sh          # ZION_MINER_ADDRESS, HUMANITARIAN_WALLET, ISSOBELLA_WALLET
vi /etc/zion/edge-v31-pool-environment.sh # POOL_WALLET, fee split addresses
vi /etc/zion/xmr-pool-environment.sh      # if XMR pool references ZION addresses
vi /etc/zion/edge-node2-environment.sh    # node2 miner address
vi /etc/zion/edge-env-no-auxpow.sh        # auxpow-disabled env
vi /etc/zion/config/dao-v31.toml          # DAO guardian addresses, treasury
vi /etc/zion/config/dao-mainnet.toml      # if still referenced (check first)
vi /etc/zion/warp.toml                    # bridge validator addresses
```

### 6.5 Restart services

```bash
ssh zion-new "systemctl start zion-v31-node"
sleep 5
ssh zion-new "systemctl start zion-v31-pool"
sleep 3
ssh zion-new "systemctl start zion-v31-multichain"
ssh zion-new "systemctl start zion-v31-dao"
ssh zion-new "systemctl start zion-v31-oasis"
```

### 6.6 Verify all 5 services active

```bash
ssh zion-new "systemctl is-active zion-v31-node zion-v31-pool zion-v31-multichain zion-v31-dao zion-v31-oasis"
# Expected: active\nactive\nactive\nactive\nactive
```

---

## 7. Verify the new chain

### 7.1 Genesis hash matches

```bash
# On Edge, query the node RPC for block 0
ssh zion-new "echo '{\"jsonrpc\":\"2.0\",\"method\":\"chain_get_block\",\"params\":[0],\"id\":1}' | nc 127.0.0.1 9445"
# The returned hash must match the V31 native genesis hash from §4.
```

### 7.2 Premine balances correct

```bash
# Query each premine address balance — must match the amounts in genesis.rs
ssh zion-new "echo '{\"jsonrpc\":\"2.0\",\"method\":\"address_get_balance\",\"params\":[\"zion172h3y7d6m7d7y7d8q2d4x363t0m55227n2rt2v2\"],\"id\":1}' | nc 127.0.0.1 9445"
# Expected: 8,250,000,000 ZION (slot 1, OASIS+GoldenEgg)
```

### 7.3 Pool fee split correct

Start a miner and submit a share. The pool must split the coinbase 89% / 5% / 5% / 1% to the new addresses:

```bash
# Check pool logs for fee split
ssh zion-new "journalctl -u zion-v31-pool --since '5 min ago' | grep 'share accepted'"
```

### 7.4 OASIS connects to RPC

```bash
ssh zion-new "journalctl -u zion-v31-oasis --since '2 min ago' | grep 'chain_height'"
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
cd ~/2.9.6-main/APP&WEB/website-v2.9
npm run build
# Deploy per APP&WEB/website-v2.9/AGENTS.md §1

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
| `gen-premine-wallets.rs` | 14 premine keypairs | OASIS (5), DAO treasury (3), Infrastructure (3), Humanitarian (1), Bridge (2) |
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

**Keys generated before 2026-08-06 do not have mnemonics.** They were produced by `generate_keypair()` (OS random → BLAKE3 one-way). There is no way to recover them from the secret key or any other data.

For all future resets, use `gen-all-keys-mnemonic.rs` which produces BIP39 24-word mnemonics alongside the raw keys. Store the mnemonics **separately** from the key files (ideally on paper in a physical safe, or metal plate for fire resistance).

If a key file is lost and no mnemonic exists, the funds at that address are **permanently unrecoverable**. This is why the pre-flight checklist (§1) requires an offline backup.

---

## Appendix E — Key management architecture (2026-08-06 audit)

### E.1 Two key systems in ZION

ZION has **two independent key systems** that serve different purposes:

| System | Used by | Key format | Mnemonic? | Recovery |
|--------|---------|-----------|-----------|----------|
| **L1 Wallet CLI** (`V31/L1/core/src/bin/wallet.rs`) | Node, pool, miner, CLI `wallet send/bridge-lock` | Raw Ed25519 secret key (32 bytes / 64 hex) | **No** | SK is the only recovery material |
| **Multi-Chain Keyring** (`V31/L2/multichain/src/wallet/mod.rs`) | SDK, bridge, swap, DAO governance via SDK | BIP39 24-word mnemonic → derive Ed25519 + EVM | **Yes** (24-word BIP39) | Mnemonic recovers all derived keys |

### E.2 How the 2026-08-06 keys were generated

The 2026-08-06 hard reset used **`gen-premine-wallets.rs`** and similar generators that call `zion_core::crypto::generate_keypair()` — **direct Ed25519 keypair generation from OS random** (`OsRng`). No BIP39 mnemonics were produced.

Evidence:
- `/tmp/derive_pubkeys.rs` — a helper script that takes raw Ed25519 secret keys and re-derives pubkeys + addresses via `SigningKey::from_bytes()`. This confirms keys were generated as raw Ed25519, not from mnemonics.
- `~/Desktop/ZION_KEYS_NEW_GENESIS_2026-08-06/` — no `mnemonic` field in any file. `grep -riE 'mnemonic|seed|bip39'` returns 0 results.
- `ADMIN_KEYS.txt` has both Ed25519 SK and EVM SK, but they were generated **independently** (not derived from a common mnemonic). The `gen-all-keys-mnemonic.rs` script derives EVM from the same mnemonic as L1, but that script was **not** used.

### E.3 What this means for wallet access

| Key type | What we have | Sufficient for L1? | Sufficient for L2 multi-chain? |
|----------|-------------|--------------------|-------------------------------|
| Premine (14) | Ed25519 SK + pubkey | **Yes** — `wallet.rs` uses SK directly | **No** — Keyring needs mnemonic to derive |
| Canonical (5) | Ed25519 SK + pubkey | **Yes** | **No** |
| Admin (3) | Ed25519 SK + EVM SK (independent) | **Yes** for L1; EVM SK works for bridge signing | **No** — cannot use `WalletClient::from_mnemonic()` |
| DAO Guardians (7) | Ed25519 SK + pubkey | **Yes** | **No** |
| EVM Validators (5) | EVM SK only | N/A (EVM-only) | **Yes** for EVM signing; **No** for Keyring SDK |

### E.4 Practical impact

- **L1 operations (node, pool, miner, send ZION, bridge lock):** Ed25519 SK is sufficient. The `wallet.rs` CLI loads SK from `ZION_WALLET_SK_HEX` or `ZION_WALLET_KEY_FILE` and signs directly. No mnemonic needed.
- **EVM bridge operations:** EVM SK is sufficient for signing bridge transactions. The `ethers` library can construct a `LocalWallet` from raw SK bytes.
- **Multi-Chain SDK (`WalletClient`):** Requires a BIP39 mnemonic. Cannot be used with the current keys. If SDK integration is needed, either:
  1. Generate new keys with `gen-all-keys-mnemonic.rs` (future reset), or
  2. Construct `Keyring` manually from raw keys (requires code change — add a `Keyring::from_raw_keys()` constructor), or
  3. Use the L1 wallet CLI + EVM wallet independently (bypass Keyring).

### E.5 Recommendation for future resets

**Always use `gen-all-keys-mnemonic.rs`** for future hard resets. It produces:
- 24-word BIP39 mnemonic for each wallet (paper-recoverable)
- Ed25519 SK + pubkey (for L1 wallet CLI)
- EVM SK + address (for bridge validators/admins)

This ensures both key systems work: L1 CLI uses raw SK, Multi-Chain Keyring uses mnemonic. Store mnemonics on paper in a physical safe; store SK files encrypted offline.

### E.6 Key file inventory (2026-08-06)

All key files are in `~/Desktop/ZION_KEYS_NEW_GENESIS_2026-08-06/` (chmod 700):

| File | Contents | Count |
|------|----------|-------|
| `PREMINE_WALLETS.txt` | 14 premine: address + pubkey + Ed25519 SK | 14 |
| `CANONICAL_WALLETS.txt` | 5 canonical: address + pubkey + Ed25519 SK | 5 |
| `ADMIN_KEYS.txt` | 3 admin: L1 address + pubkey + Ed25519 SK + EVM address + EVM SK | 3 |
| `DAO_GUARDIANS.txt` | 7 guardians: L1 address + pubkey + Ed25519 SK | 7 |
| `EVM_VALIDATORS_AND_ESCROW.txt` | 5 validators: EVM address + EVM SK + 1 escrow: L1 address + pubkey + Ed25519 SK | 6 |
| `PUBLIC_ADDRESSES.txt` | All public addresses + pubkeys (no SK) — safe to share | 30 |

**Total: 35 keypairs, 0 mnemonics.**

---

*This playbook was created on 2026-08-06 following the second hard genesis reset in ZION's history. The first was 2026-07-20 (block-retention bug). This document ensures future resets follow a verified, repeatable procedure.*
