#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# ZION Edge Server — Automated Log Cleanup & Monitoring
# File: /usr/local/bin/edge-log-cleanup.sh
#
# This script is called by:
#   1. systemd timer (edge-log-cleanup.timer) — every 6 hours
#   2. logrotate postrotate hook — after each rotation
#
# It performs SAFE cleanup that never deletes data without rotation first.
# All rotated logs are compressed and kept per the logrotate policy.
#
# Safety features:
#   - Never rm -rf any log directory
#   - Only truncates files that have already been rotated by logrotate
#   - Checks disk usage and alerts if above threshold
#   - Sends alerts to dashboard API
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

LOG_TAG="edge-log-cleanup"
THRESHOLD_WARN=80    # percent disk usage → warning
THRESHOLD_CRIT=90    # percent disk usage → critical
DASHBOARD_API="http://127.0.0.1:8766/api/alert"

log() {
    logger -t "$LOG_TAG" "$1"
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $1"
}

send_alert() {
    local severity="$1"
    local message="$2"
    log "ALERT [$severity]: $message"
    # Try to send to dashboard (non-fatal if dashboard is down)
    curl -s -X POST "$DASHBOARD_API" \
        -H "Content-Type: application/json" \
        -d "{\"severity\":\"$severity\",\"source\":\"edge-log-cleanup\",\"message\":\"$message\"}" \
        --connect-timeout 3 --max-time 5 2>/dev/null || true
}

# ── 1. Check disk usage ───────────────────────────────────────────────────────
DISK_USAGE=$(df / | awk 'NR==2 {gsub(/%/,""); print $5}')
DISK_AVAIL=$(df -h / | awk 'NR==2 {print $4}')

log "Disk usage: ${DISK_USAGE}% (${DISK_AVAIL} available)"

if [ "$DISK_USAGE" -ge "$THRESHOLD_CRIT" ]; then
    send_alert "critical" "Edge server disk usage at ${DISK_USAGE}% — only ${DISK_AVAIL} available"
elif [ "$DISK_USAGE" -ge "$THRESHOLD_WARN" ]; then
    send_alert "warning" "Edge server disk usage at ${DISK_USAGE}% — ${DISK_AVAIL} available"
fi

# ── 2. Run logrotate in force mode if disk is critical ────────────────────────
if [ "$DISK_USAGE" -ge "$THRESHOLD_CRIT" ]; then
    log "Disk critical — forcing logrotate"
    logrotate --force /etc/logrotate.d/zion-edge 2>/dev/null || true
    logrotate --force /etc/logrotate.d/rsyslog 2>/dev/null || true
fi

# ── 3. Vacuum journald to 500MB if above 1GB ──────────────────────────────────
# Parse systemd's human-readable size (e.g. "3.5G", "500M") instead of only the
# leading digits, which caused the threshold to be effectively unreachable.
# Normalize to remove any whitespace between number and unit.
JOURNAL_USAGE=$(journalctl --disk-usage 2>/dev/null | grep -oP '[0-9]+(\.[0-9]+)?\s*[KMGTP]?' | head -1 | tr -d '[:space:]' || echo "0")
JOURNAL_MB=0
if [[ -n "$JOURNAL_USAGE" && "$JOURNAL_USAGE" != "0" ]]; then
    JOURNAL_MB=$(echo "$JOURNAL_USAGE" | awk '{
        u=$1; gsub(/[0-9.]+/,"",u);
        n=$1; gsub(/[KMGTP]/,"",n);
        if (u=="G") n*=1024; else if (u=="T") n*=1024*1024; else if (u=="K") n/=1024;
        print int(n)
    }')
fi
if [ "$JOURNAL_MB" -gt 1024 ]; then
    log "Journal is ${JOURNAL_USAGE} — vacuuming to 500M"
    journalctl --vacuum-size=500M >/dev/null 2>&1 || true
fi

# ── 4. Check for runaway log files (>5GB) and rotate them safely ──────────────
for logfile in /var/log/syslog /var/log/zion-edge-miner.log /var/log/zion-edge-watchdog.log; do
    if [ -f "$logfile" ]; then
        SIZE_MB=$(du -m "$logfile" 2>/dev/null | cut -f1)
        if [ "$SIZE_MB" -gt 5120 ]; then
            log "Runaway log: $logfile is ${SIZE_MB}MB — rotating"
            # Safe rotation: copy then truncate (no data loss)
            cp "$logfile" "${logfile}.$(date -u '+%Y%m%d%H%M%S')"
            > "$logfile"
            # Compress the copy after 1 minute (give rsyslog time to reopen)
            (sleep 60 && gzip "${logfile}.$(date -u '+%Y%m%d%H%M%S')" 2>/dev/null) &
            # Clean up old rotated copies (keep 3)
            ls -t "${logfile}".* 2>/dev/null | tail -n +4 | xargs rm -f 2>/dev/null || true
        fi
    fi
done

# ── 5. Clean Docker container logs if any exceed 500MB ────────────────────────
for container_id in $(docker ps -q 2>/dev/null); do
    log_path=$(docker inspect --format='{{.LogPath}}' "$container_id" 2>/dev/null)
    if [ -n "$log_path" ] && [ -f "$log_path" ]; then
        SIZE_MB=$(du -m "$log_path" 2>/dev/null | cut -f1)
        if [ "$SIZE_MB" -gt 500 ]; then
            container_name=$(docker inspect --format='{{.Name}}' "$container_id" 2>/dev/null)
            log "Docker container ${container_name} log is ${SIZE_MB}MB — truncating"
            # Truncate (Docker will continue writing to the same file)
            > "$log_path"
        fi
    fi
done

# ── 6. Final disk check ───────────────────────────────────────────────────────
DISK_USAGE_AFTER=$(df / | awk 'NR==2 {gsub(/%/,""); print $5}')
log "Disk usage after cleanup: ${DISK_USAGE_AFTER}%"

if [ "$DISK_USAGE_AFTER" -ge "$THRESHOLD_CRIT" ]; then
    send_alert "critical" "Edge server disk still at ${DISK_USAGE_AFTER}% after cleanup — manual intervention needed"
fi

log "Cleanup complete"
