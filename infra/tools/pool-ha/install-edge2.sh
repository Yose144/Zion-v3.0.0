#!/usr/bin/env bash
# install-edge2.sh — install pool HA standby tooling on EDGE2 (A4.2).
#
# Usage (from repo root or a copy of infra/tools/pool-ha):
#   bash infra/tools/pool-ha/install-edge2.sh
#
# Installs scripts → /usr/local/sbin, units → /etc/systemd/system, creates
# the standby dir + env skeleton, enables the three timers. Does NOT:
#   - enable/start zion-pool-standby.service (manual failover unit)
#   - create the ACTIVATED gate file
#   - fill secrets into the env file (operator step, see runbook)
#   - deploy the standby binary (see runbook — copy EDGE-built zion-pool)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"

install -m 0755 "$HERE/pool-standby-sync.sh" /usr/local/sbin/pool-standby-sync.sh
install -m 0755 "$HERE/pool-ha-watchdog.sh" /usr/local/sbin/pool-ha-watchdog.sh

for u in zion-pool-standby-sync zion-pool-standby-dbsync zion-pool-ha-watchdog zion-pool-standby; do
    install -m 0644 "$HERE/units/$u.service" "/etc/systemd/system/$u.service"
done
for u in zion-pool-standby-sync zion-pool-standby-dbsync zion-pool-ha-watchdog; do
    install -m 0644 "$HERE/units/$u.timer" "/etc/systemd/system/$u.timer"
done

mkdir -p /opt/zion/data/v31-standby /var/lib/zion-pool-ha
chmod 700 /opt/zion/data/v31-standby /var/lib/zion-pool-ha

if [ ! -f /etc/zion/pool-standby.env ]; then
    install -m 0600 "$HERE/pool-standby.env.example" /etc/zion/pool-standby.env
    echo ">> created /etc/zion/pool-standby.env — FILL SECRETS before enabling timers"
fi

systemctl daemon-reload
echo ">> installed. Next (runbook): fill /etc/zion/pool-standby.env, deploy"
echo ">> /opt/zion/bin/zion-pool-standby (EDGE-built binary), then:"
echo "   systemctl enable --now zion-pool-standby-sync.timer \\"
echo "                          zion-pool-standby-dbsync.timer \\"
echo "                          zion-pool-ha-watchdog.timer"
echo ">> zion-pool-standby.service stays DISABLED — manual failover only."
