# Bridge submit overload report

Generated: 2026-08-22 19:03:01 UTC
Target: http://127.0.0.1:19336/v1/bridge/submit
Requests: 1000
Concurrency: 50
Total time: 0.56s
Throughput: 1793.5 req/s

| Metric | Value |
|--------|-------|
| Status distribution | {"400": 1000} |
| Latency avg | 18.3 ms |
| Latency p50 | 15.7 ms |
| Latency p95 | 43.3 ms |
| Latency p99 | 62.5 ms |
| Latency max | 80.1 ms |

Note: Valid-shaped requests with placeholder addresses are expected to fail
validation; the goal is to confirm the service stays responsive under load.
