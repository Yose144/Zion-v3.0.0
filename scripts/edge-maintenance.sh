#!/usr/bin/env bash
# ============================================================================
# ZION Edge Maintenance — RAM + Disk optimization automation
#
# Modes:
#   disk   — reclaim disk space (docker prune, apt clean, journal vacuum,
#            old log files, logrotate force)
#   ram    — check RAM pressure, drop caches, optionally restart heavy
#            non-critical services if above threshold
#   all    — disk + ram (default)
#
# Flags:
#   --dry-run   report only, no destructive action
#   --force     skip confirmation guards (for cron/timer use)
#   --verbose   extra output
#
# Exit codes:
#   0  ok (or dry-run completed)
#   1  usage error
#   2  critical service would be affected (aborted for safety)
#
# Environment variables:
#   ZION_MAINT_LOG          optional log file (defaults to logger/journal)
#   ZION_RAM_WARN_PCT       RAM usage % that triggers warning (default 80)
#   ZION_RAM_CRIT_PCT       RAM usage % that triggers action    (default 92)
#   ZION_DISK_WARN_PCT      disk usage % that triggers warning  (default 70)
#   ZION_JOURNAL_MAX        journald vacuum target              (default 200M)
#   ZION_LOG_RETAIN_DAYS    retain log files older than N days  (default 14)
#
# Designed to run via zion-edge-maintenance.timer (daily) or manually.
# Safe by default: never touches zion-edge-node1/node2/pool/bridge/dao/warp
# data directories or critical service state.
# ============================================================================

set -euo pipefail

MODE="${1:-all}"
DRY_RUN=0
FORCE=0
VERBOSE=0
shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)  DRY_RUN=1; shift ;;
    --force)    FORCE=1;   shift ;;
    --verbose|-v) VERBOSE=1; shift ;;
    --) shift; break ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

# Config ---------------------------------------------------------------------
RAM_WARN_PCT="${ZION_RAM_WARN_PCT:-80}"
RAM_CRIT_PCT="${ZION_RAM_CRIT_PCT:-92}"
DISK_WARN_PCT="${ZION_DISK_WARN_PCT:-70}"
JOURNAL_MAX="${ZION_JOURNAL_MAX:-200M}"
LOG_RETAIN_DAYS="${ZION_LOG_RETAIN_DAYS:-14}"

LOG_FILE="${ZION_MAINT_LOG:-}"

# Critical services we must NEVER restart or touch ---------------------------
CRITICAL_SERVICES=(
  zion-edge-node1
  zion-edge-node2
  zion-edge-pool
  zion-edge-bridge
  zion-edge-dao
  zion-edge-atomic-swap
  zion-edge-warp
)

# Logging --------------------------------------------------------------------
_log() {
  local level="$1"; shift
  local msg="$*"
  local ts
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local line="[$ts] [$level] [maint] $msg"
  if [[ -n "$LOG_FILE" ]]; then
    echo "$line" >> "$LOG_FILE"
  else
    echo "$line"
  fi
  if [[ "${ZION_MAINT_LOG_TO_LOGGER:-}" == "1" ]] || [[ -z "$LOG_FILE" ]]; then
    logger -t zion-maintenance "$level: $msg" 2>/dev/null || true
  fi
}
info()  { _log INFO  "$@"; }
warn()  { _log WARN  "$@"; }
err()   { _log ERROR "$@"; }

if [[ "$VERBOSE" == "1" ]] || [[ "$DRY_RUN" == "1" ]]; then
  info "mode=$MODE dry_run=$DRY_RUN force=$FORCE"
fi

# Helpers --------------------------------------------------------------------
_ram_used_pct() {
  # Used = total - available - buffers/cache counted as reclaimable
  # Use MemAvailable when present (more accurate)
  local meminfo total avail used
  meminfo="$(cat /proc/meminfo)"
  total="$(awk '/^MemTotal:/{print $2}' <<<"$meminfo")"
  avail="$(awk '/^MemAvailable:/{print $2}' <<<"$meminfo")"
  if [[ -z "$avail" ]]; then
    avail="$(awk '/^MemFree:/{print $2}' <<<"$meminfo")"
  fi
  if [[ -z "$total" ]] || [[ "$total" == "0" ]]; then echo 0; return; fi
  used=$(( total - avail ))
  echo $(( used * 100 / total ))
}

_swap_used_pct() {
  local meminfo total used
  meminfo="$(cat /proc/meminfo)"
  total="$(awk '/^SwapTotal:/{print $2}' <<<"$meminfo")"
  used="$(awk '/^SwapFree:/{print $2}' <<<"$meminfo")"
  if [[ -z "$total" ]] || [[ "$total" == "0" ]]; then echo 0; return; fi
  used=$(( total - used ))
  echo $(( used * 100 / total ))
}

_swap_total_gb() {
  awk '/^SwapTotal:/{printf "%.1f", $2/1048576}' /proc/meminfo
}

_swap_used_gb() {
  local total free
  total="$(awk '/^SwapTotal:/{print $2}' /proc/meminfo)"
  free="$(awk '/^SwapFree:/{print $2}' /proc/meminfo)"
  printf "%.1f" "$(echo "scale=1; ($total - $free) / 1048576" | bc)"
}

_disk_used_pct() {
  local pct
  pct="$(df -P / | awk 'NR==2{gsub(/%/,""); print $5}')"
  echo "${pct:-0}"
}

_disk_free_gb() {
  df -BG / | awk 'NR==2{print $4}' | tr -d 'G'
}

_run() {
  # Run a command unless dry-run; echo it in verbose/dry-run
  if [[ "$DRY_RUN" == "1" ]] || [[ "$VERBOSE" == "1" ]]; then
    info "exec: $*"
  fi
  if [[ "$DRY_RUN" == "1" ]]; then
    return 0
  fi
  "$@"
}

# ============================================================================
# DISK cleanup
# ============================================================================
do_disk() {
  info "=== DISK cleanup start ==="
  local before_pct after_pct before_free after_free reclaimed
  before_pct="$(_disk_used_pct)"
  before_free="$(_disk_free_gb)"
  info "disk before: ${before_pct}% used, ${before_free} GB free"

  # 1. Docker — prune unused images, build cache, stopped containers, volumes
  #    No until-filter: unused = no container references it. Active web image
  #    is kept automatically because its container holds a reference.
  if command -v docker >/dev/null 2>&1; then
    info "docker: pruning unused images, build cache, stopped containers, dangling volumes"
    _run docker image prune -af >/dev/null 2>&1 || true
    _run docker builder prune -af >/dev/null 2>&1 || true
    _run docker container prune -f >/dev/null 2>&1 || true
    _run docker volume prune -f >/dev/null 2>&1 || true
  else
    info "docker: not installed, skipping"
  fi

  # 2. APT — clean cache + lists
  if command -v apt-get >/dev/null 2>&1; then
    info "apt: clean cache + autoclean + autoremove"
    _run apt-get clean
    _run apt-get autoclean -y >/dev/null 2>&1 || true
    _run apt-get autoremove --purge -y >/dev/null 2>&1 || true
    _run rm -rf /var/cache/apt/archives/*.deb
  fi

  # 3. journald — vacuum to JOURNAL_MAX + vacuum-time 14d
  if command -v journalctl >/dev/null 2>&1; then
    info "journal: vacuum to ${JOURNAL_MAX} + ${LOG_RETAIN_DAYS}d"
    _run journalctl --vacuum-size="$JOURNAL_MAX" >/dev/null 2>&1 || true
    _run journalctl --vacuum-time="${LOG_RETAIN_DAYS}days" >/dev/null 2>&1 || true
  fi

  # 4. /var/log — remove rotated/compressed logs older than LOG_RETAIN_DAYS
  info "logs: removing *.gz/*.1/*.old files older than ${LOG_RETAIN_DAYS}d in /var/log"
  _run find /var/log -type f \( -name '*.gz' -o -name '*.1' -o -name '*.old' \) \
    -mtime "+${LOG_RETAIN_DAYS}" -delete 2>/dev/null || true

  # 5. syslog — truncate if bloated (>500 MB), keep last 50 MB
  local syslog_size
  syslog_size="$(stat -c%s /var/log/syslog 2>/dev/null || echo 0)"
  if [[ "$syslog_size" -gt 524288000 ]]; then
    info "syslog: bloated ($(( syslog_size / 1048576 )) MB), truncating to 50 MB tail"
    if [[ "$DRY_RUN" == "1" ]]; then
      info "exec: tail -c 52428800 /var/log/syslog > /var/log/syslog.trim && mv"
    else
      tail -c 52428800 /var/log/syslog > /var/log/syslog.trim 2>/dev/null || true
      cat /var/log/syslog.trim > /var/log/syslog 2>/dev/null || true
      rm -f /var/log/syslog.trim
    fi
  fi

  # 6. /tmp — remove files older than LOG_RETAIN_DAYS not owned by root services
  info "tmp: cleaning files older than ${LOG_RETAIN_DAYS}d in /tmp (excluding sockets)"
  _run find /tmp -type f -mtime "+${LOG_RETAIN_DAYS}" -not -name '*.sock' -delete 2>/dev/null || true

  # 7. logrotate force (if available)
  if command -v logrotate >/dev/null 2>&1; then
    info "logrotate: forcing rotation"
    _run logrotate -f /etc/logrotate.conf >/dev/null 2>&1 || true
  fi

  # 8. /root/zion-dashboard cache + /opt/zion/data transient
  info "dashboard: clearing transient cache files"
  _run find /opt/zion/data -type f -name '*.tmp' -mtime "+${LOG_RETAIN_DAYS}" -delete 2>/dev/null || true

  after_pct="$(_disk_used_pct)"
  after_free="$(_disk_free_gb)"
  reclaimed=$(( after_free - before_free ))
  info "disk after: ${after_pct}% used, ${after_free} GB free (reclaimed ${reclaimed} GB)"

  if [[ "$after_pct" -ge "$DISK_WARN_PCT" ]]; then
    warn "disk usage ${after_pct}% >= ${DISK_WARN_PCT}% threshold"
  fi
  info "=== DISK cleanup done ==="
}

# ============================================================================
# RAM optimization
# ============================================================================
do_ram() {
  info "=== RAM optimization start ==="
  local used before_used after_used swap_pct swap_total swap_used
  used="$(_ram_used_pct)"
  before_used="$used"
  swap_pct="$(_swap_used_pct)"
  swap_total="$(_swap_total_gb)"
  swap_used="$(_swap_used_gb)"
  info "ram before: ${used}% used (warn=${RAM_WARN_PCT}% crit=${RAM_CRIT_PCT}%)"
  info "swap before: ${swap_used}/${swap_total} GB (${swap_pct}% used)"

  # 1. Drop kernel caches (pagecache + dentries + inodes) — safe, kernel re-fills
  #    Always do this in --force mode (even below warn threshold) because it's
  #    cheap and frees 200-500 MB of pagecache on this server.
  info "ram: dropping kernel caches (echo 3 > /proc/sys/vm/drop_caches)"
  if [[ "$DRY_RUN" == "1" ]]; then
    info "exec: sync && echo 3 > /proc/sys/vm/drop_caches"
  else
    sync
    ( echo 3 > /proc/sys/vm/drop_caches ) 2>/dev/null || warn "drop_caches failed (need root)"
  fi

  # 2. Compact systemd journal in-memory (also helps journald RSS)
  if command -v journalctl >/dev/null 2>&1; then
    info "ram: journal vacuum to ${JOURNAL_MAX}"
    _run journalctl --vacuum-size="$JOURNAL_MAX" >/dev/null 2>&1 || true
  fi

  # 3. Docker — prune to free daemon memory
  if command -v docker >/dev/null 2>&1; then
    info "ram: docker prune (frees dockerd memory)"
    _run docker system prune -f --volumes >/dev/null 2>&1 || true
  fi

  after_used="$(_ram_used_pct)"
  local swap_after_pct swap_after_used
  swap_after_pct="$(_swap_used_pct)"
  swap_after_used="$(_swap_used_gb)"
  info "ram after drop_caches: ${after_used}% (was ${before_used}%)"
  info "swap after: ${swap_after_used}/${swap_total} GB (${swap_after_pct}%)"

  # 4. Critical threshold — restart non-critical heavy services
  #    NEVER touch CRITICAL_SERVICES. Only candidates: prometheus, pm2, etc.
  if [[ "$after_used" -ge "$RAM_CRIT_PCT" ]] && [[ "$FORCE" == "1" ]]; then
    warn "ram: CRITICAL ${after_used}% >= ${RAM_CRIT_PCT}%, restarting non-critical heavy services"
    # Prometheus can be safely restarted (resamples from exporters)
    if systemctl is-active --quiet prometheus 2>/dev/null; then
      info "ram: restarting prometheus (non-critical, resamples)"
      _run systemctl restart prometheus
    fi
    # PM2 god daemon — only if no managed app depends on it
    if systemctl is-active --quiet pm2-root 2>/dev/null; then
      info "ram: restarting pm2-root"
      _run systemctl restart pm2-root
    fi
    after_used="$(_ram_used_pct)"
    info "ram after service restarts: ${after_used}%"
  elif [[ "$after_used" -ge "$RAM_CRIT_PCT" ]] && [[ "$FORCE" == "0" ]]; then
    warn "ram: CRITICAL ${after_used}% but --force not set; skipping service restarts (run with --force or via timer)"
  fi

  if [[ "$after_used" -ge "$RAM_WARN_PCT" ]]; then
    warn "ram: still ${after_used}% >= ${RAM_WARN_PCT}% after optimization"
  else
    info "ram: now ${after_used}% (OK)"
  fi
  info "=== RAM optimization done ==="
}

# ============================================================================
# Main
# ============================================================================
case "$MODE" in
  disk) do_disk ;;
  ram)  do_ram  ;;
  all)  do_disk; do_ram ;;
  status)
    info "status: ram=$(_ram_used_pct)% disk=$(_disk_used_pct)% disk_free=$(_disk_free_gb)GB swap=$(_swap_used_pct)% swap_total=$(_swap_total_gb)GB swap_used=$(_swap_used_gb)GB"
    ;;
  *)
    echo "Usage: $0 [disk|ram|all|status] [--dry-run] [--force] [--verbose]"
    exit 1
    ;;
esac

info "maintenance complete (mode=$MODE dry_run=$DRY_RUN)"
exit 0
