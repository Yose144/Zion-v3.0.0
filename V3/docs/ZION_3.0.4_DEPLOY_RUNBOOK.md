# ZION 3.0.4 Deploy Runbook

**Created:** 2026-06-29
**Status:** ✅ COMPLETED (2026-06-29) — all DeFi contracts deployed, reward pools funded, DAO guardians provisioned, website rebuilt
**Target:** Base Mainnet (chain 8453)

---

## Deploy Results (2026-06-29)

| Kontrakt | Adresa | TX Hash | Detail |
|----------|--------|---------|--------|
| ZIONGovernance | `0xB77eB4ab9468Ce03FBd7eCec70e976EFCfa623E8` | — | Token-weighted voting, quorum 15%, 14d voting |
| ZIONTreasury | `0x455f465ac7e14fdA97dC46fdd74bCa78bfC0aEeD` | — | 3-of-3 multisig |
| ZIONStaking | `0xbd5cEe7878337d22188BFBaF9aa9F39A850Be78B` | `0x9604e075...` (fund) | 12% APR, 7d cooldown, 100K wZION funded |
| ZIONFarm | `0x167B2753F5D8D9F8e62875cc9e379d7804308B08` | `0xb89d6fef...` (fund) | 1 wZION/s, 90d halving, 500K wZION funded |

**Deployer balance after deploy:** 0.0059 ETH, 199,509,960 wZION

**Hardhat config fixes applied:**
- `tsconfig.json`: `"ignoreDeprecations": "6.0"`, `"rootDir": "."`
- `hardhat.config.ts`: multi-compiler 0.8.20 (paris) + 0.8.26 (cancun) for OpenZeppelin v5 `mcopy`
- All deploy/fund scripts: `await sleep(3000)` after each TX (public Base RPC 1 in-flight limit)

**Remaining:**
- [ ] Basescan verify (needs `BASESCAN_API_KEY` from https://basescan.org/myapikey)
- [ ] L2 watcher update: `L1Block` struct add `account_transactions` field + watcher.rs scan account-model memo TXs

---

## Prerequisites

- Deployer wallet: `0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186`
- ETH balance: ≥ 0.005 ETH on Base Mainnet (for 4 contract deploys + reward seed txs)
- Current ETH balance: ~0.006 ETH (sufficient for deploy, tight for seed funding)
- Basescan API key: https://basescan.org/myapikey
- SSH access to Edge server: `root@100.76.16.108`

---

## P1 — DeFi Contracts Deploy (ZIONStaking + ZIONFarm + ZIONGovernance + ZIONTreasury)

### Step 1: Prepare hardhat environment

```bash
cd V3/L2/contracts/hardhat

# Install dependencies (first time only, ~2 min)
npm install

# Copy env template
cp .env.mainnet.example .env

# Edit .env — fill in:
#   DEPLOYER_PRIVATE_KEY=0x...  (deployer wallet private key)
#   BASESCAN_API_KEY=...        (from https://basescan.org/myapikey)
# WZION_ADDRESS, BRIDGE_ADDRESS, ATOMIC_SWAP_ADDRESS are already set in the template
```

### Step 2: Compile contracts (verify no errors)

```bash
npx hardhat compile
```

Expected: `Compiled 7 Solidity files successfully`

### Step 3: Deploy Governance + Treasury + Staking

```bash
npx hardhat run scripts/deploy-defi.ts --network base
```

Expected output:
```
═ ZION DeFi Stack Deploy — ZIONGovernance + ZIONTreasury + ZIONStaking ═
Network:  base (chain 8453)
Deployer: 0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186
Balance:  0.006 ETH
wZION:    0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6
Guardian: 0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186
APR:      1200 bps (12%)

✅ ZIONGovernance deployed: 0x...
✅ ZIONTreasury deployed:   0x...
✅ ZIONStaking deployed:    0x...
✅ Saved to deployed-defi.json
```

### Step 4: Deploy Farm

```bash
npx hardhat run scripts/deploy-farm.ts --network base
```

Expected output:
```
🌾 Deploy ZIONFarm — network: base
wZION:          0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6
Admin:          0xdde17506...
Guardian:       0xdde17506...
Reward/sec:     1.0 wZION/s
Halving:        every 90 days

✅ ZIONFarm deployed: 0x...
✅ Pool 0 added: wZION single-asset (100 alloc pts)
✅ Pool 1 added: wZION/WETH LP placeholder (200 alloc pts)
✅ Saved to deployed-farm-base.json
```

### Step 5: Fund reward pools

```bash
# Fund staking reward pool (100K wZION)
npx hardhat run scripts/fund-staking.ts --network base

# Fund farm reward pool (500K wZION)
npx hardhat run scripts/fund-farm.ts --network base
```

> **Note:** This requires wZION balance on deployer wallet. Current: ~98M wZION available.

### Step 6: Verify on Basescan

```bash
npx hardhat run scripts/verify-base-mainnet-basescan.ts --network base
```

### Step 7: Update website config

After deploy, read the addresses from `deployed-defi.json` and `deployed-farm-base.json`,
then update `APP&WEB/website-v2.9/src/lib/defi-contracts.ts`:

```typescript
export const CONTRACTS = {
  // ... existing ...
  ZIONStaking:    '0x<from deployed-defi.json>',
  ZIONFarm:       '0x<from deployed-farm-base.json>',
  ZIONGovernance: '0x<from deployed-defi.json>',
  ZIONTreasury:   '0x<from deployed-defi.json>',
} as const;

// These flags will auto-flip to true:
export const STAKING_DEPLOYED = true;
export const FARM_DEPLOYED = true;
export const GOVERNANCE_DEPLOYED = true;
```

### Step 8: Verify website

```bash
cd APP&WEB/website-v2.9
npm run build
# Check /defi/staking page — "Deploy pending" banner should disappear
# Check /defi/farming page — "Deploy pending" banner should disappear
```

---

## P2 — Atomic Swap E2E Test

### Current state
- Atomic swap daemon: **ACTIVE** on Edge (port 8452)
- Escrow address: `zion1y0j484d5e8r49785d253e8w0c2x4t3n792m5724`
- EVM contract: `0x3DE9Ad42716854083ab837706E3961d10B0e63Eb` (Base Mainnet)
- **Blocker:** Escrow needs 5-10 ZION for L1 release TX fees

### Step 1: Fund escrow address

Send 5-10 ZION to `zion1y0j484d5e8r49785d253e8w0c2x4t3n792m5724` from any L1 wallet.

Verify on Edge:
```bash
ssh root@100.76.16.108
# Check escrow balance via RPC
echo '{"jsonrpc":"2.0","id":1,"method":"getAddressInfo","params":["zion1y0j484d5e8r49785d253e8w0c2x4t3n792m5724"]}' | nc -q1 127.0.0.1 8443
# Expect: balance_flowers > 0
```

### Step 2: Generate HTLC secrets

```bash
# Generate preimage (32 bytes random)
PREIMAGE=$(openssl rand -hex 32)
echo "Preimage: $PREIMAGE"

# Generate hashlock (SHA-256 of preimage)
HASHLOCK=$(echo -n "$PREIMAGE" | xxd -r -p | sha256sum | awk '{print $1}')
echo "Hashlock: $HASHLOCK"
```

### Step 3: L1 Lock TX (memo: SWAP:LOCK)

Send L1 transaction with memo `SWAP:LOCK:<hashlock>:<evm_address>:<amount_zion>:<timelock_blocks>`

Example:
```
SWAP:LOCK:<HASHLOCK>:0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186:10:1000
```

This locks 10 ZION on L1 with the hashlock. The atomic swap daemon will detect it.

### Step 4: Verify daemon detection

```bash
ssh root@100.76.16.108
journalctl -u zion-edge-atomic-swap -f --since "1 min ago"
# Look for: "Detected SWAP:LOCK memo" log entry
```

### Step 5: EVM Claim ( HTLC)

The daemon should automatically claim on EVM using the preimage. Verify:

```bash
# Check atomic swap API
curl http://127.0.0.1:8452/api/swaps | jq
# Look for swap status: "claimed" or "completed"
```

### Step 6: Create ATOMIC_SWAP_RUNBOOK.md

After successful E2E test, document the full procedure in `docs/ATOMIC_SWAP_RUNBOOK.md`.

---

## P3 — DAO Guardians + Voting E2E

### Current state
- DAO daemon: **ACTIVE** on Edge (port 8450)
- L1 scanner: **FIXED** (DAO_L1_RPC=127.0.0.1:8443, no /jsonrpc suffix)
- Treasury addresses: configured (3 genesis premine outputs)
- **Missing:** Guardian keypairs not yet provisioned

### Step 1: Generate 5-7 guardian keypairs

On Edge server (or air-gapped machine):
```bash
ssh root@100.76.16.108

# Generate guardian keys using zion-cli
for i in 1 2 3 4 5 6 7; do
  echo "=== Guardian $i ==="
  zion-cli keygen --label "guardian-$i"
done
```

Save outputs securely — these are the guardian private keys.

### Step 2: Add guardians to DAO config

Edit `/root/zion-2.9.6-main/V3/L2/dao/config/dao-mainnet.toml`:

```toml
# ── Guardians ────────────────────────────────────────────────────────────────
[[guardians]]
name       = "guardian-1"
address    = "zion1..."  # from keygen output
public_key = "ed25519hex..."  # from keygen output

[[guardians]]
name       = "guardian-2"
address    = "zion1..."
public_key = "ed25519hex..."

# ... repeat for guardians 3-7
```

### Step 3: Restart DAO service

```bash
ssh root@100.76.16.108
systemctl restart zion-edge-dao
journalctl -u zion-edge-dao -f --since "10 sec ago"
# Look for: "Loaded N guardians" log entry
```

### Step 4: Verify co-admins API

```bash
curl http://127.0.0.1:8450/api/dao/co-admins | jq
# Expect: array of guardian objects
```

### Step 5: Voting E2E test

1. Create a test proposal via API:
```bash
curl -X POST http://127.0.0.1:8450/api/dao/proposals \
  -H "Content-Type: application/json" \
  -H "x-dao-key: $ZION_DAO_API_KEY" \
  -d '{"title":"Test Proposal","description":"E2E voting test","proposer":"guardian-1"}'
```

2. Cast a vote via L1 memo TX:
   - Send L1 transaction with memo `DAO:vote:<proposal_id>:yes`
   - Wait 15 seconds (scan interval)

3. Verify vote recorded:
```bash
curl http://127.0.0.1:8450/api/dao/proposals/<id>/votes | jq
# Expect: vote from guardian-1 with "yes"
```

4. Check website DAO page — vote should appear in UI.

---

## Post-Deploy Checklist

- [ ] P1: ZIONStaking deployed + verified on Basescan
- [ ] P1: ZIONFarm deployed + verified on Basescan
- [ ] P1: ZIONGovernance deployed + verified on Basescan
- [ ] P1: ZIONTreasury deployed + verified on Basescan
- [ ] P1: Staking reward pool funded (100K wZION)
- [ ] P1: Farm reward pool funded (500K wZION)
- [ ] P1: `defi-contracts.ts` updated with real addresses
- [ ] P1: Website /defi/staking shows live data
- [ ] P1: Website /defi/farming shows live data
- [ ] P2: Escrow funded (5-10 ZION)
- [ ] P2: E2E swap test completed (L1 lock → EVM claim)
- [ ] P2: `ATOMIC_SWAP_RUNBOOK.md` created
- [ ] P3: 5-7 guardian keypairs generated
- [ ] P3: Guardians added to dao-mainnet.toml
- [ ] P3: DAO service restarted + co-admins verified
- [ ] P3: Voting E2E test passed
- [ ] Update `V3/ROADMAP.md` — mark P1/P2/P3 as complete
- [ ] Update `L2Complete.md` — add 3.0.4 closure section
- [ ] Update `StatusV3.md` — 3.0.4 milestone complete

---

## Rollback

### P1 Rollback (if deploy fails)
- No rollback needed — failed deploys just cost gas, no state change
- If contracts deployed but broken: pause via guardian, redeploy
- Website: revert `defi-contracts.ts` to placeholder addresses

### P2 Rollback (if atomic swap fails)
- Escrow funds are timelocked — will refund after timelock expires
- No EVM state change until claim TX succeeds
- Daemon can be stopped: `systemctl stop zion-edge-atomic-swap`

### P3 Rollback (if DAO guardians break)
- Remove guardian entries from dao-mainnet.toml
- Restart DAO service
- Proposals/votes in DB are preserved
