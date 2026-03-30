# Mining Troubleshooting Runbook

> Draft v0.1 – consolidate common failure modes for Zion mining stack.

## Components
- `ziond` (seed1, seed2) – core daemon (P2P 18080, RPC 18081)
- `rpc-shim` – aggregation / Monero-like JSON-RPC (18089)
- `walletd` – wallet RPC (8070 internal)
- `uzi-pool` – stratum server (3333)
- `xmrig` – miner container(s)
- `redis` – pool backend state

## Quick Health Checklist
1. Containers up: `docker ps --format '{{.Names}}' | grep -E 'zion-(seed|uzi-pool|rpc-shim|walletd|xmrig'`
2. Daemon info: `curl -s http://localhost:18081/get_info | jq` (height > 0)
3. Shim info: `curl -s http://localhost:18089/json_rpc -d '{"jsonrpc":"2.0","id":"0","method":"get_info"}' -H 'Content-Type: application/json' | jq`
4. Pool listening: `ss -ltnp | grep 3333` OR `nc -zv localhost 3333`
5. Xmrig logs show accepted shares (look for `accepted`)

## Common Failure Modes
| Symptom | Probable Cause | Resolution |
|---------|----------------|-----------|
| Miner stuck on "waiting for job" | Pool not generating templates | Check rpc-shim -> get_info; verify node syncing |
| "Invalid wallet address" in pool logs | Wrong address format / legacy hex | Regenerate or update configs; run `tools/validate_wallet_format.py` |
| Connection refused to 3333 | Pool container down / port conflict | `docker logs zion-uzi-pool`; ensure only one service binds 3333 |
| Shares all rejected | Address mismatch or algorithm mismatch | Confirm algo `rx/0`; verify same address across pool + xmrig |
| High stale share % | Latency or thread oversubscription | Reduce threads or optimize CPU affinity |

## Address Validation
```
./tools/validate_wallet_format.py Z321y5Ug...
```
Expected: `VALID`.

## Manual Stratum Login Test
```
echo '{"id":1,"method":"login","params":{"login":"Z321y5Ug...","pass":"x","agent":"diag","rigid":"TEST"}}' | nc -v zion-uzi-pool 3333
```
Should receive JSON with `id":1` and `job` field.

## Logs to Collect
- `docker logs --tail=200 zion-uzi-pool`
- `docker logs --tail=200 zion-rpc-shim`
- `docker logs --tail=120 zion-xmrig-test` (or ryzen)

## Environment Normalization
| Item | Canonical Value |
|------|-----------------|
| Stratum host | `zion-uzi-pool` |
| Stratum port | `3333` |
| Algo | `rx/0` (RandomX) |
| Wallet prefix | `Z3` |
| Daemon RPC | `seed1:18081` / `seed2:18081` |
| Shim RPC | `18089` |

## Next Enhancements
- Add xmrig HTTP API + healthcheck
- Implement checksum decoding for addresses
- Automate config generation from single YAML
- Alerting via Prometheus exporter (pool metrics)

---
Maintainers: update this file when introducing protocol or port changes.
