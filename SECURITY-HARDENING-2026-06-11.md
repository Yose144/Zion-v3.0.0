# ZION Edge Server Security Hardening
## Applied: 2026-06-11

### 1. Firewall (UFW)
- Status: ACTIVE (default deny incoming)
- Tailscale: ALLOW ALL (tailscale0 interface)
- SSH (22): LIMIT (rate limited, 6 attempts / 30s)
- HTTP/HTTPS (80/443): LIMIT (rate limited)
- ZION node/pool (8333, 8443, 8444): LIMIT
- All other ports: DENY

### 2. SSH Hardening
- PasswordAuthentication: no (key-only)
- PermitRootLogin: prohibit-password
- MaxAuthTries: 3
- MaxSessions: 10
- MaxStartups: 10:30:60 (rate limit concurrent handshakes)
- LoginGraceTime: 30

### 3. fail2ban
- sshd: 3 failed attempts = 24h ban
- sshd-aggressive: 2 attempts = 7d ban (invalid users)
- recidive: repeat offenders = 7d ban
- mysqld-auth: 5 failed attempts = 1h ban
- Currently banned: 12 IPs

### 4. DDoS Protection (sysctl)
- tcp_syncookies: enabled
- tcp_max_syn_backlog: 2048
- rp_filter: enabled (anti-spoofing)
- accept_source_route: disabled
- accept_redirects: disabled
- log_martians: enabled

### 5. Monitoring Isolation
- Prometheus (9090): iptables DROP from external
- Grafana (3100): iptables DROP from external
- Node exporter (9100): iptables DROP from external
- Accessible only via localhost / Tailscale

### 6. Tailscale SSH
- Primary access method: tailscale ssh root@mainnetedge
- Public SSH (77.42.71.94:22): key-only, rate limited
- Recommendation: Use Tailscale for all admin access

### Verified Commands
```bash
# Check firewall
ufw status verbose

# Check fail2ban
fail2ban-client status
fail2ban-client status sshd

# Check banned IPs
fail2ban-client status sshd | grep Banned

# Check SSH config
grep -E 'PasswordAuthentication|PermitRootLogin|Max' /etc/ssh/sshd_config

# Check load
uptime
```
