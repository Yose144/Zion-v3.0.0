#!/bin/bash
# Edge server health probe — outputs key=value pairs on one line
# Installed at: /usr/local/bin/edge-health-probe.sh
# V31: adapted for V31 binary paths and service names

DISK=$(df / | awk 'NR==2{print $2","$3","$4","$5}')
MEM=$(free -m | awk 'NR==2{print $2","$3","$7}')
LOAD=$(cat /proc/loadavg | awk '{print $1","$2","$3}')
CORES=$(nproc)
UPTIME=$(awk '{print $1}' /proc/uptime)
SYSLOG=$(du -sm /var/log/syslog 2>/dev/null | cut -f1)
JOURNAL_USAGE=$(journalctl --disk-usage 2>/dev/null | grep -oP '[0-9]+(\.[0-9]+)?\s*[KMGTP]?' | head -1 | tr -d '[:space:]')
JOURNAL=0
if [[ -n "$JOURNAL_USAGE" && "$JOURNAL_USAGE" != "0" ]]; then
    JOURNAL=$(echo "$JOURNAL_USAGE" | awk '{
        u=$1; gsub(/[0-9.]+/,"",u);
        n=$1; gsub(/[KMGTP]/,"",n);
        if (u=="G") n*=1024; else if (u=="T") n*=1024*1024; else if (u=="K") n/=1024;
        print int(n)
    }')
fi
ZIONMINER=$(du -sm /var/log/zion-edge-miner.log /var/log/zion-miner.log 2>/dev/null | cut -f1 | sort -n | tail -1)
TIMER_ACTIVE=$(systemctl is-active edge-log-cleanup.timer 2>/dev/null)
TIMER_TRIGGER=$(systemctl show edge-log-cleanup.timer -p LastTriggerUSec --value 2>/dev/null)
SVCS=$(systemctl is-active zion-edge-node1 zion-edge-node2 zion-edge-pool zion-edge-bridge zion-edge-dao zion-edge-warp zion-edge-miner zion-edge-watchdog zion-edge-backup zion-edge-maintenance 2>/dev/null | paste -sd ',')
DOCKER=$(docker ps --format '{{.Names}}::{{.Status}}' 2>/dev/null | paste -sd '|')

echo "DISK=$DISK MEM=$MEM LOAD=$LOAD CORES=$CORES UPTIME=$UPTIME SYSLOG=$SYSLOG JOURNAL=$JOURNAL ZIONMINER=$ZIONMINER TIMER_ACTIVE=$TIMER_ACTIVE TIMER_TRIGGER=$TIMER_TRIGGER SVCS=$SVCS DOCKER=$DOCKER"
