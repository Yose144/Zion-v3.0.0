# ZION v2.9 Metrics Reference

This document lists Prometheus metrics exported by the ZION stack and used by Grafana dashboards and alerts.

## Mining Pool (job: `zion-pool`)
- `zion_pool_active_miners`: Number of active miners connected.
- `zion_pool_hashrate_total`: Aggregated pool hashrate (H/s).
- `zion_pool_blocks_found_total`: Total blocks found by the pool.
- `zion_pool_current_block_height`: Latest known block height.
- `zion_pool_shares_accepted_total`: Counter of accepted shares.
- `zion_pool_shares_rejected_total`: Counter of rejected shares.

## Blockchain Node (job: `zion-blockchain`)
- `zion_blockchain_height`: Current chain height.
- `zion_blockchain_peers`: Connected peer count.
- `zion_blockchain_mempool_size`: Transactions in mempool.
- `zion_blockchain_transactions_total`: Total transactions (counter).

## API Gateway (job: `zion-api`)
- `zion_api_requests_total`: Total HTTP requests.
- `zion_api_request_duration_seconds`: Request latency histogram.
- `zion_api_errors_total`: Error counter.
- `zion_api_active_connections`: Active connections.

## Prometheus (job: `prometheus`)
- `up{job="prometheus"}`: Prometheus self-health.

## Scrape Targets
- Pool: `pool:9090`
- Blockchain: `blockchain:9100`
- API: `api:9102`
- Prometheus: `localhost:9090`

## Alert Rules (summary)
- API down: `up{job="zion-api"} == 0` for 2m
- Blockchain stalled: `rate(zion_blockchain_height[10m]) <= 0` for 10m
- Low peers: `zion_blockchain_peers < 2` for 5m
- Pool down: `up{job="zion-pool"} == 0` for 1m
- High reject rate: `rate(rejected)/rate(accepted) > 0.2` for 5m

## Notes
- All metrics paths are `/metrics`.
- Retention: Prometheus stores 30 days with 10GB cap (see compose).
- Dashboards UIDs: `zion-pool-001`, `zion-blockchain-001`.
- Ensure API metrics port `9102` binds to `0.0.0.0` and is exposed in compose.