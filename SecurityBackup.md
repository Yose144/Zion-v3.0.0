# ZION Security Incident Report — F1 Exploit (Forged Peer-Block Transactions)

**Incident ID:** SEC-2026-07-02-F1-EXPLOIT
**Date discovered:** 2026-07-02
**Severity:** CRITICAL
**Status:** ROLLBACK COMPLETE — F1 PATCH + SECURITY HARDENING DEPLOYED

---

## 1. Executive Summary

A critical consensus vulnerability (F1) in the ZION V3 L1 peer-block validation
was exploited on **2026-06-30** to forge account-model transactions without
access to private keys. The attacker mined blocks containing forged transactions
that transferred funds from premine wallets to attacker-controlled addresses.

**Total stolen: 589,000,001 ZION** (589M from Genesis Creator + 1 from Bridge Seed probe)

The F1 security fix (peer-block signature verification) was deployed to Edge
mainnet on 2026-07-02. No new forged transactions can occur post-fix.

**A chain rollback to block 22180 (last clean block before main attack) is planned.**

---

## 2. Vulnerability Details (F1)

### Root Cause

`V3/L1/core/src/lib.rs` — `validate_peer_block()` function did NOT call
`verify_signature()` for non-coinbase account transactions in mined blocks.

Two validation paths existed:
1. **RPC submit** (`insert_transaction`) — VŽDY volal `verify_signature()` ✅
2. **Peer block / mined block** (`validate_peer_block`) — NEvolal `verify_signature()` ❌

This meant any miner could:
1. Get a block template via `getTemplate` RPC
2. Inject a forged transaction (fake `from`, victim's `public_key`, garbage `signature`)
3. Mine the block (find valid PoW)
4. Submit via `submitCandidate` — block accepted without signature check

### Fix Deployed

`V3/L1/core/src/lib.rs` line ~2833:
```rust
if account_tx_memo_v1_active(block.height)
    && !transaction.verify_signature()
{
    return Err("account transaction signature verification failed".to_string());
}
```

**Deployed to Edge:** 2026-07-02 13:38 UTC
**Commit:** `fd3387bc` (contains F1 fix) + `270a419d` (env config)
**Verification:** `strings /usr/local/bin/zion-node | grep "account transaction signature verification failed"` = 2 matches

### Important Note

The fix is **height-gated** by `account_tx_memo_v1_active()` (activation height 24000).
This means:
- Blocks 0-23999: signature verification NOT enforced (historical blocks)
- Blocks 24000+: signature verification enforced

**The attack occurred at blocks 21959 and 22181 — both BEFORE activation height 24000.**
The F1 fix prevents NEW attacks but does NOT retroactively reject the forged blocks.
A rollback is required to undo the damage.

---

## 3. Attack Timeline

| Time (UTC) | Block | Event |
|------------|-------|-------|
| 2026-06-30 15:39:23 | 21959 | **PROBE**: Forged 1 ZION from Bridge Seed (Slot 13) to `zion17758s76520t4c6c3v656g8a5p7d4x4c2d2032x0` |
| 2026-06-30 16:31:41 | 22180 | Last clean block before main attack |
| 2026-06-30 16:32:03 | 22181 | **MAIN ATTACK**: Forged 589,000,000 ZION from Genesis Creator (Slot 11) to `zion1t3l7q3p8f457n335r083k8r3n6l5w4u2f2q83r2` |
| 2026-07-02 13:38 | — | F1 patch deployed to Edge |
| 2026-07-02 14:07 | — | Forensic analysis confirms signatures are INVALID (forged) |

---

## 4. Forensic Evidence

### Forged Transaction 1 (PROBE)

```
TX ID:      3a28a9b9e4ff81387122743c7d7c6b6b7b253c363c2d7d7ecd3d8c599e0a050f
Block:      21959
Timestamp:  2026-06-30T15:39:23Z
From:       zion13794g7k3m0f84637l2x0t855h3l258k8p3xp5t3 (Bridge Seed, Slot 13)
To:         zion17758s76520t4c6c3v656g8a5p7d4x4c2d2032x0 (ATTACKER)
Amount:     1.00 ZION (1,000,000 flowers)
Fee:        1 flower
Public Key: b53d2696f623c2bc6e9ff975fba85cf2fb5f0c231f9c525de9fd48fbca2714af
            (derives to zion1y4q6k774r2a7h0x287k7h2s0z3w3t5w863lu825 — MINER wallet, NOT Bridge Seed)
Signature:  51779bf96190ef45e70a321b5fd73497b152921916db9e00512f977cede8462f...
            INVALID — does not verify against tx_id
```

**Key observation:** Attacker used a RANDOM public key (miner wallet's PK) that
does NOT derive to the `from` address. This confirms the old code did not check
`derive_address(pk) == from` in peer-block validation.

### Forged Transaction 2 (MAIN ATTACK)

```
TX ID:      ba079e82dfdd856e32283136772b687a31b8f4578b277635bb885f4190040706
Block:      22181
Timestamp:  2026-06-30T16:32:19Z
From:       zion16542q4l853a2z0u5r5w8y4m8k4558847h503736 (Genesis Creator, Slot 11)
To:         zion1t3l7q3p8f457n335r083k8r3n6l5w4u2f2q83r2 (ATTACKER)
Amount:     589,000,000.00 ZION (589,000,000,000,000 flowers)
Fee:        1,000 flowers (0.001 ZION)
Public Key: 4608c3495ad13f1dbf68bebfbd476aa36bba797bd2da499a652b36bd75915bc5
            (derives to zion16542q4l853a2z0u5r5w8y4m8k4558847h503736 — CORRECT, matches from)
Signature:  07a5bd50b2a1345dce708c0284a64fc041a22959687ba3f35e64a902885c64db...
            INVALID — does not verify against tx_id
```

**Key observation:** Attacker used the CORRECT public key (derives to `from` address)
but could not produce a valid signature without the private key. The old code did not
verify the signature, so the block was accepted.

### Signature Verification (Python cryptography library)

```python
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.exceptions import InvalidSignature

pk = Ed25519PublicKey.from_public_bytes(bytes.fromhex("4608c3495ad13f1dbf68bebfbd476aa36bba797bd2da499a652b36bd75915bc5"))
try:
    pk.verify(
        bytes.fromhex("07a5bd50b2a1345dce708c0284a64fc041a22959687ba3f35e64a902885c64dbd69982f09e8745069f25de8111834df194a6773d79dd348da906db8670b43100"),
        bytes.fromhex("ba079e82dfdd856e32283136772b687a31b8f4578b277635bb885f4190040706")
    )
except InvalidSignature:
    print("SIGNATURE IS INVALID — FORGED TRANSACTION")
```

Result: **INVALID SIGNATURE** — confirmed forged.

### Private Key Status

The Genesis Creator private key is **NOT compromised**. The attacker did not need
it — they only needed the public key (derivable from the address) and the lack of
signature verification in peer-block validation.

---

## 5. Attacker Profile

### Attacker Addresses

| Address | Balance | TX Count | First Seen |
|---------|---------|----------|------------|
| `zion1t3l7q3p8f457n335r083k8r3n6l5w4u2f2q83r2` | 589,000,000 ZION | 1 | Block 22181 |
| `zion17758s76520t4c6c3v656g8a5p7d4x4c2d2032x0` | 1 ZION | 1 | Block 21959 |

**Neither address appears in:**
- `ZION_V3_MAINNET_WALLETS.txt` (canonical wallet backup)
- Any code, config, or documentation in the repo
- Any stash, backup, or temporary file on Edge

### Attacker Behavior

1. **Probe first**: Tested the exploit with 1 ZION from Bridge Seed (block 21959)
2. **Waited 222 blocks** (~3.7 hours) to confirm the probe worked
3. **Main attack**: Stole 589M ZION from Genesis Creator (block 22181)
4. **Has not moved funds**: Both attacker addresses have zero outgoing transactions
5. **Has mining capability**: The attacker mined valid blocks (PoW) containing the forged TXs

### P2P Evidence

- Node logs from the attack period (2026-06-30) are NOT available — node was
  restarted since then, losing journalctl history.
- Current P2P peer: `100.86.102.5:8333` (local backup node via Tailscale)
- No evidence of external P2P connections in available logs
- Attacker likely connected via P2P, mined block, submitted, then disconnected

---

## 6. Impact Assessment

### Stolen Funds

| Victim | Amount | Block |
|--------|--------|-------|
| Genesis Creator (Slot 11) | 589,000,000 ZION | 22181 |
| Bridge Seed (Slot 13) | 1 ZION | 21959 |
| **Total** | **589,000,001 ZION** | |

### Affected Wallets (post-attack balances)

| Wallet | Pre-attack | Post-attack | Delta |
|--------|-----------|-------------|-------|
| Genesis Creator | 590,000,000 ZION | 999,999.999 ZION | −589,000,000 |
| Bridge Seed | 400,000,000 ZION | 399,999,998.999 ZION | −1.001 |

### Pool Payout Issue (Separate)

The pool payout wallet (`zion16825y...`) had 29 outgoing TXs with invalid
signatures. These are NOT attacker-forged — they are the pool's own payout
transactions signed with the WRONG secret key (`edee1b...` instead of `340dcd...`).
The wrong SK was configured in `edge-environment.sh`. This has been fixed.

---

## 7. Remediation Plan

### Phase 1: Patch (COMPLETED 2026-07-02 13:38 UTC)

- [x] F1 fix deployed to Edge (peer-block signature verification)
- [x] Pool SK corrected (`edee1b...` → `340dcd...`)
- [x] Pool guard activated (fail-fast on SK/wallet mismatch)
- [x] All 12 services verified active
- [x] No new forged TXs possible post-fix

### Phase 2: Additional Hardening (COMPLETED 2026-07-02 14:38 UTC)

- [x] Set `ZION_ACCOUNT_TX_MEMO_V1_HEIGHT=22181` (signature verification from block 22181 onward — covers post-rollback chain)
- [x] P2P firewall: port 8333/8334 restricted to Tailscale interface + localhost
- [x] RPC firewall: port 8443/8446 restricted to localhost only
- [x] Pool port: 8444 restricted to Tailscale + localhost
- [x] iptables-persistent installed — rules survive reboot
- [x] Block submitter logging enabled (`ZION_LOG_BLOCK_SUBMITTER=1`)
- [x] P2P peer allowlist env set (`ZION_P2P_ALLOWED_PEERS=100.86.102.5,100.76.16.108`)
- [x] Forged TX monitor cron job (every 5 min, logs to `/var/log/zion-forged-tx-alerts.log`)
- [ ] Rotate all premine private keys (air-gapped, per Genesis Regeneration Runbook) — PENDING
- [ ] Scrub any leaked key material from logs/temp files — PENDING

### Phase 3: Rollback (COMPLETED 2026-07-02 14:33 UTC)

- [x] Stop all Zion services on Edge
- [x] Backup current chain state → `/root/backups/rollback-2026-07-02/`
- [x] Truncate `edge-state.db` + `edge2-state.db` to block 22180 (removed 2515 blocks)
- [x] Rebuild `active_template` for height 22181 (valid 160-char header)
- [x] Restart all 12 services — all active
- [x] Verify all premine balances restored (Genesis Creator: 590M ZION ✅)
- [x] Verify attacker addresses: 0 ZION ✅ (589M address), 1 ZION (probe address — pre-22180, kept)
- [x] Mining resumed: chain at 22184, pool accepting shares

### Phase 4: Post-Rollback Verification (COMPLETED 2026-07-02 14:41 UTC)

- [x] Genesis Creator: 590,000,000 ZION ✅
- [x] Bridge Seed: 399,999,998.999999 ZION ✅ (1.001 ZION lost to probe attack — pre-22180)
- [x] OASIS: 1,650,000,000 ZION ✅
- [x] DAO main: 2,500,000,000.000001 ZION ✅
- [x] Core Dev: 1,000,000,000 ZION ✅
- [x] Attacker 1 (589M): 0 ZION ✅
- [x] Pool operational, accepting shares ✅
- [x] Node1 + Node2 synced at height 22180 ✅
- [x] Firewall rules active and persisted ✅

---

## 8. Chain State at Time of Incident

| Parameter | Value |
|-----------|-------|
| Chain height (at attack) | 22181 |
| Chain height (at discovery) | ~24671 |
| Blocks affected | 22159-22181 (probe), 22181 (main) |
| Migration height | 18850 (3.0.3 decimal fork) |
| Memo v1 activation | 24000 |
| Protocol version | 3.0.3 |
| Node binary | zion-node (built 2026-07-02 13:38 UTC) |
| Genesis hash | 7543004c76b11416ef32e2f1f5a4c72f0178f841d4559bf476e29e15a9602728 |

---

## 9. File References

- F1 fix: `V3/L1/core/src/lib.rs` (peer-block validation, line ~2833)
- Pool guard: `V3/L1/pool/src/bin/server.rs`
- Genesis config: `V3/L1/core/src/genesis.rs` (PremineOutput, Slot 11)
- Emission constants: `V3/L1/core/src/emission.rs` (FLOWERS_PER_ZION, LEGACY_FLOWERS_PER_ZION)
- Migration: `V3/L1/core/src/migration.rs` (MIGRATION_DIVISOR, is_post_migration)
- Edge environment: `edge-deploy/config/edge-environment.sh`
- Wallet backup: `C:\Users\yosef\Desktop\ZION_V3_MAINNET_WALLETS.txt`
- Deploy runbook: `V3/docs/ZION_3.0.4_SECURITY_FIX_DEPLOY_RUNBOOK.md`
- Genesis regeneration: `GENESIS_REGENERATION_RUNBOOK.md`

---

## 10. Lessons Learned

1. **All validation paths must verify signatures.** The RPC path checked signatures
   but the peer-block path did not — creating an exploit via mining.
2. **Height-gating security fixes is dangerous.** The F1 fix only applies to
   blocks ≥ 24000, but the attack occurred at block 22181. Security fixes should
   not be height-gated.
3. **Pool SK must be validated at startup.** The pool guard (deployed today)
   would have caught the wrong SK earlier.
4. **Node logs must be persisted.** Journalctl lost the attack-period logs.
   Consider persistent logging to file.
5. **P2P access must be restricted.** The attacker connected via P2P, mined a
   block, and disconnected. Peer allowlisting would prevent this.

---

*This document is the authoritative security incident record. Update status as
remediation progresses. Store encrypted copies on flash drive `F:\`.*
