# Incident Report: Singapore Node Fork

**Date:** 2026-04-04  
**Severity:** High  
**Duration:** ~2 days (estimated fork onset) → ~12 min recovery  
**Status:** ✅ RESOLVED

## Summary

The Singapore mainnet node (`v3-mainnet-singapore`, 5.223.84.191) diverged from the canonical chain at height ~9391, producing blocks on an isolated fork with significantly lower difficulty (9,435 vs canonical 21,868). Prague and USA nodes continued on the canonical chain at height 9,515+.

## Detection

Discovered via the Mission Control dashboard at `https://zionterranova.com/dashboard`:
- Singapore: height 9,386, difficulty 9,435
- Prague / USA: height 9,509, difficulty 21,868
- Different `tip_hash` confirmed fork (not simple lag)

## Root Cause

1. `zion-core` container was restarted ~46 minutes before diagnosis (other containers had 2-day uptime)
2. After restart, core loaded chain state from its forked `chain_state.json`
3. Outbound sync failed repeatedly with: `peer batch block at height 9392 does not link to expected parent 000080a7fce7bf8f26187f572e41b2b949976107170de719fdbf98ffb6d0c6c2`
4. `max_reorg_depth=10` in `config/mainnet.toml` — the 125+ block drift exceeded automatic reorg capability
5. Node was stuck in a loop: connect peers → attempt sync → parent mismatch → disconnect → retry

## P2P State During Fork

Despite the fork, Singapore maintained P2P connections to both peers:
- Prague (91.98.122.165:8333) — connected, hello/welcome/status exchanges working
- USA (5.78.194.94:8333) — connected, hello/welcome/status exchanges working
- Block sync failed at the linking step, not the connectivity step

## Resolution

1. SSH to Singapore: `ssh -i ~/.ssh/zion_hetzner_key root@5.223.84.191`
2. Stopped miner and core: `docker stop zion-miner zion-core`
3. Backed up forked state: `cp chain_state.json chain_state.FORKED.bak`
4. Removed forked chain data: `rm chain_state.json`
5. Started core: `docker start zion-core` — triggered fresh IBD
6. IBD completed in ~10 minutes (~1,000 blocks/min from Prague+USA)
7. Started miner: `docker start zion-miner`
8. All 3 nodes confirmed at height 9,529 with matching `tip_hash`
9. Cleaned up backup: `rm chain_state.FORKED.bak`

## Verification

```
Singapore: height=9529 accepted=9530 tip=00005087cfcf8a297627d394...
Prague:    height=9529 accepted=9530 tip=00005087cfcf8a297627d394...
USA:       height=9529 accepted=9530 tip=00005087cfcf8a297627d394...
```

## Recommendations

1. **Auto-fork detection**: Add a health check that compares local `tip_hash` against known peers at the same height — if they diverge, alert or auto-reset
2. **Increase max_reorg_depth**: Consider raising from 10 to 100 to handle longer drifts automatically
3. **IBD fallback on sync failure**: If `outbound_sync_err` repeats N times at the same height, automatically drop local chain and re-IBD
4. **Monitoring alert**: Add Prometheus alert for `height_spread > 20` across the mesh
5. **Root cause of original fork**: Investigate what caused the original core restart and divergence — likely a race condition during block acceptance or a transient disk issue
