# Zion OS Orchestrator

## Overview

Zion OS Orchestrator je kompletni system pro rizeni celeho Zion Mainnet ekosystemu. Definuje vsechny sluzby, jejich zavislosti, porty, health checky a orchestruje jejich beh.

## Architecture

```
Zion OS Orchestrator/
├── manifest.yaml                      # Hlavni definice vsech sluzeb
├── orchestrator.py                    # Python orchestrator CLI
├── docker-compose.orchestrator.yml    # Docker Compose orchestrace
├── systemd/                           # systemd service definice
│   ├── zion-node.service
│   ├── zion-pool.service
│   ├── zion-dashboard-web.service
│   └── zion-orchestrator.service
└── README.md                          # Tento soubor
```

## Services

### L1 - Core Layer
| Service | Port | Description |
|---------|------|-------------|
| zion-node | 8333, 8443, 8445, 9115 | P2P sync, consensus, mempool, RPC |
| zion-pool | 8444, 8455, 8080 | Stratum mining, share validation |
| zion-miner | - | CPU/GPU mining (Metal, CUDA, OpenCL) |

### L2 - Service Layer
| Service | Port | Description |
|---------|------|-------------|
| zion-bridge | 9102 | Cross-chain bridge daemon |
| zion-dao | 8450 | DAO daemon + Axum API |
| zion-atomic-swap | 8452 | HTLC swap daemon |

### L3 - WARP Layer
| Service | Port | Description |
|---------|------|-------------|
| zion-warp | 8453 | Cross-chain relay daemon |

### L4 - AI Layer
| Service | Port | Description |
|---------|------|-------------|
| zion-hiranyagarbha | 8001 | Orchestrator, RAG, Consciousness |
| zion-hiran-inference | 8002 | LLM inference API |

### L5 - Operator Layer
| Service | Type | Description |
|---------|------|-------------|
| zion-cli | CLI | Unified operator CLI |
| zion-mining-agent | Agent | Multi-GPU mining agent |

### L6 - Application Layer
| Service | Port | Description |
|---------|------|-------------|
| zion-dashboard-web | 8766 | Python Flask dashboard |
| zion-desktop-dashboard | - | Tauri v2 desktop app |
| zion-mobile-app | - | React Native mobile app |
| zion-website | 3000 | Next.js website |

### Monitoring Stack
| Service | Port | Description |
|---------|------|-------------|
| zion-prometheus | 9090 | Metrics collection |
| zion-grafana | 3100 | Visualization dashboards |
| zion-alertmanager | 9093 | Alert routing |
| zion-node-exporter | 9100 | Host system metrics |

### Auto-Update
| Service | Port | Description |
|---------|------|-------------|
| zion-auto-update | 8767 | Automatic updates |

## Quick Start

### 1. Using Python Orchestrator

```bash
# Start all services (default profile: mainnet)
cd ZION_OS/orchestrator
python3 orchestrator.py start

# Start specific service
python3 orchestrator.py start --service zion-node

# Start with profile
python3 orchestrator.py start --profile minimal
python3 orchestrator.py start --profile dev
python3 orchestrator.py start --profile mainnet
python3 orchestrator.py start --profile full

# Check status
python3 orchestrator.py status
python3 orchestrator.py status --service zion-node

# Watch mode (continuous monitoring)
python3 orchestrator.py watch --interval 10

# Health report
python3 orchestrator.py health

# Stop all
python3 orchestrator.py stop

# Restart specific service
python3 orchestrator.py restart --service zion-node
```

### 2. Using Docker Compose

```bash
# Start all services
cd ZION_OS/orchestrator
docker compose -f docker-compose.orchestrator.yml up -d

# View logs
docker compose -f docker-compose.orchestrator.yml logs -f

# Scale services
docker compose -f docker-compose.orchestrator.yml up -d --scale zion-node=2

# Stop
docker compose -f docker-compose.orchestrator.yml down
```

### 3. Using systemd (Production)

```bash
# Copy service files
sudo cp ZION_OS/orchestrator/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload

# Enable and start services
sudo systemctl enable zion-node.service zion-pool.service zion-dashboard-web.service zion-orchestrator.service
sudo systemctl start zion-node.service zion-pool.service zion-dashboard-web.service zion-orchestrator.service

# Check status
sudo systemctl status zion-*

# View logs
sudo journalctl -u zion-node -f
```

## Profiles

### minimal
- zion-node
- zion-pool
- zion-miner
- zion-dashboard-web

### dev
- L1 services
- L2 services
- Dashboard
- Desktop dashboard

### mainnet
- L1 services
- L2 services
- L3 services
- Dashboard
- Desktop dashboard
- Mining agent
- Website

### full
- Vsechny sluzby vcetne monitoringu a AI

## Health Checks

### Types
- **tcp** - TCP port check
- **http** - HTTP endpoint check
- **rpc** - JSON-RPC check
- **log** - Log pattern matching
- **process** - Process existence check

### Configuration
```yaml
health_check:
  type: http
  endpoint: "http://127.0.0.1:8443/jsonrpc"
  interval: 10s
  timeout: 5s
```

## Alerting

### Rules
- **node_down** - Restart node, notify push + email
- **pool_down** - Restart pool, notify push + email
- **miner_stalled** - Restart miner, notify push
- **high_memory** - Notify push + email
- **disk_full** - Notify push + email

### Channels
- Push notifications (mobile app)
- Email
- Webhook
- Slack/Discord

## Network Topology

### Edge (Primary)
- Host: MainnetEdge
- VPN IP: 100.76.16.108
- Public IP: 77.42.71.94
- Services: Node, Pool, Bridge, DAO, Atomic Swap, WARP, Hiranyagarbha, Website, Monitoring

### Core (Backup)
- Host: local-pc
- VPN IP: 100.86.102.5
- Services: Node, Miner, Mining Agent, Dashboard, Desktop Dashboard

### macOS (Miner)
- Host: macos-local
- VPN IP: 100.100.46.39
- Services: Node, Miner, Mining Agent, Dashboard

## Logging

### Global Configuration
- Level: info
- Format: JSON
- Rotation: Daily
- Retention: 30 days
- Max size: 100MB

### Service Logs
- Node: `logs/node.log`
- Pool: `logs/pool.log`
- Miner: `logs/miner.log`
- Dashboard: `logs/dashboard.log`
- Orchestrator: `logs/orchestrator.log`

## Security

### SSH
- Edge key: `ssh-key-zion-edge`
- Tailscale VPN required

### API
- JWT authentication
- Rate limiting: 100 req/min

### Wallet
- AES-256-GCM encryption
- Keyring storage

## Backup & Recovery

### Schedule
- Daily at midnight
- Retention: 7 days

### Targets
- Node state: `V3/data/`
- Logs: `logs/`
- Dashboard data: `ZION_OS/dashboard/data/`

## Troubleshooting

### Service won't start
1. Check dependencies are running
2. Check port conflicts
3. Check logs: `tail -f logs/<service>.log`
4. Check manifest: `python3 orchestrator.py status`

### Health check failing
1. Verify service is running: `pgrep -f <binary>`
2. Test endpoint manually: `curl <endpoint>`
3. Check firewall rules
4. Check logs for errors

### High memory usage
1. Check which service is consuming memory
2. Adjust resource limits in manifest
3. Restart service
4. Check for memory leaks

## Development

### Adding New Service
1. Add to `manifest.yaml`
2. Define health check
3. Add to profiles
4. Create systemd service (optional)
5. Update documentation

### Testing
```bash
# Unit tests
python3 -m pytest tests/

# Integration tests
python3 orchestrator.py start --profile minimal
python3 orchestrator.py health
```

## License

MIT License - ZION Project
