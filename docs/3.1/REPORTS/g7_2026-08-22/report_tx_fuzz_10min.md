# Transaction fuzz report

Generated: 2026-08-22 19:12:23 UTC
Target: 127.0.0.1:8443
Duration: 600.0s
Concurrency: 20
Total RPC-ish requests: 2280
Health checks: 114

| Metric | Value |
|--------|-------|
| RPC success | 2227 (97.7%) |
| RPC errors | 53 |
| Health OK | 114 |
| Health fail | 0 |
| RPC latency avg | 1034.0 ms |
| RPC latency p50 | 211.6 ms |
| RPC latency p99 | 10010.8 ms |
| Health latency avg | 215.5 ms |
| Health latency p99 | 670.2 ms |

Note: Errors are expected for malformed / random payloads; the important signal
is that the node stays responsive and does not crash.
