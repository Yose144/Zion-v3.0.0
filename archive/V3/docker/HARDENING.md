# ZION V3 Server Hardening — Quick Reference
#
# Target host: Hetzner VPS (Core + Edge topology)

## Firewall (ufw)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp          # SSH
ufw allow 8334/tcp        # P2P (node)
ufw allow 3333/tcp        # Stratum (public miner port, if exposed)
ufw allow 8001/tcp        # AI Native API (only if public agent access is required)
# Keep RPC, metrics, Grafana on loopback only — no ufw rule needed.
ufw enable
ufw status verbose
```

## Docker JSON-file log driver limits

Add to `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  }
}
```

Then `systemctl restart docker`.

## Logrotate

Copy `logrotate-docker.conf` to `/etc/logrotate.d/docker-containers`:

```bash
cp logrotate-docker.conf /etc/logrotate.d/docker-containers
logrotate --debug /etc/logrotate.d/docker-containers
```

## Automatic security updates

```bash
apt install unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

## SSH hardening (already applied on Zion2)

- Key-only auth (`PasswordAuthentication no`)
- `PermitRootLogin prohibit-password`
- Custom key: `~/.ssh/zion_hetzner_key`

## TLS for Grafana (optional)

Use a reverse-proxy (Caddy or nginx) with Let's Encrypt in front of
`127.0.0.1:3000`. Do not expose Grafana directly to the internet
without TLS.
