# Health check for ZION stack ✅

This document explains the lightweight health check script and how to integrate it into cron/systemd for basic alerting.

Files added:

- `scripts/health_check.py` — checks blockchain RPC `get_block_template` and TCP connectivity to pool port. Returns exit code `0` when healthy and `2` when unhealthy.

Usage example (run from server):

```bash
python3 scripts/health_check.py --blockchain-host 127.0.0.1 --blockchain-port 18081 --pool-host 127.0.0.1 --pool-port 3333
```

Systemd example unit (deploy on the host to run every minute):

Create `/etc/systemd/system/zion-healthcheck.service`:

```
[Unit]
Description=ZION Health Check

[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /root/zion-v2.9/scripts/health_check.py --blockchain-host 127.0.0.1 --blockchain-port 18081 --pool-host 127.0.0.1 --pool-port 3333
```

Create a timer `/etc/systemd/system/zion-healthcheck.timer`:

```
[Unit]
Description=Run ZION Health Check every minute

[Timer]
OnBootSec=1min
OnUnitActiveSec=1min

[Install]
WantedBy=timers.target
```

When the service returns non-zero, use your infrastructure (Prometheus Alertmanager, cron mail, or other) to escalate.

Tips:
- You can integrate this script into your external monitoring or run it on the host to trigger email/Slack notifications.
- Expand later by adding Slack/webhook support or sending metrics to Prometheus pushgateway.
