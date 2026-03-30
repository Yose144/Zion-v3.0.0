# Zion Metrics Specification

Status: Draft v0.1 (2025-09-26)

## rpc-shim Metrics (Planned)
| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `shim_getblocktemplate_requests_total` | counter | status | Count of GBT attempts (status=ok|error|busy) |
| `shim_getblocktemplate_cache_hits_total` | counter | - | Cache hits |
| `shim_getblocktemplate_duration_seconds` | histogram | - | Latency of upstream daemon GBT calls |
| `shim_submitblock_attempts_total` | counter | result | Attempts grouped by result (accepted|busy|error) |
| `shim_submitblock_duration_seconds` | histogram | result | Submit latency |
| `shim_upstream_active` | gauge | url | 1 if upstream RPC responsive |
| `shim_height` | gauge | - | Latest observed daemon height |

## Pool Metrics
| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `pool_miners_connected` | gauge | - | Active mining sessions |
| `pool_shares_total` | counter | verdict | Shares by verdict (valid|invalid|stale) |
| `pool_difficulty_current` | gauge | - | Current target difficulty (median) |
| `pool_payout_last_seconds` | gauge | - | Seconds since last payout run |
| `pool_jobs_dispatched_total` | counter | - | Jobs sent to miners |

## Node (Daemon) (Expose via exporter or parse logs)
| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `daemon_height` | gauge | - | Current chain height |
| `daemon_alt_blocks` | gauge | - | Alternate blocks count |
| `daemon_tx_pool_size` | gauge | - | Mempool size |
| `daemon_block_time_seconds` | histogram | - | Observed block intervals |
| `daemon_difficulty` | gauge | - | Current network difficulty |

## Wallet Adapter
| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `wallet_rpc_requests_total` | counter | method,status | Wallet RPC calls |
| `wallet_balance_total` | gauge | wallet | Balance per tracked wallet |

## Implementation Plan
1. Add Prometheus client to rpc-shim (Node.js `prom-client`).
2. Wrap GBT + submit calls with timers & counters.
3. Expose `/metrics` endpoint (text format) separate from JSON endpoints.
4. Pool: either patch codebase nebo sidecar parser (phase 2).
5. Basic Grafana dashboard: height, difficulty, submit success ratio, share acceptance.

## Alerting Suggestions
| Condition | Threshold | Action |
|-----------|-----------|--------|
| Submit success ratio < 80% (5m) | <0.8 | Investigate daemon logs |
| Height stagnates > 10 min | >600s | Restart mining layer / notify |
| No new shares 5 min | 5m | Check stratum connectivity |
| Pool miners spike > 5x baseline | anomaly | Potential abuse |

---
Update as metrics are instrumented. Link dashboard JSON once stabilized.
