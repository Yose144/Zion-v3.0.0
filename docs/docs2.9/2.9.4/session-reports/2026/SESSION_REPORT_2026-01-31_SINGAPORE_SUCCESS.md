# SESSION REPORT 2026-01-31: Singapore Server Deployment SUCCESS 🇸🇬

## Summary
Successfully deployed ZION infrastructure on Singapore server (5.223.56.124), completing the 3-node P2P network.

## Network Status (All Active ✅)

| Server | Location | IP | P2P Port | RPC Port | Pool Port | Status |
|--------|----------|-----|----------|----------|-----------|--------|
| Helsinki | Finland | 77.42.31.72 | 8334 | 8444 | 3333 | ✅ SEED |
| USA | Ashburn | 5.78.145.234 | 8335 | 8444 | 3333 | ✅ PEER 1 |
| Singapore | Singapore | 5.223.56.124 | 8336 | 8446 | 3335 | ✅ PEER 2 |

## Blockchain Sync
- **All nodes synced at height=3**
- **Same prev_hash**: `374d2500de11aa872ca052cc15919dca79928add296caf7e41eefac3b5958c6b`
- P2P network fully operational

## Singapore Installation Steps Completed

### 1. Fixed Server IP
- Documentation showed wrong IP (5.223.56.122)
- Correct IP: **5.223.56.124**

### 2. Installed Rust 1.93.0
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 3. Transferred & Compiled zion-core
```bash
rsync -avz 2.9.5/zion-cosmic-harmony-v3/ root@5.223.56.124:/root/zion-native/core/
cargo build --release
cp target/release/zion-core /usr/local/bin/
```

### 4. Transferred & Compiled zion-pool
```bash
rsync -avz 2.9.5/zion-cosmic-harmony-v3/zion-pool/ root@5.223.56.124:/root/zion-native/pool/
cargo build --release
cp target/release/zion-pool /usr/local/bin/
```

### 5. Created systemd Services

**zion-core.service:**
```ini
[Unit]
Description=ZION Core Node (Singapore)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/zion-native/core
ExecStart=/usr/local/bin/zion-core \
    --p2p-listen 0.0.0.0:8336 \
    --rpc-listen 0.0.0.0:8446 \
    --peers 77.42.31.72:8334,5.78.145.234:8335 \
    --data-dir /root/zion-native/data
Restart=always
RestartSec=5
Environment=RUST_LOG=info

[Install]
WantedBy=multi-user.target
```

**zion-pool.service:**
```ini
[Unit]
Description=ZION Mining Pool (Singapore)
After=network.target zion-core.service postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/zion-native/pool
ExecStart=/usr/local/bin/zion-pool
Restart=always
RestartSec=5
Environment=RUST_LOG=info
Environment=ZION_POOL_LISTEN=0.0.0.0:3335
Environment=ZION_POOL_API=0.0.0.0:8182
Environment=ZION_CORE_RPC=http://127.0.0.1:8446/jsonrpc
Environment=DATABASE_URL=postgres://zion:zion123@127.0.0.1/zion_pool
Environment=ZION_DISABLE_REVENUE_PROXY=true

[Install]
WantedBy=multi-user.target
```

### 6. Installed PostgreSQL
```bash
apt-get install -y postgresql postgresql-contrib
systemctl start postgresql
sudo -u postgres psql -c "CREATE USER zion WITH PASSWORD 'zion123';"
sudo -u postgres psql -c "CREATE DATABASE zion_pool OWNER zion;"
```

## Known Issue: External Port Blocking

⚠️ **Hetzner Cloud Singapore blocks external connections to port 3335**

- Pool works locally (localhost:3335)
- External connections blocked (even from other Hetzner DCs)
- P2P port 8336 works fine
- RPC port 8446 works fine

### Workaround: SSH Tunnel
```bash
# Create tunnel
ssh -i ~/.ssh/zion_hetzner_key -L 3335:127.0.0.1:3335 root@5.223.56.124 -f -N

# Mine via tunnel
./zion-universal-miner --pool stratum+tcp://127.0.0.1:3335 --wallet YOUR_WALLET
```

## Mining Test Results

### Helsinki Pool (Direct Connection)
- **Hashrate**: ~520 kH/s
- **Shares accepted**: 51 in 90 seconds
- **No errors** ✅

### Singapore Pool (via SSH Tunnel)
- Connection works
- Share submission has timeouts (tunnel latency)
- Recommend using Helsinki/USA pools for now

## Recommendations

1. **Use Helsinki (77.42.31.72:3333)** as primary pool - best connectivity
2. **Use USA (5.78.145.234:3333)** as backup pool
3. **Singapore** - for P2P node redundancy only (until port issue resolved)

## Potential Solutions for Singapore Port Issue

1. **Hetzner Firewall Console** - Check cloud firewall rules
2. **Use standard port 3333** - May work better
3. **WireGuard VPN** - Create tunnel between nodes
4. **Cloudflare Tunnel** - TCP proxy through CF

## Files Modified
- Created `/etc/systemd/system/zion-core.service` (Singapore)
- Created `/etc/systemd/system/zion-pool.service` (Singapore)
- Updated UFW rules

## Git Status
- All changes pushed to repository ✅

---

**Session Duration**: ~2 hours  
**Result**: Singapore node operational, P2P network complete 🎉

**Next Steps**:
1. Investigate Hetzner firewall settings for port 3335
2. Consider port change or VPN solution
3. Monitor P2P sync stability
