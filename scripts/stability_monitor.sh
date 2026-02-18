#!/bin/bash
# ZION 72h Stability Monitor v1.0
# Sprint 1.10

LOG="/root/stability_run.log"
INTERVAL=300
DURATION=$((72 * 3600))
START=$(date +%s)
SERVER=$(hostname)

echo "============================================" >> $LOG
echo "  ZION 72h Stability Run - $SERVER" >> $LOG
echo "  Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> $LOG
echo "============================================" >> $LOG
echo "" >> $LOG

while true; do
    NOW=$(date +%s)
    ELAPSED=$(( NOW - START ))
    HOURS=$(( ELAPSED / 3600 ))
    MINS=$(( (ELAPSED % 3600) / 60 ))

    STATS=$(curl -s --max-time 5 http://localhost:8444/stats 2>/dev/null)
    HEIGHT=$(echo "$STATS" | grep -o '"height":[0-9]*' | cut -d: -f2)
    PEERS=$(echo "$STATS" | grep -o '"peers_connected":[0-9]*' | cut -d: -f2)
    DIFFICULTY=$(echo "$STATS" | grep -o '"difficulty":[0-9]*' | cut -d: -f2)
    MEMPOOL=$(echo "$STATS" | grep -o '"mempool_size":[0-9]*' | cut -d: -f2)
    STATUS=$(echo "$STATS" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    LAST_BLOCK=$(echo "$STATS" | grep -o '"time_since_last_block":[0-9]*' | cut -d: -f2)

    MEM_USED=$(free -m | awk '/Mem:/ {print $3}')
    MEM_TOTAL=$(free -m | awk '/Mem:/ {print $2}')
    MEM_PCT=$(( MEM_USED * 100 / MEM_TOTAL ))
    DISK_PCT=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
    LOAD=$(cat /proc/loadavg | awk '{print $1}')

    CONTAINERS_UP=$(docker ps --format "{{.Names}}" 2>/dev/null | wc -l)
    CONTAINERS_HEALTHY=$(docker ps --filter "health=healthy" --format "{{.Names}}" 2>/dev/null | wc -l)
    CORE_STATUS=$(docker inspect --format='{{.State.Status}}' zion-core 2>/dev/null)

    ALERT=""
    [ "$STATUS" != "healthy" ] && ALERT="${ALERT}[NODE_UNHEALTHY] "
    [ "$CORE_STATUS" != "running" ] && ALERT="${ALERT}[CORE_DOWN] "
    [ "$CONTAINERS_UP" -lt 4 ] && ALERT="${ALERT}[CONTAINER_MISSING] "
    [ -n "$LAST_BLOCK" ] && [ "$LAST_BLOCK" -gt 600 ] && ALERT="${ALERT}[STALE_${LAST_BLOCK}s] "
    [ "$MEM_PCT" -gt 90 ] && ALERT="${ALERT}[MEM_HIGH_${MEM_PCT}pct] "
    [ "$DISK_PCT" -gt 85 ] && ALERT="${ALERT}[DISK_HIGH_${DISK_PCT}pct] "

    TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    printf "%s | %02dh%02dm | H:%s P:%s D:%s MP:%s | MEM:%s/%sMB(%s%%) DISK:%s%% LOAD:%s | CTR:%s/%s | %s\n" \
        "$TIMESTAMP" "$HOURS" "$MINS" \
        "${HEIGHT:-?}" "${PEERS:-?}" "${DIFFICULTY:-?}" "${MEMPOOL:-?}" \
        "$MEM_USED" "$MEM_TOTAL" "$MEM_PCT" "$DISK_PCT" "$LOAD" \
        "$CONTAINERS_UP" "$CONTAINERS_HEALTHY" \
        "${ALERT:-OK}" >> $LOG

    if [ $ELAPSED -ge $DURATION ]; then
        echo "" >> $LOG
        echo "============================================" >> $LOG
        echo "  72h STABILITY RUN COMPLETED" >> $LOG
        echo "  Finished: $TIMESTAMP" >> $LOG
        echo "  Final height: $HEIGHT" >> $LOG
        echo "============================================" >> $LOG
        exit 0
    fi

    sleep $INTERVAL
done
