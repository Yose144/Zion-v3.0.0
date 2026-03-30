# ZION Mining Stack - SSH Server Deployment Guide

## Quick Deployment

### 1. Prerequisites on SSH Server
```bash
# Ensure Docker and docker-compose installed
docker --version
docker-compose --version

# Create network (if not exists)
docker network create zion-seeds 2>/dev/null || true
```

### 2. Update Paths for Your Server
Edit `docker/compose.mining-production.yml` and update:
```yaml
volumes:
  # Change this path to your ZION1 location
  - /your/path/to/ZION1/adapters/uzi-pool-config:/config:ro
```

### 3. Deploy Mining Stack
```bash
# Start mining services (assumes seed nodes already running)
docker-compose -f docker/compose.mining-production.yml up -d

# Check status
docker-compose -f docker/compose.mining-production.yml ps

# View logs
docker-compose -f docker/compose.mining-production.yml logs -f
```

### 4. Test Mining Connection
```bash
# Test pool connectivity
curl -s http://localhost:18089/ | jq
nc -zv localhost 3333

# Test XMRig connection
xmrig --url=localhost:3333 \
      --user=Z3222ywic7fGUZHv9EfFwEKf1VJRrEqPbLrHgRiBb43LWaS1Cz2gVwgdF2kvUPsGb9jSvUUf31oNCSZgNEtUiGDT4sBLtXmGzc \
      --pass=x --algo=rx/0
```

## Important Notes

### For SSH Servers:
- Update volume mount paths to match your server location
- Ensure proper firewall rules for ports 3333 and 18089
- Seed nodes should be running first (separate compose file)

### Environment Variables:
All Z3 addresses are pre-configured for current mining test:
- **Mining Address**: `Z3222ywic7fGUZHv9EfFwEKf1VJRrEqPbLrHgRiBb43LWaS1Cz2gVwgdF2kvUPsGb9jSvUUf31oNCSZgNEtUiGDT4sBLtXmGzc`
- **Pool Address**: Same as mining address
- **RPC Shim**: Configured for bootstrap mining phase

### Troubleshooting:
```bash
# Check rpc-shim can reach seed nodes
docker exec zion-rpc-shim curl -s http://zion-seed1:18081/getheight

# Check pool can reach rpc-shim  
docker exec zion-uzi-pool curl -s http://rpc-shim:18089/

# Manual pool restart if needed
docker-compose -f docker/compose.mining-production.yml restart uzi-pool
```

## Production Checklist
- [ ] Updated volume paths for server location
- [ ] Seed nodes healthy and synced
- [ ] Network `zion-seeds` exists
- [ ] Firewall allows ports 3333, 18089
- [ ] Z3 mining addresses backed up securely
- [ ] Monitor logs for successful mining connections

---
Ready for production deployment! 🚀