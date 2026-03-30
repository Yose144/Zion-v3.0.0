# ZION Bootstrap: First 60 Blocks Runbook

Goal: Produce the first 60 blocks quickly, reliably, and with audit trails so that wallets, address format, and baseline economics can be validated.

## Success Criteria
- Chain height reaches >= 60
- No orphan streak longer than 3 blocks
- Average inter-block time (post height 5) < 90s (early PoW difficulty settling)
- Pool + shim logs contain structured submit / busy diagnostics
- Wallet balance for pool wallet reflects coinbase maturation once maturity window passes (TBD in consensus doc)

## Prerequisites
1. Images built:
   - `zion:production-fixed` (daemon)
2. Canonical pool wallet address present in:
   - `docker/xmrig*.json`
3. Shim configuration environment (recommended overrides for bootstrap):
   ```
   GBT_CACHE_MS=1500
   BUSY_CACHE_FACTOR=6
   SUBMIT_INITIAL_DELAY_MS=800
   SUBMIT_MAX_BACKOFF_MS=10000
   GBT_DISABLE_CACHE_AFTER_HEIGHT=80   # keep cache while chain very low
   ```
4. Optional background template prefetch:
   - `PREFETCH_WALLET=<pool_address>`
   - `PREFETCH_INTERVAL_MS=4000`

## Launch Sequence
1. Start core + pool + shim stack (adjust compose file as needed):
   ```bash
   docker compose -f docker/compose.single-node.yml up -d seed1 seed2 zion-rpc-shim zion-uzi-pool
   ```
2. Start internal miner container(s) or external XMRig pointed at pool:
   ```bash
   docker compose -f docker/compose.single-node.yml up -d xmrig
   ```
3. Verify shim health:
   ```bash
   curl -s http://localhost:18089/ | jq
   ```
4. Tail shim logs focusing on structured submit lines:
   ```bash
   docker logs -f zion-rpc-shim | grep -E 'submitblock (accepted|busy|error)'
   ```
5. Watch chain height until 60:
   ```bash
   ./tools/watch_height.sh 60
   ```

## Observability
- Prometheus metrics endpoint: `http://<shim-host>:18089/metrics`
  - Key counters:
    - `zion_shim_gbt_requests_total`
    - `zion_shim_gbt_busy_retries_total`
    - `zion_shim_submit_busy_retries_total` (TODO expose new busy counter name if added)
    - `zion_shim_submit_ok_total`
- JSON metrics: `http://<shim-host>:18089/metrics.json`

## Interpreting Logs
- `submitblock accepted {"attempt":N,"height":H}` -> Block accepted (height may lag until next template fetch)
- `submitblock busy (-9)` -> Daemon not ready; backoff expansions normal early.
- Cached template served lines show age & height; excessive age (> cache * factor) indicates stalled template updates.

## Troubleshooting
| Symptom | Action |
|---------|--------|
| Continuous busy (-9) on getblocktemplate | Increase GBT_CACHE_MS temporarily; ensure daemon not re-syncing snapshot |
| submitblock busy every attempt | Check CPU saturation; reduce external miners temporarily |
| Height not advancing after accepts | Query daemon directly (`curl seed1:18081/json_rpc ... getheight`) to confirm; may be orphaned or template cached too long |
| Very old template age | Confirm prefetch loop running OR reduce PREFETCH_INTERVAL_MS |

## Post-60 Actions
1. Raise `GBT_DISABLE_CACHE_AFTER_HEIGHT` to 200 or disable (=-1) once stability confirmed.
2. Capture metrics snapshot and archive logs for audit.
3. Run address validation across mined outputs once maturity passes.
4. Update `MINING_STARTUP_LOG.md` progress section.

## Appendix: Quick Commands
```bash
# Direct height
curl -s seed1:18081/getheight

# Manual template fetch
curl -s "http://localhost:18089/getblocktemplate?wallet_address=$POOL_ADDR&reserve_size=16" | jq '.height'

# Submit raw block (if you have a blob) via shim helper
curl -s "http://localhost:18089/submit?blob=$BLOB"
```

---
Document version: 2025-09-26 bootstrap runbook
