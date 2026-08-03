# V3 Operations Toolkit

Python-based operational tooling for the ZION V3 mainnet node.
Ported and adapted from the TREE_NODES 2.9 ops toolkit for the V3 runtime.

## Scripts

| Script | Purpose |
|--------|---------|
| `health_check.py` | Comprehensive node health check (RPC, P2P, pool, sync, disk) |
| `monitor.py` | Continuous monitoring with Discord/Telegram alerting |
| `backup.py` | Automated LMDB/config backup with encryption and retention |
| `deploy.py` | Zero-downtime deploy orchestrator for Docker-based V3 nodes |

## Configuration

Copy `config.example.json` and edit:

```bash
cp config.example.json config.json
# Edit config.json with your node addresses, alert webhooks, etc.
```

## Usage

```bash
# One-shot health check
python3 health_check.py

# Continuous monitoring (runs every 60s)
python3 monitor.py

# Backup chain data
python3 backup.py --backup

# List backups
python3 backup.py --list

# Deploy / rolling update
python3 deploy.py --target testnet --action deploy
```

## Requirements

- Python 3.10+
- `aiohttp` for async HTTP
- `aiofiles` for async file I/O (optional)

```bash
pip install aiohttp
```

## Network

These tools connect to V3 nodes via:
- **RPC**: port 8332 (HTTP JSON-RPC)
- **P2P**: port 8334 (TCP)
- **Stratum**: port 3416 (TCP, pool only)
- **Health**: port 8080 (HTTP /health, /metrics)
- **UDP Discovery**: port 8335
