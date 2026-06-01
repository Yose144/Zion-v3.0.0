#!/usr/bin/env bash
# ZION V3 — Shared shell library for control scripts (Linux + macOS)
# Source this from any start-*/stop-* script:  source "$(dirname "$0")/_lib.sh"
#
# Provides:
#   REPO_ROOT, LOG_DIR, DATA_DIR, BIN_DIR, SCRIPTS_DIR
#   ZION_OS         = "linux" | "macos"
#   zlog <msg>      — timestamped echo
#   find_exe <name> — locate a release binary (release first, then debug)
#   start_bg <id> <exe> [args...]  — launch in background with nohup + log redirect
#   stop_match <pattern>           — pkill processes matching a path/pattern
#   default_gpu_backend            — "opencl" on Linux, "metal" on macOS

# Resolve repo paths relative to this lib (scripts/_lib.sh -> repo root)
_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$_LIB_DIR/.." && pwd)"
SCRIPTS_DIR="$_LIB_DIR"
LOG_DIR="$REPO_ROOT/logs"
DATA_DIR="$REPO_ROOT/V3/data"
BIN_DIR="$REPO_ROOT/V3/target/release"
BIN_DIR_DEBUG="$REPO_ROOT/V3/target/debug"

mkdir -p "$LOG_DIR" "$DATA_DIR"

# OS detection
case "$(uname -s)" in
    Darwin) ZION_OS="macos" ;;
    Linux)  ZION_OS="linux" ;;
    *)      ZION_OS="linux" ;;
esac

zlog() {
    printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

# Locate a built binary by name; prefer release, fall back to debug.
# Prints the path on stdout, returns 1 if not found.
find_exe() {
    local name="$1"
    if [[ -x "$BIN_DIR/$name" ]]; then
        echo "$BIN_DIR/$name"; return 0
    fi
    if [[ -x "$BIN_DIR_DEBUG/$name" ]]; then
        echo "$BIN_DIR_DEBUG/$name"; return 0
    fi
    return 1
}

# Default GPU backend by OS (cosmic-harmony: OpenCL on Linux, Metal on macOS)
default_gpu_backend() {
    if [[ "$ZION_OS" == "macos" ]]; then echo "metal"; else echo "opencl"; fi
}

# Launch a binary in the background, surviving SIGHUP, redirecting to logs/<id>.log/.err.
# Also writes a PID file to logs/<id>.pid so single-instance services that share a
# binary (e.g. node1 vs node2) can be stopped individually.
# Usage: start_bg <log-id> <exe-path> [args...]
start_bg() {
    local id="$1"; shift
    local exe="$1"; shift
    nohup "$exe" "$@" > "$LOG_DIR/$id.log" 2> "$LOG_DIR/$id.err" &
    local pid=$!
    echo "$pid" > "$LOG_DIR/$id.pid"
    zlog "Started $id  PID=$pid  exe=$exe"
    echo "$pid"
}

# Stop a service by its PID file (logs/<id>.pid). Returns 0 if a process was signalled.
# Usage: stop_pidfile <log-id> <friendly-name>
stop_pidfile() {
    local id="$1"; local name="${2:-$1}"
    local pf="$LOG_DIR/$id.pid"
    if [[ -f "$pf" ]]; then
        local pid; pid="$(cat "$pf" 2>/dev/null || true)"
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
            sleep 1
            kill -9 "$pid" 2>/dev/null || true
            zlog "[stop] $name stopped (pid $pid)"
            rm -f "$pf"
            return 0
        fi
        rm -f "$pf"
    fi
    zlog "[stop] $name no live PID file"
    return 1
}

# Stop processes whose command line matches the given pattern.
# Usage: stop_match <pattern> <friendly-name>
stop_match() {
    local pattern="$1"; local name="${2:-$1}"
    if pkill -f "$pattern" 2>/dev/null; then
        zlog "[stop] $name stopped (matched: $pattern)"
    else
        zlog "[stop] $name not running (no match: $pattern)"
    fi
}
