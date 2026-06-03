# ZION V3 — Service Level Objectives (SLO)

## Overview

This document defines measurable SLOs for the ZION V3 mainnet stack. Each SLO maps to Prometheus metrics and alert rules in `V3/docker/prometheus/alert_rules.yml`.

## L1 Core Node

| SLO | Target | Metric | Alert |
|-----|--------|--------|-------|
| **Availability** | 99.9% | `up{job="zion-core-node1"}` | `CoreNode1Down` |
| **Block time p95** | < 90 s | `zion_block_time_seconds_bucket` | `CoreSyncStalled` (height not changing) |
| **Peer connectivity** | ≥ 1 peer | `zion_peer_count` | `CoreLowPeers` |
| **Block rejection rate** | < 10% | `zion_blocks_rejected_total / accepted_total` | `CoreBlockRejectionSurge` |
| **Sync gap (primary ↔ backup)** | < 5 blocks | `zion_chain_height` diff | `CoreEdgeSyncGap` |

## Pool

| SLO | Target | Metric | Alert |
|-----|--------|--------|-------|
| **Availability** | 99.9% | `up{job="zion-pool"}` | `PoolDown` |
| **Active miners** | ≥ 1 | `zion_pool_active_sessions` | `PoolNoConnections` |
| **Share reject rate** | < 15% | `rejected / (accepted + rejected)` | `PoolHighRejectRate` |

## Bridge Relay

| SLO | Target | Metric | Alert |
|-----|--------|--------|-------|
| **Availability** | 99.5% | `up{job="zion-bridge"}` | `BridgeRelayDown` |
| **L1 watcher lag** | < 10 min | `changes(zion_bridge_last_l1_height[10m])` | `BridgeL1WatcherStalled` |
| **EVM watcher lag** | < 10 min | `changes(zion_bridge_last_evm_block[10m])` | `BridgeEVMWatcherStalled` |
| **Error rate** | < 0.1 / s | `rate(zion_bridge_errors_total[5m])` | `BridgeErrorSurge` |
| **Mint backlog** | < 5 pending | `finalized - confirmed` | `BridgeMintFailure` |
| **Unlock backlog** | < 5 pending | `burns - unlocks` | `BridgeUnlockFailure` |
| **End-to-end latency** | < 15 min | `zion_bridge_l1_locks_finalized_total` → `evm_mints_confirmed_total` delta | (derived from mint/unlock alerts) |

## Infrastructure

| SLO | Target | Metric | Alert |
|-----|--------|--------|-------|
| **Host availability** | 99.9% | `up{job="zion-node-exporter"}` | `HostDown` |
| **Disk free** | > 10% | `node_filesystem_avail_percent` | *(add when node-exporter rules configured)* |
| **Memory free** | > 5% | `node_memory_MemAvailable_percent` | *(add when node-exporter rules configured)* |

## Mempool (Future)

| SLO | Target | Metric | Status |
|-----|--------|--------|--------|
| **Depth** | < 1,000 TX | `zion_mempool_size` | 🔄 Not yet instrumented |
| **Oldest TX age** | < 5 min | `zion_mempool_oldest_seconds` | 🔄 Not yet instrumented |

## Error Budgets

Monthly error budget = (1 - SLO target) × 30 days

| Service | SLO | Monthly Error Budget |
|---------|-----|----------------------|
| Core Node | 99.9% | 43.2 min |
| Pool | 99.9% | 43.2 min |
| Bridge Relay | 99.5% | 3.6 h |
| Host | 99.9% | 43.2 min |

When an error budget is exceeded in a rolling 30-day window:
1. Page on-call (Discord webhook → Alertmanager)
2. Create incident retro within 24h
3. If bridge budget exceeded 2× consecutively, freeze mainnet bridge ops until root cause is fixed

## Dashboard

Grafana dashboard `zion-slo-overview.json` (TBD) will display:
- Current SLO burn rate per service
- Remaining error budget (%) for the month
- Alert firing history

## Related Files

- `V3/docker/prometheus/alert_rules.yml` — alert definitions
- `V3/docker/alertmanager/alertmanager.yml` — routing + Discord
- `V3/ROADMAP.md` Phase 23 — monitoring stack history
