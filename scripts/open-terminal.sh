#!/usr/bin/env bash
# ZION V3 — Open a visible terminal tailing all core service logs (Linux/macOS)
set -uo pipefail
source "$(dirname "$0")/_lib.sh"

# Ensure log files exist so tail doesn't error immediately
for f in node1.log node2.log pool.log miner.log; do
    touch "$LOG_DIR/$f"
done

TAIL_CMD="tail -n 200 -F '$LOG_DIR'/node1.log '$LOG_DIR'/node2.log '$LOG_DIR'/pool.log '$LOG_DIR'/miner.log"

if [[ "$ZION_OS" == "macos" ]]; then
    # macOS: open Terminal.app running the tail command
    osascript -e "tell application \"Terminal\" to do script \"$TAIL_CMD\"" >/dev/null 2>&1 \
        && { zlog "[open-terminal] Launched Terminal.app with live logs."; exit 0; }
    zlog "[open-terminal] Could not launch Terminal.app."
    exit 1
fi

# Linux: try common terminal emulators in order
for term in gnome-terminal konsole xfce4-terminal xterm; do
    if command -v "$term" >/dev/null 2>&1; then
        case "$term" in
            gnome-terminal) "$term" -- bash -c "$TAIL_CMD; exec bash" & ;;
            konsole)        "$term" -e bash -c "$TAIL_CMD; exec bash" & ;;
            xfce4-terminal) "$term" -e "bash -c \"$TAIL_CMD; exec bash\"" & ;;
            xterm)          "$term" -e bash -c "$TAIL_CMD; exec bash" & ;;
        esac
        zlog "[open-terminal] Launched $term with live logs."
        exit 0
    fi
done

zlog "[open-terminal] No terminal emulator found (tried gnome-terminal/konsole/xfce4-terminal/xterm)."
zlog "[open-terminal] Run manually: $TAIL_CMD"
exit 1
