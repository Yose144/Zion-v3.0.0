# Edge-as-Primary Deploy Report — 2026-06-02

## Summary

Successfully migrated the canonical 24/7 ZION V3 mainnet stack to the **Edge server (Hetzner VPS, 100.76.16.108)**. The local PC now acts as a backup node + GPU miner host. All services are managed by systemd and survive reboots autonomously.

## Deploy Steps Executed

### 1. Code sync to Edge
- Cleaned old `/root/zion-2.9.6-main` on Edge
- Rsynced only `V3/` (Rust sources, ~13 MB without targets) and `edge-deploy/` (configs, systemd services)
- Copied local Linux binaries (`node`, `server`) to Edge to avoid Rust build (toolchain not installed on Edge)

### 2. Environment & systemd
- Installed `edge-environment.sh` with burn-model settings:
  - `ZION_SEED_PEERS=none` (Edge is greenfield genesis source)
  - `ZION_VARDIFF_MAX_DIFF=10000`
  - `ZION_PPLNS_WINDOW_SIZE=500000`
  - No `ZION_POOL_FEE_WALLET` (1% burned)
- Installed systemd services:
  - `zion-edge-node.service` — primary chain node (Restart=always)
  - `zion-edge-pool.service` — primary pool (Restart=always, depends on node)
  - `zion-edge-watchdog.timer` — healthcheck every 2 minutes
- Enabled auto-start on boot

### 3. Genesis wipe & start
- Removed old `edge-state.db` for clean burn-model genesis
- Started `zion-edge-node` then `zion-edge-pool`
- Both services reported **active**

## Test Results

### Health checks
| Check | Edge (100.76.16.108) | Local (127.0.0.1) |
|-------|---------------------|-------------------|
| Node RPC /health | `{"status":"ok"}` | `{"status":"ok"}` |
| Chain height | 31 (primary, mining) | 23 (syncing from Edge) |
| P2P peer | — | Connected to Edge |
| Pool TCP 8444 | Open, accepting miners | — |

### Fee split verification (burn model)
From Edge node logs, every block coinbase has exactly **3 outputs**:
- Miner (89%): `4806059630000000` flowers
- Humanitarian (5%): `270003350000000` flowers
- Issobella (5%): `270003350000000` flowers
- Pool fee: **burned** (`pool_fee_address=""`)

Total subsidy: `5400067000000000` flowers = 5.4 ZION
89 + 5 + 5 = 99% distributed, 1% burned.

### Miner connections
Both local miners (CPU + GPU) successfully connected to Edge pool at `100.76.16.108:8444`:
- `cpu-worker-local` — submitting accepted shares
- `gpu-worker-local` — submitting accepted shares
- Pool log shows `valid_share` and `share_status=Accepted` for both workers

### P2P sync
- Local backup node (`local-backup-node`) connected to Edge via Tailscale VPN
- Receiving blocks from Edge, height advancing (23 vs Edge 31)
- Genesis hash matches on both nodes

## Topology

```
Edge (Hetzner VPS, 100.76.16.108)
  zion-edge-node.service  -> P2P 8333, RPC 8443
  zion-edge-pool.service  -> Stratum 8444

Local PC (100.86.102.5)
  launch-local-backup.sh:
    - Node (backup) -> syncs from Edge:8333
    - CPU miner -> connects to Edge:8444
    - GPU miner -> connects to Edge:8444
```

## Operational Notes

- **Watchdog**: `zion-edge-watchdog.timer` runs every 2 min, checks RPC + TCP, auto-restarts dead services
- **Logs**: `journalctl -u zion-edge-node -f` / `journalctl -u zion-edge-pool -f`
- **Deploy updates**: Run `bash edge-deploy/deploy-edge.sh` from local PC
- **Reboot survival**: Both services enabled via `systemctl enable`, start automatically

## Issues / Observations

1. **Port conflict on first start**: Old `zion-node` process (PID 1318776) was holding port 8333. Killed manually; systemd then started the new service successfully.
2. **Local PC sync lag**: Local backup node runs ~8 blocks behind Edge. This is expected for P2P sync and improves as the chain grows.
3. **Pool wallet balance zero**: On a fresh chain the pool wallet has no balance until enough blocks are mined and rewards mature. Payouts will trigger once funds are available.

## Next Steps

- Monitor Edge pool payouts over next hour to verify burn-model payout execution
- Verify local GPU miner hashrate is stable (~3 KH/s expected)
- Consider installing Rust toolchain on Edge for future binary builds
