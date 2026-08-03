# ZION V31 Edge Deploy

Deployment infrastructure for the ZION V31 Mainnet Alpha edge server.

## Structure

```
V31/deploy/
├── systemd/              # systemd service + timer unit files
│   ├── zion-edge-node1.service        # Primary P2P node (genesis)
│   ├── zion-edge-node2.service        # Follower P2P node
│   ├── zion-edge-pool.service         # Mining pool (stratum 8444)
│   ├── zion-edge-bridge.service       # L2 cross-chain bridge relay
│   ├── zion-edge-dao.service          # L2 DAO governance API (8450)
│   ├── zion-edge-warp.service         # L2/L3 cross-chain WARP relay
│   ├── zion-edge-miner.service        # CPU miner (connects to pool)
│   ├── zion-edge-watchdog.service     # Health check + auto-restart
│   ├── zion-edge-watchdog.timer       # Runs watchdog every 2 min
│   ├── zion-edge-backup.service       # DB + config backup
│   ├── zion-edge-backup.timer         # Runs backup every 4 hours
│   ├── zion-edge-maintenance.service  # Disk + RAM optimization
│   ├── zion-edge-maintenance.timer    # Runs maintenance daily at 04:17 UTC
│   ├── journald-zion-limits.conf      # journald storage cap (200M)
│   ├── logrotate-zion-pool.conf       # logrotate for pool log
│   ├── sysctl-zion-ram.conf           # kernel RAM tuning sysctl
│   └── docker-ram-limits.conf         # Docker daemon memory cap
├── config/
│   └── edge-environment.sh            # Shared env vars for all Edge services
├── scripts/
│   └── edge-health-probe.sh           # One-line health status output
├── nginx/
│   └── zion-nginx.conf                # nginx site config (HTTPS + RPC proxy)
├── fail2ban/
│   ├── zion-p2p.conf                  # fail2ban jail for P2P ports 8333/8334
│   └── zion-p2p-filter.conf           # fail2ban filter for P2P errors
├── deploy-edge.sh                     # Main deploy script (SSH + rsync + rebuild)
└── README.md                          # This file
```

## Key Differences from V3 edge-deploy

| Aspect | V3 (edge-deploy) | V31 (this directory) |
|--------|------------------|----------------------|
| Binary path | `/opt/zion/V3/target/release/` | `/opt/zion/V31/target/release/` |
| Node binary | `node` | `zion-node` |
| Pool binary | `server` | `zion-pool` |
| Bridge | `zion-bridge` (separate crate) | `zion-bridge` (multichain crate) |
| WARP | `zion-warp-server` (separate) | `warpd` (multichain crate) |
| Config paths | `/opt/zion/V3/L2/bridge/config/` | `/opt/zion/V31/L2/multichain/bridge/config/` |
| Service names | `zion-edge-*` | `zion-edge-*` (unchanged) |

## Deployment

```bash
# From repo root:
bash V31/deploy/deploy-edge.sh

# Or with custom SSH key:
ZION_EDGE_SSH_KEY=~/.ssh/my-key bash V31/deploy/deploy-edge.sh
```

The deploy script:
1. Verifies SSH access and environment file
2. Backs up current installation
3. rsyncs V31 code to `/opt/zion` on the Edge server
4. Ensures `zion` user and directories exist
5. Rebuilds V31 binaries (`zion-node`, `zion-pool`, `zion-bridge`, `zion-dao`, `warpd`, `zion-miner`)
6. Installs systemd services, timers, and drop-ins
7. Installs fail2ban jail, nginx config, journald/logrotate/sysctl configs
8. Restarts all services in dependency order
9. Verifies deployment status

## Prerequisites

- Edge server at `62.171.141.136` reachable via SSH
- SSH key at `~/.ssh/zion-edge-post-wipe-2026-07-29`
- `/etc/zion/edge-environment.sh` with real secrets (not placeholders)
- Rust toolchain on the Edge server (`/root/.cargo/env`)
