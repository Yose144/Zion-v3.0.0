#!/bin/bash

# Overnight Mining Monitor - Track pool stats every 5 minutes
# This script monitors mining progress throughout the night

LOG_FILE="overnight_mining_$(date +%Y-%m-%d_%H%M%S).log"

echo "🌙 ZION OVERNIGHT MINING TEST STARTED - $(date)" | tee "$LOG_FILE"
echo "=================================================" | tee -a "$LOG_FILE"
echo "Monitoring pool statistics every 5 minutes" | tee -a "$LOG_FILE"
echo "Target: Generate block when 1000 shares reached" | tee -a "$LOG_FILE"
echo "=================================================" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Baseline time
START_TIME=$(date +%s)
LAST_SHARE_COUNT=0

# Loop for 12 hours (720 minutes)
for i in {1..144}; do
    CURRENT_TIME=$(date '+%Y-%m-%d %H:%M:%S')
    ELAPSED=$(($(date +%s) - START_TIME))
    ELAPSED_MIN=$((ELAPSED / 60))
    
    echo "[$(printf "%03d" $i)] $CURRENT_TIME (${ELAPSED_MIN} min elapsed)" | tee -a "$LOG_FILE"
    
    # Get pool stats
    echo "  📊 Querying pool database for share count..." | tee -a "$LOG_FILE"
    
    SHARE_COUNT=$(ssh root@91.98.122.165 'python3 -c "
import sqlite3
try:
    conn = sqlite3.connect(\"/root/zion_pool.db\")
    cursor = conn.cursor()
    cursor.execute(\"SELECT COUNT(*) FROM shares\")
    count = cursor.fetchone()[0]
    print(count)
    conn.close()
except:
    print(0)
" 2>/dev/null' || echo "0")
    
    SHARES_SINCE_LAST=$((SHARE_COUNT - LAST_SHARE_COUNT))
    LAST_SHARE_COUNT=$SHARE_COUNT
    
    # Get block count
    BLOCK_COUNT=$(ssh root@91.98.122.165 'curl -s -X POST http://localhost:18081/json_rpc -d "{\"jsonrpc\":\"2.0\",\"id\":\"test\",\"method\":\"getblockcount\"}" 2>/dev/null | python3 -c "import sys, json; print(json.load(sys.stdin).get(\"result\", {}).get(\"count\", 0))" 2>/dev/null' || echo "0")
    
    # Calculate shares per minute
    if [ $ELAPSED_MIN -gt 0 ]; then
        SHARES_PER_MIN=$(echo "scale=2; $SHARE_COUNT / $ELAPSED_MIN" | bc 2>/dev/null || echo "0")
    else
        SHARES_PER_MIN=0
    fi
    
    # Estimate time to 1000 shares
    if [ $(echo "$SHARES_PER_MIN > 0" | bc 2>/dev/null) -eq 1 ]; then
        REMAINING_SHARES=$((1000 - SHARE_COUNT))
        if [ $REMAINING_SHARES -le 0 ]; then
            EST_TIME="✅ GOAL REACHED!"
        else
            EST_MIN=$(echo "scale=0; $REMAINING_SHARES / $SHARES_PER_MIN" | bc 2>/dev/null || echo "?")
            EST_TIME="${EST_MIN} min"
        fi
    else
        EST_TIME="calculating..."
    fi
    
    # Format output
    echo "  ✅ Shares: $SHARE_COUNT (+$SHARES_SINCE_LAST this interval) @ ${SHARES_PER_MIN} sh/min" | tee -a "$LOG_FILE"
    echo "  📦 Blocks: $BLOCK_COUNT" | tee -a "$LOG_FILE"
    echo "  ⏱️  Est. time to 1000 shares: $EST_TIME" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    
    # Check if we reached 1000 shares
    if [ $SHARE_COUNT -ge 1000 ]; then
        echo "🎉 ============================================" | tee -a "$LOG_FILE"
        echo "🎉 SUCCESS! Reached 1000 shares at $CURRENT_TIME" | tee -a "$LOG_FILE"
        echo "🎉 Total time: ${ELAPSED_MIN} minutes" | tee -a "$LOG_FILE"
        echo "🎉 Block count: $BLOCK_COUNT" | tee -a "$LOG_FILE"
        echo "🎉 ============================================" | tee -a "$LOG_FILE"
        exit 0
    fi
    
    # Wait 5 minutes before next check
    sleep 300
done

# Report final status
FINAL_TIME=$(date '+%Y-%m-%d %H:%M:%S')
FINAL_ELAPSED=$(($(date +%s) - START_TIME))
FINAL_ELAPSED_MIN=$((FINAL_ELAPSED / 60))

echo "" | tee -a "$LOG_FILE"
echo "🌅 TEST COMPLETED - $FINAL_TIME" | tee -a "$LOG_FILE"
echo "=================================================" | tee -a "$LOG_FILE"
echo "⏱️  Duration: ${FINAL_ELAPSED_MIN} minutes" | tee -a "$LOG_FILE"
echo "📊 Final shares: $SHARE_COUNT" | tee -a "$LOG_FILE"
echo "📦 Final blocks: $BLOCK_COUNT" | tee -a "$LOG_FILE"
echo "📈 Average rate: $(echo "scale=2; $SHARE_COUNT / $FINAL_ELAPSED_MIN" | bc 2>/dev/null || echo "N/A") shares/min" | tee -a "$LOG_FILE"
echo "=================================================" | tee -a "$LOG_FILE"

echo "✅ Monitor log saved: $LOG_FILE"
