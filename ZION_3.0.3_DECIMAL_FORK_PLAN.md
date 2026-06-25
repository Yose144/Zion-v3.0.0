# ZION 3.0.3 — Decimal Fork Plan (preserves block history)

> **Status:** APPROVED IN PRINCIPLE by repo owner, 2026-06-25.
> Scheduled execution: 2026-06-26 (tomorrow).
> Authors: Copilot (this document), to be executed by repo owner +
> Kimi 2.7 or any compatible agent.
> Last-mile validator: human review of every cargo test output before
> cutover.

---

## 0. Audience & how to read this plan

This plan is written so that **another LLM agent (Kimi 2.7 or
equivalent)** can pick it up cold and execute. Every step is
self-contained and lists:

- Exact file path(s) to touch
- Exact constant(s) / line(s) to change
- Exact shell command(s) to run
- Pass/fail criteria for the step
- Rollback action if the step fails

If you (the agent) are unsure, **STOP** and ask the repo owner before
proceeding past the L1 boundary. L1 edits are irreversible on mainnet
per [`AGENTS.md`](./AGENTS.md) → "L1 / Consensus Security Protocol".

Two related documents you MUST read first:

1. [`docs/CANONICAL_UNITS_AUDIT.md`](./docs/CANONICAL_UNITS_AUDIT.md)
   — current RPC contract reality and three coexisting conventions.
2. [`docs/3.0.3-DECIMAL-MIGRATION-PROPOSAL.md`](./docs/3.0.3-DECIMAL-MIGRATION-PROPOSAL.md)
   — the four options analyzed; this plan implements **Option E**
   (block-history-preserving variant of Option C), which the owner
   chose because losing block hashes 1..H was unacceptable.

---

## 1. TL;DR

### CZ

- Měníme `FLOWERS_PER_ZION` z `10¹²` na `10⁶`.
- **Bloky 0..H zůstávají v DB**, jejich hashe se nemění, explorer
  vidí celou historii.
- Na bloku H+1 je **migration block** — speciální coinbase, která
  burnuje všechny staré UTXO a vytváří nové s amount `/10⁶`.
- Od H+1 nový `protocol_version = 2`, nová emise, nový reward,
  nový minimum fee — vše ve flowers (10⁶).
- Bridge `FLOWERS_TO_WEI_FACTOR` se mění z `10⁶` na `10¹²`
  (matches Monero/XMR ergonomy; clean 1:1 s Cardano/Cosmos).
- Stejný release uzamkne canonical RPC pojmenování (`_flowers`
  všude, `_zion_display` jen pro floats).

### EN

- Change `FLOWERS_PER_ZION` from `10¹²` to `10⁶`.
- **Blocks 0..H stay on disk**, their hashes do not change, the
  explorer keeps the full history.
- Block H+1 is a **migration block** — special coinbase that burns
  every legacy UTXO and re-issues new ones with `value / 10⁶`.
- From H+1 onwards: new `protocol_version = 2`, new emission, new
  block reward, new min fee — all in flowers (10⁶).
- Bridge `FLOWERS_TO_WEI_FACTOR` switches from `10⁶` to `10¹²`
  (Monero/XMR style; clean 1:1 with Cardano/Cosmos).
- Same release locks the canonical RPC naming (`_flowers` everywhere,
  `_zion_display` only for floats).

---

## 2. Why now (and not later)

Three independent pressures align this week:

1. **`getBlockTemplate._zion` bug.** RPC field is mis-named —
   contains flowers but the suffix promises ZION. A UI consumer
   would render 5.4 quadrillion ZION instead of 5 400.067. Fixing
   this cleanly already requires a non-breaking RPC contract bump
   (see [`CANONICAL_UNITS_AUDIT.md`](./docs/CANONICAL_UNITS_AUDIT.md)
   §3b.3). Bundling the decimal change costs ~nothing extra.

2. **Three coexisting naming conventions** (`_flowers`, `_atomic`,
   mis-named `_zion`). The longer we wait the more code accumulates
   that hard-codes one of them. Now is the cheapest possible time
   to canonicalize.

3. **Pre-launch window still open.** Mainnet is at height ~15 259
   with ~82 M ZION mined. No external public bridge wraps exist
   yet, no exchanges listed, no real-money tx flows. Cost of a
   protocol bump today ≈ 0; cost in 6 months ≈ painful hard fork
   governance vote.

Doing it tomorrow trades 1 day of careful engineering for ~12
months of "we should have done it earlier" tech debt.

---

## 3. Approach: Option E — In-place fork with migration block

### 3.1 What stays the same

- Block hashes 0..H, header chain, all tx hashes pre-H.
- Genesis block (#0) and its 14 premine outputs — addresses identical,
  amounts identical **on disk** (the bytes don't change). Their
  *interpretation* changes via the migration block.
- Chain ID, peer protocol magic, P2P listen ports.
- All canonical wallet addresses
  ([`AGENTS.md`](./AGENTS.md) — Humanitarian, ISSOBELLA, Pool Fee,
  Default Miner, Pool Payout, Genesis Creator, Bridge Vault,
  Bridge Seed Fund).
- Network topology (Edge VPS as primary).

### 3.2 What changes at H+1

- **All live UTXOs** burned + re-issued with `value / 10⁶`.
- **All account-model balances** rewritten with `balance / 10⁶`.
- **DAO treasury, bridge locks, pool pending balances** rewritten
  with `balance / 10⁶`.
- `FLOWERS_PER_ZION = 1_000_000` from block H+1 onwards.
- `protocol_version = 2` from block H+1 onwards.
- New emission constants (block reward, min fee, max output, dust
  threshold) — all expressed in NEW flowers.
- Bridge `FLOWERS_TO_WEI_FACTOR = 1_000_000_000_000` (×10¹²).

### 3.3 What is lost

- Sub-micro-ZION precision (10⁻⁷ to 10⁻¹² ZION) — irrelevant at
  our fee level (min fee = 0.001 ZION).
- **Dust loss** = `Σ (old_balance % 10⁶)` across all addresses.
  Expected total: << 1 ZION. Documented in migration receipt.

---

## 4. Activation height H

### 4.1 Selection rule

```
H = max(current_height + 1440, current_height + 24 * 60 * 60 / 60)
   = current_height + 1440 blocks    (≈ 24 hours at 60s blocks)
```

The +24h buffer gives miners, pool, dashboard and any external
observer time to upgrade binaries.

### 4.2 Decision step (to be run before cutover on 2026-06-26)

```bash
# On Edge (or any node):
CURRENT_HEIGHT=$(curl -sX POST \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"getSupplyInfo","params":{}}' \
  http://77.42.71.94:8443/jsonrpc | jq -r '.result.height')
H=$((CURRENT_HEIGHT + 1440))
echo "Migration block (H+1) will be: $((H + 1))"
echo "Snapshot height (H) will be:    $H"
```

Pin both numbers in `docs/3.0.3-migration-receipt.md` (created in
Phase 5) BEFORE any code change.

---

## 5. Code change matrix (exact paths and constants)

> Each row is one edit. Apply in the order listed. After each row,
> run `cargo check --manifest-path V3/Cargo.toml -p <crate>`. If
> check fails, STOP and revert that row.

### 5.1 L1 core

| File | Line / symbol | Before | After | Why |
|------|---------------|--------|-------|-----|
| [`V3/L1/core/src/emission.rs`](./V3/L1/core/src/emission.rs) | `FLOWERS_PER_ZION` | `1_000_000_000_000` | `1_000_000` | Core constant |
| [`V3/L1/core/src/emission.rs`](./V3/L1/core/src/emission.rs) | doc comment | "12 decimals" | "6 decimals (post-3.0.3 fork)" | Doc accuracy |
| [`V3/L1/core/src/emission.rs`](./V3/L1/core/src/emission.rs) | `TOTAL_SUPPLY` formula | unchanged (`144_000_000_000_u128 * FLOWERS_PER_ZION as u128`) | unchanged | Value auto-updates |
| [`V3/L1/core/src/emission.rs`](./V3/L1/core/src/emission.rs) | `GENESIS_PREMINE` formula | unchanged | unchanged | Value auto-updates |
| [`V3/L1/core/src/emission.rs`](./V3/L1/core/src/emission.rs) | block reward fn | check `BLOCK_REWARD` constant, scale to NEW flowers | new value = `5_400_067_000` | Was `5_400_067_000_000_000` |
| [`V3/L1/core/src/emission.rs`](./V3/L1/core/src/emission.rs) | `format_zion` test asserts | `"1.000000000000"` | `"1.000000"` | 6 decimals string |
| [`V3/L1/core/src/emission.rs`](./V3/L1/core/src/emission.rs) | `TOTAL_SUPPLY` test assert | `144_000_000_000_000_000_000_000_u128` | `144_000_000_000_000_000_u128` | New magnitude |
| [`V3/L1/core/src/emission.rs`](./V3/L1/core/src/emission.rs) | `GENESIS_PREMINE` test assert | `16_780_000_000_000_000_000_000_u128` | `16_780_000_000_000_000_u128` | New magnitude |
| [`V3/L1/core/src/fee.rs`](./V3/L1/core/src/fee.rs) | `MIN_TX_FEE` | `1_000` | `1` | 0.001 ZION = 1 new flower |
| [`V3/L1/core/src/fee.rs`](./V3/L1/core/src/fee.rs) | doc comment | "1 ZION = 1e12 flowers" | "1 ZION = 1e6 flowers (post-3.0.3)" | Doc accuracy |
| [`V3/L1/core/src/fee.rs`](./V3/L1/core/src/fee.rs) | error msg "minimum 1,000 flowers (0.001 ZION)" | as text | "minimum 1 flower (0.001 ZION)" | UX accuracy |
| `V3/L1/core/src/wallet.rs` | local `FLOWERS_PER_ZION` (if any duplicate) | `1_000_000_000_000` | `1_000_000` OR import from `emission` | De-duplicate |
| `V3/L1/core/src/genesis.rs` | premine outputs | values stored as-is on disk | **NO CHANGE** — old genesis bytes preserved | Block hash continuity |
| `V3/L1/core/src/lib.rs` | `PROTOCOL_VERSION` | `1` | `2` (or add `LEGACY_PROTOCOL_VERSION = 1`) | Cutover marker |
| `V3/L1/core/src/consensus.rs` | block validation | add `if height <= H { use legacy units } else { use new units }` switch in coinbase reward check | new function | The only place where validation needs to know |

### 5.2 L1 → migration block (new code)

| File | What | Notes |
|------|------|-------|
| `V3/L1/core/src/migration.rs` (NEW) | `pub fn build_migration_block(state_at_h: &ChainState) -> Block` | Coinbase has N outputs, one per non-dust UTXO/account at H, each with `value / 10⁶` |
| `V3/L1/core/src/migration.rs` (NEW) | `pub const MIGRATION_HEIGHT: u64 = <H+1>` | Hard-coded after Phase 4 |
| `V3/L1/core/src/migration.rs` (NEW) | `pub const DUST_BURN_FLOWERS_NEW: u64 = <sum>` | Hard-coded after Phase 4 |
| `V3/L1/core/src/blockchain.rs` | block apply path | special-case `MIGRATION_HEIGHT`: skip normal coinbase emission, accept the migration coinbase as authoritative state rewrite | Single conditional |
| `V3/L1/core/src/rpc.rs` | every method returning amounts | add `_flowers` suffix; if old method returned `_atomic` or mis-named `_zion`, keep old field as alias for one release | Per `CANONICAL_UNITS_AUDIT.md` §3b.5 |

### 5.3 L2 bridge

| File | Symbol | Before | After |
|------|--------|--------|-------|
| `V3/L2/bridge/src/types.rs` | `FLOWERS_PER_ZION` | `1_000_000_000_000` | `1_000_000` |
| `V3/L2/bridge/src/types.rs` | `FLOWERS_TO_WEI_FACTOR` | `1_000_000` | `1_000_000_000_000` |
| `V3/L2/bridge/src/types.rs` | doc | "12 decimals" | "6 decimals" |
| `V3/L2/bridge/src/types.rs` | `MIN_BRIDGE_AMOUNT` | `100 * FLOWERS_PER_ZION` (unchanged) | unchanged | Auto-rescales |
| `V3/L2/bridge/src/relay.rs` | wrap/unwrap math | uses constants above | recompiles automatically |
| Bridge startup | runtime assertion | none | `assert!(FLOWERS_PER_ZION == 1_000_000)` | Crash loud if old binary loaded |

### 5.4 L2 DAO

| File | Symbol | Action |
|------|--------|--------|
| `V3/L2/dao/src/types.rs` | any local `FLOWERS_PER_ZION` | unify to `1_000_000` (or import from `zion-core`) |
| `V3/L2/dao/src/api.rs` | RPC field naming | rename `available_atomic` → `available_flowers`, `amount_atomic` → `amount_flowers`; keep old names as aliases for 1 release |
| `V3/L2/dao/src/governance.rs` | `weightFlowers` | already canonical ✅ |

### 5.5 L2 atomic-swap, L3 WARP, L3 NCL

- Audit each crate for hard-coded `1_000_000_000_000` or `1e12`.
- Replace with `import emission::FLOWERS_PER_ZION` from `zion-core`.
- WARP cross-chain decimal table already updated in
  [`docs/WARP_ARCHITECTURE.md`](./docs/WARP_ARCHITECTURE.md).

### 5.6 L1 pool

| File | Change |
|------|--------|
| `V3/L1/pool/src/payout.rs` | uses `FLOWERS_PER_ZION` constant — auto-recompiles |
| `V3/L1/pool/src/server.rs` | min payout threshold (if hard-coded in old flowers) → divide by 10⁶ |
| Pool RPC | `paid_total`, `pending_balance` should now be in NEW flowers — UI auto-converts via `/ FLOWERS_PER_ZION` |

### 5.7 L1 miner

- No code changes needed — miner submits shares against block template
  from pool; pool already speaks NEW protocol after restart.
- Verify `ZION_PAYOUT_ADDRESS` env var still valid (addresses unchanged).

### 5.8 Frontend / clients

| Component | Action |
|-----------|--------|
| `APP&WEB/website-v2.9/src/lib/constants.ts` | `FLOWERS_PER_ZION = 1_000_000` (was `1_000_000_000_000`). `flowersToZion` / `zionToFlowers` already correct via constant. Deprecated aliases (`ATOMIC_UNITS_PER_ZION`) follow automatically. |
| `APP&WEB/website-v2.9/src/lib/zion-rpc.ts` | drop local `ATOMIC_PER_ZION`, import from `constants.ts` |
| `APP&WEB/website-v2.9/src/lib/dao-api.ts` | rename `available_atomic` / `amount_atomic` → `available_flowers` / `amount_flowers` (matches new DAO API) |
| `APP&WEB/website-v2.9/src/components/MinerDashboard.tsx` | replace raw `/ 1e12` with `flowersToZion(x)` |
| `APP&WEB/desktop-agent/**` | any `FLOWERS_PER_ZION` constant → `1_000_000` |
| `APP&WEB/mobile-app/src/constants/blockchain.js` | `FLOWERS_PER_ZION` → `1_000_000` |
| `APP&WEB/zion-wallet-sdk/**` | same |
| `ZION_OS/dashboard/app.py` | any `1e12` or `1_000_000_000_000` literal → `1_000_000` |
| `ZION_OS/desktop/**` (Tauri Rust) | import from `zion-core` |

### 5.9 Documentation

After cutover, update in this order:

1. [`AGENTS.md`](./AGENTS.md) — section "Canonical Units" — replace
   "1 ZION = 10¹² flowers" with "1 ZION = 10⁶ flowers (since v3.0.3,
   block H+1)"; keep historical paragraph about pre-3.0.3 = 10¹² for
   archeology.
2. [`docs/CANONICAL_UNITS_AUDIT.md`](./docs/CANONICAL_UNITS_AUDIT.md)
   — close the three-conventions section as "resolved at v3.0.3".
3. [`docs/WARP_ARCHITECTURE.md`](./docs/WARP_ARCHITECTURE.md) —
   rebuild the decimal table for the new factors (×10¹² to EVM,
   ×1 to Cardano/Cosmos).
4. [`docs/ROADMAP.md`](./docs/ROADMAP.md) and
   [`docs/MAINNET_ROADMAP_2026.md`](./docs/MAINNET_ROADMAP_2026.md)
   — flip the Sub-unit row from `10¹²` to `10⁶`.
5. [`README.md`](./README.md) — if it mentions decimals, update.
6. [`WHITEPAPER.md`](./WHITEPAPER.md) — "Atomic unit | 1 ZION = …" →
   `1 ZION = 1_000_000 flowers`.
7. Create [`docs/3.0.3-migration-receipt.md`](./docs/3.0.3-migration-receipt.md)
   with: chosen H, snapshot SHA256, dust total, per-address before/after.

---

## 6. Test plan (must pass before cutover)

Run on a local devnet first — DO NOT run any of this against the
live Edge node until Phase 4.

```bash
cd V3
# 1. Workspace compiles after every code change above
cargo check --workspace
# 2. Core unit tests (consensus, emission, fee)
cargo test -p zion-core --release
# 3. Pool tests
cargo test -p zion-pool --release
# 4. Full workspace
cargo test --workspace -- --test-threads=1
# 5. Lints clean
cargo clippy --workspace --all-targets -D warnings
# 6. Fmt clean
cargo fmt --all --check
```

Manual checks (local devnet):

- `zion-cli height` returns expected value.
- `getBalance` for a known address returns `old_balance / 1_000_000`
  in NEW flowers, with the corresponding ZION display unchanged.
- `getSupplyInfo.circulating_supply_flowers ==
   getSupplyInfo.circulating_supply_atomic / 1_000_000`
  (legacy alias preserved).
- `getBlockTemplate.reward_flowers == reward_zion_display * 1_000_000`
  (the mis-named field bug is closed).
- Bridge wrap dry-run: lock 100 ZION on L1 → mint wZION on Anvil
  EVM fork → must produce `100 * 10¹⁸` wei (= `100 * 10⁶ * 10¹²` =
  `100 ZION` in EVM units).

---

## 7. Cutover runbook (the actual day)

### Phase 0 — T-12h preflight (2026-06-26 morning)

- [ ] Confirm chosen H is in the future by at least 1 hour.
- [ ] Tag rollback point: `git tag pre-3.0.3 && git push --tags`.
- [ ] Hetzner snapshot of Edge VM.
- [ ] Backup `/root/zion-2.9.6-main/V3/data/` to off-box storage.
- [ ] Stop pool deposits/withdrawals (atomic-swap creation locked).
- [ ] Post public notice on website: "Decimal denomination upgrade
      scheduled at block H+1, expected at <UTC timestamp>."

### Phase 1 — T-2h state freeze

- [ ] On Edge: `zion-cli snapshot export --at-height H
       --out /root/migration-snapshot.json
       --include-utxo --include-accounts --include-dao
       --include-bridge`.
- [ ] Compute SHA256, pin in repo and in post-cutover receipt.
- [ ] Build the migration block payload off-line:
       `zion-cli migration build-block
        --snapshot /root/migration-snapshot.json
        --new-flowers-per-zion 1000000
        --out /root/migration-block.bin`.
- [ ] Hard-code resulting `MIGRATION_HEIGHT`, `DUST_BURN_FLOWERS_NEW`
       and the block hash into `V3/L1/core/src/migration.rs`.
- [ ] `cargo build --release --workspace`.

### Phase 2 — T-30min binary roll

- [ ] On Edge: copy new binaries into
       `/usr/local/bin/zion-node-new`, `zion-pool-new`,
       `zion-bridge-new`, `zion-dao-new`, `zion-swap-new`,
       `zion-warp-new`.
- [ ] Do **not** swap yet.

### Phase 3 — T-5min: stop old services

- [ ] `systemctl stop zion-edge-pool zion-edge-bridge
       zion-edge-dao zion-edge-atomic-swap zion-edge-warp
       zion-edge-miner zion-edge-node1 zion-edge-node2`.
- [ ] Backup DBs again (incremental, only what changed since Phase 0).

### Phase 4 — T-0: swap binaries + restart

- [ ] `mv /usr/local/bin/zion-node /usr/local/bin/zion-node-old`
- [ ] `mv /usr/local/bin/zion-node-new /usr/local/bin/zion-node`
- [ ] Repeat for every binary.
- [ ] `systemctl start zion-edge-node1`.
- [ ] Wait for node to load chain up to H.
- [ ] Submit the migration block via privileged operator wallet:
       `zion-cli migration submit
        --block-file /root/migration-block.bin
        --signer <operator-key>`.
- [ ] Node accepts block at height H+1. Log line:
       `MIGRATION_COMPLETE protocol_version=2 dust_burned=<N> flowers`.
- [ ] Start node2, pool, bridge, DAO, swap, WARP, miner.

### Phase 5 — T+10min smoke tests

- [ ] `getBalance` for the 14 premine addresses — must return
       `original_premine / 1_000_000` in NEW flowers.
- [ ] Pool emits a block at H+2 with correct new emission.
- [ ] Miner produces shares accepted by pool.
- [ ] Website live at zionterranova.com renders new numbers
       correctly (no `5.4 quadrillion ZION` anywhere).
- [ ] Dashboard `127.0.0.1:8766` shows green for every Edge service.
- [ ] Bridge does a small (1 ZION) wrap round-trip on a local Anvil
       fork to confirm new `FLOWERS_TO_WEI_FACTOR`.

### Phase 6 — T+1h public receipt

- [ ] Commit and push
       [`docs/3.0.3-migration-receipt.md`](./docs/3.0.3-migration-receipt.md)
       with:
  - Snapshot SHA256
  - Migration block hash
  - H and H+1 timestamps
  - Total dust burned (flowers + ZION equivalent)
  - Before/after table for the 14 premine addresses
- [ ] `git tag v3.0.3-mainnet && git push --tags`.

---

## 8. Rollback plan

If anything in Phase 4–5 fails:

```bash
# Stop everything
systemctl stop zion-edge-*

# Swap binaries back
mv /usr/local/bin/zion-node /usr/local/bin/zion-node-failed
mv /usr/local/bin/zion-node-old /usr/local/bin/zion-node
# Repeat for every binary.

# Restore DB from Phase 0 backup if migration block was committed
cp -r /root/backup-pre-3.0.3/* /root/zion-2.9.6-main/V3/data/

# Start old services
systemctl start zion-edge-node1 zion-edge-node2 zion-edge-pool ...
```

Hetzner snapshot from Phase 0 is the worst-case restore.

---

## 9. Risk register

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | Migration block has wrong amount for some address | Critical | Cross-verify snapshot sum vs `getSupplyInfo.circulating_supply_atomic` at H. |
| R2 | Old binary loaded by mistake post-cutover | High | Add runtime panic if `chain_height >= MIGRATION_HEIGHT && FLOWERS_PER_ZION != 1_000_000`. |
| R3 | Bridge operator forgets to update wei factor | High | Bridge startup checks `assert!(FLOWERS_TO_WEI_FACTOR == 1_000_000_000_000)` else exits. |
| R4 | Pool keeps old `pending_balance` numbers in NEW flowers (double-counted) | Medium | Pool restart MUST clear local payout cache; force re-sync from on-chain. |
| R5 | UI shows mixed old/new numbers during the swap window | Low | Website shows a maintenance banner from Phase 3 to Phase 5. |
| R6 | Bridge re-mint to wZION holders forgotten (pre-existing wraps) | Low | Currently zero public wraps exist (no exchange listed wZION). Document explicitly that this risk is empty. |
| R7 | Snapshot exporter doesn't yet exist (`zion-cli snapshot export`) | High | **Implement this as the very first task** of Phase 1 work tomorrow. Without it, migration block can't be built. |
| R8 | Tests fail after constant change because they hard-code old magnitudes | Medium | Plan §5.1 already lists every test assertion to update. Run full workspace tests before Phase 0. |
| R9 | Block H+1 hash unstable across rebuilds | Medium | Migration block is deterministic given snapshot SHA256 + new constant. Build once on a reference machine; pin the hash. |
| R10 | Reorg around height H reverses the snapshot | Low | H is +1440 blocks (~24h) above current; reorg depth cap is 10. Choose H from a 60-block-confirmed snapshot for safety. |

---

## 10. Open decisions (need owner answer before Phase 1)

1. **Confirm direction.** Owner has said OK to L1 change preserving
   blocks → this plan. Sign here: `[ ] yes / [ ] no, hold`.
2. **Confirm `+1440 block` upgrade window** (≈24h). Larger window =
   more time to react but more chain growth to snapshot.
3. **Rounding rule for `value / 10⁶`.**
   Recommendation: floor (drop the remainder, sum as dust burn).
4. **Compensate dust loss?** Expected < 1 ZION total. Drop or
   transfer to DAO treasury?
5. **Keep old `_atomic` field names as aliases for how long?**
   Recommend: 1 release (3.0.3), drop in 3.0.4.
6. **Migration block signer.** Which canonical operator key signs
   the migration coinbase? Default: Pool Payout signer key
   (`MAINNET_CANONICAL_POOL_PAYOUT_WALLET`).
7. **Post-launch tag:** `v3.0.3-mainnet` (default) or `v4.0.0-mainnet`
   to signal the breaking unit change?

---

## 11. Sign-off matrix

| Role | Name | Sign | Date |
|------|------|------|------|
| Repo owner / L1 consensus authority | (owner) | _______ | _______ |
| Plan author | Copilot | (this file) | 2026-06-25 |
| Execution agent | Kimi 2.7 / Copilot | _______ | 2026-06-26 |
| Human last-mile validator | (owner) | _______ | 2026-06-26 |

---

## 12. Quick reference for the executing agent

If you start tomorrow and only have time to read 10 lines, read these:

1. Constant change: `FLOWERS_PER_ZION = 1_000_000` (was `1_000_000_000_000`).
2. Bridge constant: `FLOWERS_TO_WEI_FACTOR = 1_000_000_000_000` (was `1_000_000`).
3. Blocks 0..H stay on disk — do NOT touch genesis bytes.
4. New code: `V3/L1/core/src/migration.rs` (build_migration_block + MIGRATION_HEIGHT).
5. Block H+1 is the migration coinbase — burns old UTXOs, issues new ones at value/10⁶.
6. After H+1, every wallet/pool/bridge speaks new units. Old binaries crash by design.
7. Run `cargo test -p zion-core --release` after every L1 edit; STOP if anything red.
8. RPC contract bump (`_flowers` everywhere, drop `_atomic`/mis-named `_zion`) is in
   [`docs/CANONICAL_UNITS_AUDIT.md`](./docs/CANONICAL_UNITS_AUDIT.md) §3b.5.
9. Cutover sequence: snapshot → build migration block → swap binaries → submit block.
10. Rollback = Hetzner snapshot + Phase 0 DB backup. Don't be a hero.

---

## 13. Cross-references

- [`AGENTS.md`](./AGENTS.md) — L1 protection rules; canonical addresses.
- [`docs/CANONICAL_UNITS_AUDIT.md`](./docs/CANONICAL_UNITS_AUDIT.md) —
  current RPC mess, recommended cleanup (§3b.5).
- [`docs/3.0.3-DECIMAL-MIGRATION-PROPOSAL.md`](./docs/3.0.3-DECIMAL-MIGRATION-PROPOSAL.md) —
  four-option analysis that led to this plan.
- [`docs/GENESIS_REGENERATION_RUNBOOK.md`](./docs/GENESIS_REGENERATION_RUNBOOK.md) —
  reference for binary swap / Edge restart sequence.
- [`docs/WARP_ARCHITECTURE.md`](./docs/WARP_ARCHITECTURE.md) —
  decimal conversion table; needs update after cutover.
- [`StatusV3.md`](./StatusV3.md) — current chain status; will record
  the cutover as a major milestone.

---

*End of plan. Total estimated execution time: 4–6 hours of focused
work + 24h of upgrade window. Have water, snacks and a clear head.*
*Peace and One Love. — Copilot, 2026-06-25*
