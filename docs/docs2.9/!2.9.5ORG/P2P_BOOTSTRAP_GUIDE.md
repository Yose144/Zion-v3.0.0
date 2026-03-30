# 🌐 P2P Network Bootstrap Guide

## Overview
ZION Core v2.9.5 includes automatic peer discovery via:
1. **Hardcoded seed nodes** - Foundation servers for network bootstrap
2. **Peer persistence** - Saves known reliable peers to disk
3. **DNS seeds** - Future: DNS-based distributed discovery

## How It Works

### On First Start
```bash
./zion-core --rpc-port 8080 --p2p-port 8334
```

**Automatic bootstrap sequence:**
1. Check for saved peers in `data/peers.json`
2. If none found, discover seed nodes via TCP connectivity check
3. Connect to reachable seeds
4. Save discovered peers every 5 minutes

### With Manual Peers
```bash
./zion-core --peers "91.98.122.165:8334,seed1.zionterranova.com:8334"
```

Manual peers are combined with saved peers from previous runs.

## Seed Nodes Configuration

**Current seed list** (`core/src/p2p/seeds.rs`):
```rust
pub const SEED_NODES: &[&str] = &[
    "91.98.122.165:8334",              // Helsinki production
    "seed1.zionterranova.com:8334",    // Foundation node 1
    "seed2.zionterranova.com:8334",    // Foundation node 2
    "seed3.zionterranova.com:8334",    // Foundation node 3
];
```

### Adding New Seeds
1. Edit `core/src/p2p/seeds.rs`
2. Add hostname or IP:port
3. Recompile: `cargo build --release`

## Peer Persistence Format

**Location:** `data/peers.json`

**Example:**
```json
[
  {
    "addr": "91.98.122.165:8334",
    "last_seen": 1705516800,
    "success_count": 0,
    "fail_count": 0
  },
  {
    "addr": "seed1.zionterranova.com:8334",
    "last_seen": 1705516700,
    "success_count": 0,
    "fail_count": 2
  }
]
```

**Fields:**
- `addr` - Peer address (hostname or IP:port)
- `last_seen` - Unix timestamp of last successful connection
- `success_count` - Reserved for future reliability tracking
- `fail_count` - Number of failed connection attempts

**Best peers selection:**
- Sorted by: low `fail_count` first, then recent `last_seen`
- Top 10 peers loaded on startup

## Setting Up a Seed Node

### Requirements
- Public IP with open port 8334 (or custom P2P port)
- Reliable uptime (24/7)
- Synced blockchain (current tip)

### Configuration
```bash
# Run with public bind address
./zion-core \
  --rpc-port 8080 \
  --p2p-port 8334 \
  --peers "91.98.122.165:8334"  # Bootstrap from existing seed
```

### Firewall Rules
```bash
# Allow P2P connections
sudo ufw allow 8334/tcp

# Optional: Allow RPC (if needed)
sudo ufw allow 8080/tcp
```

### Monitoring
```bash
# Check connected peers
curl http://localhost:8080/metrics | grep peers_connected

# View P2P logs
journalctl -u zion-core -f | grep "P2P"
```

## DNS Seeds (Future)

### Setup DNS-Based Discovery
```bash
# Example A records for seed.zionterranova.com
seed.zionterranova.com. 3600 IN A 91.98.122.165
seed.zionterranova.com. 3600 IN A 77.42.31.72
seed.zionterranova.com. 3600 IN A 185.220.101.45
```

**Code integration** (already implemented):
```rust
use zion_core::p2p::seeds::resolve_dns_seeds;

let peers = resolve_dns_seeds("seed.zionterranova.com:8334").await?;
```

## Troubleshooting

### No Seeds Reachable
```
[P2P] WARNING: No seed nodes reachable!
```

**Solutions:**
1. Check network connectivity: `ping 91.98.122.165`
2. Verify port not blocked: `telnet 91.98.122.165 8334`
3. Use manual peers: `--peers "known.node:8334"`

### Peer Persistence Not Working
```bash
# Check if data directory exists
ls -la data/

# Verify permissions
chmod 755 data/
```

### Connection Timeouts
Seed discovery uses 3-second timeout per node. If all seeds timeout:
- Network latency issues
- Seeds offline (check status)
- Firewall blocking outbound TCP

## Network Bootstrap Timeline

**Phase 1 - TestNet (Q1 2025):**
- 4 Foundation seed nodes
- Manual peer addition via `--peers`
- Basic connectivity check (TCP)

**Phase 2 - Expansion (Q2 2025):**
- Community seed nodes
- DNS-based discovery
- Peer reputation system

**Phase 3 - Mainnet (Q4 2025):**
- 10+ distributed seeds
- Encrypted P2P (TLS)
- DDoS protection

## API Reference

### Check Seed Availability
```rust
use zion_core::p2p::seeds::discover_seeds;

let reachable = discover_seeds().await;
println!("Found {} seeds", reachable.len());
```

### Manual Peer Save/Load
```rust
use zion_core::p2p::persistence::{save_peers, load_peers};
use std::path::Path;

// Save
let path = Path::new("data/peers.json");
save_peers(&persisted_peers, path).await?;

// Load
let peers = load_peers(path).await?;
```

---

**Status:** ✅ Production Ready  
**Version:** v2.9.5  
**Updated:** January 17, 2026

🌟 **"Network bootstraps consciousness"** 🌟
