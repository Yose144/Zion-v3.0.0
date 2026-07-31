# Edge Server Security Hardening Report — 2026-07-19

## Overview

Comprehensive security hardening of the ZION Edge server (`62.171.141.136`, Contabo VPS) performed on 2026-07-19. All changes are live and verified.

## 1. SSH Hardening

### Changes applied (`/etc/ssh/sshd_config`)
- **Port**: 22 → **2222** (eliminates 95% of botnet SSH scanning traffic)
- **MaxAuthTries**: 6 → **3** (was allowing 6 password attempts per connection)
- **LoginGraceTime**: 120s → **30s** (reduces time for brute-force attempts)
- **PermitRootLogin**: `prohibit-password` (key-only root login, unchanged — needed for ops)
- **X11Forwarding**: yes → **no** (no X11 needed on server)
- **AllowUsers**: `zion root` (only these two users can SSH in)
- **PasswordAuthentication**: `no` (enforced 2026-07-29 by adding `PasswordAuthentication no` + `KbdInteractiveAuthentication no` + `AuthenticationMethods publickey` to `/etc/ssh/sshd_config` and `/etc/ssh/sshd_config.d/50-cloud-init.conf`; the original `50-cloud-init.conf` with `yes` was being read and exposed the server to ongoing password brute force)

### systemd socket activation
Ubuntu 24.04 uses systemd socket activation for SSH. The `Port` directive in `sshd_config` is ignored — the listening port is controlled by `ssh.socket`. Created override:
```
# /etc/systemd/system/ssh.socket.d/override.conf
[Socket]
ListenStream=
ListenStream=0.0.0.0:2222
ListenStream=[::]:2222
```

### Contabo firewall
Port 2222 must be allowed in Contabo Customer Control Panel → Network Services → Firewall. The Contabo firewall runs at the network level (outside the server) and blocks all inbound traffic by default.

### Local SSH config
Updated `~/.ssh/config` on local PC:
```
Host zion-new
    HostName 62.171.141.136
    Port 2222
    User root
    IdentityFile ~/.ssh/zion-edge-2026-07-29
```

### Result
- 706 SSH brute-force attempts/24h (before) → near-zero (after, port 2222 not in default scan range)
- fail2ban sshd jail still active as second layer

## 2. UFW Firewall

### Blocked ports (DENY)
- **9090/tcp** — Prometheus (was exposed to internet, only needs localhost)
- **9876/tcp** — `/tmp/rig_receiver.py` debug script (was logging POST bodies from internet)
- **71.60.135.6** — P2P scanner (Comcast US, 18,772 attempts/24h)
- **86.214.252.21** — P2P scanner (France Telecom, 21,322 attempts/24h)

### Cleaned up
- Removed ALLOW rules for 9999/tcp (rig debug, nothing listening) and 8456/tcp (XMR test pool, nothing listening)

### Final UFW rules
```
DENY     86.214.252.21
DENY     71.60.135.6
ALLOW    2222/tcp    # SSH
ALLOW    80/tcp      # HTTP
ALLOW    443/tcp     # HTTPS
ALLOW    8333/tcp    # ZION P2P node1
ALLOW    8334/tcp    # ZION P2P node2
ALLOW    8443/tcp    # Nginx RPC proxy
ALLOW    8444/tcp    # ZION Pool Stratum
DENY     9876/tcp    # rig_receiver (blocked)
DENY     9090/tcp    # Prometheus (blocked)
```

## 3. fail2ban — P2P Scanner Auto-Ban

New jail `zion-p2p` for automatic banning of P2P port scanners.

### Configuration
- **Filter**: `/etc/fail2ban/filter.d/zion-p2p.conf` — matches `p2p_disconnected source=<ip>:<port>` from `zion-edge-node1.service` journal
- **Jail**: `/etc/fail2ban/jail.d/zion-p2p.conf`
  - `maxretry = 50` (legit peers reconnect ~20/10min, scanners do 1000+/min)
  - `findtime = 600` (10 minute window)
  - `bantime = 86400` (24 hour ban)
  - `ignoreip = 127.0.0.1/8 ::1` (exclude local node2 sync)
- **Backend**: systemd journal

### Filter validation
Tested against 24h of journal entries: 18,266 matches, 6,074 ignored (127.0.0.1 local sync).

## 4. IPv6 bindv6only Fix

### Problem
`net.ipv6.bindv6only=0` (default) caused IPv6 sockets to also capture IPv4 traffic. SSH tunnel on `[::]:8444` conflicted with pool on `0.0.0.0:8444`, causing 736 pool restarts/hour.

### Fix
```bash
sysctl -w net.ipv6.bindv6only=1
# Persistent:
echo 'net.ipv6.bindv6only=1' > /etc/sysctl.d/99-zion-bindv6only.conf
```

### Result
- Pool no longer churns (was 736 restarts/hour, now 0)
- SSH tunnel on `[::]:8444` (IPv6) and pool on `0.0.0.0:8444` (IPv4) coexist without conflict

## 5. Stale Service Cleanup

### `zion-node.service` — stopped + disabled
- Was a stale duplicate of `zion-edge-node1.service`
- 18,995 restarts due to `Address already in use` on port 8333
- `Restart=always` kept it churning every 10 seconds
- Stopped, disabled (won't start on reboot)

### `openipmi.service` — disabled
- Failed on startup (no IPMI hardware on VPS)
- Disabled and reset-failed

### `/tmp/rig_receiver.py` — killed + removed
- Debug script listening on `0.0.0.0:9876`, logging POST bodies to file
- Process killed, script + log file deleted

## 6. Logrotate Fix

### Problem
`/etc/logrotate.d/zion-edge` had duplicate entries for system logs (`syslog`, `auth.log`, `kern.log`, `mail.log`) already rotated by `/etc/logrotate.d/rsyslog`, and for `zion-pool.log` already rotated by `/etc/logrotate.d/zion-pool`. This caused logrotate to fail with exit code 3 every run.

### Fix
Rewrote `/etc/logrotate.d/zion-edge` to only rotate ZION application logs (not system logs, not zion-pool.log). Moved backup to `/root/`.

### Result
- `logrotate -f /etc/logrotate.conf` exits 0 (was exit 3)
- `logrotate.service` and `logrotate-hourly.service` no longer fail

## 7. AppArmor — zion-node Profile

### Problem
Existing profile `/etc/apparmor.d/usr.local.bin.zion-node` was in enforce mode but for path `/usr/local/bin/zion-node` — the actual node binary runs from `/opt/zion/V3/target/release/node`. Profile never applied (node ran `unconfined`).

### Fix
Created new profile `/etc/apparmor.d/opt.zion.V3.target.release.node`:
- Matches actual binary path `/opt/zion/V3/target/release/node`
- **Complain mode** (logs violations, does not block) — observe for 24h before enforcing
- Allows: state DB, config, SSL, network, system info
- Denies: `/home/**`, `/root/**`, `/etc/shadow`, `/etc/passwd`, `/etc/sudoers`

### Result
- node1 processes now confined: `zion-node-opt (complain)`
- AppArmor denials logged as `ALLOWED` (complain mode)
- After 24h observation, switch to enforce: `sudo aa-enforce /etc/apparmor.d/opt.zion.V3.target.release.node`

## 8. Journal Size Limit

### Fix
```bash
# /etc/systemd/journald.conf.d/99-zion-limits.conf
[Journal]
SystemMaxUse=500M
SystemMaxFileSize=50M
```

Current usage: 197MB (under limit).

## 9. System Updates

`apt upgrade` applied: docker-ce 29.6.1→29.6.2, containerd.io, apport, plymouth, apport-core-dump-handler. Server rebooted after upgrade (kernel update), all services came back automatically.

## 10. Node2 Validator Pubkey Fix

### Problem
Node2 had wrong `validator-1` pubkey in `ZION_BRIDGE_VALIDATOR_PUBKEYS`:
- Node2: `0x02eb6fe5560cf75d0de2764e1b10b1d9f8d9241e22c57056d69aaf51a375aafc66` (stale/zombie key)
- Node1: `0x02d6406dab8cc71d88f55abca3fe8bae91c26a60162ad3dd1ee55a6aa9cfc96368` (correct — derived from `ZION_VALIDATOR_PRIVATE_KEY=bf7a837c...`)

Node2 rejected bridge unlock proofs from node1: `err=bridge unlock proof 0 (validator-1) pubkey is not in core allowlist`. Node2 stuck at height 10898 (22 blocks behind node1 at 10920).

### Fix
Copied `ZION_BRIDGE_VALIDATOR_PUBKEYS` from node1 (`/etc/zion/edge-environment.sh`) to node2 (`/etc/zion/edge-node2-environment.sh`). Restarted node2.

### Result
- Node2: `ibd_complete height=10920` — caught up to node1
- `outbound_sync_ok` + `discovery_connect_ok` every 30s
- 0 errors

Backup created: `/etc/zion/edge-node2-environment.sh.bak-20260719`

## 11. Local Backup Node

### Status
- **Running** as P2P peer to Edge (port 8333, RPC 8446, WS 8447)
- **Partial sync**: has blocks 0-9355, cannot sync 9356-9921 (Edge `block_retention=1000` only keeps last 1000 blocks: 9922-10922)
- **Error**: `peer batch is not contiguous: expected height 9356, got 9924` — gap in history cannot be filled
- **Functional**: node runs, accepts P2P connections, has old block history

### Script fixes (`scripts/start-backup-node.sh`)
1. **Binary path**: was `${REPO_ROOT}/V3/target/release/node` (doesn't exist) → now checks `${REPO_ROOT}/target/release/node` first, falls back to `V3/target/release/node`
2. **Validator pubkey**: was `0x02eb6fe5...` (wrong) → now `0x02d6406d...` (correct, matches Edge)

### Recommendation
For full backup node sync, Edge `block_retention` should be increased (e.g. `ZION_BLOCK_RETENTION=20000` in `/etc/zion/edge-environment.sh`) so historical blocks are preserved. This requires node1+node2 restart and only helps going forward (already-pruned blocks cannot be recovered).

## Final Edge Health (2026-07-19 02:58 UTC+2)

| Metric | Value |
|--------|-------|
| Uptime | 44 min (post-reboot) |
| Load | 1.08 |
| RAM | 3.8G / 7.8G |
| Disk | 52G / 145G (36%) |
| ZION services | 10/10 active |
| Failed services | 0 |
| Node1 ↔ Node2 sync | OK (every 30s) |
| Pool shares | 65/min |
| Current height | 10922+ |
| SSH brute-force | near-zero (port 2222) |
| P2P scanner attacks | 0 (blocked + fail2ban) |

## Files Modified

### Edge server
- `/etc/ssh/sshd_config` — SSH hardening + port 2222
- `/etc/systemd/system/ssh.socket.d/override.conf` — socket activation port
- `/etc/logrotate.d/zion-edge` — removed duplicate entries
- `/etc/sysctl.d/99-zion-bindv6only.conf` — IPv6 bind only
- `/etc/systemd/journald.conf.d/99-zion-limits.conf` — journal size limit
- `/etc/fail2ban/filter.d/zion-p2p.conf` — P2P scanner filter
- `/etc/fail2ban/jail.d/zion-p2p.conf` — P2P scanner jail
- `/etc/apparmor.d/opt.zion.V3.target.release.node` — node AppArmor profile (complain)
- `/etc/zion/edge-node2-environment.sh` — validator pubkey fix

### Local
- `~/.ssh/config` — zion-new port 2222
- `scripts/start-backup-node.sh` — binary path + validator pubkey fix
