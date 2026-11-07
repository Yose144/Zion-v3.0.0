# Host + payout monitoring — prepared, not deployed (2026-11-07)

Local checks:

```sh
python3 -B -m unittest discover -s V31/deploy/monitoring -p 'test_writepath_probe.py'
cd V31/deploy/monitoring
promtool check rules zion-host.rules.yml zion_writepath.rules.yml
promtool test rules edge-audit.rules.test.yml
```

## Contracts

- `/public/v1/payouts?source=recorded&coin=zion&limit=1` reads durable rows,
  filters the internal coin tag **in SQL before LIMIT**, and never takes the
  in-memory PPLNS lock. DB read error → **503**, not a successful empty list.
- `latest_recorded_ts` is the latest matching ledger timestamp, or **null** for
  an empty ledger. The default feed still prepends queued entries with
  **`ts:null`**; they do not affect the ledger clock. This is a write-path
  signal, **not proof of on-chain payout/finality/solvency**.
- The probe calls the recorded endpoint. Invalid/missing/future timestamps
  never become `now()` or age zero. HTTP reachability and measurement validity
  have separate gauges. No age is emitted when it cannot be measured.
- `zion_writepath_probe_success_timestamp_seconds` marks a completed collection,
  even when a dependency failed; individual failure gauges remain down. If the
  process aborts, node_exporter may serve the old file, but its age now alerts.
- `node-hosts-scrape.yml` is the canonical **one `node` job**, instances `edge1`
  and `edge2`. The two new write-path absence rules explicitly expect
  `{job="node",instance="edge2"}`. **Do not deploy those rules alone against
  the old `edge2` job/labels.**

## Approved rollout only (not executed by this batch)

1. Snapshot the live config/rules/probe and record the currently running pool
   binary; do not reset G8, change holds or alter ledger rows.
2. Deploy the pool read-API change first, under the normal pool deploy/runbook
   approval and canary. Verify the recorded response, ZION coin and timestamp;
   a legacy 200 response without `latest_recorded_ts` is **not compatible**.
3. Install the updated EDGE2 probe, run once, inspect its textfile/metrics:
   measurement validity, last payout age, completion clock, PG failure signals.
   Never print the credential file. A PG timeout is bounded and still allows
   the remaining probes to publish.
4. Merge `node-hosts-scrape.yml` into the real config (not a blind overwrite).
   Replace the old duplicate `node` / `node_exporter` EDGE1 targets and migrate
   the old `edge2` scrape to this job. Preserve other jobs, rules and paths;
   check dashboards/alerts depending on old job/instance selectors. Confirm
   EDGE2 :9100 remains restricted to EDGE1, not publicly opened.
5. Check the merged config and rules with `promtool`. With operator approval,
   start the already-enabled EDGE1 `prometheus-node-exporter` (it was inactive),
   then reload Prometheus. **No node/pool restart is needed for the host/probe/
   rule changes themselves.** The pool API binary rollout in step 2 is separate.
6. Query both `up{job="node"}` targets, memory gauges and the three new alert
   expressions. Observe actual alert delivery and absence recovery; synthetic
   `promtool` tests alone do not prove the live scrape/notification path.

Rollback monitoring as one compatible config/probe/rules set. Rolling the pool
back to an older API makes the new measurement alert fire intentionally; do not
hide that incompatibility by inventing freshness. **QTC payout OFF, PRL dry-run,
BTC swap OFF** remain unchanged.
