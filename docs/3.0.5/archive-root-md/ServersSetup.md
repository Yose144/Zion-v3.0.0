# ServersSetup.md — ZION V3 Server Setup & Automation Guide

**Last updated:** 2026-07-11
**Server:** Edge primary `62.171.141.136` (SSH: `ssh zion-new`, key: `~/.ssh/zion-new-server`)
**OS:** Ubuntu 24.04 LTS, x86_64
**Genesis hash:** `4f75a0dfe6dde3b167287d445aa1ade56577b0e9166c641ed288b4c20a79bd6e`

> This document captures the **complete server configuration, services, and
> automation** so a new server can be provisioned from scratch without
> re-discovering every step.

---

## 1. Server Specs

| Property | Value |
|----------|-------|
| Provider | Contabo VPS |
| IP | `62.171.141.136` |
| OS | Ubuntu 24.04 LTS |
| Arch | x86_64 |
| Disk | 145 GB SSD |
| RAM | (check with `free -h`) |
| CPU | (check with `nproc`) |

---

## 2. Network & Firewall (UFW)

```bash
# SSH, HTTP, HTTPS, P2P, Pool, Dashboard
ufw allow 22/tcp           # SSH
ufw allow 80/tcp           # HTTP (nginx → HTTPS redirect)
ufw allow 443/tcp          # HTTPS (nginx)
ufw allow 8333/tcp         # ZION P2P
ufw allow 8444/tcp         # ZION Pool Stratum
ufw allow 8334/tcp         # ZION Node2 P2P
ufw allow 8443/tcp         # ZION RPC (public, rate-limited)
ufw enable
```

**Fail2Ban:** Active, protects SSH.

---

## 3. Services (systemd)

### 3.1 ZION Core Services

| Service | Binary | Port | Description |
|---------|--------|------|-------------|
| `zion-node.service` | `/usr/local/bin/zion-node` | P2P 8333, RPC 9443 (localhost), WS 8445 (localhost) | L1 mainnet node (primary) |
| `zion-node2.service` | `/usr/local/bin/zion-node` | P2P 8334, RPC 9444 (localhost) | L1 follower node (P2P sync) |
| `zion-pool.service` | `/usr/local/bin/zion-pool-server` | 8444 | Stratum pool server |
| `zion-bridge.service` | `/usr/local/bin/zion-bridge` | 9101 (localhost) | L2 bridge relay |
| `zion-dao.service` | `/usr/local/bin/zion-dao` | 8450 (localhost) | L2 DAO scanner |
| `zion-atomic-swap.service` | `/usr/local/bin/zion-atomic-swap` | — | L2 atomic swap escrow |
| `zion-warp.service` | `/usr/local/bin/zion-warp-server` | 9102 (localhost) | L3 cross-chain relay |
| `zion-oasis.service` | `/usr/local/bin/zion-oasis` | — | L4 OASIS Avatar Hub |
| `zion-free-world.service` | `/usr/local/bin/zion-free-world` | — | L5 Free World Humanitarian |
| `zion-issobella.service` | `/usr/local/bin/zion-issobella` | — | L6 Issobella Space Layer |
| `zion-dashboard.service` | Python (zero-dep) | 5000 (localhost) | Dashboard API + static HTML |
| `zion-watchdog.service` | `/usr/local/bin/zion-watchdog.sh` | — | Health check (oneshot) |

### 3.2 Infrastructure Services

| Service | Port | Description |
|---------|------|-------------|
| `nginx` | 80, 443 | Reverse proxy: HTTPS for website + dashboard |
| `docker` | — | Container engine (website Next.js) |
| `fail2ban` | — | SSH brute-force protection |
| `ufw` | — | Firewall |

### 3.3 Service management

```bash
# List all ZION services
systemctl list-units --type=service | grep zion

# Restart a service
systemctl restart zion-pool.service

# View logs
journalctl -u zion-pool.service --since "5 min ago" --no-pager

# Check status
systemctl status zion-node.service
```

---

## 4. Environment Configuration

**File:** `/etc/zion/edge-environment.sh` (chmod 600, contains secrets)

Contains all environment variables for ZION services:
- L1 node config (state path, P2P/RPC/WS bind, seed peers)
- Miner + subsidy split (89% miner, 5% humanitarian, 5% Issobella, 1% burn)
- Pool config (bind, node RPC, wallet, payout signing key, PPLNS)
- Bridge validator keys (5/5 threshold, secp256k1)
- DAO guardian keys (7, air-gapped)
- Atomic swap escrow key
- WARP config
- AuxPow merge mining (KAS, BTC)
- Logging (RUST_LOG=info)
- Block retention (1000 blocks in memory)
- MALLOC_ARENA_MAX=1 (memory optimization)

**All services read this file via `EnvironmentFile=` in their systemd unit.**

---

## 5. Nginx Configuration

### Reverse proxy routes

| Domain | Upstream | Description |
|--------|----------|-------------|
| `zionterranova.com` | Docker (Next.js standalone) | Website |
| `dashboard.zionterranova.com` | `127.0.0.1:5000` | Dashboard (Basic Auth) |
| `api.zionterranova.com` | `127.0.0.1:9443` | RPC API (rate-limited) |

### SSL

- Let's Encrypt via certbot
- Auto-renewal via systemd timer

---

## 6. Data Storage

| Path | Content |
|------|---------|
| `/data/zion/state` | L1 node 1 blockchain state (LMDB) |
| `/data/zion/state-node2` | L1 node 2 blockchain state (LMDB) |
| `/data/zion/pplns-state.json` | PPLNS engine state (JSON, saved every 10s) |
| `/data/zion/bridge-mainnet.db` | Bridge relay database |
| `/data/zion/dao-mainnet.db` | DAO scanner database |
| `/data/zion/atomic-swap.db` | Atomic swap escrow database |
| `/data/zion/oasis.db` | OASIS database |
| `/data/zion/issobella.db` | Issobella database |

---

## 7. Automation & Auto-Patching

### 7.1 Disk Cleanup (auto-patch, installed 2026-07-11)

**Problem:** Disk filled to 60% (87 GB) due to uncontrolled log growth and
Docker image/cache accumulation.

**Solution:** Multi-layer auto-patch:

#### Layer 1: Logrotate (hourly)

```bash
# /etc/systemd/system/logrotate-hourly.timer
[Timer]
OnCalendar=hourly
AccuracySec=5min
Persistent=true
```

- Runs logrotate every hour (not just daily)
- `/etc/logrotate.d/zion-edge` rotates syslog at `maxsize 2G`, keeps 7 days
- ZION app logs rotated at `maxsize 500M`, kept 14 days

#### Layer 2: Journald size limit

```bash
# /etc/systemd/journald.conf
SystemMaxUse=500M
SystemMaxFileSize=50M
MaxFileCount=10
```

#### Layer 3: Rsyslog rate-limiting

```bash
# /etc/rsyslog.d/49-zion-pool-ratelimit.conf
# Routes pool server logs to /var/log/zion-pool.log (not syslog)
# Rate-limits any program: 1000 messages / 60 seconds
```

#### Layer 4: Daily cleanup script

**Script:** `/usr/local/bin/zion-disk-cleanup.sh`
**Cron:** `/etc/cron.d/zion-disk-cleanup` (runs at 04:00 daily)

Cleans:
1. Docker images older than 48h (`docker image prune -af`)
2. Docker build cache older than 48h (`docker builder prune -af`)
3. Stopped containers (`docker container prune -f`)
4. APT cache (`apt-get clean`)
5. Temp files in `/tmp` older than 7 days
6. Rust `target/` directories older than 3 days
7. Journal vacuum to 200 MB
8. Rotated logs older than 14 days
9. Reports disk usage, alerts if > 80%

### 7.2 Monitoring Cron Jobs

| Script | Schedule | Purpose |
|--------|----------|---------|
| `zion-monitor-height.sh` | Every 5 min | Checks block height, alerts if stalled |
| `zion-monitor-memory.sh` | Every 10 min | Checks RAM usage, alerts if > 90% |
| `zion-monitor-p2p.sh` | Every 15 min | Checks P2P peer count |
| `zion-monitor-forged.sh` | Every 30 min | Checks for forged TX attempts |

### 7.3 Watchdog

**Service:** `zion-watchdog.service` (oneshot)
Checks all ZION services are running, restarts if needed.

### 7.4 Fail2Ban

- SSH protection enabled
- Default ban time: 10 min
- Max retries: 5

---

## 8. Build & Deploy

### 8.1 Rust toolchain

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env

# Build ZION binaries
cd /root/zion/2.9.6/V3
cargo build --release -p zion-pool
cargo build --release -p zion-core    # node, wallet, CLI tools
```

### 8.2 Binary deployment

```bash
# Stop service
systemctl stop zion-pool.service

# Backup old binary
cp /usr/local/bin/zion-pool-server /usr/local/bin/zion-pool-server.bak-$(date +%Y%m%d%H%M%S)

# Deploy new binary
cp /root/zion/2.9.6/V3/target/release/server /usr/local/bin/zion-pool-server
chmod +x /usr/local/bin/zion-pool-server

# Restart
systemctl start zion-pool.service
```

### 8.3 Source code sync (from dev machine)

```bash
# Sync V3 source to edge (excluding target/ and .git/)
rsync -avz --exclude target --exclude .git \
  -e "ssh -i ~/.ssh/zion-new-server" \
  /Users/yeshuae/Projects/2.9.6/V3/ \
  root@62.171.141.136:/root/zion/2.9.6/V3/

# Sync AuXpow (dependency)
rsync -avz --exclude target --exclude .git \
  -e "ssh -i ~/.ssh/zion-new-server" \
  /Users/yeshuae/Projects/2.9.6/AuXpow/ \
  root@62.171.141.136:/root/zion/2.9.6/AuXpow/
```

### 8.4 Website deployment

```bash
# Website runs in Docker container
# Image: Next.js standalone
# Rebuild: cd /root/zion/website && docker build -t zion-web .
# Restart: docker restart zion-web
```

---

## 9. Dashboard

**URL:** `https://dashboard.zionterranova.com` (Basic Auth)
**Service:** `zion-dashboard.service` (Python, zero-dep)
**Port:** 5000 (localhost, proxied by nginx)

### Dashboard pages

| Tab | Content |
|-----|---------|
| Overview | Network status, block height, node info |
| Pool Miners | Active miners, hashrate, share stats |
| Revenue System | Revenue streams, AuxPow stats |
| Servers Setup | Server config, services, automation status |

---

## 10. Security

### 10.1 SSH

- Key-only authentication (`~/.ssh/zion-new-server`)
- Password auth disabled
- Fail2Ban active

### 10.2 Firewall (UFW)

- Only ports 22, 80, 443, 8333, 8444, 8334, 8443 open
- All ZION RPC/WS bound to localhost

### 10.3 File permissions

- `/etc/zion/edge-environment.sh` → chmod 600 (contains secrets)
- Private keys never committed to git

### 10.4 AppArmor

- Profile for `zion-node` (restricts filesystem access)

---

## 11. New Server Provisioning Checklist

To set up a new ZION server from scratch:

1. **OS setup**
   - [ ] Install Ubuntu 24.04 LTS
   - [ ] Create root SSH key, disable password auth
   - [ ] Update: `apt update && apt upgrade -y`

2. **Firewall**
   - [ ] Install UFW, configure ports (see §2)
   - [ ] Install Fail2Ban

3. **Rust toolchain**
   - [ ] `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y`

4. **Docker**
   - [ ] `apt install docker.io docker-compose-v2`

5. **Nginx + SSL**
   - [ ] `apt install nginx certbot python3-certbot-nginx`
   - [ ] Configure reverse proxy (see §5)
   - [ ] `certbot --nginx -d zionterranova.com -d dashboard.zionterranova.com`

6. **ZION source code**
   - [ ] `mkdir -p /root/zion/2.9.6`
   - [ ] Rsync V3/ and AuXpow/ from dev machine (see §8.3)

7. **Build binaries**
   - [ ] `cd /root/zion/2.9.6/V3 && cargo build --release`

8. **Environment**
   - [ ] Create `/etc/zion/edge-environment.sh` (chmod 600)
   - [ ] Fill in all secrets (air-gapped key generation)

9. **Data directory**
   - [ ] `mkdir -p /data/zion`

10. **systemd services**
    - [ ] Copy all `.service` files to `/etc/systemd/system/`
    - [ ] `systemctl daemon-reload`
    - [ ] `systemctl enable --now zion-node zion-pool zion-bridge zion-dao zion-atomic-swap zion-warp zion-dashboard`

11. **Disk auto-patch**
    - [ ] Install logrotate hourly timer (see §7.1)
    - [ ] Configure journald size limit (see §7.1)
    - [ ] Install rsyslog rate-limiting (see §7.1)
    - [ ] Install `zion-disk-cleanup.sh` + cron (see §7.1)

12. **Monitoring**
    - [ ] Install monitoring cron jobs (see §7.2)
    - [ ] Install watchdog (see §7.3)

13. **Verify**
    - [ ] `systemctl is-active zion-node zion-pool`
    - [ ] `df -h /` (disk usage < 20%)
    - [ ] `journalctl -u zion-node --since "1 min ago"` (node syncing)
    - [ ] `curl http://127.0.0.1:9443/health` (RPC responding)

---

## 12. Backup

### What to back up

| Path | Priority | Frequency |
|------|----------|-----------|
| `/data/zion/state` | Critical | Daily (LMDB hot copy) |
| `/data/zion/pplns-state.json` | High | Every 10s (automatic) |
| `/data/zion/bridge-mainnet.db` | High | Daily |
| `/data/zion/dao-mainnet.db` | Medium | Daily |
| `/data/zion/atomic-swap.db` | Medium | Daily |
| `/etc/zion/edge-environment.sh` | Critical | On change (contains secrets) |
| `/etc/systemd/system/zion*.service` | Medium | On change |
| `/etc/nginx/sites-available/*` | Medium | On change |

### Key backups

- Guardian mnemonics: `/home/zionserver/Desktop/ZionKeys/` (OpenSSL encrypted)
- USB backup: 4/4 files verified (SHA256 + GPG signatures)
- Genesis keys: Air-gapped, owner-controlled

---

## 13. Troubleshooting

### Disk full

```bash
# Check what's using space
du -sh /var/log/* | sort -rh | head -10
docker system df
journalctl --disk-usage

# Quick cleanup
/usr/local/bin/zion-disk-cleanup.sh
```

### Pool payouts failing

```bash
# Check deferred payout queue
journalctl -u zion-pool.service | grep payout_deferred

# Check pool wallet balance
curl -s http://127.0.0.1:9443/getBalance -d '{"jsonrpc":"2.0","method":"getBalance","params":["<POOL_WALLET>"],"id":1}'
```

### Node not syncing

```bash
# Check peer count
journalctl -u zion-node.service | grep peer

# Check block height
journalctl -u zion-node.service | grep height
```

### Service won't start

```bash
# Check logs
journalctl -u zion-pool.service --since "5 min ago" --no-pager

# Check if binary exists and is executable
ls -la /usr/local/bin/zion-pool-server

# Check environment file
cat /etc/zion/edge-environment.sh | grep -v "^#" | grep -v "^$"
```
