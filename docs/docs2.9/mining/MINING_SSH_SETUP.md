# 🌉 ZION Mining Pool SSH Setup

## Overview

This document explains how to set up SSH tunneling for ZION mining pool access, enabling secure mining connections through encrypted SSH tunnels.

## Quick Start

### 1. Deploy ZION with Mining Pool

```bash
# Deploy to your server
./deploy-ssh.sh 91.98.122.165 root

# This will:
# ✅ Install Docker & dependencies
# 🔥 Configure firewall (ports 22, 18080, 18081, 3333)
# 🚀 Start ZION node + mining pool
# 🌉 Enable SSH tunneling support
```

### 2. Create SSH Tunnel

```bash
# Using the helper script
./scripts/mining-ssh-tunnel.sh 91.98.122.165

# Or manually
ssh -L 3333:localhost:3333 root@91.98.122.165
```

### 3. Connect Your Miner

```bash
# Through SSH tunnel (secure)
xmrig --url stratum+tcp://localhost:3333 --user YOUR_WALLET --algo rx/0

# Direct connection (if firewall allows)
xmrig --url stratum+tcp://91.98.122.165:3333 --user YOUR_WALLET --algo rx/0
```

## Architecture

```
[Local Miner] ←→ [SSH Tunnel] ←→ [Server] ←→ [ZION Pool:3333]
               (localhost:3333)    (91.98.122.165)
```

## Services & Ports

| Service      | Port  | Protocol | Purpose                |
|--------------|-------|----------|------------------------|
| SSH          | 22    | TCP      | Secure tunnel access   |
| ZION P2P     | 18080 | TCP      | Blockchain sync        |
| ZION RPC     | 18081 | TCP      | API & web interface    |
| Mining Pool  | 3333  | TCP      | Stratum mining         |

## SSH Tunnel Commands

### Basic Tunnel
```bash
ssh -L 3333:localhost:3333 root@91.98.122.165
```

### Background Tunnel
```bash
ssh -fN -L 3333:localhost:3333 root@91.98.122.165
```

### Persistent Tunnel with ControlMaster
```bash
ssh -o ControlMaster=yes \
    -o ControlPath=/tmp/zion-tunnel \
    -o ControlPersist=5m \
    -L 3333:localhost:3333 \
    -N root@91.98.122.165
```

### Kill Background Tunnel
```bash
pkill -f "ssh.*3333:localhost:3333"
```

## Mining Examples

### XMRig (Local)
```bash
# Through tunnel
xmrig \
  --url stratum+tcp://localhost:3333 \
  --user Z3YourWalletAddressHere \
  --algo rx/0 \
  --threads 4 \
  --donate-level 0

# Direct connection
xmrig \
  --url stratum+tcp://91.98.122.165:3333 \
  --user Z3YourWalletAddressHere \
  --algo rx/0 \
  --threads 4 \
  --donate-level 0
```

### Mining Pool Stats
```bash
# Check pool status
curl http://91.98.122.165:18081/stats

# Check miners
curl http://91.98.122.165:18081/miners

# Pool configuration
curl http://91.98.122.165:18081/pool/config
```

## Security Benefits

### Why Use SSH Tunnels?

1. **🔐 Encryption**: All mining traffic encrypted through SSH
2. **🛡️ Authentication**: SSH key-based access control
3. **🌐 Firewall Bypass**: Mine through restricted networks
4. **📊 Monitoring**: SSH logs show connection attempts
5. **⚡ Performance**: Minimal overhead, high reliability

### Firewall Configuration

The deployment automatically configures UFW:

```bash
# Applied automatically by deploy-ssh.sh
ufw allow 22/tcp comment 'SSH'
ufw allow 18080/tcp comment 'ZION P2P'
ufw allow 18081/tcp comment 'ZION RPC'
ufw allow 3333/tcp comment 'ZION Mining Pool'
```

## Troubleshooting

### Connection Issues

```bash
# Test SSH connectivity
nc -zv 91.98.122.165 22

# Test mining pool
nc -zv 91.98.122.165 3333

# Check tunnel
ss -tlnp | grep 3333

# Docker status
ssh root@91.98.122.165 'docker ps'
```

### Server-Side Debugging

```bash
# Connect to server
ssh root@91.98.122.165

# Check services
docker ps
docker logs zion-pool

# Pool port binding
netstat -tlnp | grep 3333

# Monitor mining connections
docker logs -f zion-pool
```

### Common Issues

| Problem | Solution |
|---------|----------|
| "Connection refused" | Check if Docker containers are running |
| "Port already in use" | Kill existing tunnel: `pkill -f 3333` |
| "SSH timeout" | Check server SSH service: `systemctl status ssh` |
| "Pool not accepting" | Verify wallet address format (Z3...) |

## Advanced Configuration

### Custom SSH Config

Add to `~/.ssh/config`:

```ssh
Host zion-mining
    HostName 91.98.122.165
    User root
    Port 22
    LocalForward 3333 localhost:3333
    ControlMaster auto
    ControlPath /tmp/ssh-zion-%r@%h:%p
    ControlPersist 5m
```

Then simply:
```bash
ssh zion-mining -N
```

### Multiple Pools

```bash
# Tunnel multiple pools
ssh -L 3333:localhost:3333 \
    -L 3334:localhost:3334 \
    root@91.98.122.165
```

### Port Forwarding Chain

```bash
# Forward through multiple hops
ssh -L 3333:SERVER2:3333 root@JUMP_SERVER
```

## Monitoring & Maintenance

### Server Monitoring

```bash
# Service status
./prod-monitor.sh monitor

# Mining pool stats
curl http://localhost:18081/pool/stats

# Live mining activity
docker logs -f zion-pool | grep -E "(accepted|rejected|connected)"
```

### Performance Metrics

```bash
# Network traffic
ss -i | grep :3333

# Mining connections
docker exec zion-pool netstat -an | grep 3333

# Pool hashrate
curl -s http://localhost:18081/pool/stats | jq '.hashrate'
```

## Lightning Network Integration (Future)

The SSH tunnel infrastructure prepares ZION for Lightning Network integration:

```bash
# Future LN channels over SSH
ssh -L 9735:localhost:9735 root@91.98.122.165

# LN mining rewards
ssh -L 10009:localhost:10009 root@91.98.122.165
```

## Support

- 📖 Documentation: [ZION Docs](https://github.com/Maitreya-ZionNet/Zion-v2.5-Testnet)
- 🐛 Issues: [GitHub Issues](https://github.com/Maitreya-ZionNet/Zion-v2.5-Testnet/issues)
- 💬 Community: [ZION Discord](https://discord.gg/zion)

---

**Happy Mining with ZION! ⛏️🚀**