#!/bin/bash
# Edge server health probe — outputs key=value pairs on one line
# Installed at: /usr/local/bin/edge-health-probe.sh

DISK=$(df / | awk 'NR==2{print $2","$3","$4","$5}')
MEM=$(free -m | awk 'NR==2{print $2","$3","$7}')
LOAD=$(cat /proc/loadavg | awk '{print $1","$2","$3}')
CORES=$(nproc)
UPTIME=$(awk '{print $1}' /proc/uptime)
SYSLOG=$(du -sm /var/log/syslog 2>/dev/null | cut -f1)
JOURNAL=$(journalctl --disk-usage 2>/dev/null | grep -oP '\d+' | head -1)
ZIONMINER=$(du -sm /var/log/zion-edge-miner.log 2>/dev/null | cut -f1)
TIMER_ACTIVE=$(systemctl is-active edge-log-cleanup.timer 2>/dev/null)
TIMER_TRIGGER=$(systemctl show edge-log-cleanup.timer -p LastTriggerUSec --value 2>/dev/null)
SVCS=$(systemctl is-active zion-edge-node1 zion-edge-pool zion-edge-bridge zion-edge-dao zion-edge-atomic-swap zion-edge-warp zion-edge-watchdog 2>/dev/null | paste -sd ',')
DOCKER=$(docker ps --format '{{.Names}}::{{.Status}}' 2>/dev/null | paste -sd '|')

echo "DISK=$DISK MEM=$MEM LOAD=$LOAD CORES=$CORES UPTIME=$UPTIME SYSLOG=$SYSLOG JOURNAL=$JOURNAL ZIONMINER=$ZIONMINER TIMER_ACTIVE=$TIMER_ACTIVE TIMER_TRIGGER=$TIMER_TRIGGER SVCS=$SVCS DOCKER=$DOCKER"
