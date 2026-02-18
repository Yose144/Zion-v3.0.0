#!/bin/bash
OUT="/var/www/html/dash/data.json"
mkdir -p /var/www/html/dash

# Helsinki (local)
H_STATS=$(curl -s --max-time 3 http://localhost:8444/stats 2>/dev/null || echo '{}')
H_POOL=$(curl -s --max-time 3 http://localhost:8080/stats 2>/dev/null || echo '{}')
H_MEM_USED=$(free -m | awk '/Mem:/ {print $3}')
H_MEM_TOTAL=$(free -m | awk '/Mem:/ {print $2}')
H_DISK=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
H_LOAD=$(cat /proc/loadavg | awk '{print $1}')
H_HEALTHY=$(docker ps --filter "health=healthy" --format '.' 2>/dev/null | wc -l | tr -d ' ')
H_TOTAL=$(docker ps --format '.' 2>/dev/null | wc -l | tr -d ' ')

# Germany (remote via SSH)
# P1-29: accept-new prevents MITM
DE_STATS=$(ssh -o ConnectTimeout=3 -o StrictHostKeyChecking=accept-new root@195.201.31.201 \
  'curl -s --max-time 3 http://localhost:8444/stats 2>/dev/null' 2>/dev/null || echo '{}')
DE_POOL=$(ssh -o ConnectTimeout=3 -o StrictHostKeyChecking=accept-new root@195.201.31.201 \
  'curl -s --max-time 3 http://localhost:8080/stats 2>/dev/null' 2>/dev/null || echo '{}')
DE_INFO=$(ssh -o ConnectTimeout=3 -o StrictHostKeyChecking=accept-new root@195.201.31.201 \
  'free -m | awk "/Mem:/ {printf \"%s %s\", \$3, \$2}"; echo -n " "; df / | tail -1 | awk "{printf \"%s\", \$5}" | tr -d "%"; echo -n " "; cat /proc/loadavg | awk "{print \$1}"; docker ps --format "." 2>/dev/null | wc -l | tr -d " "; docker ps --filter "health=healthy" --format "." 2>/dev/null | wc -l | tr -d " "' 2>/dev/null)
DE_MEM_USED=$(echo "$DE_INFO" | awk 'NR==1{print $1}')
DE_MEM_TOTAL=$(echo "$DE_INFO" | awk 'NR==1{print $2}')
DE_DISK=$(echo "$DE_INFO" | awk 'NR==1{print $3}')
DE_LOAD=$(echo "$DE_INFO" | awk 'NR==1{print $4}')
DE_TOTAL=$(echo "$DE_INFO" | awk 'NR==2{print $1}')
DE_HEALTHY=$(echo "$DE_INFO" | awk 'NR==3{print $1}')

# Fallback zeros
: "${DE_MEM_USED:=0}" "${DE_MEM_TOTAL:=8192}" "${DE_DISK:=0}" "${DE_LOAD:=0}"
: "${DE_TOTAL:=0}" "${DE_HEALTHY:=0}"

# Stability run
START_EPOCH=1770683895
NOW_EPOCH=$(date +%s)
ELAPSED=$(( NOW_EPOCH - START_EPOCH ))
DURATION=259200
REMAINING=$(( DURATION - ELAPSED ))
[ $REMAINING -lt 0 ] && REMAINING=0
PCT=$(( ELAPSED * 100 / DURATION ))
[ $PCT -gt 100 ] && PCT=100

# Determine status
if [ $PCT -ge 100 ]; then
  STATUS="COMPLETE"
elif [ "$H_HEALTHY" -ge 1 ] && [ "$DE_HEALTHY" -ge 1 ]; then
  STATUS="RUN"
elif [ "$H_TOTAL" -ge 1 ]; then
  STATUS="ISSUE"
else
  STATUS="DOWN"
fi

LOG_TAIL=$(tail -24 /root/stability_run.log 2>/dev/null | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | awk '{printf "%s\\n", $0}')

cat > "$OUT" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "$STATUS",
  "stability_run": {
    "start": "2026-02-10T01:38:15Z",
    "elapsed_secs": $ELAPSED,
    "remaining_secs": $REMAINING,
    "duration_secs": $DURATION,
    "progress_pct": $PCT
  },
  "helsinki": {
    "ip": "77.42.31.72",
    "stats": $H_STATS,
    "pool": $H_POOL,
    "mem": {"used": $H_MEM_USED, "total": $H_MEM_TOTAL},
    "disk": {"used_pct": $H_DISK},
    "load": $H_LOAD,
    "containers_up": $H_TOTAL,
    "containers_healthy": $H_HEALTHY
  },
  "germany": {
    "ip": "195.201.31.201",
    "stats": $DE_STATS,
    "pool": $DE_POOL,
    "mem": {"used": $DE_MEM_USED, "total": $DE_MEM_TOTAL},
    "disk": {"used_pct": $DE_DISK},
    "load": $DE_LOAD,
    "containers_up": $DE_TOTAL,
    "containers_healthy": $DE_HEALTHY
  },
  "log_tail": "$LOG_TAIL"
}
EOF
